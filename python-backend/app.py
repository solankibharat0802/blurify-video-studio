import os
import json
import tempfile
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from supabase import create_client, Client
import requests
from typing import List, Dict, Any
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', "https://zywjsozsmnjajwirkcsu.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# In-memory storage for processing status (use Redis in production)
processing_status = {}

class BlurMask:
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get('id')
        self.x = data.get('x', 0)
        self.y = data.get('y', 0)
        self.width = data.get('width', 0)
        self.height = data.get('height', 0)
        self.start_time = data.get('startTime', 0)
        self.end_time = data.get('endTime', 0)
        self.intensity = data.get('intensity', 10)

def download_video_from_supabase(file_path: str) -> bytes:
    """Download video from Supabase storage"""
    try:
        response = supabase.storage.from_('original-videos').download(file_path)
        return response
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        raise

def upload_video_to_supabase(video_bytes: bytes, file_path: str) -> bool:
    """Upload processed video to Supabase storage"""
    try:
        supabase.storage.from_('edited-videos').upload(file_path, video_bytes)
        return True
    except Exception as e:
        logger.error(f"Error uploading video: {str(e)}")
        return False

def update_video_status(video_id: str, status: str, edited_file_path: str = None):
    """Update video status in Supabase database"""
    try:
        update_data = {'status': status}
        if edited_file_path:
            update_data['edited_file_path'] = edited_file_path
            
        supabase.table('uploadvideo').update(update_data).eq('id', video_id).execute()
        logger.info(f"Updated video {video_id} status to {status}")
    except Exception as e:
        logger.error(f"Error updating video status: {str(e)}")

def process_video_with_blur(video_bytes: bytes, blur_masks: List[BlurMask]) -> bytes:
    """
    Process video with blur effects
    Replace this with your actual video processing logic
    """
    try:
        logger.info(f"Processing video with {len(blur_masks)} blur masks")
        
        # TODO: Implement your actual video processing here
        # This is a placeholder - you would use your AI/ML model here
        # For now, we'll just return the original video
        
        # Example processing steps:
        # 1. Save video_bytes to temporary file
        # 2. Apply blur effects using your AI model
        # 3. Read processed video back to bytes
        # 4. Return processed video bytes
        
        # Placeholder: Just return original video for now
        # In real implementation, you would:
        # - Use OpenCV, FFmpeg, or your AI model
        # - Apply blur effects at specified coordinates and times
        # - Return the processed video
        
        logger.info("Video processing completed")
        return video_bytes
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/process-video', methods=['POST'])
def process_video():
    """Main video processing endpoint"""
    try:
        data = request.get_json()
        video_id = data.get('videoId')
        blur_masks_data = data.get('blurMasks', [])
        
        if not video_id:
            return jsonify({'success': False, 'message': 'Video ID is required'}), 400
            
        logger.info(f"Processing video {video_id} with {len(blur_masks_data)} blur masks")
        
        # Convert blur masks data to objects
        blur_masks = [BlurMask(mask_data) for mask_data in blur_masks_data]
        
        # Update processing status
        processing_status[video_id] = {
            'status': 'processing',
            'progress': 0,
            'started_at': datetime.now().isoformat()
        }
        
        # Get video metadata from database
        video_response = supabase.table('uploadvideo').select('*').eq('id', video_id).execute()
        
        if not video_response.data:
            return jsonify({'success': False, 'message': 'Video not found'}), 404
            
        video_data = video_response.data[0]
        original_file_path = video_data['original_file_path']
        
        # Update status to processing in database
        update_video_status(video_id, 'processing')
        
        # Update progress
        processing_status[video_id]['progress'] = 20
        
        # Download original video from Supabase
        logger.info(f"Downloading video from {original_file_path}")
        video_bytes = download_video_from_supabase(original_file_path)
        
        # Update progress
        processing_status[video_id]['progress'] = 40
        
        # Process video with blur effects
        logger.info("Starting video processing")
        processed_video_bytes = process_video_with_blur(video_bytes, blur_masks)
        
        # Update progress
        processing_status[video_id]['progress'] = 80
        
        # Generate output file path
        user_id = video_data['user_id']
        original_filename = video_data['original_filename']
        name_without_ext = os.path.splitext(original_filename)[0]
        ext = os.path.splitext(original_filename)[1]
        edited_file_path = f"{user_id}/{name_without_ext}_edited{ext}"
        
        # Upload processed video to Supabase
        logger.info(f"Uploading processed video to {edited_file_path}")
        upload_success = upload_video_to_supabase(processed_video_bytes, edited_file_path)
        
        if upload_success:
            # Update database with completed status
            update_video_status(video_id, 'completed', edited_file_path)
            processing_status[video_id] = {
                'status': 'completed',
                'progress': 100,
                'completed_at': datetime.now().isoformat()
            }
            logger.info(f"Video processing completed for {video_id}")
            return jsonify({'success': True, 'message': 'Video processed successfully'})
        else:
            # Update database with error status
            update_video_status(video_id, 'error')
            processing_status[video_id] = {
                'status': 'error',
                'progress': 0,
                'error': 'Upload failed'
            }
            return jsonify({'success': False, 'message': 'Failed to upload processed video'}), 500
            
    except Exception as e:
        logger.error(f"Error in process_video: {str(e)}")
        if video_id:
            update_video_status(video_id, 'error')
            processing_status[video_id] = {
                'status': 'error',
                'progress': 0,
                'error': str(e)
            }
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/video-status/<video_id>', methods=['GET'])
def get_video_status(video_id: str):
    """Get processing status for a specific video"""
    try:
        # Check in-memory status first
        if video_id in processing_status:
            return jsonify(processing_status[video_id])
        
        # Check database status
        video_response = supabase.table('uploadvideo').select('status').eq('id', video_id).execute()
        
        if not video_response.data:
            return jsonify({'status': 'not_found'}), 404
            
        db_status = video_response.data[0]['status']
        return jsonify({'status': db_status, 'progress': 100 if db_status == 'completed' else 0})
        
    except Exception as e:
        logger.error(f"Error getting video status: {str(e)}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/processing-queue', methods=['GET'])
def get_queue_status():
    """Get current processing queue status"""
    processing_count = len([s for s in processing_status.values() if s['status'] == 'processing'])
    return jsonify({
        'queueLength': processing_count,
        'estimatedWait': f"{processing_count * 2} minutes"  # Estimate 2 minutes per video
    })

@app.route('/cancel-processing/<video_id>', methods=['DELETE'])
def cancel_processing(video_id: str):
    """Cancel video processing"""
    try:
        if video_id in processing_status:
            processing_status[video_id]['status'] = 'cancelled'
            update_video_status(video_id, 'cancelled')
            return jsonify({'success': True, 'message': 'Processing cancelled'})
        else:
            return jsonify({'success': False, 'message': 'Video not in processing queue'}), 404
    except Exception as e:
        logger.error(f"Error cancelling processing: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/webhook/video-complete', methods=['POST'])
def video_complete_webhook():
    """Webhook endpoint for external processing completion"""
    try:
        data = request.get_json()
        video_id = data.get('videoId')
        success = data.get('success', False)
        output_path = data.get('outputPath')
        
        if success and output_path:
            update_video_status(video_id, 'completed', output_path)
        else:
            update_video_status(video_id, 'error')
            
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error in webhook: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    # Check for required environment variables
    if SUPABASE_SERVICE_KEY == "your-service-role-key-here":
        logger.warning("⚠️  Please set your actual Supabase service role key!")
        
    logger.info("Starting Flask video processing server...")
    logger.info(f"Supabase URL: {SUPABASE_URL}")
    
    # Run the Flask app
    app.run(host='127.0.0.1', port=5000, debug=True)
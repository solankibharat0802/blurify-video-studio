import os
import json
import tempfile
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import uuid
from typing import List, Dict, Any
from werkzeug.utils import secure_filename
# GIT Update
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Configure CORS broadly for dev, including Private Network Access preflight
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

# Add header for Chrome Private Network Access so public origins can reach localhost
@app.after_request
def add_pna_header(response):
    response.headers['Access-Control-Allow-Private-Network'] = 'true'  # For PNA preflight
    # Ensure CORS origin echoes back for non-credentialed requests
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = request.headers.get('Access-Control-Request-Headers', 'Content-Type')
    response.headers['Access-Control-Allow-Methods'] = request.headers.get('Access-Control-Request-Method', 'GET, POST, OPTIONS')
    return response

# Video storage configuration
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# In-memory storage for processing status (use Redis in production)
processing_status = {}
uploaded_videos = {}

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

def get_video_path(video_id: str) -> str:
    """Get the file path for a video"""
    return os.path.join(UPLOAD_FOLDER, f"{video_id}.mp4")

def get_processed_video_path(video_id: str) -> str:
    """Get the file path for processed video"""
    return os.path.join(PROCESSED_FOLDER, f"{video_id}_processed.mp4")

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

@app.route('/upload-video', methods=['POST'])
def upload_video():
    """Upload video endpoint"""
    try:
        if 'video' not in request.files:
            return jsonify({'success': False, 'message': 'No video file provided'}), 400
        
        file = request.files['video']
        video_id = request.form.get('videoId')
        
        if not video_id:
            video_id = str(uuid.uuid4())
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        # Save the uploaded file
        filename = secure_filename(f"{video_id}.mp4")
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Store video metadata
        uploaded_videos[video_id] = {
            'filename': file.filename,
            'file_path': file_path,
            'uploaded_at': datetime.now().isoformat(),
            'size': os.path.getsize(file_path)
        }
        
        logger.info(f"Video uploaded successfully: {video_id}")
        return jsonify({
            'success': True,
            'videoId': video_id,
            'message': 'Video uploaded successfully'
        })
        
    except Exception as e:
        logger.error(f"Error uploading video: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/process-video', methods=['POST'])
def process_video():
    """Main video processing endpoint"""
    try:
        data = request.get_json()
        video_id = data.get('videoId')
        blur_masks_data = data.get('blurMasks', [])
        
        if not video_id:
            return jsonify({'success': False, 'message': 'Video ID is required'}), 400
            
        # Check if video exists
        if video_id not in uploaded_videos:
            return jsonify({'success': False, 'message': 'Video not found'}), 404
            
        logger.info(f"Processing video {video_id} with {len(blur_masks_data)} blur masks")
        
        # Convert blur masks data to objects
        blur_masks = [BlurMask(mask_data) for mask_data in blur_masks_data]
        
        # Update processing status
        processing_status[video_id] = {
            'status': 'processing',
            'progress': 0,
            'started_at': datetime.now().isoformat()
        }
        
        # Get video file path
        video_file_path = uploaded_videos[video_id]['file_path']
        
        # Update progress
        processing_status[video_id]['progress'] = 20
        
        # Read original video file
        logger.info(f"Reading video from {video_file_path}")
        with open(video_file_path, 'rb') as f:
            video_bytes = f.read()
        
        # Update progress
        processing_status[video_id]['progress'] = 40
        
        # Process video with blur effects
        logger.info("Starting video processing")
        processed_video_bytes = process_video_with_blur(video_bytes, blur_masks)
        
        # Update progress
        processing_status[video_id]['progress'] = 80
        
        # Save processed video
        processed_file_path = get_processed_video_path(video_id)
        with open(processed_file_path, 'wb') as f:
            f.write(processed_video_bytes)
        
        # Update progress
        processing_status[video_id] = {
            'status': 'completed',
            'progress': 100,
            'completed_at': datetime.now().isoformat(),
            'processed_file_path': processed_file_path
        }
        
        logger.info(f"Video processing completed for {video_id}")
        return jsonify({
            'success': True, 
            'message': 'Video processed successfully',
            'downloadUrl': f'/download/{video_id}'
        })
            
    except Exception as e:
        logger.error(f"Error in process_video: {str(e)}")
        if video_id:
            processing_status[video_id] = {
                'status': 'error',
                'progress': 0,
                'error': str(e)
            }
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/download/<video_id>', methods=['GET'])
def download_processed_video(video_id: str):
    """Download processed video"""
    try:
        if video_id not in processing_status:
            return jsonify({'error': 'Video not found'}), 404
        
        status = processing_status[video_id]
        if status['status'] != 'completed':
            return jsonify({'error': 'Video processing not completed'}), 400
        
        processed_file_path = get_processed_video_path(video_id)
        if not os.path.exists(processed_file_path):
            return jsonify({'error': 'Processed video file not found'}), 404
        
        return send_file(
            processed_file_path,
            as_attachment=True,
            download_name=f"{video_id}_processed.mp4",
            mimetype='video/mp4'
        )
        
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/video-status/<video_id>', methods=['GET'])
def get_video_status(video_id: str):
    """Get processing status for a specific video"""
    try:
        # Check in-memory status first
        if video_id in processing_status:
            return jsonify(processing_status[video_id])
        
        # Check if video was uploaded
        if video_id in uploaded_videos:
            return jsonify({'status': 'uploaded', 'progress': 0})
        
        return jsonify({'status': 'not_found'}), 404
        
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
            return jsonify({'success': True, 'message': 'Processing cancelled'})
        else:
            return jsonify({'success': False, 'message': 'Video not in processing queue'}), 404
    except Exception as e:
        logger.error(f"Error cancelling processing: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask video processing server...")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Processed folder: {PROCESSED_FOLDER}")
    
    # Run the Flask app
    app.run(host='127.0.0.1', port=5000, debug=True)

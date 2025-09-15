# Video Processing Backend

Flask backend for processing videos with blur effects, integrated with Supabase.

## Setup Instructions

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your Supabase service role key:
- Go to your Supabase project settings
- Navigate to API section
- Copy the "service_role" key (not the anon key)
- Paste it in the `.env` file

### 3. Run the Server
```bash
python app.py
```

The server will start at `http://127.0.0.1:5000`

## API Endpoints

### Core Endpoints
- `POST /process-video` - Process video with blur masks
- `GET /video-status/<video_id>` - Check processing status
- `GET /health` - Health check

### Additional Endpoints
- `GET /processing-queue` - Get queue status
- `DELETE /cancel-processing/<video_id>` - Cancel processing
- `POST /webhook/video-complete` - Webhook for external completion

## Video Processing Integration

### Current Implementation
The `process_video_with_blur()` function is a placeholder. Replace it with your actual video processing logic:

```python
def process_video_with_blur(video_bytes: bytes, blur_masks: List[BlurMask]) -> bytes:
    # TODO: Implement your AI/ML video processing here
    # Example integrations:
    
    # 1. OpenCV processing
    # 2. FFmpeg with custom filters
    # 3. Machine learning models (PyTorch, TensorFlow)
    # 4. External APIs (Replicate, RunPod, etc.)
    
    return processed_video_bytes
```

### Blur Mask Data Structure
```python
class BlurMask:
    id: str           # Unique identifier
    x: int           # X coordinate (pixels)
    y: int           # Y coordinate (pixels) 
    width: int       # Width (pixels)
    height: int      # Height (pixels)
    start_time: float # Start time (seconds)
    end_time: float   # End time (seconds)
    intensity: int    # Blur intensity (1-50)
```

## Production Considerations

1. **Replace in-memory storage** with Redis or database
2. **Add authentication** for API endpoints
3. **Implement proper logging** and monitoring
4. **Add rate limiting** and request validation
5. **Use task queue** (Celery, RQ) for heavy processing
6. **Add video format validation** and conversion
7. **Implement proper error handling** and retry logic

## Debugging

- Check logs for processing errors
- Verify Supabase connectivity with `/health` endpoint
- Monitor processing status with `/video-status/<id>`
- Use `/processing-queue` to check system load

## Dependencies for Video Processing

Uncomment in `requirements.txt` based on your needs:
- `opencv-python` - For OpenCV video processing
- `ffmpeg-python` - For FFmpeg integration
- `torch` + `torchvision` - For ML models
- `transformers` - For Hugging Face models
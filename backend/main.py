from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from dotenv import load_dotenv
import logging
import time
import threading
import cv2
import numpy as np
import base64
from processors.segmentation import PersonSegmentationProcessor
from utils.video_utils import VideoFrameHandler, PerformanceMonitor
from utils.youtube_processor import YouTubeProcessor
from utils.subtitle_processor import SubtitleProcessor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'video-background-filter-secret'

# Enable CORS for WebSocket connections
cors = CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize SocketIO with CORS support
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   logger=True, engineio_logger=True)

# Global instances
segmentation_processor = None
frame_handler = VideoFrameHandler()
performance_monitor = PerformanceMonitor()
youtube_processor = YouTubeProcessor()
subtitle_processor = SubtitleProcessor()

# Processing state
active_connections = set()
current_filter = "grayscale"
processing_enabled = True

def initialize_processor():
    """Initialize the segmentation processor."""
    global segmentation_processor
    try:
        segmentation_processor = PersonSegmentationProcessor(model_selection=1)
        logger.info("Segmentation processor initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize segmentation processor: {e}")
        return False

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    try:
        processor_status = "ready" if segmentation_processor else "not_initialized"
        return jsonify({
            "status": "healthy",
            "processor_status": processor_status,
            "active_connections": len(active_connections),
            "current_filter": current_filter,
            "performance": performance_monitor.get_stats()
        }), 200
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/hello-world", methods=["GET"])
def hello_world():
    """Legacy endpoint for compatibility."""
    try:
        return jsonify({"Hello": "World"}), 200
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/filters", methods=["GET"])
def get_filters():
    """Get available background filters."""
    try:
        if segmentation_processor:
            filters = segmentation_processor.get_available_filters()
        else:
            filters = ["grayscale", "sepia", "blur", "vintage"]

        return jsonify({
            "filters": filters,
            "current_filter": current_filter
        }), 200
    except Exception as e:
        logger.error(f"Error getting filters: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/youtube/info", methods=["POST"])
def get_youtube_info():
    """Get YouTube video information without downloading."""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "No URL provided"}), 400

        url = data['url'].strip()
        if not url:
            return jsonify({"error": "Empty URL provided"}), 400

        logger.info(f"Getting YouTube info for: {url}")

        # Validate URL first
        if not youtube_processor.validate_url(url):
            return jsonify({"error": "Invalid or unsupported YouTube URL"}), 400

        # Extract video information
        info = youtube_processor.extract_video_info(url)
        if not info:
            return jsonify({"error": "Failed to extract video information"}), 400

        return jsonify({
            "success": True,
            "info": info
        }), 200

    except Exception as e:
        logger.error(f"YouTube info error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/youtube/download", methods=["POST"])
def download_youtube_video():
    """Download YouTube video and return access information."""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "No URL provided"}), 400

        url = data['url'].strip()
        if not url:
            return jsonify({"error": "Empty URL provided"}), 400

        logger.info(f"Downloading YouTube video: {url}")

        # Validate URL first
        if not youtube_processor.validate_url(url):
            return jsonify({"error": "Invalid or unsupported YouTube URL"}), 400

        # Get video info
        info = youtube_processor.extract_video_info(url)
        if not info:
            return jsonify({"error": "Failed to extract video information"}), 400

        # Download video
        video_path = youtube_processor.download_video(url)
        if not video_path:
            return jsonify({"error": "Failed to download video"}), 400

        # Generate access token/ID for the video
        video_id = info['id']

        return jsonify({
            "success": True,
            "video_id": video_id,
            "info": info,
            "message": "Video downloaded successfully"
        }), 200

    except Exception as e:
        logger.error(f"YouTube download error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/youtube/video/<video_id>", methods=["GET"])
def serve_youtube_video(video_id):
    """Serve downloaded YouTube video file."""
    try:
        # Find the video file
        video_files = list(youtube_processor.temp_dir.glob(f"{video_id}.*"))
        if not video_files:
            return jsonify({"error": "Video not found"}), 404

        video_path = video_files[0]
        if not video_path.exists():
            return jsonify({"error": "Video file not found"}), 404

        # Serve the video file
        from flask import send_file
        return send_file(
            video_path,
            mimetype='video/mp4',
            as_attachment=False,
            download_name=f"{video_id}.mp4"
        )

    except Exception as e:
        logger.error(f"Error serving YouTube video {video_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/subtitles/upload", methods=["POST"])
def upload_video_for_subtitles():
    """Upload video file and process subtitles."""
    try:
        if 'video' not in request.files:
            return jsonify({"error": "No video file provided"}), 400

        video_file = request.files['video']
        if video_file.filename == '':
            return jsonify({"error": "No video file selected"}), 400

        logger.info(f"Processing subtitles for uploaded video: {video_file.filename}")

        # Save the uploaded video
        video_path = subtitle_processor.save_uploaded_video(video_file)

        # Generate video ID
        video_id = subtitle_processor.get_video_id_from_path(video_path)

        # Process subtitles in background (could be made async for better UX)
        subtitles = subtitle_processor.process_video_subtitles(video_path)

        return jsonify({
            "success": True,
            "video_id": video_id,
            "subtitle_count": len(subtitles),
            "message": "Video uploaded and subtitles processed successfully"
        }), 200

    except Exception as e:
        logger.error(f"Upload video for subtitles error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/subtitles/<video_id>", methods=["GET"])
def get_video_subtitles(video_id):
    """Get subtitles for a video by ID."""
    try:
        logger.info(f"Getting subtitles for video: {video_id}")

        # Check if this is a YouTube video
        youtube_video_files = list(youtube_processor.temp_dir.glob(f"{video_id}.*"))
        if youtube_video_files:
            video_path = str(youtube_video_files[0])
            logger.info(f"Processing YouTube video: {video_path}")
        else:
            # Check for uploaded video - try different patterns
            video_files = []

            # Try exact match first
            exact_matches = list(subtitle_processor.temp_dir.glob(f"*{video_id}*"))
            video_files.extend([f for f in exact_matches if not f.name.endswith(('.json', '.wav'))])

            # If no exact match, try partial match (in case ID generation differs)
            if not video_files:
                all_videos = list(subtitle_processor.temp_dir.glob("upload_*"))
                video_files = [f for f in all_videos if not f.name.endswith(('.json', '.wav'))]

                # Log available files for debugging
                logger.info(f"Available video files: {[f.name for f in video_files]}")

            if not video_files:
                return jsonify({"error": "Video not found"}), 404

            video_path = str(video_files[0])
            logger.info(f"Using video file: {video_path}")

        # Check for cached subtitles first
        cached_subtitles = subtitle_processor.get_cached_subtitles(video_id)
        if cached_subtitles:
            logger.info(f"Returning cached subtitles for {video_id}")
            return jsonify({
                "success": True,
                "video_id": video_id,
                "subtitles": cached_subtitles,
                "cached": True
            }), 200

        # Process subtitles
        subtitles = subtitle_processor.process_video_subtitles(video_path)

        return jsonify({
            "success": True,
            "video_id": video_id,
            "subtitles": subtitles,
            "cached": False
        }), 200

    except Exception as e:
        logger.error(f"Get subtitles error for {video_id}: {e}")
        return jsonify({"error": str(e)}), 500


@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    try:
        session_id = request.sid
        active_connections.add(session_id)
        logger.info(f"Client connected: {session_id}, total connections: {len(active_connections)}")

        # Send connection confirmation
        emit('connection_ready', {
            'session_id': session_id,
            'server_info': {
                'processor_ready': segmentation_processor is not None,
                'available_filters': segmentation_processor.get_available_filters() if segmentation_processor else [],
                'current_filter': current_filter
            }
        })

    except Exception as e:
        logger.error(f"Connection error: {e}")
        emit('connection_error', {'error': str(e)})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    try:
        session_id = request.sid
        active_connections.discard(session_id)
        logger.info(f"Client disconnected: {session_id}, remaining connections: {len(active_connections)}")
    except Exception as e:
        logger.error(f"Disconnection error: {e}")

@socketio.on('video_frame')
def handle_video_frame(data):
    """Handle incoming video frame for processing."""
    try:
        start_time = time.time()

        if not segmentation_processor:
            emit('processing_error', {
                'error': 'Segmentation processor not initialized',
                'timestamp': time.time()
            })
            return

        if not processing_enabled:
            return

        # Extract frame data
        frame_data = data.get('frame')
        timestamp = data.get('timestamp', time.time())
        filter_type = data.get('filter_type', current_filter)

        if not frame_data:
            emit('processing_error', {
                'error': 'No frame data provided',
                'timestamp': timestamp
            })
            return

        # Convert base64 to frame
        frame = frame_handler.base64_to_frame(frame_data)
        if frame is None:
            emit('processing_error', {
                'error': 'Failed to decode frame',
                'timestamp': timestamp
            })
            return

        # Optimize frame for processing
        optimized_frame = frame_handler.apply_frame_optimization(frame, max_dimension=720)

        # Process frame
        processing_start = time.time()
        processed_frame, mask = segmentation_processor.process_frame(optimized_frame, filter_type)
        processing_time = (time.time() - processing_start) * 1000

        # Convert processed frame back to base64
        processed_base64 = frame_handler.frame_to_base64(processed_frame, quality=85)
        if processed_base64 is None:
            emit('processing_error', {
                'error': 'Failed to encode processed frame',
                'timestamp': timestamp
            })
            return

        # Calculate timing metrics
        total_time = (time.time() - start_time) * 1000
        performance_monitor.add_frame_time(total_time)
        performance_monitor.add_processing_time(processing_time)

        # Send processed frame back
        emit('processed_frame', {
            'frame': processed_base64,
            'timestamp': timestamp,
            'processing_time_ms': round(processing_time, 2),
            'total_time_ms': round(total_time, 2),
            'filter_type': filter_type
        })

    except Exception as e:
        logger.error(f"Frame processing error: {e}")
        emit('processing_error', {
            'error': str(e),
            'timestamp': time.time()
        })

@socketio.on('filter_change')
def handle_filter_change(data):
    """Handle filter change request."""
    try:
        global current_filter

        new_filter = data.get('type', 'grayscale')
        intensity = data.get('intensity', 1.0)

        if segmentation_processor and new_filter in segmentation_processor.get_available_filters():
            current_filter = new_filter
            logger.info(f"Filter changed to: {current_filter}")

            # Broadcast filter change to all connected clients
            socketio.emit('filter_changed', {
                'filter_type': current_filter,
                'intensity': intensity,
                'timestamp': time.time()
            })
        else:
            emit('processing_error', {
                'error': f'Invalid filter type: {new_filter}',
                'timestamp': time.time()
            })

    except Exception as e:
        logger.error(f"Filter change error: {e}")
        emit('processing_error', {
            'error': str(e),
            'timestamp': time.time()
        })

@socketio.on('toggle_processing')
def handle_toggle_processing(data):
    """Handle processing enable/disable."""
    try:
        global processing_enabled
        processing_enabled = data.get('enabled', True)

        logger.info(f"Processing {'enabled' if processing_enabled else 'disabled'}")

        socketio.emit('processing_toggled', {
            'enabled': processing_enabled,
            'timestamp': time.time()
        })

    except Exception as e:
        logger.error(f"Toggle processing error: {e}")
        emit('processing_error', {
            'error': str(e),
            'timestamp': time.time()
        })

@socketio.on('get_performance_stats')
def handle_get_performance_stats():
    """Handle performance stats request."""
    try:
        stats = performance_monitor.get_stats()
        emit('performance_stats', {
            'stats': stats,
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Performance stats error: {e}")
        emit('processing_error', {
            'error': str(e),
            'timestamp': time.time()
        })

def cleanup_resources():
    """Clean up resources on shutdown."""
    global segmentation_processor
    if segmentation_processor:
        segmentation_processor.cleanup()
        segmentation_processor = None
    logger.info("Resources cleaned up")

if __name__ == "__main__":
    try:
        # Initialize the segmentation processor
        if not initialize_processor():
            logger.error("Failed to initialize processor, server may not function properly")

        # Start the server
        logger.info("Starting video background filter server on port 8080")
        socketio.run(app, host='0.0.0.0', port=8080, debug=True, use_reloader=False)

    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    finally:
        cleanup_resources()

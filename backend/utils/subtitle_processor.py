"""
Subtitle extraction processor using Whisper for speech-to-text conversion.
"""

import os
import tempfile
import logging
from typing import List, Dict, Any, Optional
import whisper
import json
from pathlib import Path
from pydub import AudioSegment
import hashlib

logger = logging.getLogger(__name__)

class SubtitleProcessor:
    """Handle subtitle extraction from video files using Whisper."""

    def __init__(self, temp_dir: Optional[str] = None):
        """
        Initialize subtitle processor.

        Args:
            temp_dir: Directory for temporary files. If None, uses system temp.
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.temp_dir = Path(self.temp_dir) / "video_processor_subtitles"
        self.temp_dir.mkdir(exist_ok=True)

        # Initialize Whisper model (base model for good balance of speed/accuracy)
        self.model = None
        self.model_size = "base"

        logger.info(f"SubtitleProcessor initialized with temp_dir: {self.temp_dir}")

    def _load_model(self):
        """Lazy load Whisper model."""
        if self.model is None:
            logger.info(f"Loading Whisper model: {self.model_size}")
            self.model = whisper.load_model(self.model_size)

    def extract_audio_from_video(self, video_path: str) -> str:
        """
        Extract audio from video file.

        Args:
            video_path: Path to video file

        Returns:
            Path to extracted audio file
        """
        try:
            # Generate audio file path
            video_hash = hashlib.md5(video_path.encode()).hexdigest()[:8]
            audio_path = self.temp_dir / f"{video_hash}_audio.wav"

            if audio_path.exists():
                logger.info(f"Using cached audio: {audio_path}")
                return str(audio_path)

            logger.info(f"Extracting audio from: {video_path}")

            # Load video and extract audio
            audio = AudioSegment.from_file(video_path)

            # Convert to mono and 16kHz (optimal for Whisper)
            audio = audio.set_channels(1).set_frame_rate(16000)

            # Export as WAV
            audio.export(str(audio_path), format="wav")

            logger.info(f"Audio extracted to: {audio_path}")
            return str(audio_path)

        except Exception as e:
            logger.error(f"Failed to extract audio from {video_path}: {e}")
            raise

    def transcribe_audio(self, audio_path: str) -> List[Dict[str, Any]]:
        """
        Transcribe audio to subtitles with timestamps.

        Args:
            audio_path: Path to audio file

        Returns:
            List of subtitle segments with start, end, and text
        """
        try:
            self._load_model()

            logger.info(f"Transcribing audio: {audio_path}")

            # Transcribe with word-level timestamps
            result = self.model.transcribe(
                audio_path,
                word_timestamps=True,
                verbose=False
            )

            subtitles = []

            # Process segments
            for segment in result.get("segments", []):
                subtitle = {
                    "start": round(segment["start"], 2),
                    "end": round(segment["end"], 2),
                    "text": segment["text"].strip()
                }

                # Skip very short or empty segments
                if subtitle["text"] and (subtitle["end"] - subtitle["start"]) > 0.5:
                    subtitles.append(subtitle)

            logger.info(f"Generated {len(subtitles)} subtitle segments")
            return subtitles

        except Exception as e:
            logger.error(f"Failed to transcribe audio {audio_path}: {e}")
            raise

    def process_video_subtitles_no_cache(self, video_path: str) -> List[Dict[str, Any]]:
        """
        Extract subtitles from video file without caching (always fresh processing).

        Args:
            video_path: Path to video file

        Returns:
            List of subtitle segments
        """
        try:
            logger.info(f"Processing subtitles for video: {video_path}")

            # Extract audio from video
            audio_path = self.extract_audio_from_video(video_path)

            # Transcribe audio to subtitles
            subtitles = self.transcribe_audio(audio_path)

            logger.info(f"Generated {len(subtitles)} subtitle segments for {video_path}")
            return subtitles

        except Exception as e:
            logger.error(f"Failed to process subtitles for {video_path}: {e}")
            return []

    def process_video_subtitles(self, video_path: str) -> List[Dict[str, Any]]:
        """
        Extract subtitles from video file (legacy method - kept for compatibility).
        Now calls the no-cache version for consistency.

        Args:
            video_path: Path to video file

        Returns:
            List of subtitle segments
        """
        return self.process_video_subtitles_no_cache(video_path)

    def get_video_id_from_path(self, video_path: str) -> str:
        """Generate a unique ID for video based on file path."""
        return hashlib.md5(video_path.encode()).hexdigest()[:12]

    def save_uploaded_video_with_id(self, video_file, video_id: str) -> str:
        """
        Save uploaded video file with specific ID and return path.

        Args:
            video_file: Uploaded file object
            video_id: Unique video identifier

        Returns:
            Path to saved video file
        """
        try:
            # Generate filename with provided ID
            original_filename = getattr(video_file, 'filename', 'uploaded_video')
            file_ext = Path(original_filename).suffix or '.mp4'
            video_filename = f"upload_{video_id}{file_ext}"

            video_path = self.temp_dir / video_filename

            # Save video file
            video_file.save(str(video_path))

            logger.info(f"Video saved to: {video_path} with ID: {video_id}")
            return str(video_path)

        except Exception as e:
            logger.error(f"Failed to save uploaded video with ID {video_id}: {e}")
            raise

    def save_uploaded_video(self, video_file) -> str:
        """
        Save uploaded video file and return path (legacy method).

        Args:
            video_file: Uploaded file object

        Returns:
            Path to saved video file
        """
        try:
            # Generate unique filename
            original_filename = getattr(video_file, 'filename', 'uploaded_video')
            file_hash = hashlib.md5(original_filename.encode()).hexdigest()[:8]
            file_ext = Path(original_filename).suffix or '.mp4'
            video_filename = f"upload_{file_hash}{file_ext}"

            video_path = self.temp_dir / video_filename

            # Save video file
            video_file.save(str(video_path))

            logger.info(f"Video saved to: {video_path}")
            return str(video_path)

        except Exception as e:
            logger.error(f"Failed to save uploaded video: {e}")
            raise

    def download_remote_video(self, video_url: str, video_id: str) -> str:
        """
        Download remote video URL temporarily for subtitle processing.

        Args:
            video_url: Remote video URL
            video_id: Unique video identifier

        Returns:
            Path to downloaded video file
        """
        try:
            import requests
            from urllib.parse import urlparse

            logger.info(f"Downloading remote video: {video_url}")

            # Parse URL to get file extension
            parsed_url = urlparse(video_url)
            file_ext = Path(parsed_url.path).suffix or '.mp4'
            
            # Create filename with video ID
            video_filename = f"remote_{video_id}{file_ext}"
            video_path = self.temp_dir / video_filename

            # Check if already downloaded
            if video_path.exists() and video_path.stat().st_size > 0:
                logger.info(f"Using cached remote video: {video_path}")
                return str(video_path)

            # Download the video
            response = requests.get(video_url, stream=True, timeout=30)
            response.raise_for_status()

            # Save video file
            with open(video_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f"Remote video downloaded to: {video_path}")
            return str(video_path)

        except Exception as e:
            logger.error(f"Failed to download remote video {video_url}: {e}")
            raise

    def cleanup_old_files(self, max_age_hours: int = 24):
        """
        Clean up old processed files.

        Args:
            max_age_hours: Maximum age of files to keep in hours
        """
        try:
            import time
            current_time = time.time()

            for file_path in self.temp_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_hours * 3600:
                        file_path.unlink()
                        logger.info(f"Cleaned up old file: {file_path}")

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    def get_cached_subtitles(self, video_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached subtitles for video ID.

        Args:
            video_id: Video identifier

        Returns:
            Cached subtitles or None if not found
        """
        try:
            subtitles_cache_path = self.temp_dir / f"{video_id}_subtitles.json"

            if subtitles_cache_path.exists():
                with open(subtitles_cache_path, 'r') as f:
                    return json.load(f)

        except Exception as e:
            logger.error(f"Error loading cached subtitles for {video_id}: {e}")

        return None
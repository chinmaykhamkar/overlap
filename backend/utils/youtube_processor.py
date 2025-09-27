"""
YouTube video processing utility using yt-dlp for video extraction.
"""

import os
import tempfile
import logging
from typing import Optional, Dict, Any
import yt_dlp
from pathlib import Path

logger = logging.getLogger(__name__)

class YouTubeProcessor:
    """Handle YouTube video extraction and processing."""

    def __init__(self, temp_dir: Optional[str] = None):
        """
        Initialize YouTube processor.

        Args:
            temp_dir: Directory for temporary video files. If None, uses system temp.
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.temp_dir = Path(self.temp_dir) / "video_processor_youtube"
        self.temp_dir.mkdir(exist_ok=True)

        # yt-dlp options for optimal video extraction
        self.ydl_opts = {
            'format': 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best',
            'outtmpl': str(self.temp_dir / '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'extractaudio': False,
            'audioformat': 'mp4',
            'embed_chapters': False,
            'embed_info_json': False,
            'writesubtitles': False,
            'writeautomaticsub': False,
        }

        logger.info(f"YouTubeProcessor initialized with temp_dir: {self.temp_dir}")

    def extract_video_info(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Extract video information without downloading.

        Args:
            url: YouTube URL (video or shorts)

        Returns:
            Dict with video information or None if failed
        """
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)

                return {
                    'id': info.get('id'),
                    'title': info.get('title'),
                    'duration': info.get('duration'),
                    'thumbnail': info.get('thumbnail'),
                    'width': info.get('width'),
                    'height': info.get('height'),
                    'uploader': info.get('uploader'),
                    'view_count': info.get('view_count'),
                    'description': info.get('description', '')[:200] + '...' if info.get('description') else '',
                }

        except Exception as e:
            logger.error(f"Failed to extract video info for {url}: {e}")
            return None

    def download_video(self, url: str) -> Optional[str]:
        """
        Download YouTube video and return local file path.

        Args:
            url: YouTube URL (video or shorts)

        Returns:
            Local file path to downloaded video or None if failed
        """
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                # Extract info to get video ID
                info = ydl.extract_info(url, download=False)
                video_id = info.get('id')

                if not video_id:
                    logger.error(f"Could not extract video ID from {url}")
                    return None

                # Check if already downloaded
                potential_files = list(self.temp_dir.glob(f"{video_id}.*"))
                if potential_files:
                    existing_file = potential_files[0]
                    if existing_file.exists() and existing_file.stat().st_size > 0:
                        logger.info(f"Using cached video: {existing_file}")
                        return str(existing_file)

                # Download the video
                logger.info(f"Downloading YouTube video: {video_id}")
                ydl.download([url])

                # Find the downloaded file
                downloaded_files = list(self.temp_dir.glob(f"{video_id}.*"))
                if downloaded_files:
                    video_path = downloaded_files[0]
                    logger.info(f"Successfully downloaded: {video_path}")
                    return str(video_path)
                else:
                    logger.error(f"Downloaded file not found for {video_id}")
                    return None

        except Exception as e:
            logger.error(f"Failed to download video from {url}: {e}")
            return None

    def validate_url(self, url: str) -> bool:
        """
        Validate if URL is a supported YouTube URL.

        Args:
            url: URL to validate

        Returns:
            True if valid YouTube URL, False otherwise
        """
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                ydl.extract_info(url, download=False)
                return True
        except:
            return False

    def cleanup_old_files(self, max_age_hours: int = 24):
        """
        Clean up old downloaded video files.

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

    def get_video_stream_url(self, url: str) -> Optional[str]:
        """
        Get direct video stream URL for immediate playback.

        Args:
            url: YouTube URL

        Returns:
            Direct video stream URL or None if failed
        """
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

                # Get the best format URL
                if 'formats' in info:
                    # Try to find mp4 format first
                    for fmt in info['formats']:
                        if fmt.get('ext') == 'mp4' and fmt.get('url'):
                            return fmt['url']

                    # Fallback to any format with URL
                    for fmt in info['formats']:
                        if fmt.get('url'):
                            return fmt['url']

                # Fallback to main URL
                return info.get('url')

        except Exception as e:
            logger.error(f"Failed to get stream URL for {url}: {e}")
            return None
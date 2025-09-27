"""
Video processing utilities for frame handling and conversion.
"""

import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

class VideoFrameHandler:
    """Utilities for handling video frame conversion and processing."""

    @staticmethod
    def base64_to_frame(base64_str: str) -> Optional[np.ndarray]:
        """
        Convert base64 encoded image string to OpenCV frame.

        Args:
            base64_str: Base64 encoded image string

        Returns:
            OpenCV frame as numpy array or None if conversion fails
        """
        try:
            # Remove data URL prefix if present
            if base64_str.startswith('data:image'):
                base64_str = base64_str.split(',')[1]

            # Decode base64 to bytes
            image_bytes = base64.b64decode(base64_str)

            # Convert to PIL Image
            pil_image = Image.open(BytesIO(image_bytes))

            # Convert to RGB if needed
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')

            # Convert to numpy array
            frame = np.array(pil_image)

            # Convert RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

            return frame_bgr

        except Exception as e:
            logger.error(f"Error converting base64 to frame: {e}")
            return None

    @staticmethod
    def frame_to_base64(frame: np.ndarray, quality: int = 85) -> Optional[str]:
        """
        Convert OpenCV frame to base64 encoded string.

        Args:
            frame: OpenCV frame as numpy array
            quality: JPEG quality (1-100)

        Returns:
            Base64 encoded image string or None if conversion fails
        """
        try:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Convert to PIL Image
            pil_image = Image.fromarray(frame_rgb)

            # Save to bytes buffer
            buffer = BytesIO()
            pil_image.save(buffer, format='JPEG', quality=quality, optimize=True)
            buffer.seek(0)

            # Encode to base64
            base64_str = base64.b64encode(buffer.read()).decode('utf-8')

            return f"data:image/jpeg;base64,{base64_str}"

        except Exception as e:
            logger.error(f"Error converting frame to base64: {e}")
            return None

    @staticmethod
    def resize_frame(frame: np.ndarray, target_width: int = None, target_height: int = None,
                    maintain_aspect: bool = True) -> np.ndarray:
        """
        Resize frame to target dimensions.

        Args:
            frame: Input frame
            target_width: Target width in pixels
            target_height: Target height in pixels
            maintain_aspect: Whether to maintain aspect ratio

        Returns:
            Resized frame
        """
        try:
            height, width = frame.shape[:2]

            if target_width is None and target_height is None:
                return frame

            if maintain_aspect:
                # Calculate aspect ratio
                aspect_ratio = width / height

                if target_width is not None and target_height is None:
                    target_height = int(target_width / aspect_ratio)
                elif target_height is not None and target_width is None:
                    target_width = int(target_height * aspect_ratio)
                else:
                    # Both specified, choose dimension that maintains aspect ratio
                    ratio_w = target_width / width
                    ratio_h = target_height / height
                    ratio = min(ratio_w, ratio_h)
                    target_width = int(width * ratio)
                    target_height = int(height * ratio)

            resized = cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_AREA)
            return resized

        except Exception as e:
            logger.error(f"Error resizing frame: {e}")
            return frame

    @staticmethod
    def validate_frame(frame: np.ndarray) -> bool:
        """
        Validate if frame is a valid image array.

        Args:
            frame: Frame to validate

        Returns:
            True if frame is valid, False otherwise
        """
        if frame is None:
            return False

        if not isinstance(frame, np.ndarray):
            return False

        if frame.size == 0:
            return False

        if len(frame.shape) not in [2, 3]:
            return False

        if len(frame.shape) == 3 and frame.shape[2] not in [1, 3, 4]:
            return False

        return True

    @staticmethod
    def apply_frame_optimization(frame: np.ndarray, max_dimension: int = 720) -> np.ndarray:
        """
        Apply optimization to frame for better processing performance.

        Args:
            frame: Input frame
            max_dimension: Maximum dimension (width or height) for the frame

        Returns:
            Optimized frame
        """
        try:
            height, width = frame.shape[:2]
            max_current = max(height, width)

            if max_current > max_dimension:
                scale = max_dimension / max_current
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

            return frame

        except Exception as e:
            logger.error(f"Error optimizing frame: {e}")
            return frame

class PerformanceMonitor:
    """Monitor processing performance and provide metrics."""

    def __init__(self):
        self.frame_times = []
        self.processing_times = []
        self.max_history = 100

    def add_frame_time(self, time_ms: float):
        """Add frame processing time."""
        self.frame_times.append(time_ms)
        if len(self.frame_times) > self.max_history:
            self.frame_times.pop(0)

    def add_processing_time(self, time_ms: float):
        """Add processing time."""
        self.processing_times.append(time_ms)
        if len(self.processing_times) > self.max_history:
            self.processing_times.pop(0)

    def get_avg_frame_time(self) -> float:
        """Get average frame time."""
        if not self.frame_times:
            return 0.0
        return sum(self.frame_times) / len(self.frame_times)

    def get_avg_processing_time(self) -> float:
        """Get average processing time."""
        if not self.processing_times:
            return 0.0
        return sum(self.processing_times) / len(self.processing_times)

    def get_fps(self) -> float:
        """Get estimated FPS."""
        avg_time = self.get_avg_frame_time()
        if avg_time == 0:
            return 0.0
        return 1000.0 / avg_time

    def get_stats(self) -> dict:
        """Get performance statistics."""
        return {
            'avg_frame_time_ms': round(self.get_avg_frame_time(), 2),
            'avg_processing_time_ms': round(self.get_avg_processing_time(), 2),
            'estimated_fps': round(self.get_fps(), 1),
            'frames_processed': len(self.frame_times)
        }
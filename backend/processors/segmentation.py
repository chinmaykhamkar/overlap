"""
MediaPipe-based person segmentation for video background filtering.
"""

import cv2
import numpy as np
import mediapipe as mp
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class PersonSegmentationProcessor:
    """
    High-quality person segmentation using MediaPipe's selfie segmentation model.
    Optimized for real-time video processing with background filtering capabilities.
    """

    def __init__(self, model_selection: int = 1):
        """
        Initialize the segmentation processor.

        Args:
            model_selection: 0 for general model (256x256), 1 for landscape model (256x144)
        """
        self.mp_selfie_segmentation = mp.solutions.selfie_segmentation
        self.mp_drawing_utils = mp.solutions.drawing_utils

        # Initialize the segmentation model
        self.selfie_segmentation = self.mp_selfie_segmentation.SelfieSegmentation(
            model_selection=model_selection
        )

        # Processing parameters
        self.blur_kernel_size = 5
        self.threshold = 0.5
        self.edge_smoothing = True

        logger.info(f"PersonSegmentationProcessor initialized with model_selection={model_selection}")

    def process_frame(self, frame: np.ndarray, filter_type: str = "grayscale") -> Tuple[np.ndarray, np.ndarray]:
        """
        Process a single video frame to apply background filtering while preserving the person.

        Args:
            frame: Input video frame as numpy array (BGR format)
            filter_type: Type of background filter to apply ("grayscale", "sepia", "blur")

        Returns:
            Tuple of (processed_frame, segmentation_mask)
        """
        if frame is None or frame.size == 0:
            raise ValueError("Invalid input frame")

        try:
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Generate segmentation mask
            results = self.selfie_segmentation.process(rgb_frame)

            if results.segmentation_mask is None:
                logger.warning("No segmentation mask generated")
                return frame, np.zeros(frame.shape[:2], dtype=np.uint8)

            # Create binary mask
            mask = results.segmentation_mask
            binary_mask = (mask > self.threshold).astype(np.uint8)

            # Apply edge smoothing
            if self.edge_smoothing:
                binary_mask = self._smooth_mask_edges(binary_mask)

            # Apply background filter
            filtered_frame = self._apply_background_filter(frame, binary_mask, filter_type)

            return filtered_frame, binary_mask

        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            return frame, np.zeros(frame.shape[:2], dtype=np.uint8)

    def _smooth_mask_edges(self, mask: np.ndarray) -> np.ndarray:
        """Apply edge smoothing to the segmentation mask."""
        # Gaussian blur to smooth edges
        smooth_mask = cv2.GaussianBlur(mask.astype(np.float32),
                                     (self.blur_kernel_size, self.blur_kernel_size), 0)

        # Morphological operations to clean up the mask
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        smooth_mask = cv2.morphologyEx(smooth_mask, cv2.MORPH_CLOSE, kernel)

        return smooth_mask

    def _apply_background_filter(self, frame: np.ndarray, mask: np.ndarray, filter_type: str) -> np.ndarray:
        """Apply the specified filter to the background while preserving the person."""
        # Create 3-channel mask
        if len(mask.shape) == 2:
            mask_3d = np.stack([mask] * 3, axis=-1)
        else:
            mask_3d = mask

        # Normalize mask to [0, 1]
        if mask_3d.dtype != np.float32:
            mask_3d = mask_3d.astype(np.float32)
        if mask_3d.max() > 1.0:
            mask_3d = mask_3d / 255.0

        # Create filtered background
        filtered_background = self._create_filtered_background(frame, filter_type)

        # Composite: person (original) + filtered background
        result = (mask_3d * frame.astype(np.float32) +
                 (1 - mask_3d) * filtered_background.astype(np.float32))

        return result.astype(np.uint8)

    def _create_filtered_background(self, frame: np.ndarray, filter_type: str) -> np.ndarray:
        """Create the filtered version of the background."""
        if filter_type == "grayscale":
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

        elif filter_type == "sepia":
            # Sepia transformation matrix
            sepia_kernel = np.array([
                [0.272, 0.534, 0.131],
                [0.349, 0.686, 0.168],
                [0.393, 0.769, 0.189]
            ])
            sepia_frame = cv2.transform(frame, sepia_kernel)
            return np.clip(sepia_frame, 0, 255)

        elif filter_type == "blur":
            return cv2.GaussianBlur(frame, (21, 21), 0)

        elif filter_type == "vintage":
            # Vintage effect: desaturate + warm tint
            vintage = frame.copy().astype(np.float32)
            vintage[:,:,0] *= 0.9  # Reduce blue
            vintage[:,:,1] *= 1.1  # Enhance green
            vintage[:,:,2] *= 1.2  # Enhance red
            return np.clip(vintage, 0, 255).astype(np.uint8)

        else:
            logger.warning(f"Unknown filter type: {filter_type}, using grayscale")
            return self._create_filtered_background(frame, "grayscale")

    def set_parameters(self, threshold: float = None, blur_kernel_size: int = None,
                      edge_smoothing: bool = None):
        """Update processing parameters."""
        if threshold is not None:
            self.threshold = max(0.0, min(1.0, threshold))
        if blur_kernel_size is not None:
            self.blur_kernel_size = max(3, blur_kernel_size | 1)  # Ensure odd number
        if edge_smoothing is not None:
            self.edge_smoothing = edge_smoothing

        logger.info(f"Parameters updated: threshold={self.threshold}, "
                   f"blur_kernel_size={self.blur_kernel_size}, edge_smoothing={self.edge_smoothing}")

    def get_available_filters(self) -> list:
        """Return list of available background filters."""
        return ["grayscale", "sepia", "blur", "vintage"]

    def cleanup(self):
        """Clean up resources."""
        if hasattr(self, 'selfie_segmentation'):
            self.selfie_segmentation.close()
        logger.info("PersonSegmentationProcessor cleaned up")
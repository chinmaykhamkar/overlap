// Legacy face detection interface (for compatibility)
export interface FaceDetection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
}

// Video processing types
export interface ProcessedFrameData {
  frame: string;
  timestamp: number;
  processing_time_ms: number;
  total_time_ms: number;
  filter_type: string;
}

export interface ProcessingError {
  error: string;
  timestamp: number;
}

export interface ServerInfo {
  processor_ready: boolean;
  available_filters: string[];
  current_filter: string;
}

export interface PerformanceStats {
  avg_frame_time_ms: number;
  avg_processing_time_ms: number;
  estimated_fps: number;
  frames_processed: number;
}

// WebSocket hook types
export interface UseWebSocketProps {
  url: string;
  onProcessedFrame?: (data: ProcessedFrameData) => void;
  onProcessingError?: (error: ProcessingError) => void;
  onConnectionReady?: (serverInfo: ServerInfo) => void;
  onFilterChanged?: (filterType: string, intensity: number) => void;
}

export interface WebSocketState {
  connected: boolean;
  socket: any | null;
  error: string | null;
  reconnecting: boolean;
}
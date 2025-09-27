import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { useWebSocket } from '../hooks/useWebSocket';
import { Play, Pause, Square, Settings, Activity } from 'lucide-react';

import { 
  PerformanceStats, 
  ProcessedFrameData, 
  ProcessingError, 
  ServerInfo 
} from '../types';
interface VideoProcessorProps {
  videoSrc: string;
}


const VideoProcessor: React.FC<VideoProcessorProps> = ({ videoSrc }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [processingEnabled, setProcessingEnabled] = useState(true);
  const [currentFilter, setCurrentFilter] = useState('grayscale');
  const [availableFilters, setAvailableFilters] = useState<string[]>(['grayscale']);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    avg_frame_time_ms: 0,
    avg_processing_time_ms: 0,
    estimated_fps: 0,
    frames_processed: 0,
  });
  const [serverReady, setServerReady] = useState(false);

  const {
    connected,
    error,
    reconnecting,
    sendFrame,
    changeFilter,
    toggleProcessing,
    getPerformanceStats,
  } = useWebSocket({
    url: 'http://127.0.0.1:8080',
    onProcessedFrame: useCallback((data: ProcessedFrameData) => {
      // Display processed frame on canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.frame;
        }
      }
    }, []),
    onProcessingError: useCallback((error: ProcessingError) => {
      console.error('Processing error:', error);
    }, []),
    onConnectionReady: useCallback((serverInfo: ServerInfo) => {
      setServerReady(true);
      setAvailableFilters(serverInfo.available_filters);
      setCurrentFilter(serverInfo.current_filter);
    }, []),
    onFilterChanged: useCallback((filterType: string, intensity: number) => {
      setCurrentFilter(filterType);
    }, []),
  });

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !connected || !processingEnabled || !serverReady) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Convert to base64 and send to backend
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    sendFrame(frameData, currentFilter);
  }, [connected, processingEnabled, serverReady, sendFrame, currentFilter]);

  const handlePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);

      // Start frame capture interval
      intervalRef.current = setInterval(() => {
        captureFrame();
      }, 100); // 10 FPS
    }
  }, [isPlaying, captureFrame]);

  const handleStop = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleFilterChange = useCallback((filter: string) => {
    changeFilter(filter);
    setCurrentFilter(filter);
  }, [changeFilter]);

  const handleProcessingToggle = useCallback((enabled: boolean) => {
    setProcessingEnabled(enabled);
    toggleProcessing(enabled);
  }, [toggleProcessing]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Get performance stats every 2 seconds
    const statsInterval = setInterval(() => {
      if (connected && serverReady) {
        getPerformanceStats();
      }
    }, 2000);

    return () => clearInterval(statsInterval);
  }, [connected, serverReady, getPerformanceStats]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Real-time Video Background Filter
          </CardTitle>
          <CardDescription>
            MediaPipe-powered person segmentation with customizable background effects
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500' : reconnecting ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-sm font-medium">
                {connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
              </span>
              {serverReady && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  Server Ready
                </span>
              )}
            </div>
            {error && (
              <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded">
                {error}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Video Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Original Video</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                loop
                muted
                onLoadedMetadata={() => {
                  console.log('Video loaded');
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Processed Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processed Video</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              {!serverReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">Waiting for server...</div>
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlay}
              disabled={!serverReady}
              variant={isPlaying ? "secondary" : "default"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              onClick={handleStop}
              disabled={!serverReady}
              variant="outline"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>

          {/* Processing Toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={processingEnabled}
              onCheckedChange={handleProcessingToggle}
              disabled={!connected || !serverReady}
            />
            <span className="text-sm font-medium">
              Real-time Processing {processingEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Filter Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Background Filter:</label>
            <div className="flex flex-wrap gap-2">
              {availableFilters.map((filter) => (
                <Button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  variant={currentFilter === filter ? "default" : "outline"}
                  size="sm"
                  disabled={!connected || !serverReady}
                  className="capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {performanceStats.estimated_fps.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">FPS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {performanceStats.avg_processing_time_ms.toFixed(1)}ms
              </div>
              <div className="text-sm text-gray-600">Avg Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {performanceStats.avg_frame_time_ms.toFixed(1)}ms
              </div>
              <div className="text-sm text-gray-600">Avg Frame Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {performanceStats.frames_processed}
              </div>
              <div className="text-sm text-gray-600">Frames Processed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoProcessor;
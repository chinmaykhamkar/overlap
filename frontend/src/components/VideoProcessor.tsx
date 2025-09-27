import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { useWebSocket } from '../hooks/useWebSocket';
import { Play, Pause, Square, Settings, Activity, Upload, Link } from 'lucide-react';
import VideoUpload from './VideoUpload';

import {
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
  const [serverReady, setServerReady] = useState(false);
  const [showFilterMessage, setShowFilterMessage] = useState(false);
  const [currentVideoSrc, setCurrentVideoSrc] = useState(videoSrc);
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<any>(null);

  const {
    connected,
    error,
    reconnecting,
    sendFrame,
    changeFilter,
    toggleProcessing,
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
      setShowFilterMessage(false); // Hide filter message when pausing
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      setShowFilterMessage(false); // Hide filter message when playing
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

    // Show message about pausing/playing to see changes
    if (isPlaying) {
      setShowFilterMessage(true);
      setTimeout(() => setShowFilterMessage(false), 4000);
    }
  }, [changeFilter, isPlaying]);

  const handleProcessingToggle = useCallback((enabled: boolean) => {
    setProcessingEnabled(enabled);
    toggleProcessing(enabled);
  }, [toggleProcessing]);

  const handleVideoSelect = useCallback((videoFile: File, videoUrl: string) => {
    // Stop current playback
    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    }

    // Set new video
    setCurrentVideoSrc(videoUrl);
    setUploadedVideoFile(videoFile);
    setShowUpload(false);
    setShowFilterMessage(false);
    setVideoAspectRatio(null); // Reset aspect ratio for new video
    setCurrentVideoId(null); // Reset video ID for new video
    setSubtitles([]); // Clear previous subtitles
  }, [isPlaying]);

  const handleYouTubeSubmit = useCallback(async () => {
    if (!youtubeUrl.trim()) return;

    setYoutubeLoading(true);

    try {
      // Step 1: Get video info
      const infoResponse = await fetch('http://127.0.0.1:8080/youtube/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const infoResult = await infoResponse.json();

      if (!infoResponse.ok) {
        alert(`Error: ${infoResult.error}`);
        return;
      }

      setYoutubeVideoInfo(infoResult.info);

      // Step 2: Download video
      const downloadResponse = await fetch('http://127.0.0.1:8080/youtube/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const downloadResult = await downloadResponse.json();

      if (!downloadResponse.ok) {
        alert(`Download Error: ${downloadResult.error}`);
        return;
      }

      // Stop current playback
      if (isPlaying) {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPlaying(false);
      }

      // Set the downloaded video as current source
      const videoServerUrl = `http://127.0.0.1:8080/youtube/video/${downloadResult.video_id}`;
      setCurrentVideoSrc(videoServerUrl);
      setShowYouTubeInput(false);
      setVideoAspectRatio(null); // Reset aspect ratio for new video
      setCurrentVideoId(downloadResult.video_id); // Set YouTube video ID
      setSubtitles([]); // Clear previous subtitles

      // Clean up any uploaded video state
      if (uploadedVideoFile) {
        URL.revokeObjectURL(currentVideoSrc);
        setUploadedVideoFile(null);
      }

    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      alert('Error processing YouTube URL. Please check your connection and try again.');
    } finally {
      setYoutubeLoading(false);
    }
  }, [youtubeUrl, isPlaying, uploadedVideoFile, currentVideoSrc]);

  // Load subtitles when video source changes
  useEffect(() => {
    if (captionsEnabled && currentVideoSrc) {
      loadSubtitles();
    }
  }, [currentVideoSrc, captionsEnabled]);

  // Update current caption based on video time
  useEffect(() => {
    if (!captionsEnabled || !videoRef.current || subtitles.length === 0) {
      setCurrentCaption('');
      return;
    }

    const updateCaption = () => {
      if (videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const activeSubtitle = subtitles.find(sub =>
          currentTime >= sub.start && currentTime <= sub.end
        );
        setCurrentCaption(activeSubtitle ? activeSubtitle.text : '');
      }
    };

    const video = videoRef.current;
    video.addEventListener('timeupdate', updateCaption);

    return () => {
      video.removeEventListener('timeupdate', updateCaption);
    };
  }, [captionsEnabled, subtitles]);

  const loadSubtitles = async () => {
    if (subtitlesLoading) return;

    setSubtitlesLoading(true);
    try {
      let videoId = currentVideoId;

      // If we don't have a video ID yet, determine video source type
      if (!videoId) {
        if (youtubeVideoInfo) {
          videoId = youtubeVideoInfo.id;
          setCurrentVideoId(videoId);
        } else if (uploadedVideoFile) {
          // For uploaded videos, we'll need to upload and process
          const formData = new FormData();
          formData.append('video', uploadedVideoFile);

          const uploadResponse = await fetch('http://127.0.0.1:8080/subtitles/upload', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            videoId = result.video_id;
            setCurrentVideoId(videoId);
            console.log('Video uploaded for subtitles, ID:', videoId);
          } else {
            console.error('Failed to upload video for subtitles');
            setSubtitles([]);
            return;
          }
        }
      }

      if (videoId) {
        console.log('Loading subtitles for video ID:', videoId);
        // Get subtitles from backend
        const response = await fetch(`http://127.0.0.1:8080/subtitles/${videoId}`);

        if (response.ok) {
          const data = await response.json();
          setSubtitles(data.subtitles || []);
          console.log('Loaded subtitles:', data.subtitles?.length || 0, 'segments');
        } else {
          console.error('Failed to load subtitles, status:', response.status);
          setSubtitles([]);
        }
      } else {
        console.log('No video ID available for subtitle loading');
        setSubtitles([]);
      }
    } catch (error) {
      console.error('Error loading subtitles:', error);
      setSubtitles([]);
    } finally {
      setSubtitlesLoading(false);
    }
  };

  const handleBackToDefault = useCallback(() => {
    // Stop current playback
    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    }

    // Clean up uploaded video URL
    if (uploadedVideoFile && currentVideoSrc !== videoSrc) {
      URL.revokeObjectURL(currentVideoSrc);
    }

    // Reset to default
    setCurrentVideoSrc(videoSrc);
    setUploadedVideoFile(null);
    setYoutubeVideoInfo(null);
    setShowFilterMessage(false);
    setVideoAspectRatio(null); // Reset aspect ratio
    setCurrentVideoId(null); // Reset video ID
    setSubtitles([]); // Clear subtitles
  }, [isPlaying, uploadedVideoFile, currentVideoSrc, videoSrc]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Cleanup uploaded video URL
      if (uploadedVideoFile && currentVideoSrc !== videoSrc) {
        URL.revokeObjectURL(currentVideoSrc);
      }
    };
  }, [uploadedVideoFile, currentVideoSrc, videoSrc]);


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

      {/* Video Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Video Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => setShowUpload(!showUpload)}
              variant={showUpload ? "default" : "outline"}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
            <Button
              onClick={() => setShowYouTubeInput(!showYouTubeInput)}
              variant={showYouTubeInput ? "default" : "outline"}
              size="sm"
            >
              <Link className="h-4 w-4 mr-2" />
              YouTube URL
            </Button>
            {(uploadedVideoFile || youtubeVideoInfo || currentVideoSrc !== videoSrc) && (
              <Button
                onClick={handleBackToDefault}
                variant="outline"
                size="sm"
              >
                Use Default Video
              </Button>
            )}
          </div>

          {showUpload && (
            <VideoUpload
              onVideoSelect={handleVideoSelect}
              isProcessing={isPlaying}
            />
          )}

          {showYouTubeInput && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">YouTube URL or Video ID:</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or shorts URL"
                    value={youtubeUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYoutubeUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleYouTubeSubmit}
                    disabled={!youtubeUrl.trim() || youtubeLoading}
                    size="sm"
                  >
                    {youtubeLoading ? 'Loading...' : 'Use Video'}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Supports YouTube videos and Shorts. Note: This is a demo implementation.
              </div>
            </div>
          )}

          {uploadedVideoFile && !showUpload && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-md text-sm">
              <span className="font-medium">Using uploaded video:</span> {uploadedVideoFile.name}
            </div>
          )}

          {youtubeVideoInfo && !showYouTubeInput && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
              <span className="font-medium">Using YouTube video:</span> {youtubeVideoInfo.title}
              <div className="text-xs text-green-600 mt-1">
                Duration: {Math.round(youtubeVideoInfo.duration || 0)}s • Uploader: {youtubeVideoInfo.uploader}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Video Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Original Video</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div
              className="relative bg-black rounded-lg overflow-hidden"
              style={{
                aspectRatio: videoAspectRatio || 16/9,
                maxHeight: '500px'
              }}
            >
              <video
                ref={videoRef}
                src={currentVideoSrc}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                loop
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  const aspectRatio = video.videoWidth / video.videoHeight;
                  setVideoAspectRatio(aspectRatio);
                  console.log('Video loaded:', video.videoWidth, 'x', video.videoHeight, 'aspect:', aspectRatio);
                }}
              />
              {captionsEnabled && (
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <div className="bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm min-h-[40px] flex items-center justify-center">
                    {subtitlesLoading ? (
                      "Loading subtitles..."
                    ) : currentCaption || (
                      subtitles.length > 0 ? "" : "No subtitles available"
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Processed Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processed Video</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div
              className="relative bg-gray-100 rounded-lg overflow-hidden"
              style={{
                aspectRatio: videoAspectRatio || 16/9,
                maxHeight: '500px'
              }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
                style={{ maxWidth: '100%', height: '100%' }}
              />
              {!serverReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">Waiting for server...</div>
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  </div>
                </div>
              )}
              {captionsEnabled && serverReady && (
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <div className="bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm min-h-[40px] flex items-center justify-center">
                    {subtitlesLoading ? (
                      "Loading subtitles..."
                    ) : currentCaption || (
                      subtitles.length > 0 ? "" : "No subtitles available"
                    )}
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

          {/* Captions Toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={captionsEnabled}
              onCheckedChange={setCaptionsEnabled}
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                Video Captions {captionsEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className="text-xs text-gray-500">
                Automatically extracts subtitles from video content
              </span>
            </div>
          </div>

          {/* Filter Gallery */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Background Filter Gallery:</label>
            {showFilterMessage && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-md text-sm">
                <span className="font-medium">Filter changed!</span> Pause and play the video to see the new effect.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {availableFilters.map((filter) => {
                const getFilterPreview = (filterName: string) => {
                  switch (filterName) {
                    case 'grayscale':
                      return {
                        bg: 'bg-gradient-to-br from-gray-300 to-gray-600',
                        icon: '⚫',
                        desc: 'Classic black & white'
                      };
                    case 'sepia':
                      return {
                        bg: 'bg-gradient-to-br from-yellow-200 to-orange-400',
                        icon: '🟫',
                        desc: 'Warm vintage tone'
                      };
                    case 'blur':
                      return {
                        bg: 'bg-gradient-to-br from-blue-200 to-blue-400',
                        icon: '🌫️',
                        desc: 'Smooth blur effect'
                      };
                    case 'vintage':
                      return {
                        bg: 'bg-gradient-to-br from-amber-200 to-amber-500',
                        icon: '📸',
                        desc: 'Retro film look'
                      };
                    default:
                      return {
                        bg: 'bg-gradient-to-br from-gray-200 to-gray-400',
                        icon: '🎨',
                        desc: 'Custom filter'
                      };
                  }
                };

                const preview = getFilterPreview(filter);
                const isSelected = currentFilter === filter;

                return (
                  <div
                    key={filter}
                    onClick={() => !(!connected || !serverReady) && handleFilterChange(filter)}
                    className={`
                      relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                      ${(!connected || !serverReady) ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Preview Circle */}
                    <div className={`w-12 h-12 rounded-full ${preview.bg} flex items-center justify-center mx-auto mb-2 text-lg`}>
                      {preview.icon}
                    </div>

                    {/* Filter Name */}
                    <div className="text-center">
                      <div className={`text-sm font-medium capitalize ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {filter}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {preview.desc}
                      </div>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default VideoProcessor;
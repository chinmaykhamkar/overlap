import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Upload, Video, CheckCircle, AlertCircle, X } from 'lucide-react';

interface VideoUploadProps {
  onVideoSelect: (videoFile: File, videoUrl: string) => void;
  isProcessing?: boolean;
}

interface UploadedVideo {
  file: File;
  url: string;
  name: string;
  size: string;
  duration?: number;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onVideoSelect, isProcessing = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState('');

  const validateVideoFile = (file: File): { isValid: boolean; message: string } => {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        message: 'Please upload a video file (MP4, WebM, MOV, or AVI)'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        message: 'Video file is too large. Please upload a file smaller than 100MB'
      };
    }

    return { isValid: true, message: 'Video file is valid' };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleVideoLoad = (video: HTMLVideoElement, file: File) => {
    const duration = video.duration;
    setUploadedVideo({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: formatFileSize(file.size),
      duration
    });

    // Validate duration (optional)
    if (duration > 300) { // 5 minutes
      setValidationStatus('invalid');
      setValidationMessage('Video is too long. Please upload a video shorter than 5 minutes.');
      return;
    }

    setValidationStatus('valid');
    setValidationMessage('Video is ready for processing!');
  };

  const processFile = useCallback((file: File) => {
    const validation = validateVideoFile(file);

    if (!validation.isValid) {
      setValidationStatus('invalid');
      setValidationMessage(validation.message);
      return;
    }

    setValidationStatus('validating');
    setValidationMessage('Validating video...');

    // Create video element to get metadata
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      handleVideoLoad(video, file);
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      setValidationStatus('invalid');
      setValidationMessage('Invalid video file. Please try a different file.');
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleUseVideo = () => {
    if (uploadedVideo && validationStatus === 'valid') {
      onVideoSelect(uploadedVideo.file, uploadedVideo.url);
    }
  };

  const handleRemoveVideo = () => {
    if (uploadedVideo) {
      URL.revokeObjectURL(uploadedVideo.url);
    }
    setUploadedVideo(null);
    setValidationStatus('idle');
    setValidationMessage('');
  };

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getValidationColor = () => {
    switch (validationStatus) {
      case 'validating':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'valid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'invalid':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Your Video
        </CardTitle>
        <CardDescription>
          Upload your own video to apply background filters. Supports MP4, WebM, MOV, and AVI formats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploadedVideo ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />

            <div className="space-y-4">
              <Video className={`w-12 h-12 mx-auto ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragging ? 'Drop your video here' : 'Drag & drop your video here'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to browse files
                </p>
              </div>
              <div className="text-xs text-gray-400">
                Supports: MP4, WebM, MOV, AVI • Max size: 100MB • Max duration: 5 minutes
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="relative flex justify-center">
              <video
                src={uploadedVideo.url}
                className="rounded-lg object-contain bg-black shadow-lg"
                style={{
                  maxWidth: '60%',
                  maxHeight: '300px',
                  width: 'auto',
                  height: 'auto'
                }}
                controls
                muted
              />
              <Button
                onClick={handleRemoveVideo}
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Video Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900 truncate">{uploadedVideo.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Size: {uploadedVideo.size}</span>
                    {uploadedVideo.duration && (
                      <span>Duration: {Math.round(uploadedVideo.duration)}s</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Status */}
            {validationStatus !== 'idle' && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${getValidationColor()}`}>
                {getValidationIcon()}
                <span>{validationMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUseVideo}
                disabled={validationStatus !== 'valid' || isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Processing...' : 'Use This Video'}
              </Button>
              <Button
                onClick={handleRemoveVideo}
                variant="outline"
                disabled={isProcessing}
              >
                Choose Different Video
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoUpload;
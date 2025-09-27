import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  WebSocketState,
  ServerInfo,
  ProcessedFrameData,
  ProcessingError,
  UseWebSocketProps
} from '../types';

export const useWebSocket = ({
  url,
  onProcessedFrame,
  onProcessingError,
  onConnectionReady,
  onFilterChanged,
}: UseWebSocketProps) => {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    socket: null,
    error: null,
    reconnecting: false,
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const socket = io(url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('WebSocket connected');
        setState(prev => ({
          ...prev,
          connected: true,
          error: null,
          reconnecting: false,
          socket
        }));
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setState(prev => ({
          ...prev,
          connected: false,
          reconnecting: reason === 'io server disconnect' ? false : true,
        }));
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setState(prev => ({
          ...prev,
          error: error.message,
          connected: false,
        }));
      });

      socket.on('connection_ready', (data: { server_info: ServerInfo }) => {
        console.log('Connection ready:', data);
        onConnectionReady?.(data.server_info);
      });

      socket.on('processed_frame', (data: ProcessedFrameData) => {
        onProcessedFrame?.(data);
      });

      socket.on('processing_error', (error: ProcessingError) => {
        console.error('Processing error:', error);
        onProcessingError?.(error);
      });

      socket.on('filter_changed', (data: { filter_type: string; intensity: number }) => {
        onFilterChanged?.(data.filter_type, data.intensity);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        setState(prev => ({
          ...prev,
          connected: true,
          error: null,
          reconnecting: false,
        }));
      });

      socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to reconnect',
          reconnecting: false,
        }));
      });

    } catch (error) {
      console.error('Error creating socket:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [url, onProcessedFrame, onProcessingError, onConnectionReady, onFilterChanged]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState(prev => ({
      ...prev,
      connected: false,
      socket: null,
      error: null,
      reconnecting: false,
    }));
  }, []);

  const sendFrame = useCallback((frameData: string, filterType?: string) => {
    if (socketRef.current && state.connected) {
      socketRef.current.emit('video_frame', {
        frame: frameData,
        timestamp: Date.now(),
        filter_type: filterType,
      });
    }
  }, [state.connected]);

  const changeFilter = useCallback((filterType: string, intensity: number = 1.0) => {
    if (socketRef.current && state.connected) {
      socketRef.current.emit('filter_change', {
        type: filterType,
        intensity,
      });
    }
  }, [state.connected]);

  const toggleProcessing = useCallback((enabled: boolean) => {
    if (socketRef.current && state.connected) {
      socketRef.current.emit('toggle_processing', { enabled });
    }
  }, [state.connected]);

  const getPerformanceStats = useCallback(() => {
    if (socketRef.current && state.connected) {
      socketRef.current.emit('get_performance_stats');
    }
  }, [state.connected]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendFrame,
    changeFilter,
    toggleProcessing,
    getPerformanceStats,
  };
};
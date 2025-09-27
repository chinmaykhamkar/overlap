import React from 'react';
import VideoProcessor from './components/VideoProcessor';
import { videoUrl } from './consts';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <VideoProcessor videoSrc={videoUrl} />
    </div>
  );
};

export default App; 
# Real-time Video Background Filter with AI-Powered Subtitles

A sophisticated full-stack application that combines **real-time video background filtering** with **AI-powered subtitle generation**. Originally designed as a technical assessment, this project has evolved into a comprehensive video processing platform with advanced features.

## 🎬 **Live Demo**

**[📺 Watch the Full Demo Video](https://www.loom.com/share/991c480842b44b20aad821d962a23597)**

See all features in action: real-time background filtering, AI subtitle generation, YouTube integration, and more!

## 🎯 **Core Features**

### **🎬 Real-time Video Background Filtering**
- **MediaPipe Person Segmentation**: Advanced AI-powered person detection
- **Selective Background Effects**: Apply filters to background while keeping person in full color
- **Multiple Filter Options**: Grayscale, Sepia, Blur, and Vintage effects
- **Real-time Processing**: Smooth 10+ FPS processing via WebSocket streaming
- **Performance Monitoring**: Real-time FPS and processing time metrics

### **🎤 AI-Powered Subtitle Generation**
- **Automatic Speech Recognition**: OpenAI Whisper integration for accurate transcription
- **Multi-Source Support**: Works with default videos, uploaded files, and YouTube videos
- **Real-time Display**: Synchronized subtitle overlay during video playback
- **Robust Processing**: Fresh subtitle generation for each video source

### **📹 Advanced Video Source Management**
- **Default Video**: Pre-configured remote video with instant processing
- **File Upload**: Support for MP4, WebM, MOV, AVI (up to 100MB, 5 minutes)
- **YouTube Integration**: Paste any YouTube URL for instant download and processing
- **Smart Source Detection**: Automatic video type identification and processing

### **🎨 Professional User Interface**
- **Modern Design**: Built with shadcn/ui components and Tailwind CSS
- **Responsive Layout**: Works seamlessly across desktop and mobile devices
- **Real-time Controls**: Play/pause, filter selection, processing toggles
- **Visual Feedback**: Loading states, progress indicators, and error handling
- **Filter Gallery**: Visual preview of all available background effects

## 🏗️ **Technical Architecture**

### **Backend Stack**
- **Framework**: Python Flask with WebSocket support (Flask-SocketIO)
- **AI/ML**: MediaPipe (person segmentation), OpenAI Whisper (speech recognition)
- **Video Processing**: OpenCV, NumPy, yt-dlp, pydub
- **Package Management**: uv (modern Python dependency management)
- **Real-time Communication**: WebSocket for low-latency frame streaming

### **Frontend Stack**
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui (modern, accessible components)
- **Styling**: Tailwind CSS with custom animations
- **Real-time**: Socket.IO client for WebSocket communication
- **Video Processing**: HTML5 Canvas API for frame manipulation

## 🚀 **Getting Started**

### **Prerequisites**
- **Python**: 3.11+ (required for backend)
- **Node.js**: 16+ (required for frontend)
- **uv**: Modern Python package manager (recommended)
- **Git**: For cloning the repository

### **Quick Setup**

#### **1. Clone the Repository**
```bash
git clone <repository-url>
cd overlap
```

#### **2. Backend Setup**

**Option A: Using uv (Recommended)**
```bash
cd backend

# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies and create virtual environment
uv sync

# Activate the virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Start the backend server
python main.py
```

**Option B: Using pip**
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install flask flask-socketio flask-cors mediapipe opencv-python numpy python-dotenv pillow python-socketio eventlet yt-dlp openai-whisper pydub requests

# Start the backend server
python main.py
```

#### **3. Frontend Setup**
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

#### **4. Access the Application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://127.0.0.1:8080
- **Health Check**: http://127.0.0.1:8080/health

## 📖 **Usage Guide**

### **Real-time Background Filtering**

1. **Start Processing**: Click the "Play" button to begin video playback
2. **Enable Processing**: Toggle "Real-time Processing" to activate background filtering
3. **Select Filters**: Choose from the filter gallery (Grayscale, Sepia, Blur, Vintage)
4. **Monitor Performance**: View real-time FPS and processing metrics

### **AI Subtitle Generation**

1. **Enable Captions**: Toggle "Video Captions" to activate subtitle processing
2. **Automatic Processing**: Subtitles are generated automatically using AI speech recognition
3. **Real-time Display**: Subtitles appear synchronized with video playback
4. **Multi-language Support**: Automatic language detection and transcription

### **Video Source Options**

#### **Default Video**
- Pre-loaded remote video ready for immediate processing
- Optimized for demonstration and testing

#### **Upload Custom Video**
- **Supported Formats**: MP4, WebM, MOV, AVI
- **Size Limit**: 100MB maximum
- **Duration Limit**: 5 minutes maximum
- **Quality**: Automatic optimization for processing

#### **YouTube Videos**
- **URL Support**: Standard YouTube URLs and YouTube Shorts
- **Recommendation**: Use videos **under 1 minute** for optimal performance
- **Processing**: Automatic download, conversion, and processing
- **Quality**: Automatically selects best quality up to 720p

### **Performance Tips**

- **Video Length**: For YouTube videos, keep under 1 minute for best experience
- **File Size**: Smaller videos process faster and use less memory
- **Browser**: Use Chrome or Firefox for optimal WebSocket performance
- **Hardware**: Better CPU performance improves real-time processing speed

## 🔧 **API Documentation**

### **REST Endpoints**

#### **Health & Status**
- `GET /health` - Server health check and performance metrics
- `GET /filters` - Available background filters

#### **Video Processing**
- `GET /youtube/video/<video_id>` - Serve downloaded YouTube video
- `POST /youtube/info` - Get YouTube video information
- `POST /youtube/download` - Download YouTube video

#### **Subtitle Processing**
- `POST /subtitles/process/upload` - Process uploaded video subtitles
- `POST /subtitles/process/youtube` - Process YouTube video subtitles  
- `POST /subtitles/process/remote` - Process remote video URL subtitles

### **WebSocket Events**

#### **Client → Server**
- `video_frame` - Send video frame for processing
- `filter_change` - Change background filter
- `toggle_processing` - Enable/disable processing

#### **Server → Client**
- `processed_frame` - Receive processed video frame
- `connection_ready` - Server initialization complete
- `processing_error` - Error during processing

## 🎨 **Available Background Filters**

| Filter | Description | Effect |
|--------|-------------|---------|
| **Grayscale** | Classic black & white | Converts background to monochrome while keeping person in color |
| **Sepia** | Warm vintage tone | Applies warm, nostalgic brown tones to background |
| **Blur** | Smooth blur effect | Creates depth-of-field effect with blurred background |
| **Vintage** | Retro film look | Applies film-like color grading to background |

## 🛠️ **Development**

### **Project Structure**
```
overlap/
├── backend/                 # Python Flask backend
│   ├── main.py             # Main application entry point
│   ├── processors/         # AI processing modules
│   │   └── segmentation.py # MediaPipe person segmentation
│   ├── utils/              # Utility modules
│   │   ├── video_utils.py  # Video processing utilities
│   │   ├── youtube_processor.py # YouTube integration
│   │   └── subtitle_processor.py # Whisper subtitle generation
│   └── pyproject.toml      # Python dependencies (uv)
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── VideoProcessor.tsx # Main video processing interface
│   │   │   ├── VideoUpload.tsx # File upload component
│   │   │   └── ...
│   │   ├── hooks/          # Custom React hooks
│   │   │   └── useWebSocket.ts # WebSocket management
│   │   └── types/          # TypeScript type definitions
│   └── package.json        # Node.js dependencies
│
└── README.md              # This file
```

### **Key Technologies**

#### **AI & Machine Learning**
- **MediaPipe**: Google's ML framework for person segmentation
- **OpenAI Whisper**: State-of-the-art speech recognition
- **OpenCV**: Computer vision and image processing

#### **Backend Technologies**
- **Flask-SocketIO**: Real-time WebSocket communication
- **yt-dlp**: YouTube video downloading
- **pydub**: Audio processing for subtitle generation

#### **Frontend Technologies**
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe JavaScript development
- **shadcn/ui**: Modern, accessible UI component library
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO**: Real-time client-server communication

## 🔍 **Troubleshooting**

### **Common Issues**

#### **Backend Won't Start**
- Ensure Python 3.11+ is installed
- Check if all dependencies are installed correctly
- Verify no other service is using port 8080

#### **Frontend Connection Issues**
- Ensure backend is running on port 8080
- Check browser console for WebSocket connection errors
- Verify CORS settings allow localhost:3000

#### **Video Processing Issues**
- Check video format is supported (MP4, WebM, MOV, AVI)
- Ensure video file size is under 100MB
- Verify sufficient system memory for processing

#### **YouTube Download Issues**
- Check internet connection
- Verify YouTube URL is valid and accessible
- Some videos may be region-restricted or private

#### **Subtitle Generation Issues**
- Ensure video has clear audio
- Check system has sufficient memory for Whisper model
- Verify audio track exists in the video file

### **Performance Optimization**

- **Reduce Video Resolution**: Lower resolution videos process faster
- **Shorter Videos**: Keep videos under 1 minute for optimal performance
- **Close Other Applications**: Free up system resources for processing
- **Use Chrome/Firefox**: Better WebSocket and Canvas performance

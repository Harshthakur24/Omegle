import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Room } from './components/Room';
import { useState, useEffect } from 'react';

function App() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    initializeMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Room
            localAudioTrack={localStream?.getAudioTracks()[0] || null}
            localVideoTrack={localStream?.getVideoTracks()[0] || null}
          />
        } />
      </Routes>
    </Router>
  );
}

export default App;

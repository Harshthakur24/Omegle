import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const URL = 'https://openmeet-backend.onrender.com/';

interface SignalingMessage {
  sdp: RTCSessionDescriptionInit;
  roomId: string;
}

interface IceCandidateMessage {
  candidate: RTCIceCandidateInit;
  roomId: string;
}

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:global.stun.twilio.com:3478",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302"
      ],
    },
  ],
};

export const Room = ({
  localStream
}: {
  localStream: MediaStream | null
}) => {
  const [lobby, setLobby] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [refresh, setRefresh] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const initializePeerConnection = useCallback(() => {
    try {
      const newPc = new RTCPeerConnection(servers);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          newPc.addTrack(track, localStream);
        });
      }

      newPc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", newPc.iceConnectionState);
        setConnectionStatus(newPc.iceConnectionState);
      };

      newPc.onicecandidateerror = (event) => {
        console.error("ICE Candidate Error:", event);
        setError("Failed to establish connection. Please try again.");
      };

      newPc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      return newPc;
    } catch (err) {
      console.error("Error initializing peer connection:", err);
      setError("Failed to initialize connection. Please refresh the page.");
      return null;
    }
  }, [localStream, refresh]);

  useEffect(() => {
    try {
      socketRef.current = io(URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      const peerConnection = initializePeerConnection();
      if (!peerConnection) return;

      peerConnectionRef.current = peerConnection;

      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      const socket = socketRef.current;
      if (!socket) return;

      socket.on('connect', () => {
        console.log('Connected to signaling server');
        setError(null);
      });

      socket.on('connect_error', (err: Error) => {
        console.error('Connection error:', err);
        setError('Failed to connect to server. Please check your internet connection.');
      });

      socket.on('send-offer', async ({ roomId }: { roomId: string }) => {
        setLobby(false);
        setError(null);

        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit('offer', { sdp: offer, roomId } as SignalingMessage);
        } catch (err) {
          console.error('Error creating offer:', err);
          setError('Failed to create connection offer. Please try again.');
        }
      });

      socket.on('offer', async ({ sdp, roomId }: SignalingMessage) => {
        setLobby(false);
        setError(null);

        try {
          await peerConnection.setRemoteDescription(sdp);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('answer', { sdp: answer, roomId } as SignalingMessage);
        } catch (err) {
          console.error('Error handling offer:', err);
          setError('Failed to handle connection offer. Please try again.');
        }
      });

      socket.on('answer', async ({ sdp }: SignalingMessage) => {
        try {
          await peerConnection.setRemoteDescription(sdp);
        } catch (err) {
          console.error('Error handling answer:', err);
          setError('Failed to establish connection. Please try again.');
        }
      });

      socket.on("add-ice-candidate", ({ candidate }: IceCandidateMessage) => {
        try {
          peerConnection.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });

      return () => {
        if (socket) {
          socket.disconnect();
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
      };
    } catch (err) {
      console.error('Error in useEffect:', err);
      setError('An unexpected error occurred. Please refresh the page.');
    }
  }, [initializePeerConnection, refresh]);

  const handleNextPerson = () => {
    setRefresh(!refresh);
    setLobby(true);
    setError(null);
    setConnectionStatus('disconnected');
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="relative rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02]">
            <video
              autoPlay
              playsInline
              ref={remoteVideoRef}
              className="w-full h-auto rounded-lg"
            />
            <div className="absolute bottom-3 left-3 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm flex items-center">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} mr-2 animate-pulse`}></div>
              {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
            </div>
          </div>
          <div className="max-sm:absolute max-sm:top-4 max-sm:right-4 z-10">
            <div className="relative max-sm:w-32 rounded-lg overflow-hidden shadow-xl border-2 border-white">
              <video
                muted
                autoPlay
                playsInline
                ref={localVideoRef}
                className="w-full h-auto rounded-lg bg-black"
              />
              <div className="max-sm:hidden absolute bottom-3 left-3 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                You
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {lobby && !error && (
          <div className="mt-6 p-5 bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700 rounded-lg shadow-md animate-pulse">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p className="font-medium">Waiting for someone to connect...</p>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleNextPerson}
            className="px-6 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg flex items-center font-medium hover:scale-110"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Find Next Person
          </button>
        </div>
      </div>

      <div className="w-full md:w-1/3 lg:w-1/4 bg-white p-6 shadow-lg border-t md:border-t-0 md:border-l border-gray-200">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
          <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          Chat
        </h2>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 h-[calc(100vh-200px)] flex flex-col justify-center items-center text-center">
          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          <p className="text-gray-500 font-medium">Chat functionality coming soon...</p>
          <p className="text-gray-400 text-sm mt-2">You'll be able to text with your connection</p>
        </div>
      </div>
    </div>
  );
};

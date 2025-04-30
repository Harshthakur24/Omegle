import { useEffect, useRef, useState } from "react";
import { Room } from "./NewRoom";

export const Landing = () => {
    const [joined, setJoined] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const getCam = async () => {
        const stream = await window.navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        })
        setLocalStream(stream);
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoRef.current) {
            return;
        }
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        // videoRef.current.play();
    }

    useEffect(() => {
        if (videoRef && videoRef.current) {
            getCam();
        }

    }, [videoRef]);

    if (!joined) {

        return (
            <div className="flex flex-col items-center justify-center h-screen w-screen p-4">
                <header className="text-center py-8">
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-800 tracking-tight">
                        <span className="inline-block transform hover:scale-110 transition-transform duration-200 ease-in-out">
                            📸
                        </span>{' '}
                        OpenMeet
                        <sup className="text-2xl md:text-3xl text-blue-500 font-bold ml-1">
                            Live Talk
                        </sup>
                    </h1>
                    <p className="mt-4 text-xl text-gray-600">
                        Connect with random people around the world
                    </p>
                </header>
                <div className="w-full max-w-sm aspect-video relative overflow-hidden rounded-xl shadow-2xl border-4 border-white">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 z-0"></div>
                    <video
                        className="w-full h-full object-cover z-10 relative"
                        autoPlay
                        ref={videoRef}
                        muted
                    ></video>
                    <div className="absolute bottom-3 left-3 bg-black/40 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                        Your camera
                    </div>
                </div>
                <p className="mt-6 text-md text-gray-700 bg-yellow-100 px-4 py-2 rounded-full shadow-sm">
                    <span className="mr-2">⚠️</span> Camera and microphone access required
                </p>
                <div className="mt-8">
                    <button
                        className="px-8 py-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center font-medium text-lg"
                        onClick={() => { if (localStream) setJoined(true) }}
                    >
                        <span className="mr-2">Start Connecting</span> →
                    </button>
                </div>
                <p className="mt-6 text-sm text-gray-500">
                    By joining, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        )
    }
    return <Room localStream={localStream} />
}

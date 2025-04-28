import { useEffect, useState } from "react"
import { Room } from "./Room";

export function Landing() {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);

    useEffect(() => {
        const initialize = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            setLocalStream(stream);
            setLocalAudioTrack(stream.getAudioTracks()[0]);
            setLocalVideoTrack(stream.getVideoTracks()[0]);
        }

        initialize().catch(console.error);

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        }
    }, [])

    return <Room localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />
}
import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";
import { BsCameraVideo, BsCameraVideoOff, BsMic, BsMicMute } from "react-icons/bs";
import { IoMdRefresh } from "react-icons/io";
import {
    RoomContainer,
    VideoContainer,
    VideoWrapper,
    Video,
    Header,
    Title,
    LobbyMessage,
    Spinner,
    ControlsContainer,
    ControlButton,
    NextButton
} from "../styles/Room.styles";

const URL = "http://localhost:3000";

// Declare global window property for pcr
declare global {
    interface Window {
        pcr: RTCPeerConnection;
    }
}

export const Room = ({
    localAudioTrack,
    localVideoTrack
}: {
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (!socket) return; // Use socket state
        const newSocket = io(URL);

        newSocket.on('send-offer', async ({ roomId }) => {
            console.log("sending offer");
            setLobby(false);
            const pc = new RTCPeerConnection();

            setSendingPc(pc);
            if (localVideoTrack) {
                console.error("added track");
                console.log(localVideoTrack)
                pc.addTrack(localVideoTrack)
            }
            if (localAudioTrack) {
                console.error("added track");
                console.log(localAudioTrack)
                pc.addTrack(localAudioTrack)
            }

            pc.onicecandidate = async (e) => {
                console.log("receiving ice candidate locally");
                if (e.candidate) {
                    newSocket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "sender",
                        roomId
                    })
                }
            }

            pc.onnegotiationneeded = async () => {
                console.log("on negotiation needed, sending offer");
                const sdp = await pc.createOffer();
                await pc.setLocalDescription(sdp);
                newSocket.emit("offer", {
                    sdp,
                    roomId
                })
            }
        });

        newSocket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
            console.log("received offer");
            setLobby(false);
            const pc = new RTCPeerConnection();
            await pc.setRemoteDescription(remoteSdp);
            const sdp = await pc.createAnswer();
            await pc.setLocalDescription(sdp);
            const stream = new MediaStream();

            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }

            setReceivingPc(pc);
            window.pcr = pc;

            pc.ontrack = (e) => {
                alert("ontrack");
                if (remoteVideoRef.current && e.track) {
                    const stream = remoteVideoRef.current.srcObject as MediaStream;
                    if (stream) {
                        stream.addTrack(e.track);
                    }
                }
            }

            pc.onicecandidate = async (e) => {
                if (!e.candidate) {
                    return;
                }
                console.log("on ice candidate on receiving side");
                newSocket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "receiver",
                    roomId
                });
            }

            newSocket.emit("answer", {
                roomId,
                sdp: sdp
            });

            setTimeout(() => {
                if (!remoteVideoRef.current) return;

                const transceivers = pc.getTransceivers();
                if (transceivers.length >= 2) {
                    const track1 = transceivers[0].receiver.track;
                    const track2 = transceivers[1].receiver.track;

                    const stream = remoteVideoRef.current.srcObject as MediaStream;
                    if (stream) {
                        stream.addTrack(track1);
                        stream.addTrack(track2);
                        remoteVideoRef.current.play().catch(console.error);
                    }
                }
            }, 5000);
        });

        newSocket.on("answer", ({ sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                if (pc) {
                    pc.setRemoteDescription(remoteSdp).catch(console.error);
                }
                return pc;
            });
            console.log("loop closed");
        });

        newSocket.on("lobby", () => {
            setLobby(true);
        });

        newSocket.on("add-ice-candidate", ({ candidate, type }) => {
            console.log("add ice candidate from remote");
            if (type === "sender") {
                setReceivingPc(pc => {
                    if (pc) {
                        pc.addIceCandidate(candidate).catch(console.error);
                    }
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    if (pc) {
                        pc.addIceCandidate(candidate).catch(console.error);
                    }
                    return pc;
                });
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            if (sendingPc) {
                sendingPc.close();
            }
            if (receivingPc) {
                receivingPc.close();
            }
        };
    }, [socket, localAudioTrack, localVideoTrack, sendingPc, receivingPc]);

    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
            localVideoRef.current.play().catch(console.error);
        }
    }, [localVideoRef, localVideoTrack]);

    const handleNextPerson = () => {
        // Implement the logic to find next person
        setLobby(true);
        // Disconnect current peer and look for new one
    };

    const toggleAudio = () => {
        if (localAudioTrack) {
            localAudioTrack.enabled = !localAudioTrack.enabled;
            setIsAudioEnabled(!isAudioEnabled);
        }
    };

    const toggleVideo = () => {
        if (localVideoTrack) {
            localVideoTrack.enabled = !localVideoTrack.enabled;
            setIsVideoEnabled(!isVideoEnabled);
        }
    };

    return (
        <RoomContainer>
            <Header>
                <Title>Random Chat</Title>
                <NextButton onClick={handleNextPerson}>
                    <IoMdRefresh size={20} style={{ marginRight: '8px' }} />
                    Next Person
                </NextButton>
            </Header>

            <VideoContainer>
                <VideoWrapper>
                    <Video ref={localVideoRef} autoPlay muted playsInline />
                    <ControlsContainer>
                        <ControlButton
                            onClick={toggleAudio}
                            isActive={isAudioEnabled}
                            title={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
                        >
                            {isAudioEnabled ? <BsMic size={20} /> : <BsMicMute size={20} />}
                        </ControlButton>
                        <ControlButton
                            onClick={toggleVideo}
                            isActive={isVideoEnabled}
                            title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                        >
                            {isVideoEnabled ? <BsCameraVideo size={20} /> : <BsCameraVideoOff size={20} />}
                        </ControlButton>
                    </ControlsContainer>
                </VideoWrapper>

                <VideoWrapper>
                    <Video ref={remoteVideoRef} autoPlay playsInline />
                </VideoWrapper>
            </VideoContainer>

            <LobbyMessage visible={lobby}>
                <Spinner />
                <p>Looking for someone to chat with...</p>
            </LobbyMessage>
        </RoomContainer>
    );
}


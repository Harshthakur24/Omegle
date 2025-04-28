import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";

const URL = "http://localhost:3000";

// Declare global window property for pcr
declare global {
    interface Window {
        pcr: RTCPeerConnection;
    }
}

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [lobby, setLobby] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [socket, setSocket] = useState<null | Socket>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);

    // Initialize refs with null
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

    return (
        <div>
            Hi {name}
            <video autoPlay width={400} height={400} ref={localVideoRef} />
            {lobby && "Waiting to connect you to someone"}
            <video autoPlay width={400} height={400} ref={remoteVideoRef} />
        </div>
    );
}


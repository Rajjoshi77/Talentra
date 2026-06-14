import { useEffect, useRef } from "react"
import { useParams } from "react-router"
import { BACKEND_URL } from "@/lib/config"

export default function Interview() {
  const { interviewId } = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        console.log("Interview started");

        const pc = new RTCPeerConnection();

        pc.ontrack = (e) => {
          console.log("Remote track received");

          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0]!;
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("ICE:", pc.iceConnectionState);
        };

        console.log("Requesting microphone");

        const ms = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        console.log("Microphone granted");

        pc.addTrack(ms.getTracks()[0]!);

        pc.createDataChannel("oai-events");

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        console.log("Sending SDP");

        const sdpResponse = await fetch(
          `${BACKEND_URL}/api/v1/session`,
          {
            method: "POST",
            body: offer.sdp,
            headers: {
              "Content-Type": "application/sdp",
            },
          }
        );

        console.log("Status:", sdpResponse.status);

        const answer = {
          type: "answer" as const,
          sdp: await sdpResponse.text(),
        };

        console.log("Setting remote description");

        await pc.setRemoteDescription(answer);

        console.log("Connected");
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  return (
    <div>
      <audio autoPlay ref={audioRef}></audio>
      <h1>Interview Page</h1>
    </div>
  )
}


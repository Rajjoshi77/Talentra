import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { BACKEND_URL } from "@/lib/config";
import { Button } from "./ui/button";
import {
  Mic,
  MicOff,
  PhoneOff,
  Terminal,
  Volume2,
  HelpCircle,
  User as UserIcon,
  Laptop,
  ShieldCheck,
  Radio,
  Camera,
  CameraOff,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface MessageLog {
  id: string;
  type: "User" | "Assistant";
  message: string;
}

const MALE_VOICE_NAMES = [
  "male",
  "david",
  "mark",
  "george",
  "guy",
  "ryan",
  "alex",
  "daniel",
  "james",
  "echo",
];

export default function Interview() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [status, setStatus] = useState<"connecting" | "active" | "ended">(
    "connecting",
  );
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<MessageLog[]>([]);
  const [activeAiDelta, setActiveAiDelta] = useState("");

  const [isMockMode, setIsMockMode] = useState(false);
  const [mockInput, setMockInput] = useState("");
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [hasCamera, setHasCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const initialized = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const shouldDownloadRef = useRef(false);

  const aiHaloRef = useRef<HTMLDivElement>(null);
  const userHaloRef = useRef<HTMLDivElement>(null);
  const aiAvatarRef = useRef<HTMLDivElement>(null);
  const userAvatarRef = useRef<HTMLDivElement>(null);
  const aiSpeakingRef = useRef(false);

  const setAiVisualLevel = (volume: number) => {
    const normalized = Math.min(Math.max(volume / 120, 0), 1);
    const aiAvatar = aiAvatarRef.current;
    if (aiAvatar) {
      aiAvatar.style.setProperty("--speech-level", normalized.toFixed(2));
    }

    const shouldSpeak = normalized > 0.14;
    if (aiSpeakingRef.current !== shouldSpeak) {
      aiSpeakingRef.current = shouldSpeak;
      setAiIsSpeaking(shouldSpeak);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startSession = async () => {
      try {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        let ms: MediaStream;
        try {
          ms = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          setHasCamera(true);
          setCameraOn(true);
        } catch (err) {
          console.warn("Camera access denied or unavailable, falling back to audio-only stream:", err);
          ms = await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasCamera(false);
          setCameraOn(false);
        }
        localStreamRef.current = ms;

        let screenStream: MediaStream | null = null;
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
        } catch (err) {
          console.warn("Screen share denied or unavailable, falling back to camera/audio recording:", err);
        }

        let recorderStream: MediaStream;
        if (screenStream) {
          recorderStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...ms.getAudioTracks(),
          ]);
        } else {
          recorderStream = ms;
        }
        startRecording(recorderStream);

        const audioTrack = ms.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, ms);
        }

        const userSource = audioCtx.createMediaStreamSource(ms);
        const userAnalyser = audioCtx.createAnalyser();
        userAnalyser.fftSize = 32;
        userSource.connect(userAnalyser);
        const userBuffer = new Uint8Array(userAnalyser.frequencyBinCount);

        let aiAnalyser: AnalyserNode | null = null;
        let aiBuffer: Uint8Array | null = null;

        pc.ontrack = (e) => {
          const remoteStream = e.streams[0];
          if (!remoteStream) return;

          if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
          }

          const aiSource = audioCtx.createMediaStreamSource(remoteStream);
          aiAnalyser = audioCtx.createAnalyser();
          aiAnalyser.fftSize = 32;
          aiSource.connect(aiAnalyser);
          aiBuffer = new Uint8Array(aiAnalyser.frequencyBinCount);
        };

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.addEventListener("open", () => {
          setStatus("active");
          toast.success(
            "Voice channel connected! The interviewer is listening.",
          );
        });

        dc.addEventListener("message", async (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "response.audio_transcript.delta") {
              setActiveAiDelta((prev) => prev + data.delta);
            }

            if (data.type === "response.audio_transcript.done") {
              const text = data.transcript;
              if (text && text.trim()) {
                setActiveAiDelta("");
                appendTranscript("Assistant", text);
                saveMessageToDatabase("Assistant", text);
              }
            }

            if (
              data.type ===
              "conversation.item.input_audio_transcription.completed"
            ) {
              const text = data.transcript;
              if (text && text.trim()) {
                appendTranscript("User", text);
                saveMessageToDatabase("User", text);
              }
            }
          } catch (err) {
            console.error("Data channel event error:", err);
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`${BACKEND_URL}/api/v1/session`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpResponse.ok) {
          throw new Error("Failed to configure WebRTC session with backend");
        }

        const answerText = await sdpResponse.text();
        if (!answerText.trim().startsWith("v=")) {
          try {
            const errObj = JSON.parse(answerText);
            throw new Error(
              errObj.error?.message ||
              errObj.message ||
              "Invalid Session SDP from server",
            );
          } catch (e) {
            throw new Error("Invalid SDP response format");
          }
        }

        const answer = {
          type: "answer" as const,
          sdp: answerText,
        };

        await pc.setRemoteDescription(answer);

        const updateFrame = () => {
          userAnalyser.getByteFrequencyData(userBuffer as any);
          let userSum = 0;
          for (let i = 0; i < userBuffer.length; i++) {
            userSum += userBuffer[i] ?? 0;
          }
          const userVol = userSum / userBuffer.length;

          const userHalo = userHaloRef.current;
          const userAvatar = userAvatarRef.current;
          if (userHalo && userAvatar) {
            const scale = 1 + (userVol / 200) * 0.4;
            const glowSize = Math.max(10, userVol * 0.45);
            userAvatar.style.transform = `scale(${scale})`;
            userHalo.style.boxShadow = `0 0 ${glowSize}px rgba(16, 185, 129, ${userVol / 120})`;
            userHalo.style.borderColor = `rgba(16, 185, 129, ${0.1 + userVol / 200})`;
          }

          if (aiAnalyser && aiBuffer) {
            aiAnalyser.getByteFrequencyData(aiBuffer as any);
            let aiSum = 0;
            for (let i = 0; i < aiBuffer.length; i++) {
              aiSum += aiBuffer[i] ?? 0;
            }
            const aiVol = aiSum / aiBuffer.length;

            const aiHalo = aiHaloRef.current;
            const aiAvatar = aiAvatarRef.current;
            if (aiHalo && aiAvatar) {
              const scale = 1 + (aiVol / 200) * 0.4;
              const glowSize = Math.max(10, aiVol * 0.45);
              aiAvatar.style.transform = `scale(${scale})`;
              aiAvatar.style.setProperty(
                "--speech-level",
                Math.min(aiVol / 120, 1).toFixed(2),
              );
              aiHalo.style.boxShadow = `0 0 ${glowSize}px rgba(99, 102, 241, ${aiVol / 120})`;
              aiHalo.style.borderColor = `rgba(99, 102, 241, ${0.1 + aiVol / 200})`;
            }
            setAiVisualLevel(aiVol);
          }

          animationFrameRef.current = requestAnimationFrame(updateFrame);
        };

        animationFrameRef.current = requestAnimationFrame(updateFrame);
      } catch (err: any) {
        console.error(
          "Interview setup failure, running in mock fallback:",
          err,
        );
        startMockInterview();
      }
    };

    startSession();

    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) pcRef.current.close();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) { }
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [interviewId]);

  const startMockInterview = async () => {
    setIsMockMode(true);
    setStatus("active");
    toast.info(
      "OpenAI WebRTC offline. Running in dynamic Gemini/Local mock interview sandbox.",
      { duration: 6000 },
    );

    try {
      if (!localStreamRef.current) {
        let ms: MediaStream;
        try {
          ms = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          setHasCamera(true);
          setCameraOn(true);
        } catch (err) {
          console.warn("Camera access denied or unavailable in mock mode, falling back to audio-only stream:", err);
          ms = await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasCamera(false);
          setCameraOn(false);
        }
        localStreamRef.current = ms;

        let screenStream: MediaStream | null = null;
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
        } catch (err) {
          console.warn("Screen share denied or unavailable in mock mode, falling back to camera/audio recording:", err);
        }

        let recorderStream: MediaStream;
        if (screenStream) {
          recorderStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...ms.getAudioTracks(),
          ]);
        } else {
          recorderStream = ms;
        }
        startRecording(recorderStream);
      } else {
        startRecording(localStreamRef.current);
      }

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = audioCtxRef.current || new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const userSource = audioCtx.createMediaStreamSource(
        localStreamRef.current,
      );
      const userAnalyser = audioCtx.createAnalyser();
      userAnalyser.fftSize = 32;
      userSource.connect(userAnalyser);
      const userBuffer = new Uint8Array(userAnalyser.frequencyBinCount);

      const updateFrame = () => {
        userAnalyser.getByteFrequencyData(userBuffer as any);
        let userSum = 0;
        for (let i = 0; i < userBuffer.length; i++) {
          userSum += userBuffer[i] ?? 0;
        }
        const userVol = userSum / userBuffer.length;

        const userHalo = userHaloRef.current;
        const userAvatar = userAvatarRef.current;
        if (userHalo && userAvatar) {
          const scale = 1 + (userVol / 200) * 0.4;
          const glowSize = Math.max(10, userVol * 0.45);
          userAvatar.style.transform = `scale(${scale})`;
          userHalo.style.boxShadow = `0 0 ${glowSize}px rgba(16, 185, 129, ${userVol / 120})`;
          userHalo.style.borderColor = `rgba(16, 185, 129, ${0.1 + userVol / 200})`;
        }
        animationFrameRef.current = requestAnimationFrame(updateFrame);
      };
      animationFrameRef.current = requestAnimationFrame(updateFrame);
    } catch (e) {
      console.warn(
        "Could not capture local audio stream for local volume pulsing",
        e,
      );
    }

    setTimeout(() => {
      fetchNextAiQuestion();
    }, 1200);
  };

  const speakOfflineText = (text: string, onEnd: () => void) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 0.82;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            MALE_VOICE_NAMES.some((name) =>
              v.name.toLowerCase().includes(name),
            ),
        ) ||
        voices.find(
          (v) => v.lang.startsWith("en") && v.name.includes("Natural"),
        ) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        onEnd();
      };

      utterance.onerror = (e) => {
        console.error("Speech Synthesis Error:", e);
        onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(onEnd, text.length * 60);
    }
  };

  const fetchNextAiQuestion = async () => {
    setAiIsSpeaking(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/interview/${interviewId}/chat`,
      );
      if (response.data && response.data.success) {
        const fullText = response.data.message;

        let displayedText = "";
        let animationDone = false;

        const runTypingAnimation = async () => {
          for (let i = 0; i < fullText.length; i++) {
            if (animationDone) break;
            displayedText += fullText[i];
            setActiveAiDelta(displayedText);
            await new Promise((r) => setTimeout(r, 20 + Math.random() * 10));
          }
          if (!animationDone) {
            setActiveAiDelta(fullText);
          }
        };
        runTypingAnimation();

        const volInterval = setInterval(() => {
          const aiVol = 30 + Math.random() * 90;
          const aiHalo = aiHaloRef.current;
          const aiAvatar = aiAvatarRef.current;
          if (aiHalo && aiAvatar) {
            aiAvatar.style.transform = `scale(${1 + (aiVol / 200) * 0.4})`;
            aiAvatar.style.setProperty(
              "--speech-level",
              Math.min(aiVol / 120, 1).toFixed(2),
            );
            aiHalo.style.boxShadow = `0 0 ${aiVol * 0.45}px rgba(99, 102, 241, ${aiVol / 120})`;
            aiHalo.style.borderColor = `rgba(99, 102, 241, ${0.1 + aiVol / 200})`;
          }
          setAiVisualLevel(aiVol);
        }, 100);

        speakOfflineText(fullText, () => {
          animationDone = true;
          clearInterval(volInterval);
          aiSpeakingRef.current = false;
          setAiIsSpeaking(false);
          setActiveAiDelta("");

          const aiHalo = aiHaloRef.current;
          const aiAvatar = aiAvatarRef.current;
          if (aiHalo && aiAvatar) {
            aiAvatar.style.transform = "scale(1)";
            aiAvatar.style.setProperty("--speech-level", "0");
            aiHalo.style.boxShadow = "none";
            aiHalo.style.borderColor = "rgba(99, 102, 241, 0.1)";
          }

          appendTranscript("Assistant", fullText);

          if (
            !fullText.toLowerCase().includes("end & review") &&
            !fullText.toLowerCase().includes("click 'end & review'")
          ) {
            startUserListening();
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch next AI question:", error);
      setAiIsSpeaking(false);
    }
  };

  const startUserListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
    }

    const SpeechLib =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechLib) {
      const rec = new SpeechLib();
      recognitionRef.current = rec;
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = async (event: any) => {
        const text = event.results[0]?.[0]?.transcript;
        if (text && text.trim()) {
          appendTranscript("User", text);
          await saveMessageToDatabase("User", text);
          setTimeout(() => {
            fetchNextAiQuestion();
          }, 1500);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Speech recognition skipped/error:", e.error);
      };

      try {
        rec.start();
      } catch (err) { }
    }
  };

  const handleSendMockMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockInput.trim() || aiIsSpeaking) return;

    const text = mockInput.trim();
    setMockInput("");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) { }
    }

    appendTranscript("User", text);
    await saveMessageToDatabase("User", text);

    setTimeout(() => {
      fetchNextAiQuestion();
    }, 1500);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast.info(
          audioTrack.enabled ? "Microphone active" : "Microphone muted",
        );
      }
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
      toast.info(
        videoTrack.enabled ? "Camera preview on" : "Camera preview off",
      );
    } else {
      toast.error("No camera track found.");
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      const getSupportedMimeType = () => {
        const types = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=h264",
          "video/webm",
          "video/mp4;codecs=h264,aac",
          "video/mp4"
        ];
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            return type;
          }
        }
        return "";
      };

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (shouldDownloadRef.current && recordingChunksRef.current.length > 0) {
          const actualMime = mediaRecorder.mimeType || mimeType || "video/webm";
          const ext = actualMime.includes("video/mp4") ? "mp4" : "webm";

          const blob = new Blob(recordingChunksRef.current, {
            type: actualMime,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          document.body.appendChild(a);
          a.style.display = "none";
          a.href = url;
          a.download = `Talentra-Interview-${interviewId || "session"}.${ext}`;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          if (ext === "webm") {
            toast.success(
              "Interview recording downloaded! To play it, drag & drop the WebM file into a Google Chrome or Edge browser tab, or open it with VLC.",
              { duration: 8000 }
            );
          } else {
            toast.success("Interview recording downloaded successfully!");
          }
        }
      };

      // Start recording without timeslices to ensure full container header integrity
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("Failed to start media recording:", err);
    }
  };

  useEffect(() => {
    if (videoRef.current && localStreamRef.current) {
      if (videoRef.current.srcObject !== localStreamRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [cameraOn, status, isMockMode, hasCamera]);

  const appendTranscript = (type: "User" | "Assistant", message: string) => {
    setTranscripts((prev) => [
      ...prev,
      { id: Math.random().toString(), type, message },
    ]);
  };

  const saveMessageToDatabase = async (
    type: "User" | "Assistant",
    message: string,
  ) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/v1/interview/${interviewId}/message`,
        {
          type,
          message,
        },
      );
    } catch (error) {
      console.error("Failed to persist message in DB:", error);
    }
  };

  const endInterview = async () => {
    setStatus("ended");

    shouldDownloadRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    toast.loading("Ending interview and evaluating results...");
    navigate(`/result/${interviewId}`);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-radial from-neutral-950 via-zinc-950 to-black text-slate-100 flex flex-col font-sans">
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[90px] pointer-events-none" />

      <header className="relative z-10 border-b border-white/5 bg-neutral-900/40 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-2 w-2 rounded-full ${isMockMode ? "bg-indigo-500" : "bg-emerald-500"} animate-pulse`}
            />
            <span className="font-mono text-xs text-slate-400 tracking-wider uppercase">
              {isMockMode
                ? "Sandbox Session: Mock Mode"
                : "Sandbox Session: Active"}
            </span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">REC</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 bg-neutral-950/60 border border-white/5 px-3 py-1.5 rounded-lg text-slate-400 font-mono text-xs">
          <Terminal className="h-3.5 w-3.5 text-indigo-400" />
          <span>UUID: {interviewId?.slice(0, 8)}...</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid grid-rows-2 md:grid-rows-1 md:grid-cols-2 p-6 gap-6 overflow-hidden">
        <section className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center space-y-12">
          <h2 className="text-slate-400 font-medium tracking-wide text-sm flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-indigo-400" /> Voice Feed Monitor
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-16 w-full max-w-lg">
            <div className="flex flex-col items-center space-y-4">
              <div
                ref={aiHaloRef}
                className={`relative flex items-center justify-center p-2 rounded-[28px] border transition-all duration-100 ease-out ${aiIsSpeaking
                  ? "border-indigo-400/40 bg-indigo-500/5"
                  : "border-indigo-500/10 bg-neutral-950/30"
                  }`}
              >
                <div
                  ref={aiAvatarRef}
                  className={`ai-interviewer-stage h-40 w-40 sm:h-48 sm:w-48 ${aiIsSpeaking ? "is-speaking" : ""}`}
                  style={{ "--speech-level": 0 } as React.CSSProperties}
                  aria-label="Animated Talentra AI interviewer"
                >
                  <div className="ai-interviewer-screen">
                    <div className="ai-interviewer-scanline" />
                    <div className="ai-interviewer-head">
                      <div className="ai-interviewer-hair" />
                      <div className="ai-interviewer-face">
                        <div className="ai-interviewer-brows">
                          <span />
                          <span />
                        </div>
                        <div className="ai-interviewer-eyes">
                          <span />
                          <span />
                        </div>
                        <div className="ai-interviewer-mouth" />
                      </div>
                      <div className="ai-interviewer-neck" />
                      <div className="ai-interviewer-jacket">
                        <span />
                      </div>
                    </div>
                    <div className="ai-interviewer-waveform" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <span className="text-slate-200 font-semibold text-base flex items-center justify-center gap-2">
                  Talentra AI
                  <Radio
                    className={`h-3.5 w-3.5 ${aiIsSpeaking ? "text-indigo-300 animate-pulse" : "text-slate-600"}`}
                  />
                </span>
                <p className="text-indigo-400 text-xs mt-0.5 font-medium uppercase tracking-wider">
                  {aiIsSpeaking ? "Speaking live" : "Interviewer standby"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div
                ref={userHaloRef}
                className={`relative flex items-center justify-center p-1 border border-emerald-500/10 transition-all duration-100 ease-out ${cameraOn && hasCamera ? "rounded-2xl" : "rounded-full"
                  }`}
              >
                {cameraOn && hasCamera ? (
                  <div
                    ref={userAvatarRef}
                    className="w-40 h-30 sm:w-48 sm:h-36 rounded-xl overflow-hidden shadow-lg transition-transform duration-100 ease-out bg-neutral-950/30"
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    ref={userAvatarRef}
                    className={`h-24 w-24 rounded-full ${isMuted ? "bg-neutral-800" : "bg-gradient-to-tr from-emerald-600 to-emerald-800"} flex items-center justify-center shadow-lg transition-transform duration-100 ease-out`}
                  >
                    {isMuted ? (
                      <MicOff className="h-10 w-10 text-neutral-400" />
                    ) : (
                      <UserIcon className="h-10 w-10 text-white" />
                    )}
                  </div>
                )}
              </div>
              <div className="text-center">
                <span className="text-slate-200 font-semibold text-base">
                  You (Candidate)
                </span>
                <p className="text-emerald-400 text-xs mt-0.5 font-medium uppercase tracking-wider">
                  {isMuted ? "Muted" : "Microphone Active"}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm grid grid-cols-3 gap-3 text-center">
            <div className="bg-neutral-950/40 border border-white/5 p-3 rounded-xl flex flex-col items-center">
              <Laptop className="h-4 w-4 text-slate-500 mb-1" />
              <span className="text-[10px] text-slate-400 font-medium">
                Platform
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {isMockMode ? "Mock Sandbox" : "WebRTC"}
              </span>
            </div>
            <div className="bg-neutral-950/40 border border-white/5 p-3 rounded-xl flex flex-col items-center">
              <ShieldCheck className="h-4 w-4 text-slate-500 mb-1" />
              <span className="text-[10px] text-slate-400 font-medium">
                Session IP
              </span>
              <span className="text-xs font-semibold text-slate-300">
                Secured
              </span>
            </div>
            <div className="bg-neutral-950/40 border border-white/5 p-3 rounded-xl flex flex-col items-center">
              <HelpCircle className="h-4 w-4 text-slate-500 mb-1" />
              <span className="text-[10px] text-slate-400 font-medium">
                Audio Mode
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {isMockMode ? "Simulated" : "Duplex"}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col overflow-hidden">
          <h2 className="text-slate-400 font-medium tracking-wide text-sm mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-indigo-400" /> Realtime Transcript
            Feed
          </h2>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-neutral-800 flex flex-col justify-between">
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
              {transcripts.length === 0 && !activeAiDelta && (
                <div className="h-full flex flex-col justify-center items-center text-slate-600 text-sm space-y-2">
                  <Laptop className="h-8 w-8 stroke-1 text-neutral-800" />
                  <p>Audios will be transcribed here in real-time.</p>
                  <p className="text-xs text-slate-700">
                    Go ahead, say hello to start the interview!
                  </p>
                </div>
              )}

              {transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border max-w-[85%] ${t.type === "User"
                    ? "bg-emerald-950/20 border-emerald-500/10 text-emerald-100 mr-auto"
                    : "bg-indigo-950/20 border-indigo-500/10 text-indigo-100 ml-auto"
                    }`}
                >
                  <span
                    className={`text-[10px] font-mono font-bold tracking-wider uppercase block mb-1 ${t.type === "User" ? "text-emerald-400" : "text-indigo-400"
                      }`}
                  >
                    {t.type === "User" ? "You" : "Talentra AI"}
                  </span>
                  <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">
                    {t.message}
                  </p>
                </div>
              ))}

              {activeAiDelta && (
                <div className="p-4 rounded-xl border max-w-[85%] bg-indigo-950/20 border-indigo-500/10 text-indigo-100 ml-auto animate-pulse">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-400 block mb-1">
                    Talentra AI (Speaking...)
                  </span>
                  <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">
                    {activeAiDelta}
                  </p>
                </div>
              )}
            </div>

            {isMockMode && (
              <form
                onSubmit={handleSendMockMessage}
                className="mt-4 flex gap-2 border-t border-white/5 pt-4"
              >
                <input
                  type="text"
                  placeholder={
                    aiIsSpeaking
                      ? "Interviewer is speaking..."
                      : "Type response or talk to mic..."
                  }
                  disabled={aiIsSpeaking}
                  value={mockInput}
                  onChange={(e) => setMockInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-100 placeholder-slate-600 focus-visible:border-indigo-500"
                />
                <Button
                  type="submit"
                  disabled={aiIsSpeaking || !mockInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 shrink-0 cursor-pointer"
                >
                  Send Response
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-neutral-900/60 backdrop-blur-md px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "connecting" ? (
            <div className="flex items-center gap-2 text-indigo-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span>Establishing secure audio link...</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 ${isMockMode ? "text-indigo-400" : "text-emerald-400"} text-sm`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMockMode ? "bg-indigo-400" : "bg-emerald-400"} opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${isMockMode ? "bg-indigo-500" : "bg-emerald-500"}`}
                ></span>
              </span>
              <span>
                {isMockMode
                  ? "Sandbox Mock Mode (Offline)"
                  : "Duplex audio connected"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={toggleMute}
            variant="outline"
            className={`rounded-xl px-5 py-6 border transition-all duration-200 font-medium flex items-center gap-2 cursor-pointer
    ${isMuted
                ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
                : "bg-white text-black border-white hover:bg-gray-100"
              }`}
          >
            {isMuted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </Button>

          <Button
            onClick={toggleCamera}
            variant="outline"
            disabled={!hasCamera}
            className={`rounded-xl px-5 py-6 border transition-all duration-200 font-medium flex items-center gap-2 cursor-pointer ${hasCamera && !cameraOn ? "bg-red-500 text-white border-red-500 hover:bg-red-600" : "bg-white text-black border-white hover:bg-gray-100"} text-sm font-medium flex items-center gap-2 cursor-pointer`}
          >
            {cameraOn && hasCamera ? (
              <Camera className="h-4 w-4" />
            ) : (
              <CameraOff className="h-4 w-4" />
            )}
            {cameraOn && hasCamera ? "Camera Off" : "Camera On"}
          </Button>

          <Button
            onClick={endInterview}
            variant="destructive"
            className="rounded-xl px-5 py-6 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm flex items-center gap-2 border-t border-red-400/20 shadow-lg shadow-red-600/10 active:scale-95 transition-all cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" /> End & Review
          </Button>
        </div>
      </footer>

      <audio autoPlay ref={audioRef}></audio>
    </div>
  );
}

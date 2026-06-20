import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router"
import { BACKEND_URL } from "@/lib/config"
import { Button } from "./ui/button"
import {
  Award, MessageSquare, RotateCcw, ShieldAlert, CheckCircle2,
  Terminal, FileText, ChevronRight, Loader2, Sparkles
} from "lucide-react"

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { toast } from "sonner"
import axios from "axios"

interface Message {
  id: string;
  type: "User" | "Assistant";
  message: string;
}

interface InterviewData {
  id: string;
  githubMetadata: string; // JSON string
  status: string;
  score: number;
  feedback: string | null;
  conversation: Message[];
}

function parseMarkdownInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-white font-sans">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="bg-neutral-950 border border-white/5 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-xs font-medium">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(rawText: string): React.ReactNode {
  const lines = rawText.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let currentList: React.ReactNode[] = [];
  let currentListType: "ul" | "ol" | null = null;
  let currentListKey = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      const listKey = `list-${elements.length}-${currentListKey++}`;
      if (currentListType === "ul") {
        elements.push(
          <ul key={listKey} className="list-disc list-inside space-y-2 text-slate-300 pl-4 my-3">
            {currentList}
          </ul>
        );
      } else if (currentListType === "ol") {
        elements.push(
          <ol key={listKey} className="list-decimal list-inside space-y-2 text-slate-300 pl-4 my-3">
            {currentList}
          </ol>
        );
      }
      currentList = [];
      currentListType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // 1. Headings
    if (trimmed.startsWith("#")) {
      flushList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1]?.length || 0;
        const content = match[2] || "";
        const headingClasses =
          level === 1 ? "text-2xl font-extrabold text-white mt-8 mb-4 border-b border-white/10 pb-2" :
            level === 2 ? "text-xl font-bold text-white mt-6 mb-3 border-l-2 border-indigo-500 pl-3" :
              "text-lg font-semibold text-slate-200 mt-4 mb-2";
        elements.push(
          <h3 key={index} className={headingClasses}>
            {parseMarkdownInline(content)}
          </h3>
        );
        return;
      }
    }

    // 2. Unordered Lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (currentListType !== "ul") {
        flushList();
        currentListType = "ul";
      }
      const content = trimmed.substring(2);
      currentList.push(
        <li key={index} className="marker:text-indigo-400 text-slate-300">
          {parseMarkdownInline(content)}
        </li>
      );
      return;
    }

    // 3. Ordered Lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (currentListType !== "ol") {
        flushList();
        currentListType = "ol";
      }
      const content = olMatch[2] || "";
      currentList.push(
        <li key={index} className="marker:text-indigo-400 text-slate-300 font-medium">
          {parseMarkdownInline(content)}
        </li>
      );
      return;
    }

    // 4. Regular paragraph
    flushList();
    elements.push(
      <p key={index} className="text-slate-300 text-sm leading-relaxed my-2.5">
        {parseMarkdownInline(trimmed)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-1">{elements}</div>;
}

export default function Result() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [data, setData] = useState<InterviewData | null>(null);

  const evaluationSteps = [
    "Collecting chat transcript records...",
    "Reviewing candidate code answers...",
    "Cross-referencing against GitHub repository metadata...",
    "Assessing technical vocabulary and explanations...",
    "Synthesizing constructive suggestions...",
    "Calculating final performance score...",
    "Formatting reports..."
  ];

  useEffect(() => {
    let interval: Timer;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < evaluationSteps.length - 1 ? prev + 1 : prev));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const fetchAndEvaluate = async () => {
      toast.dismiss();
      try {
        // Step 1: Trigger evaluation
        console.log("Starting evaluation for interview:", interviewId);
        const evalResponse = await axios.post(`${BACKEND_URL}/api/v1/interview/${interviewId}/evaluate`);

        if (evalResponse.data && evalResponse.data.success) {
          // Step 2: Fetch full interview details (including conversation logs)
          const infoResponse = await axios.get(`${BACKEND_URL}/api/v1/interview/${interviewId}`);
          if (infoResponse.data && infoResponse.data.success) {
            setData(infoResponse.data.interview);
          } else {
            throw new Error("Could not retrieve interview records");
          }
        } else {
          throw new Error("Evaluation routine failed");
        }
      } catch (err: any) {
        console.error("Evaluation loading failure:", err);
        toast.error("Failed to compile evaluation: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    if (interviewId) {
      fetchAndEvaluate();
    }
  }, [interviewId]);

  if (loading) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-radial from-slate-950 via-neutral-950 to-black text-slate-100 flex flex-col justify-center items-center font-sans p-4">
        {/* Glowing backgrounds */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-[440px] bg-neutral-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-16 w-16 text-emerald-500 animate-spin" />
            <Award className="absolute h-6 w-6 text-slate-300" />
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-emerald-400">Compiling Feedback</h3>
            <p className="text-slate-400 text-xs px-4">
              Our AI is analyzing your answers and GitHub profile to build a custom performance scorecard.
            </p>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs bg-neutral-950/60 border border-white/5 px-4 py-2.5 rounded-xl font-mono justify-center">
            <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-pulse" />
            <span>{evaluationSteps[loadingStep]}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen w-screen bg-black text-slate-100 flex flex-col justify-center items-center p-4">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold">Session Not Found</h3>
        <p className="text-slate-500 mt-2 text-sm">We could not load any records for interview ID {interviewId}</p>
        <Button onClick={() => navigate("/")} className="mt-6 bg-neutral-800 rounded-xl px-5 py-2 hover:bg-neutral-700">
          Go Back Home
        </Button>
      </div>
    );
  }

  // Parse scraped repos
  let repos: any[] = [];
  try {
    repos = typeof data.githubMetadata === "string" ? JSON.parse(data.githubMetadata) : data.githubMetadata;
  } catch (err) {
    console.error("Failed to parse GitHub metadata:", err);
  }

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-slate-100 font-sans p-6 md:p-12 overflow-y-auto">

      {/* Background aesthetics */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-8">

        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Evaluation Scorecard
            </h1>
            <p className="text-slate-500 text-sm mt-1">Interview sandbox completed on Talentra AI</p>
          </div>
          <Button
            onClick={() => navigate("/")}
            className="
    rounded-xl
    bg-white
    text-black
    hover:bg-neutral-200
    font-medium
    px-4 py-2
    flex items-center gap-2
    shadow-md
    transition-all
    cursor-pointer
  "
          >
            <RotateCcw className="h-4 w-4" />
            Start New Session
          </Button>
        </div>

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Score Circle Panel */}
          <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
            <h3 className="text-slate-400 font-semibold text-sm mb-4 tracking-wider uppercase">Overall Rating</h3>

            {/* Score Ring */}
            <div className="relative flex items-center justify-center h-36 w-36 mb-4">
              <svg className="absolute h-full w-full -rotate-90">
                <circle
                  cx="72" cy="72" r="62"
                  className="stroke-neutral-800 fill-none"
                  strokeWidth="8"
                />
                <circle
                  cx="72" cy="72" r="62"
                  className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 62}
                  strokeDashoffset={2 * Math.PI * 62 * (1 - data.score / 100)}
                />
              </svg>
              <div className="flex flex-col items-center">
                <span className="text-4xl font-extrabold text-white">{data.score}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">out of 100</span>
              </div>
            </div>

            <span className={`px-3.5 py-1 rounded-full text-xs font-semibold ${data.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              data.score >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {data.score >= 80 ? 'Excellent Match' : data.score >= 60 ? 'Average Match' : 'Revision Suggested'}
            </span>
          </div>

          {/* GitHub Metadata Scraped Panel */}
          <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-lg md:col-span-2">
            <div>
              <h3 className="text-slate-400 font-semibold text-sm mb-4 tracking-wider uppercase flex items-center gap-2">
                <Github className="h-4 w-4 text-indigo-400" /> Linked GitHub Portfolio
              </h3>

              {repos && repos.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Scraped <span className="text-indigo-400 font-semibold">{repos.length} public repositories</span>.
                  </p>

                  {/* Top Repos list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {repos.slice(0, 4).map((r: any, idx: number) => (
                      <div key={idx} className="bg-neutral-950/50 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                        <div className="overflow-hidden">
                          <span className="font-medium text-xs text-slate-200 block truncate">{r.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{r.language || "Unknown Language"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-yellow-500 bg-yellow-500/5 px-2 py-0.5 rounded-lg border border-yellow-500/10 shrink-0">
                          <span>★</span>
                          <span>{r.starCount || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">No public repositories metadata was scraped during initialization.</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Status: <strong className="text-emerald-400 uppercase font-mono">Done</strong></span>
              <span>Session UUID: {data.id}</span>
            </div>
          </div>
        </div>

        {/* Detailed Evaluation & Transcript Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Left Column: AI Detailed Constructive Feedback Report (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-lg">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                <FileText className="h-5 w-5 text-indigo-400" /> AI Feedback Assessment
              </h2>

              {data.feedback ? (
                <div className="prose prose-invert prose-indigo max-w-none text-slate-300 text-sm leading-relaxed space-y-1">
                  {renderMarkdown(data.feedback)}
                </div>
              ) : (
                <p className="text-slate-500 italic text-sm">No feedback report text was compiled.</p>
              )}
            </div>
          </div>

          {/* Right Column: Scrolling transcript record */}
          <div className="space-y-6">
            <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg flex flex-col max-h-[640px] overflow-hidden">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/5 pb-4">
                <MessageSquare className="h-4 w-4 text-emerald-400" /> Chat Logs ({data.conversation?.length || 0})
              </h2>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
                {data.conversation && data.conversation.length > 0 ? (
                  data.conversation.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border text-xs leading-normal ${msg.type === "User"
                        ? "bg-emerald-950/15 border-emerald-500/10 text-emerald-100"
                        : "bg-indigo-950/15 border-indigo-500/10 text-indigo-100"
                        }`}
                    >
                      <span className={`text-[9px] font-mono font-bold tracking-wider uppercase block mb-1 ${msg.type === "User" ? "text-emerald-400" : "text-indigo-400"
                        }`}>
                        {msg.type === "User" ? "You" : "Talentra AI"}
                      </span>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 italic text-xs text-center py-8">No messages were recorded during this call.</p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}


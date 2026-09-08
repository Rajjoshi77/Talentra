import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router"
import { BACKEND_URL } from "@/lib/config"
import { Button } from "./ui/button"
import {
  Award, MessageSquare, RotateCcw, ShieldAlert, ShieldCheck, CheckCircle2,
  Terminal, FileText, ChevronRight, Loader2, Sparkles, AlertTriangle, Lock, Eye
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
import bgImageLoading from "../assets/image2.png"
import bgImageResult from "../assets/image3.png"


function getFactorScores(feedback: string | null, overallScore: number) {
  const safeScore = Math.min(Math.max(overallScore || 0, 0), 100);

  // 1. Try parsing structured EVAL_FACTORS JSON comment from feedback
  if (feedback) {
    const jsonMatch = feedback.match(/<!--\s*EVAL_FACTORS:\s*({.*?})\s*-->/s);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const gh = Math.min(Math.max(Number(parsed.github) || 0, 0), 100);
        const tech = Math.min(Math.max(Number(parsed.technical) || 0, 0), 100);
        const ps = Math.min(Math.max(Number(parsed.problemSolving) || 0, 0), 100);
        const test = Math.min(Math.max(Number(parsed.testing) || 0, 0), 100);
        const comm = Math.min(Math.max(Number(parsed.communication) || 0, 0), 100);

        return [
          {
            key: "github",
            label: "GitHub Code Quality & Portfolio",
            weight: "20%",
            weightNum: 0.20,
            score: gh,
            points: (gh * 0.20).toFixed(1),
            color: "from-cyan-500 to-blue-500",
            barColor: "bg-cyan-500",
            desc: "Repository structure, commit frequency, star ratings & tech stack"
          },
          {
            key: "technical",
            label: "Technical Depth & Accuracy",
            weight: "30%",
            weightNum: 0.30,
            score: tech,
            points: (tech * 0.30).toFixed(1),
            color: "from-indigo-500 to-purple-500",
            barColor: "bg-indigo-500",
            desc: "Domain knowledge, vocabulary and theoretical correctness during Q&A"
          },
          {
            key: "problemSolving",
            label: "Problem-Solving & System Design",
            weight: "20%",
            weightNum: 0.20,
            score: ps,
            points: (ps * 0.20).toFixed(1),
            color: "from-violet-500 to-fuchsia-500",
            barColor: "bg-violet-500",
            desc: "Architectural tradeoffs, scalability reasoning & edge-case handling"
          },
          {
            key: "testing",
            label: "Testing, Automation & CI/CD",
            weight: "15%",
            weightNum: 0.15,
            score: test,
            points: (test * 0.15).toFixed(1),
            color: "from-amber-500 to-orange-500",
            barColor: "bg-amber-500",
            desc: "Unit test presence, linting rules & automated deployment workflows"
          },
          {
            key: "communication",
            label: "Verbal Communication & Integrity",
            weight: "15%",
            weightNum: 0.15,
            score: comm,
            points: (comm * 0.15).toFixed(1),
            color: "from-emerald-500 to-teal-500",
            barColor: "bg-emerald-500",
            desc: "Answer articulation, professional delivery & proctoring trust verification"
          },
        ];
      } catch (e) { }
    }
  }

  // 2. Regex fallback parser
  const extractScore = (pattern: RegExp, fallback: number) => {
    if (!feedback) return fallback;
    const match = feedback.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num >= 0 && num <= 100) return num;
    }
    return fallback;
  };

  const github = extractScore(/GitHub.*?(\d{1,3})\s*(?:\/100|%|marks|points)/i, safeScore >= 50 ? Math.min(100, safeScore + 5) : safeScore);
  const technical = extractScore(/Technical Depth.*?(\d{1,3})\s*(?:\/100|%|marks|points)/i, safeScore);
  const problemSolving = extractScore(/Problem-Solving.*?(\d{1,3})\s*(?:\/100|%|marks|points)/i, safeScore);
  const testing = extractScore(/Testing.*?(\d{1,3})\s*(?:\/100|%|marks|points)/i, Math.max(0, safeScore - 10));
  const communication = extractScore(/Communication.*?(\d{1,3})\s*(?:\/100|%|marks|points)/i, safeScore);

  return [
    {
      key: "github",
      label: "GitHub Code Quality & Portfolio",
      weight: "20%",
      weightNum: 0.20,
      score: github,
      points: (github * 0.20).toFixed(1),
      color: "from-cyan-500 to-blue-500",
      barColor: "bg-cyan-500",
      desc: "Repository structure, commit frequency, star ratings & tech stack"
    },
    {
      key: "technical",
      label: "Technical Depth & Accuracy",
      weight: "30%",
      weightNum: 0.30,
      score: technical,
      points: (technical * 0.30).toFixed(1),
      color: "from-indigo-500 to-purple-500",
      barColor: "bg-indigo-500",
      desc: "Domain knowledge, vocabulary and theoretical correctness during Q&A"
    },
    {
      key: "problemSolving",
      label: "Problem-Solving & System Design",
      weight: "20%",
      weightNum: 0.20,
      score: problemSolving,
      points: (problemSolving * 0.20).toFixed(1),
      color: "from-violet-500 to-fuchsia-500",
      barColor: "bg-violet-500",
      desc: "Architectural tradeoffs, scalability reasoning & edge-case handling"
    },
    {
      key: "testing",
      label: "Testing, Automation & CI/CD",
      weight: "15%",
      weightNum: 0.15,
      score: testing,
      points: (testing * 0.15).toFixed(1),
      color: "from-amber-500 to-orange-500",
      barColor: "bg-amber-500",
      desc: "Unit test presence, linting rules & automated deployment workflows"
    },
    {
      key: "communication",
      label: "Verbal Communication & Integrity",
      weight: "15%",
      weightNum: 0.15,
      score: communication,
      points: (communication * 0.15).toFixed(1),
      color: "from-emerald-500 to-teal-500",
      barColor: "bg-emerald-500",
      desc: "Answer articulation, professional delivery & proctoring trust verification"
    },
  ];
}

interface Message {
  id: string;
  type: "User" | "Assistant";
  message: string;
}

interface InterviewData {
  id: string;
  githubMetadata: string; // JSON string
  resumeMetadata?: string | any;
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

const renderResumeItem = (item: any) => {
  if (typeof item === "string") {
    return item;
  }
  if (typeof item === "object" && item !== null) {
    const role = item.role || item.title || item.position || "";
    const company = item.company || item.employer || item.organization || "";
    const duration = item.duration || item.period || item.date || item.years || "";
    const description = item.description || item.details || "";

    return (
      <div className="space-y-1 text-left">
        <div className="flex justify-between items-start gap-2">
          <span className="font-semibold text-slate-200 text-xs">
            {role}{company ? ` @ ${company}` : ""}
          </span>
          {duration && (
            <span className="text-[10px] text-slate-500 font-mono shrink-0 font-medium">
              {duration}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-slate-400 font-light leading-normal">
            {description}
          </p>
        )}
      </div>
    );
  }
  return JSON.stringify(item);
};

const renderProjectItem = (item: any) => {
  if (typeof item === "string") {
    return item;
  }
  if (typeof item === "object" && item !== null) {
    const title = item.title || item.name || "";
    const technologies = Array.isArray(item.technologies) ? item.technologies.join(", ") : item.technologies || item.tech || "";
    const description = item.description || item.details || "";

    return (
      <div className="space-y-1 text-left">
        <div className="flex justify-between items-start gap-2">
          <span className="font-semibold text-slate-200 text-xs">
            {title}
          </span>
          {technologies && (
            <span className="text-[10px] text-indigo-400 font-mono shrink-0 font-medium bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.5 rounded">
              {technologies}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-slate-400 font-light leading-normal">
            {description}
          </p>
        )}
      </div>
    );
  }
  return JSON.stringify(item);
};

const renderCertificationItem = (item: any) => {
  if (typeof item === "string") {
    return item;
  }
  if (typeof item === "object" && item !== null) {
    const name = item.name || item.title || "";
    const issuer = item.issuer || item.authority || "";
    const date = item.date || item.year || "";

    return (
      <div className="flex justify-between items-start gap-2 text-xs text-left">
        <span className="font-semibold text-slate-200">
          {name}{issuer ? ` (${issuer})` : ""}
        </span>
        {date && (
          <span className="text-[10px] text-slate-500 font-mono shrink-0 font-medium">
            {date}
          </span>
        )}
      </div>
    );
  }
  return JSON.stringify(item);
};

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

  const [proctoring, setProctoring] = useState<any>(() => {
    if (!interviewId) return null;
    try {
      const raw = localStorage.getItem(`talentra_proctoring_${interviewId}`);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return null;
  });

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
        // Read latest proctoring data
        let currentProctoring = proctoring;
        if (!currentProctoring && interviewId) {
          try {
            const raw = localStorage.getItem(`talentra_proctoring_${interviewId}`);
            if (raw) {
              currentProctoring = JSON.parse(raw);
              setProctoring(currentProctoring);
            }
          } catch (e) { }
        }

        // Step 1: Trigger evaluation with proctoring telemetry
        console.log("Starting evaluation for interview:", interviewId, "Proctoring:", currentProctoring);
        const evalResponse = await axios.post(
          `${BACKEND_URL}/api/v1/interview/${interviewId}/evaluate`,
          { proctoring: currentProctoring }
        );

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
      <div
        className="relative h-screen w-screen overflow-hidden text-slate-100 flex flex-col justify-center items-center font-sans p-4"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, 0.75) 0%, rgba(9, 9, 11, 0.95) 100%), url(${bgImageLoading})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative z-10 w-full max-w-[440px] bg-neutral-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
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
    <div
      className="min-h-screen w-screen text-slate-100 font-sans p-6 md:p-12 overflow-y-auto"
      style={{
        backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, 0.85) 0%, rgba(9, 9, 11, 0.98) 100%), url(${bgImageResult})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
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

        {/* Top Overall Rating & 5-Factor Scorecard Breakdown */}
        {(() => {
          const factors = getFactorScores(data.feedback, data.score);
          const rawTotalPoints = factors.reduce((sum, f) => sum + (f.score * f.weightNum), 0);
          const computedSum = Math.round(rawTotalPoints);
          const displayScore = data.score !== undefined && data.score !== null ? data.score : computedSum;

          const strokeColor =
            displayScore >= 80 ? "#10b981" : // emerald-500
            displayScore >= 60 ? "#f59e0b" : // amber-500
            "#f43f5e"; // rose-500

          const scoreBadge =
            displayScore >= 85 ? {
              label: "Exceptional Match (Top Tier)",
              bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
              desc: "Outstanding technical depth and verified portfolio alignment."
            } : displayScore >= 70 ? {
              label: "Strong Candidate (Recommended)",
              bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              desc: "Solid domain competence with well-rounded problem-solving."
            } : displayScore >= 50 ? {
              label: "Moderate Match (Needs Practice)",
              bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              desc: "Shows foundation, but needs deeper technical articulation or test coverage."
            } : {
              label: "Incomplete / Needs Development",
              bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
              desc: "Unanswered questions, low test coverage, or critical knowledge gaps recorded."
            };

          return (
            <div className="space-y-6">
              {/* Overall Score + 5 Pillars Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Score Gauge Summary Card */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-between text-center shadow-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                  <div className="w-full flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-slate-400 font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Overall Score
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-neutral-950/70 border border-white/5 px-2 py-0.5 rounded">
                      Weighted 100%
                    </span>
                  </div>

                  {/* SVG Gauge */}
                  <div className="relative flex items-center justify-center h-44 w-44 my-4">
                    <svg className="absolute h-full w-full -rotate-90">
                      <circle
                        cx="88" cy="88" r="74"
                        className="stroke-neutral-800/80 fill-none"
                        strokeWidth="10"
                      />
                      <circle
                        cx="88" cy="88" r="74"
                        className="fill-none transition-all duration-1000 ease-out"
                        stroke={strokeColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 74}
                        strokeDashoffset={2 * Math.PI * 74 * (1 - displayScore / 100)}
                      />
                    </svg>
                    <div className="flex flex-col items-center z-10">
                      <span className="text-5xl font-black text-white tracking-tight">{displayScore}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mt-1 font-semibold">out of 100</span>
                    </div>
                  </div>

                  {/* Match Badge & Description */}
                  <div className="space-y-2 w-full">
                    <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-block ${scoreBadge.bg}`}>
                      {scoreBadge.label}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                      {scoreBadge.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 w-full flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Formula: Weighted Sum</span>
                    <span className="text-emerald-400 font-bold">{rawTotalPoints.toFixed(1)} / 100 pts</span>
                  </div>
                </div>

                {/* 5-Factor Weighted Scorecard Breakdown (Span 2) */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Award className="h-4 w-4 text-emerald-400" /> Evaluation Rating Breakdown
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Composite score calculated across 5 weighted assessment dimensions.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                        5 Pillars Evaluated
                      </span>
                    </div>

                    {/* Progress Bars for each factor */}
                    <div className="space-y-3.5 pt-1">
                      {factors.map((f, idx) => {
                        const factorPct = Math.min(Math.max(f.score, 0), 100);
                        const factorStroke =
                          f.score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                          f.score >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                          'text-rose-400 bg-rose-500/10 border-rose-500/20';

                        return (
                          <div key={idx} className="bg-neutral-950/40 border border-white/5 rounded-xl p-3 space-y-2 hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">{f.label}</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-neutral-900 border border-white/10 px-1.5 py-0.5 rounded">
                                  {f.weight} weight
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${factorStroke}`}>
                                  {f.score} / 100
                                </span>
                                <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 px-2 py-0.5 rounded">
                                  +{f.points} pts
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                              <div
                                className={`h-full bg-gradient-to-r ${f.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${factorPct}%` }}
                              />
                            </div>

                            <p className="text-[10px] text-slate-400 font-light">
                              {f.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mathematical Summation Equation */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-slate-400 text-[11px] font-mono">
                      <span>Σ Additions:</span>
                      {factors.map((f, i) => (
                        <span key={i} className="text-slate-300">
                          {f.points}{i < factors.length - 1 ? " +" : ""}
                        </span>
                      ))}
                      <span>= <strong className="text-white">{rawTotalPoints.toFixed(1)}</strong></span>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-300">
                      Total Added Score: <strong className="text-emerald-400 text-sm font-bold">{displayScore}</strong> / 100
                    </div>
                  </div>
                </div>

              </div>

              {/* GitHub Metadata Scraped Panel */}
              <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-4 mb-4">
                  <h3 className="text-slate-300 font-semibold text-sm tracking-wider uppercase flex items-center gap-2">
                    <Github className="h-4 w-4 text-indigo-400" /> Scraped GitHub Repositories ({repos?.length || 0})
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Status: <strong className="text-emerald-400 uppercase font-mono">Done</strong></span>
                    <span className="font-mono text-[11px] text-slate-500">Session ID: {data.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {repos && repos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                ) : (
                  <p className="text-slate-500 text-sm italic">No public repositories metadata was scraped during initialization.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Proctoring & Academic Integrity Audit Section */}
        {(() => {
          const score = proctoring?.integrityScore ?? 100;
          const tabSwitches = proctoring?.tabSwitchCount ?? 0;
          const pasteAttempts = proctoring?.pasteCount ?? 0;
          const fullscreenExits = proctoring?.fullscreenExitCount ?? 0;
          const violations: any[] = proctoring?.violations || [];

          const statusBadge =
            score >= 90 ? {
              label: "Verified Clean (High Trust)",
              bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              desc: "No unauthorized tab switching or external clipboard anomalies were detected.",
            } : score >= 70 ? {
              label: "Moderate Trust (Minor Flags)",
              bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              desc: "Occasional focus changes or minor window switches were recorded.",
            } : {
              label: "Suspicious Activity Flagged",
              bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
              desc: "Multiple tab switches, copy/paste attempts, or devtools access were intercepted.",
            };

          return (
            <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${score >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Proctoring & Integrity Audit
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time behavioral telemetry, focus tracking, and anti-cheating verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg}`}>
                    {statusBadge.label}
                  </span>
                  <span className="font-mono text-sm font-bold bg-neutral-950/70 border border-white/10 px-3 py-1 rounded-lg text-slate-200">
                    {score}% Trust
                  </span>
                </div>
              </div>

              {/* 3 Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-neutral-950/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider block">Tab Switches / Blur</span>
                    <span className="text-xl font-bold text-slate-200 mt-1 block">{tabSwitches}</span>
                  </div>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tabSwitches === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    <Eye className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-neutral-950/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider block">Clipboard Pastes</span>
                    <span className="text-xl font-bold text-slate-200 mt-1 block">{pasteAttempts}</span>
                  </div>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${pasteAttempts === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    <Lock className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-neutral-950/50 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider block">Fullscreen Exits</span>
                    <span className="text-xl font-bold text-slate-200 mt-1 block">{fullscreenExits}</span>
                  </div>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${fullscreenExits === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Event Logs List (if any) */}
              {violations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Recorded Incident Log ({violations.length})
                  </span>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                    {violations.map((v: any, idx: number) => (
                      <div key={idx} className="bg-neutral-950/40 border border-rose-500/10 p-2.5 rounded-lg flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-rose-300 capitalize">{v.type?.replace("_", " ")}</span>
                          <p className="text-slate-400 text-[11px]">{v.message}</p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">{v.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Resume Highlights Panel */}
        {(() => {
          let resumeInfo: any = null;
          if (data && data.resumeMetadata) {
            try {
              resumeInfo = typeof data.resumeMetadata === "string"
                ? JSON.parse(data.resumeMetadata)
                : data.resumeMetadata;
            } catch (err) {
              console.error("Failed to parse resume metadata:", err);
            }
          }

          if (!resumeInfo || (!resumeInfo.name && !resumeInfo.education && (!resumeInfo.skills || resumeInfo.skills.length === 0))) {
            return null;
          }

          return (
            <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg text-left">
              <h3 className="text-slate-400 font-semibold text-sm mb-6 tracking-wider uppercase flex items-center gap-2 border-b border-white/5 pb-3">
                <FileText className="h-4 w-4 text-emerald-400" /> Parsed Resume Highlights
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Candidate Details & Education */}
                <div className="space-y-4">
                  {resumeInfo.name && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Candidate Name</span>
                      <span className="text-lg font-bold text-slate-100">{resumeInfo.name}</span>
                    </div>
                  )}

                  {resumeInfo.education && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Education</span>
                      <span className="text-sm text-slate-300 block leading-relaxed">{resumeInfo.education}</span>
                    </div>
                  )}
                </div>

                {/* Skills */}
                <div className="space-y-2 md:col-span-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block mb-1">Key Skills Extracted</span>
                  {resumeInfo.skills && resumeInfo.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {resumeInfo.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs italic">No skills listed in the parsed data.</span>
                  )}
                </div>
              </div>

              {/* Experience / Projects / Certifications lists */}
              {((resumeInfo.experience && resumeInfo.experience.length > 0) ||
                (resumeInfo.projects && resumeInfo.projects.length > 0) ||
                (resumeInfo.certifications && resumeInfo.certifications.length > 0)) && (
                  <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Experience */}
                    {resumeInfo.experience && resumeInfo.experience.length > 0 && (
                      <div className="space-y-2.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Professional Experience</span>
                        <ul className="space-y-2">
                          {resumeInfo.experience.map((exp: any, idx: number) => (
                            <li key={idx} className="text-xs text-slate-300 bg-neutral-950/30 border border-white/5 rounded-lg p-2.5 leading-relaxed">
                              {renderResumeItem(exp)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Projects */}
                    {resumeInfo.projects && resumeInfo.projects.length > 0 && (
                      <div className="space-y-2.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Key Projects</span>
                        <ul className="space-y-2">
                          {resumeInfo.projects.map((proj: any, idx: number) => (
                            <li key={idx} className="text-xs text-slate-300 bg-neutral-950/30 border border-white/5 rounded-lg p-2.5 leading-relaxed">
                              {renderProjectItem(proj)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Certifications */}
                    {resumeInfo.certifications && resumeInfo.certifications.length > 0 && (
                      <div className="space-y-2.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Certifications</span>
                        <ul className="space-y-2">
                          {resumeInfo.certifications.map((cert: any, idx: number) => (
                            <li key={idx} className="text-xs text-slate-300 bg-neutral-950/30 border border-white/5 rounded-lg p-2.5 leading-relaxed">
                              {renderCertificationItem(cert)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
            </div>
          );
        })()}

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


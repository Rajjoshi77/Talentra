import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";
import { Play, Loader2, Sparkles, Terminal, Code, Brain, Layers, Monitor, Server } from "lucide-react";
import bgImage from "../assets/image.png";


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

const normalizeGithubProfile = (input: string) => {
  const value = input.trim().replace(/^@/, "");

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(www\.)?github\.com\//i.test(value)) {
    return `https://${value}`;
  }

  return `https://github.com/${value}`;
};

const ROLES = [
  {
    key: "Software Engineer",
    title: "Software Engineer",
    description: "Algorithms, DSA, clean code",
    icon: Code,
    color: "from-blue-500 to-indigo-500",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  {
    key: "AI Engineer",
    title: "AI Engineer",
    description: "LLMs, RAG, ML, APIs",
    icon: Brain,
    color: "from-purple-500 to-fuchsia-500",
    glow: "rgba(168, 85, 247, 0.15)",
  },
  {
    key: "Full Stack Engineer",
    title: "Full Stack/Web",
    description: "React, Node, DBs, Architectures",
    icon: Layers,
    color: "from-emerald-500 to-teal-500",
    glow: "rgba(16, 185, 129, 0.15)",
  },
  {
    key: "Frontend Engineer",
    title: "Frontend",
    description: "React, CSS, browser APIs, UX",
    icon: Monitor,
    color: "from-pink-500 to-rose-500",
    glow: "rgba(236, 72, 153, 0.15)",
  },
  {
    key: "Backend Engineer",
    title: "Backend",
    description: "Scale, DB, security, Docker",
    icon: Server,
    color: "from-amber-500 to-orange-500",
    glow: "rgba(245, 158, 11, 0.15)",
  },
];

const Form = () => {
  const [gitInput, setGitInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const navigate = useNavigate();
  const [resume, setResume] = useState<File | null>(null);
  const [selectedRole, setSelectedRole] = useState("Software Engineer");

  const loadingSteps = [
    "Analyzing GitHub profile...",
    "Parsing uploaded resume...",
    "Extracting skills and experience...",
    "Scanning repositories and activities...",
    "Building candidate profile...",
    "Generating personalized questions...",
    "Establishing WebRTC session...",
    "Initializing Talentra AI Interviewer...",
  ];

  useEffect(() => {
    let interval: Timer;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) =>
          prev < loadingSteps.length - 1 ? prev + 1 : prev,
        );
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gitInput.trim()) {
      toast.error("Please provide a valid GitHub username or profile link.");
      return;
    }

    setLoading(true);
    setLoadingStep(0);

    try {
      const githubUrl = normalizeGithubProfile(gitInput);

      const formData = new FormData();

      formData.append(
        "linkedIn",
        "https://linkedin.com/in/dummy-talentra"
      );

      formData.append("github", githubUrl);
      formData.append("role", selectedRole);

      if (resume) {
        formData.append("resume", resume);
      }

      const response = await axios.post(
        `${BACKEND_URL}/api/v1/pre-interview`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data && response.data.interviewId) {
        setTimeout(() => {
          navigate(`/interview/${response.data.interviewId}`);
        }, 1500);
      } else {
        toast.error("Failed to initialize interview. Please try again.");
        setLoading(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
        "Failed to parse GitHub profile. Make sure the username exists.",
      );
      setLoading(false);
    }
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden text-slate-100 flex flex-col justify-center items-center font-sans p-4"
      style={{
        backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, 0.75) 0%, rgba(9, 9, 11, 0.95) 100%), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 w-full max-w-[560px] bg-neutral-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.4)] transition-all duration-500">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-slate-800/80 border border-white/10 rounded-xl mb-4 shadow-sm">
            <Sparkles className="h-7 w-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Talentra AI
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide uppercase">
            Autonomous Technical Interviewer
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-6 text-center space-y-5 animate-fade-in">
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-16 w-16 text-indigo-500 animate-spin" />
              <Github className="absolute h-6 w-6 text-slate-300" />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-indigo-300">
                Setting up your sandbox
              </h3>
              <div className="h-1 w-48 bg-neutral-800 rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{
                    width: `${((loadingStep + 1) / loadingSteps.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm bg-neutral-950/60 border border-white/5 px-4 py-2 rounded-lg font-mono">
              <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="animate-pulse">{loadingSteps[loadingStep]}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Job Role Cards Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 px-0.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" /> Select Practice Track
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map((role) => {
                  const IconComponent = role.icon;
                  const isSelected = selectedRole === role.key;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => setSelectedRole(role.key)}
                      className={`flex items-start gap-3 text-left p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                        role.key === "Backend Engineer" ? "col-span-2" : "col-span-1"
                      } ${
                        isSelected
                          ? "bg-slate-900/40 border-indigo-500/70"
                          : "bg-black/20 border-neutral-900 hover:border-neutral-800 hover:bg-neutral-950/20"
                      }`}
                      style={
                        isSelected
                          ? {
                              boxShadow: `0 0 15px ${role.glow}`,
                            }
                          : {}
                      }
                    >
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${role.color} text-white shrink-0 shadow-md`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">{role.title}</div>
                        <div className="text-[10px] text-slate-500 leading-tight font-medium line-clamp-2">{role.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-1.5 px-0.5">
                  <Github className="h-4 w-4" /> GitHub Username or Profile
                </label>
                <div className="relative flex items-center">
                  <Input
                    placeholder="e.g., torvalds or github.com/torvalds"
                    value={gitInput}
                    onChange={(e) => setGitInput(e.target.value)}
                    disabled={loading}
                    className="bg-black/40 border-neutral-800 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 text-slate-100 placeholder-slate-600 h-12 rounded-xl text-base px-4 pr-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 px-0.5">
                  Resume (PDF/DOCX)
                </label>

                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setResume(file);
                    }
                  }}
                  className="bg-black/40 border-neutral-800 text-slate-100 h-12 rounded-xl cursor-pointer"
                />

                <p className="text-slate-500 text-xs px-0.5 font-light">
                  Upload your resume to generate personalized questions based on
                  experience, internships, projects, and skills.
                </p>

                {resume && (
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    Selected: {resume.name}
                  </div>
                )}
              </div>
              <p className="text-slate-500 text-[11px] px-0.5 font-light leading-normal">
                We'll scrape your public repos and parse your Resume to tailor custom questions matching your selected role track.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold text-base py-6 rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all duration-200 border border-indigo-500/30 shadow-md flex justify-center items-center gap-2 cursor-pointer"
            >
              Start Interview <Play className="h-4 w-4 fill-white text-white" />
            </Button>
          </form>
        )}
      </div>

      <div className="absolute bottom-6 text-slate-600 text-xs font-mono">
        Talentra Engine v1.0.0 - Powered by GPT-Realtime
      </div>
    </div>
  );
};

export default Form;

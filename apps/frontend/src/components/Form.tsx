import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";
import { Play, Loader2, Sparkles, Terminal } from "lucide-react";

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

const Form = () => {
  const [gitInput, setGitInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const navigate = useNavigate();

  const loadingSteps = [
    "Analyzing input profile...",
    "Contacting GitHub Metadata Scraper...",
    "Scanning public repositories and activities...",
    "Extracting languages and programming stats...",
    "Synthesizing customized interview questions...",
    "Establishing secure WebRTC audio channels...",
    "Initializing Talentra AI Interviewer session...",
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

      const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
        linkedIn: "https://linkedin.com/in/dummy-talentra",
        github: githubUrl,
      });

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
    <div className="relative h-screen w-screen overflow-hidden bg-radial from-slate-950 via-neutral-950 to-black text-slate-100 flex flex-col justify-center items-center font-sans p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[480px] bg-neutral-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-indigo-500 to-emerald-500 rounded-xl mb-4 shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-7 w-7 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
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
          <form onSubmit={onSubmit} className="space-y-6">
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
              <p className="text-slate-500 text-xs px-0.5 font-light">
                We'll scrape your public repos to tailor backend, frontend, or
                systems questions based on your actual stack.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold text-base py-6 rounded-xl hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] transition-all duration-200 border-t border-indigo-400/20 shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 cursor-pointer"
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

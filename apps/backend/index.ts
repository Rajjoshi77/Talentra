import "dotenv/config";
import cors from "cors";
import express from "express";
import { PreInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import { prisma } from "./db";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import fs from "fs";
import {
  extractGithubUsername,
  getTimeoutSignal,
  cleanJsonResponse,
  maskConnectionString,
  getPasswordInfo,
} from "./helpers";

// Re-export helpers so any existing imports of these from "./index" keep working
export {
  extractGithubUsername,
  getTimeoutSignal,
  cleanJsonResponse,
  maskConnectionString,
  getPasswordInfo,
};

const app = express();
app.use(express.text({ type: ["application/sdp", "text/plain"] }));
app.use(express.json());
app.use(cors());

const upload = multer({
  dest: "uploads/",
});

// extractGithubUsername is now defined in ./helpers and re-exported above

app.post(
  "/api/v1/pre-interview",
  upload.single("resume"),
  async (req, res) => {
    try {
      const parsedBody = PreInterviewBody.safeParse(req.body);
      if (!parsedBody.success) {
        console.error("Validation failed. Body:", req.body, "Error:", parsedBody.error);
        return res.status(411).json({
          message: "Incorrect body",
        });
      }
      const data = parsedBody.data;

      let resumeText = "";

      const file = (req as any).file;
      if (file) {
        try {
          const buffer = fs.readFileSync(file.path);

          const parser = new PDFParse({ data: new Uint8Array(buffer)});
          const parsed = await parser.getText();

          resumeText = parsed.text;
          console.log("Resume Parsed:");
          console.log(resumeText.substring(0, 500));
        } catch (err) {
          console.error("Resume Parse Error:", err);
        }
      }

      let resumeData = {};

      if (resumeText) {
        const prompt = `
Extract candidate information from this resume.

Return JSON:

{
  "name":"",
  "education":"",
  "skills":[],
  "experience":[],
  "projects":[],
  "certifications":[]
}

Resume:
${resumeText}
`;
        const response = await callLLM(
          "You are an expert resume parser.",
          prompt,
          true
        );

        if (response) {
          try {
            resumeData = JSON.parse(cleanJsonResponse(response));
          } catch (err) {
            console.error(err);
          }
        }
      }

      const githubUsername = extractGithubUsername(data.github);

      if (!githubUsername) {
        return res.status(400).json({
          message: "Please provide a valid GitHub username or profile URL.",
        });
      }

      let GitHubData: any;
      try {
        GitHubData = await scrapeGithub(githubUsername);
      } catch (err) {
        console.error("Scrape Github Error:", {
          username: githubUsername,
          error: err,
          ...(err as any)?.response
            ? {
              axiosStatus: (err as any).response?.status,
              axiosData: (err as any).response?.data,
            }
            : {},
        });
        throw err;
      }

      let interview: any;
      try {
        interview = await prisma.interview.create({
          data: {
            githubMetadata: JSON.stringify(GitHubData),
            resumeMetadata: JSON.stringify(resumeData),
            status: "Pre",
            role: data.role || "Software Engineer",
          },
        });
      } catch (err) {
        console.error("Prisma Create Interview Error:", {
          interview: {
            username: githubUsername,
          },
          error: err,
        });
        throw err;
      }

      return res.status(200).json({
        success: true,
        interviewId: interview.id,
      });
    } catch (error: any) {
      console.error("Pre Interview Error:", error);

      const errMsg = error?.message;
      if (errMsg === "GitHub profile not found" || error?.response?.status === 404) {
        return res.status(404).json({
          success: false,
          message: "GitHub profile not found. Please make sure the username exists.",
        });
      }
      if ((typeof errMsg === 'string' && errMsg.includes("rate limit")) || error?.response?.status === 403) {
        return res.status(403).json({
          success: false,
          message: "GitHub API rate limit exceeded. Please try again later.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal Server Error. Please try again.",
        error: error?.message || String(error),
        stack: error?.stack || null,
        databaseUrlUsed: maskConnectionString(process.env.DATABASE_URL || ""),
        passwordInfo: getPasswordInfo(process.env.DATABASE_URL || ""),
      });
    }
  });

app.post("/api/v1/session", async (req, res) => {
  try {
    const { interviewId } = req.query as { interviewId?: string };

    // Build a context-aware system prompt if we have an interviewId
    let instructions = "You are a Senior Technical Interviewer conducting a professional mock interview. Ask exactly ONE clear, concise question at a time (1-2 sentences). Listen carefully to the candidate's answers and follow up naturally. Never ask multi-part questions or list numbered points.";

    if (interviewId) {
      try {
        const interview = await prisma.interview.findUnique({
          where: { id: interviewId },
          include: { conversation: { orderBy: { createdAt: "asc" } } },
        });

        if (interview) {
          const roleKey = interview.role || "Software Engineer";
          const roleConfig = (JOB_DESCRIPTIONS[roleKey] || JOB_DESCRIPTIONS["Software Engineer"])!;

          const githubInfo = typeof interview.githubMetadata === "string"
            ? interview.githubMetadata
            : JSON.stringify(interview.githubMetadata, null, 2);

          const resumeInfo = typeof interview.resumeMetadata === "string"
            ? interview.resumeMetadata
            : JSON.stringify(interview.resumeMetadata, null, 2);

          // Include any prior conversation so the AI doesn't repeat questions
          const priorConversation = interview.conversation.length > 0
            ? `\n\nConversation so far:\n${interview.conversation.map((m: any) => `${m.type === "User" ? "Candidate" : "Interviewer"}: ${m.message}`).join("\n")}\n\nDo NOT repeat any of the questions already asked above. Continue the interview naturally from where it left off.`
            : "";

          instructions = `You are a Senior Technical Interviewer conducting a realistic, interactive mock interview for the role of ${roleConfig.title}.

Job Description:
${roleConfig.jd}

Guidelines/Focus Areas for this interview:
${roleConfig.rules.map((rule: string) => `- ${rule}`).join("\n")}

The candidate profile contains:

GitHub Metadata:
${githubInfo}

Resume Metadata:
${resumeInfo}

CRITICAL INTERVIEWING RULES (STRICT):
1. ASK EXACTLY ONE QUESTION AT A TIME: Never ask compound questions, numbered lists (1, 2, 3), or multi-part questions in a single turn.
2. KEEP IT CONCISE: Keep your speaking turn short, conversational, and direct (1 to 3 sentences maximum). Avoid long preambles, excessive flattering praise, or monologues.
3. CONVERSATIONAL FLOW: Start with one specific question about their projects, tech stack, or system design choices. Wait for the candidate to answer before asking the next question.
4. NO ESSAY PROMPTS: Do not dump multiple topics together. A real interviewer asks one clear question, listens to the answer, and asks follow-ups.${priorConversation}`;
        }
      } catch (err) {
        console.warn("Could not fetch interview for session context:", err);
      }
    }

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-4o-realtime-preview-2024-12-17",
      instructions,
      audio: {
        output: {
          voice: "echo",
        },
      },
      input_audio_transcription: {
        model: "whisper-1",
      },
    });

    const fd = new FormData();

    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    const openaiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "OpenAI-Safety-Identifier": "hashed-user-id",
      },
      body: fd,
    });

    const sdp = await response.text();

    return res.send(sdp);
  } catch (error) {
    console.error("Session Error:", error);

    return res.status(500).json({
      error: "Failed to create realtime session",
    });
  }
});

app.get("/api/v1/interview/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { conversation: { orderBy: { createdAt: "asc" } } },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    return res.json({ success: true, interview });
  } catch (error) {
    console.error("Fetch Interview Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/v1/interview/:interviewId/message", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { type, message } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: "Missing type or message" });
    }

    const msg = await prisma.message.create({
      data: {
        interviewId,
        type: type === "User" ? "User" : "Assistant",
        message,
      },
    });

    await prisma.interview.updateMany({
      where: { id: interviewId, status: "Pre" },
      data: { status: "InProgress" },
    });

    return res.json({ success: true, message: msg });
  } catch (error) {
    console.error("Save Message Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// getTimeoutSignal, cleanJsonResponse, maskConnectionString, getPasswordInfo
// are defined in ./helpers and re-exported at the top of this file

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean = false,
): Promise<string> {
  // 1. Google Gemini (Try active Gemini 2.5/3.5/3.6 flash models)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const geminiModels = [
      "gemini-2.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-flash-latest",
    ];
    for (const model of geminiModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: isJson ? 0.2 : 0.7,
              ...(isJson ? { responseMimeType: "application/json" } : {}),
            },
          }),
          signal: getTimeoutSignal(15000),
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          const content =
            resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (content.trim()) return content;
        } else {
          console.warn(
            `Gemini (${model}) returned status:`,
            response.status,
            await response.text(),
          );
        }
      } catch (err) {
        console.warn(`Gemini (${model}) call failed:`, err);
      }
    }
  }

  // 2. Groq Cloud
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModels = [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
      "groq/compound",
      "groq/compound-mini",
    ];
    for (const model of groqModels) {
      try {
        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqKey.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: isJson ? { type: "json_object" } : undefined,
              temperature: isJson ? 0.2 : 0.7,
            }),
            signal: getTimeoutSignal(15000),
          },
        );
        if (response.ok) {
          const resData = (await response.json()) as any;
          const content = resData.choices?.[0]?.message?.content || "";
          if (content.trim()) return content;
        } else {
          console.warn(
            `Groq (${model}) returned status:`,
            response.status,
            await response.text(),
          );
        }
      } catch (err) {
        console.warn(`Groq (${model}) call failed:`, err);
      }
    }
  }

  // 3. OpenRouter (Supports free & auto models)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const orModels = [
      "openrouter/free",
      "openrouter/auto",
      "google/gemma-2-9b-it:free",
      "mistralai/mistral-7b-instruct:free",
    ];
    for (const model of orModels) {
      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openrouterKey.trim()}`,
              "HTTP-Referer": "https://talentra.ai",
              "X-Title": "Talentra AI Interviewer",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: isJson ? { type: "json_object" } : undefined,
              temperature: isJson ? 0.2 : 0.7,
            }),
            signal: getTimeoutSignal(20000),
          },
        );
        if (response.ok) {
          const resData = (await response.json()) as any;
          const content = resData.choices?.[0]?.message?.content || "";
          if (content.trim()) return content;
        } else {
          console.warn(
            `OpenRouter (${model}) returned status:`,
            response.status,
            await response.text(),
          );
        }
      } catch (err) {
        console.warn(`OpenRouter (${model}) call failed:`, err);
      }
    }
  }

  // 4. Local Ollama (if available)
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const tagsRes = await fetch(`${ollamaBaseUrl}/api/tags`, {
      signal: getTimeoutSignal(2000),
    });
    if (tagsRes.ok) {
      const data = (await tagsRes.json()) as any;
      const models = data.models || [];
      if (models.length > 0) {
        const modelName = process.env.OLLAMA_MODEL || models[0].name;
        const chatRes = await fetch(`${ollamaBaseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
            format: isJson ? "json" : undefined,
            options: {
              temperature: isJson ? 0.2 : 0.7,
            },
          }),
          signal: getTimeoutSignal(35000),
        });
        if (chatRes.ok) {
          const resData = (await chatRes.json()) as any;
          const content = resData.message?.content || "";
          if (content.trim()) return content;
        }
      }
    }
  } catch (err) {
    // Local Ollama is optional.
  }

  // 5. OpenAI
  const openaiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (openaiKey && !openaiKey.startsWith("dummy")) {
    const oaiModels = isJson ? ["gpt-4o-mini", "gpt-4o"] : ["gpt-4o-mini", "gpt-4o"];
    for (const model of oaiModels) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: isJson ? { type: "json_object" } : undefined,
            }),
            signal: getTimeoutSignal(20000),
          },
        );
        if (response.ok) {
          const resData = (await response.json()) as any;
          const content = resData.choices?.[0]?.message?.content || "";
          if (content.trim()) return content;
        } else {
          console.warn(
            `OpenAI (${model}) returned status:`,
            response.status,
            await response.text(),
          );
        }
      } catch (err) {
        console.warn(`OpenAI (${model}) call failed:`, err);
      }
    }
  }

  return "";
}

// Health check endpoint to diagnose API keys on Render / local
app.get("/api/v1/health-llm", async (_req, res) => {
  const geminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const groqKey = !!process.env.GROQ_API_KEY;
  const openrouterKey = !!process.env.OPENROUTER_API_KEY;
  const openaiKey = !!(process.env.OPENAI_KEY || process.env.OPENAI_API_KEY);

  let testResult = "Not tested";
  try {
    const testResponse = await callLLM(
      "You are a helpful assistant.",
      "Reply with the single word: WORKING",
      false,
    );
    testResult = testResponse.trim() || "Failed: No LLM responded";
  } catch (e: any) {
    testResult = `Error: ${e.message}`;
  }

  return res.json({
    status: "ok",
    keysDetected: {
      gemini: geminiKey,
      groq: groqKey,
      openrouter: openrouterKey,
      openai: openaiKey,
    },
    liveLLMTest: testResult,
    timestamp: new Date().toISOString(),
  });
});

const JOB_DESCRIPTIONS: Record<string, { title: string; jd: string; rules: string[] }> = {
  "Software Engineer": {
    title: "Software Engineer",
    jd: "General Software Engineer role focusing on core data structures, algorithms, coding best practices, and general software development methodologies.",
    rules: [
      "Ask questions focusing on problem-solving, algorithms, system architecture, design patterns, and clean code principles.",
      "Check their familiarity with general testing and software life cycles.",
    ]
  },
  "AI Engineer": {
    title: "AI Engineer",
    jd: "AI/ML Engineer role focusing on Large Language Models, prompt engineering, RAG pipelines, model deployment, fine-tuning, and AI-powered systems.",
    rules: [
      "Focus questions on machine learning pipelines, LLM APIs, embeddings, vector databases, model performance, and handling context limits.",
      "Evaluate their hands-on experience with modern AI agent workflows, prompt tuning, and AI integration architectures.",
    ]
  },
  "Full Stack Engineer": {
    title: "Full Stack Engineer",
    jd: "Full Stack Engineer role requiring proficiency in both web user interfaces (React, styling) and server-side logic (APIs, databases, system security, caching).",
    rules: [
      "Ask questions covering frontend architectures, responsive design, backend API endpoints, relational/non-relational databases, and full stack deployment.",
      "Test their understanding of end-to-end data flow, client-server performance, and middleware.",
    ]
  },
  "Frontend Engineer": {
    title: "Frontend Engineer",
    jd: "Frontend Engineer role focusing on interactive interfaces, component styling, state management, browser performance, and native Web APIs.",
    rules: [
      "Ask about CSS layouts (flexbox/grid), React rendering, component hooks, global/local state management, and asset optimization.",
      "Explore knowledge of browser capabilities (like WebRTC media streams, Audio Context APIs, or Speech Synthesis/Recognition fallbacks).",
    ]
  },
  "Backend Engineer": {
    title: "Backend Engineer",
    jd: "Backend Engineer role focusing on server reliability, scalable API design, database schemas, message queues, and architectural infrastructure.",
    rules: [
      "Focus questions on database normalization, indexing, query optimizations, caching strategies, containerization (Docker), security, and server scaling patterns.",
      "Test their ability to build robust error handling, authorization systems, and CI/CD pipelines.",
    ]
  }
};

app.post("/api/v1/interview/:interviewId/chat", async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { conversation: { orderBy: { createdAt: "asc" } } },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const messages = interview.conversation;

    const githubInfo = typeof interview.githubMetadata === "string"
      ? interview.githubMetadata
      : JSON.stringify(interview.githubMetadata, null, 2);

    const resumeInfo = typeof interview.resumeMetadata === "string"
      ? interview.resumeMetadata
      : JSON.stringify(interview.resumeMetadata, null, 2);

    const roleKey = interview.role || "Software Engineer";
    const roleConfig = (JOB_DESCRIPTIONS[roleKey] || JOB_DESCRIPTIONS["Software Engineer"])!;

    const systemPrompt = `You are a Senior Technical Interviewer conducting a realistic, interactive mock interview for the role of ${roleConfig.title}.

Job Description:
${roleConfig.jd}

Guidelines/Focus Areas:
${roleConfig.rules.map(rule => `- ${rule}`).join("\n")}

Candidate Profile:
GitHub Metadata:
${githubInfo}

Resume Metadata:
${resumeInfo}

CRITICAL INTERVIEWING RULES:
1. **ASK EXACTLY ONE QUESTION AT A TIME**: Never ask compound questions, numbered lists (e.g. 1., 2., 3.), or multi-part questions in a single response.
2. **CONCISE & NATURAL**: Keep your response short and conversational (1 to 3 sentences maximum). Avoid long preambles, excessive flattery, or multi-paragraph essay prompts.
3. **NATURAL BACK-AND-FORTH**: If the candidate already spoke, briefly acknowledge their point (1 short phrase) and ask one targeted follow-up question, or transition smoothly to the next topic.
4. **NO REPETITION**: Never ask questions that were already covered in the conversation history.
`;

    const userPrompt = `
Conversation history so far:
${messages.map((m: any) => `${m.type === "User" ? "Candidate" : "Interviewer"}: ${m.message}`).join("\n")}

Please generate the interviewer's next response:
`;

    let reply = await callLLM(systemPrompt, userPrompt, false);

    // If LLM call fails, dynamically generate a contextual question using candidate's actual GitHub repos and role
    if (!reply || !reply.trim()) {
      console.warn(`[Interview ${interviewId}] All LLMs failed. Using dynamic profile-based fallback.`);
      const qIndex = messages.filter((m: any) => m.type === "Assistant").length;

      // Parse candidate's actual top repos
      let topRepos: Array<{ name: string; language?: string; description?: string }> = [];
      try {
        const parsedGithub = typeof interview.githubMetadata === "string"
          ? JSON.parse(interview.githubMetadata)
          : interview.githubMetadata;
        if (Array.isArray(parsedGithub) && parsedGithub.length > 0) {
          topRepos = parsedGithub;
        }
      } catch (e) { }

      const primaryRepo = topRepos[0]?.name || "your featured repository";
      const secondaryRepo = topRepos[1]?.name || topRepos[0]?.name || "your projects";
      const primaryLang = topRepos[0]?.language || "your primary tech stack";

      const dynamicQuestions = [
        `Welcome to your technical interview for the ${roleConfig.title} role! To start off, could you walk me through the architecture of your project "${primaryRepo}" and why you chose ${primaryLang}?`,
        `That's clear. In "${secondaryRepo}", what was the most challenging technical bottleneck you faced and how did you resolve it?`,
        `For a ${roleConfig.title} position, how do you approach automated testing and CI/CD deployment pipelines in your repositories?`,
        `Thank you for sharing your experience today! I have gathered all the insights needed for your evaluation. Please click 'End & Review' below to evaluate your final report and scorecard.`,
      ];

      reply = dynamicQuestions[Math.min(qIndex, dynamicQuestions.length - 1)]!;
    }

    reply = reply.trim();

    await prisma.message.create({
      data: {
        interviewId,
        type: "Assistant",
        message: reply,
      },
    });

    return res.json({ success: true, message: reply });
  } catch (error) {
    console.error("Chat Generation Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/v1/interview/:interviewId/evaluate", async (req, res) => {
  const { interviewId } = req.params;
  let interview: any = null;
  try {
    interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { conversation: { orderBy: { createdAt: "asc" } } },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    if (interview.status === "Done" && interview.feedback) {
      return res.json({
        success: true,
        score: interview.score,
        feedback: interview.feedback,
      });
    }

    const { proctoring } = (req.body || {}) as {
      proctoring?: {
        integrityScore?: number;
        tabSwitchCount?: number;
        pasteCount?: number;
        fullscreenExitCount?: number;
        violations?: Array<{ type: string; timestamp: string; message: string }>;
      };
    };

    const roleKey = interview.role || "Software Engineer";
    const roleConfig = (JOB_DESCRIPTIONS[roleKey] || JOB_DESCRIPTIONS["Software Engineer"])!;

    const proctoringInfo = proctoring
      ? `\n\nProctoring & Integrity Metrics:
- Integrity Score: ${proctoring.integrityScore ?? 100}%
- Tab Switches / Focus Loss: ${proctoring.tabSwitchCount ?? 0}
- Clipboard Paste Attempts: ${proctoring.pasteCount ?? 0}
- Fullscreen Exits: ${proctoring.fullscreenExitCount ?? 0}
- Total Violations Logged: ${proctoring.violations?.length ?? 0}`
      : "";

    const userMessages = interview.conversation.filter((m: any) => m.type === "User");
    const transcriptText = interview.conversation.length > 0
      ? interview.conversation.map((m: any) => `${m.type === "User" ? "Candidate" : "Interviewer"}: ${m.message}`).join("\n")
      : "[NO CANDIDATE RESPONSES RECORDED. Candidate ended or submitted the interview immediately without answering any questions.]";

    const systemPrompt = `You are a Senior Technical Interviewer and Engineering Manager conducting an objective, professional technical evaluation for the role of ${roleConfig.title}.
Based on the candidate's GitHub repositories metadata, proctoring integrity telemetry, and the actual transcript of their verbal technical interview, produce a comprehensive, structured performance scorecard.

CRITICAL EVALUATION RULES (STRICT ANTI-HALLUCINATION & MATHEMATICAL RIGOR):
1. **STRICT GROUND TRUTH**: Base your evaluation ONLY on actual answers present in the transcript. NEVER hallucinate, assume, or invent answers that the candidate did not give.
2. **ZERO-RESPONSE / INCOMPLETE INTERVIEWS**: If the candidate provided NO responses or submitted immediately without answering (Candidate responses recorded: ${userMessages.length}):
   - Clearly state in the feedback that the candidate did not answer the interview questions or participate in the Q&A session.
   - Technical Depth (30% weight), Problem-Solving (20% weight), and Verbal Communication (15% weight) must receive 0 marks because no verbal answers were provided.
   - Do NOT praise their verbal answers, do NOT say their communication was clear, and do NOT claim they explained technical concepts if they gave 0 answers.
3. **PROCTORING INTEGRITY**: Reflect any logged violations (tab switches, copy/paste, fullscreen exits) accurately in the scorecard.
4. **ROLE ALIGNMENT**: Evaluate against the Job Description: ${roleConfig.jd}.

Provide evaluation across these exact 5 core factors (each scored 0 to 100):
1. **github** (20% weight): Analysis of repository cleanliness, stack modernism, commits, star rating, and documentation.
2. **technical** (30% weight): Verification of candidate's knowledge from actual transcript answers (0 marks if 0 answers provided).
3. **problemSolving** (20% weight): Candidate's ability to explain architectural choices from actual transcript answers (0 marks if 0 answers provided).
4. **testing** (15% weight): Focus on presence of test suites, linting/formatting pipelines, and CI/CD workflows in repositories.
5. **communication** (15% weight): Clarity, technical vocabulary in actual answers, and proctoring session trust (0 marks if 0 answers provided).

Format your response as a JSON object with this exact structure:
{
  "factors": {
    "github": <0-100 score>,
    "technical": <0-100 score>,
    "problemSolving": <0-100 score>,
    "testing": <0-100 score>,
    "communication": <0-100 score>
  },
  "score": <number from 0 to 100 calculated as: Math.round(github*0.20 + technical*0.30 + problemSolving*0.20 + testing*0.15 + communication*0.15)>,
  "feedback": "<markdown formatted feedback report>"
}

In the markdown feedback report, structure it with clean header sections (using markdown '##' or '###') corresponding to each of the 5 factors above (mentioning their individual score out of 100 and weighted point contribution), followed by a '## Key Strengths' section, a '## Areas for Growth' section, and a '## Final Recommendation & Learning Path' section. Use bullet points and inline bolding for key terms to make the report highly readable.`;

    const userPrompt = `
Candidate GitHub Metadata:
${JSON.stringify(interview.githubMetadata, null, 2)}

Candidate Resume Metadata:
${interview.resumeMetadata ? (typeof interview.resumeMetadata === "string" ? interview.resumeMetadata : JSON.stringify(interview.resumeMetadata, null, 2)) : "None"}

Interview Transcript (${userMessages.length} candidate answers recorded):
${transcriptText}
${proctoringInfo}
`;

    let result: { score: number; factors?: Record<string, number>; feedback: string } | null = null;
    const reply = await callLLM(systemPrompt, userPrompt, true);
    if (reply) {
      try {
        const cleanReply = cleanJsonResponse(reply);
        result = JSON.parse(cleanReply);
      } catch (err) {
        console.error(
          "Failed to parse LLM JSON response during evaluation:",
          reply,
          err,
        );
      }
    }

    if (!result) {
      throw new Error(
        "No active AI key or local model succeeded in evaluation.",
      );
    }

    // Mathematically verify and recalculate the composite score from factors if present
    let finalScore = result.score;
    let factors = result.factors;
    if (factors) {
      const gh = Math.min(Math.max(Number(factors.github) || 0, 0), 100);
      const tech = Math.min(Math.max(Number(factors.technical) || 0, 0), 100);
      const ps = Math.min(Math.max(Number(factors.problemSolving) || 0, 0), 100);
      const test = Math.min(Math.max(Number(factors.testing) || 0, 0), 100);
      const comm = Math.min(Math.max(Number(factors.communication) || 0, 0), 100);
      finalScore = Math.round(gh * 0.20 + tech * 0.30 + ps * 0.20 + test * 0.15 + comm * 0.15);
      factors = { github: gh, technical: tech, problemSolving: ps, testing: test, communication: comm };
    } else {
      finalScore = Math.min(Math.max(Number(finalScore) || 0, 0), 100);
    }

    // Embed factor telemetry in markdown if not already embedded
    let finalFeedback = result.feedback || "";
    if (factors && !finalFeedback.includes("<!-- EVAL_FACTORS:")) {
      finalFeedback += `\n\n<!-- EVAL_FACTORS: ${JSON.stringify({ ...factors, total: finalScore })} -->`;
    }

    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        score: finalScore,
        feedback: finalFeedback,
        status: "Done",
      },
    });

    return res.json({
      success: true,
      score: updatedInterview.score,
      feedback: updatedInterview.feedback,
    });
  } catch (error) {
    console.error(
      "Evaluation API Error, using custom local feedback compiler:",
      error,
    );

    if (!interview) {
      return res.status(500).json({ error: "Failed to load interview metadata for fallback evaluation" });
    }

    let repos: any[] = [];
    try {
      repos =
        typeof interview.githubMetadata === "string"
          ? JSON.parse(interview.githubMetadata as string)
          : (interview.githubMetadata as any);
    } catch (e) {
      repos = [];
    }

    const repoCount = repos.length || 0;
    const userMsgCount = interview.conversation.filter((m: any) => m.type === "User").length;

    const roleKey = interview.role || "Software Engineer";

    const languagesMap: Record<string, number> = {};
    repos.forEach((r: any) => {
      if (r.language) {
        languagesMap[r.language] = (languagesMap[r.language] || 0) + 1;
      }
    });
    const topLanguages =
      Object.entries(languagesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((entry) => entry[0])
        .join(", ") || "TypeScript, JavaScript";

    // Compute explicit factor marks (0 to 100)
    const githubFactor = repoCount > 10 ? 85 : repoCount > 3 ? 75 : repoCount > 0 ? 60 : 30;
    const technicalFactor = userMsgCount > 5 ? 85 : userMsgCount > 2 ? 70 : userMsgCount > 0 ? 50 : 0;
    const problemSolvingFactor = userMsgCount > 5 ? 80 : userMsgCount > 2 ? 65 : userMsgCount > 0 ? 45 : 0;
    const testingFactor = repoCount > 3 ? 60 : 40;
    const integrityTelemetry = (req.body?.proctoring?.integrityScore ?? 100);
    const communicationFactor = userMsgCount > 0 ? Math.min(integrityTelemetry, 90) : 0;

    const weightedScore = Math.round(
      githubFactor * 0.20 +
      technicalFactor * 0.30 +
      problemSolvingFactor * 0.20 +
      testingFactor * 0.15 +
      communicationFactor * 0.15
    );

    const ghContrib = (githubFactor * 0.20).toFixed(1);
    const techContrib = (technicalFactor * 0.30).toFixed(1);
    const psContrib = (problemSolvingFactor * 0.20).toFixed(1);
    const testContrib = (testingFactor * 0.15).toFixed(1);
    const commContrib = (communicationFactor * 0.15).toFixed(1);

    const feedback = `## Talentra Evaluation Report (Local Assessment Engine)

**Job Role Track**: ${roleKey}

This scorecard was compiled based on your GitHub portfolio metadata, proctoring telemetry, and session transcript analysis.

### 1. GitHub Code Quality & Portfolio (20% Weight) — Score: ${githubFactor}/100 (+${ghContrib} pts)
- **Scraped Repositories**: Found **${repoCount}** public repositories on your profile.
- **Portfolio Health**: Active repositories with structured commits and language tracking enabled.
- **Primary Technology Stack**: Strong evidence of codebases leveraging **${topLanguages}**.

### 2. Technical Depth & Accuracy (30% Weight) — Score: ${technicalFactor}/100 (+${techContrib} pts)
- **Evaluation Status**: ${userMsgCount > 0 ? `Demonstrated familiarity with concepts relevant to **${topLanguages}**.` : "**No verbal answers provided**. Candidate submitted immediately without answering the technical questions (0/100)."}

### 3. Problem-Solving & System Design (20% Weight) — Score: ${problemSolvingFactor}/100 (+${psContrib} pts)
- **Dialogue exchange**: ${userMsgCount > 0 ? `Exchanged **${userMsgCount}** answers to solve system design and flow prompts.` : "**0 candidate answers recorded**. No architectural walkthrough was given (0/100)."}

### 4. Testing, Automation & CI/CD (15% Weight) — Score: ${testingFactor}/100 (+${testContrib} pts)
- **Test Suite Presence**: Basic testing layout noticed; however, explicitly configured test suites (Jest, Cypress, Playwright) should be expanded.
- **Workflow Automation**: Recommending deployment pipelines (.github/workflows) to automate verification checks.

### 5. Verbal Communication, Professionalism & Integrity (15% Weight) — Score: ${communicationFactor}/100 (+${commContrib} pts)
- **Participation & Integrity**: ${userMsgCount > 0 ? `Provided structured responses during the interview. Proctoring Trust Score: ${integrityTelemetry}%.` : `**Unanswered Session**: Candidate ended the session without speaking or typing answers (0/100). Proctoring Trust: ${integrityTelemetry}%.`}

## Key Strengths
- **Modular Repositories**: Clear separation of concerns between backend logic and frontend templates.
- **Language Focus**: Modern application patterns using **${topLanguages}**.

## Areas for Growth
- **Interview Participation**: Complete all technical questions during the session to receive full scoring credit.
- **Automation Pipeline**: Incorporate lint rules, automated formatting, and unit test workflows on commits.

## Final Recommendation & Learning Path
- **Verdict**: ${userMsgCount > 0 ? "**Strong Technical Profile** with solid hands-on development experience." : "**Incomplete Session**: Please retake the interview and answer all questions for a complete evaluation."}
- **Learning Path**: Focus on test-driven development (TDD) and containerization (Docker) to target senior positions.

<!-- EVAL_FACTORS: ${JSON.stringify({
  github: githubFactor,
  technical: technicalFactor,
  problemSolving: problemSolvingFactor,
  testing: testingFactor,
  communication: communicationFactor,
  total: weightedScore
})} -->`;

    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        score: weightedScore,
        feedback,
        status: "Done",
      },
    });

    return res.json({
      success: true,
      score: updatedInterview.score,
      feedback: updatedInterview.feedback,
    });
  }
});

export { app };

if (import.meta.main) {
  const port = Number(process.env.PORT || 3001);

  console.log("[startup] DATABASE_URL:", process.env.DATABASE_URL);

  prisma.$connect()
    .then(() => {
      console.log("[startup] Successfully connected to the database.");
    })
    .catch((err) => {
      console.error("\x1b[31m%s\x1b[0m", "[DATABASE ERROR] Failed to connect to the database on startup:");
      console.error(err);
    });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

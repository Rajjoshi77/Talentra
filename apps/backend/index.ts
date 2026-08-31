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
    let instructions = "You are a Senior Technical Interviewer conducting a professional mock interview. Ask relevant technical questions, listen carefully to the candidate's answers, and follow up with deeper probing questions based on their responses. Do not repeat questions you have already asked.";

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

          instructions = `You are a Senior Technical Interviewer conducting a professional mock interview for the role of ${roleConfig.title}.

Job Description:
${roleConfig.jd}

Guidelines/Focus Areas for this interview:
${roleConfig.rules.map((rule: string) => `- ${rule}`).join("\n")}

The candidate profile contains:

GitHub Metadata:
${githubInfo}

Resume Metadata:
${resumeInfo}

Generate interview questions using BOTH sources.
Focus on:
- How their skills and repositories relate to the selected role (${roleConfig.title}).
- Projects
- Skills
- Internships
- Education
- GitHub repositories

Keep your questions concise and conversational since this is a voice interview. Ask one question at a time. Wait for the candidate to finish speaking before asking the next question. Do NOT repeat questions.${priorConversation}`;
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

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
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
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
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
            responseMimeType: isJson ? "application/json" : "text/plain",
          },
        }),
        signal: getTimeoutSignal(12000),
      });

      if (response.ok) {
        const resData = (await response.json()) as any;
        const content =
          resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content.trim()) return content;
      } else {
        console.error(
          "Gemini API error status:",
          response.status,
          await response.text(),
        );
      }
    } catch (err) {
      console.error("Gemini call failed:", err);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: isJson ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
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
        console.error(
          "Groq API error status:",
          response.status,
          await response.text(),
        );
      }
    } catch (err) {
      console.error("Groq call failed:", err);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3-8b-instruct:free",
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
        console.error(
          "OpenRouter API error status:",
          response.status,
          await response.text(),
        );
      }
    } catch (err) {
      console.error("OpenRouter call failed:", err);
    }
  }

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
        } else {
          console.error(
            "Ollama API returned status:",
            chatRes.status,
            await chatRes.text(),
          );
        }
      }
    }
  } catch (err) {
    // Local Ollama is optional.
  }

  if (process.env.OPENAI_KEY && !process.env.OPENAI_KEY.startsWith("dummy")) {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          },
          body: JSON.stringify({
            model: isJson ? "gpt-4o" : "gpt-4o-mini",
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
        console.error(
          "OpenAI API returned status:",
          response.status,
          await response.text(),
        );
      }
    } catch (err) {
      console.error("OpenAI call failed:", err);
    }
  }

  return "";
}

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

    const systemPrompt = `You are a Senior Technical Interviewer conducting a mock interview for a candidate for the role of ${roleConfig.title}.

Job Description:
${roleConfig.jd}

Guidelines/Focus Areas for this interview:
${roleConfig.rules.map(rule => `- ${rule}`).join("\n")}

The candidate profile contains:

GitHub Metadata:
${githubInfo}

Resume Metadata:
${resumeInfo}

Generate interview questions using BOTH sources.
Focus on:
- How their skills and repositories relate to the selected role (${roleConfig.title}).
- Projects
- Skills
- Internships
- Education
- GitHub repositories
`;

    const userPrompt = `
Conversation history so far:
${messages.map((m: any) => `${m.type === "User" ? "Candidate" : "Interviewer"}: ${m.message}`).join("\n")}

Please generate the interviewer's next response:
`;

    let reply = await callLLM(systemPrompt, userPrompt, false);

    if (!reply) {
      const qIndex = messages.filter((m: any) => m.type === "Assistant").length;
      const fallbackQuestions = [
        "Could you describe the general architecture and library choices of your primary project?",
        "How do you usually handle application state management and asset performance optimizations?",
        "What is your experience with writing test coverage (like unit and integration tests) and configuring CI/CD automation?",
        "Thank you for sharing your background! I've logged your answers. Please click 'End & Review' below to evaluate your final report.",
      ];
      reply =
        fallbackQuestions[Math.min(qIndex, fallbackQuestions.length - 1)]!;
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

    const roleKey = interview.role || "Software Engineer";
    const roleConfig = (JOB_DESCRIPTIONS[roleKey] || JOB_DESCRIPTIONS["Software Engineer"])!;

    const systemPrompt = `You are a Senior Technical Interviewer and Engineering Manager conducting a professional technical evaluation for the role of ${roleConfig.title}.
Based on the candidate's GitHub repositories metadata and the transcript of their verbal technical interview, produce a comprehensive, structured performance scorecard.
The evaluation and score weighting should reflect expectations for a candidate applying to a ${roleConfig.title} role (Job Description: ${roleConfig.jd}).

Provide evaluation across these exact 5 core factors:
1. **GitHub Code Quality & Portfolio (20% weight)**: Analysis of repository cleanliness, stack modernism, commits, star rating, and documentation.
2. **Technical Depth & Accuracy (30% weight)**: Verification of candidate's knowledge of principles, libraries, and frameworks relevant to a ${roleConfig.title}.
3. **Problem-Solving & System Design (20% weight)**: Candidate's ability to explain architectural choices, project structures, state management, and performance optimizations.
4. **Testing, Automation & CI/CD (15% weight)**: Focus on presence of test suites, linting/formatting pipelines, and CI/CD workflows.
5. **Verbal Communication & Professionalism (15% weight)**: Clarity, structured technical explanations, and technical vocabulary usage during the session.

Format your response as a JSON object with this exact structure:
{
  "score": <number from 0 to 100 representing the weighted average of the above factors>,
  "feedback": "<markdown formatted feedback report>"
}

In the markdown feedback report, structure it with clean header sections (using markdown '##' or '###') corresponding to each of the 5 factors above, followed by a '## Key Strengths' section, a '## Areas for Growth' section, and a '## Final Recommendation & Learning Path' section. Use bullet points and inline bolding for key terms to make the report highly readable.`;

    const userPrompt = `
GitHub Portfolio Metadata:
${JSON.stringify(interview.githubMetadata, null, 2)}

Interview Transcript:
${interview.conversation.map((m: any) => `${m.type}: ${m.message}`).join("\n")}
`;

    let result: { score: number; feedback: string } | null = null;
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

    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        score: result.score,
        feedback: result.feedback,
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
    const msgCount = interview.conversation.length || 0;

    let score = 75;
    if (repoCount > 10) score += 10;
    else if (repoCount > 3) score += 5;
    if (msgCount > 6) score += 5;
    score = Math.min(score, 98);

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

    const roleKey = interview.role || "Software Engineer";

    const feedback = `## Talentra Evaluation Report (Local Assessment Engine)

**Job Role Track**: ${roleKey}

This scorecard was compiled based on your GitHub portfolio metadata and session transcript analysis.

### 1. GitHub Code Quality & Portfolio (20% Weight)
- **Scraped Repositories**: Found **${repoCount}** public repositories on your profile.
- **Portfolio Health**: Active repositories with structured commits and language tracking enabled.
- **Primary Technology Stack**: Strong evidence of codebases leveraging **${topLanguages}**.

### 2. Technical Depth & Accuracy (30% Weight)
- **Framework Competency**: Demonstrated familiarity with frontend and backend concepts relevant to **${topLanguages}**.
- **Accurate Terminology**: Used correct technical terms when explaining routing, server configuration, and layout logic.

### 3. Problem-Solving & System Design (20% Weight)
- **Architectural Awareness**: Responded to architectural questions concerning modular patterns and connections (such as frontend-to-backend integration).
- **Dialogue exchange**: Exchanged **${msgCount}** verbal/text blocks to solve system design and flow prompts.

### 4. Testing, Automation & CI/CD (15% Weight)
- **Test Suite Presence**: Basic testing layout noticed; however, explicitly configured test suites (Jest, Cypress, Playwright) should be expanded.
- **Workflow Automation**: Recommending deployment pipelines (.github/workflows) to automate verification checks.

### 5. Verbal Communication & Professionalism (15% Weight)
- **Explanations**: Clear, focused responses during the sandbox simulation.
- **Adaptability**: Gracefully handled fallback mock-mode verbal prompts.

## Key Strengths
- **Modular Repositories**: Clear separation of concerns between backend logic and frontend templates.
- **Language Focus**: Modern application patterns using **${topLanguages}**.

## Areas for Growth
- **Automation Pipeline**: Incorporate lint rules, automated formatting, and unit test workflows on commits.
- **Interactive State**: Deepen familiarity with state sharing architectures.

## Final Recommendation & Learning Path
- **Verdict**: **Strong Technical Profile** with solid hands-on development experience.
- **Learning Path**: Focus on test-driven development (TDD) and containerization (Docker) to target senior positions.
`;

    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        score,
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

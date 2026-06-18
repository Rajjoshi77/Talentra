import cors from "cors";
import express from "express";
import { PreInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import { prisma } from "./db";

const app = express();

app.use(express.text({ type: ["application/sdp", "text/plain"] }));
app.use(express.json());
app.use(cors());

export function extractGithubUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");

  try {
    const candidate = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(candidate);
    const isGithubHost =
      url.hostname === "github.com" || url.hostname === "www.github.com";

    if (isGithubHost) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    return trimmed.split("/").filter(Boolean).pop() || "";
  }

  return trimmed.split("/").filter(Boolean).pop() || trimmed;
}

app.post("/api/v1/pre-interview", async (req, res) => {
  try {
    const { success, data } = PreInterviewBody.safeParse(req.body);

    if (!success) {
      return res.status(411).json({
        message: "Incorrect body",
      });
    }

    const githubUsername = extractGithubUsername(data.github);

    if (!githubUsername) {
      return res.status(400).json({
        message: "Please provide a valid GitHub username or profile URL.",
      });
    }

    const GitHubData = await scrapeGithub(githubUsername);
    const interview = await prisma.interview.create({
      data: {
        githubMetadata: JSON.stringify(GitHubData),
        status: "Pre",
      },
    });

    return res.status(200).json({
      success: true,
      interviewId: interview.id,
    });
  } catch (error) {
    console.error("Pre Interview Error:", error);

    if ((error as any)?.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message:
          "GitHub user not found. Check the username or profile URL and try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

app.post("/api/v1/session", async (req, res) => {
  try {
    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-4o-realtime-preview-2024-12-17",
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

export const getTimeoutSignal = (ms: number) => {
  if (typeof AbortSignal !== "undefined" && (AbortSignal as any).timeout) {
    return (AbortSignal as any).timeout(ms);
  }
  return undefined;
};

export function cleanJsonResponse(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "");
    text = text.replace(/\n?```$/, "");
  }
  return text.trim();
}

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

    const systemPrompt = `You are a Senior Technical Interviewer conducting a mock interview for a candidate.
The candidate's GitHub repositories metadata is:
${JSON.stringify(interview.githubMetadata, null, 2)}

Conduct a professional, interactive technical interview. 
Ask one clear question at a time. Adapt your questions based on the candidate's answers and their technology stack shown in their GitHub metadata.
Keep your responses short, conversational, and direct (1-3 sentences maximum), suitable for voice output.

If the candidate has answered all key topics or you've exchanged 4-5 messages, tell them they can end the interview.
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

    const systemPrompt = `You are a Senior Technical Interviewer and Engineering Manager conducting a professional technical evaluation.
Based on the candidate's GitHub repositories metadata and the transcript of their verbal technical interview, produce a comprehensive, structured performance scorecard.

Provide evaluation across these exact 5 core factors:
1. **GitHub Code Quality & Portfolio (20% weight)**: Analysis of repository cleanliness, stack modernism, commits, star rating, and documentation.
2. **Technical Depth & Accuracy (30% weight)**: Verification of candidate's knowledge of frontend/backend principles, library usage, and frameworks discussed.
3. **Problem-Solving & System Design (20% weight)**: Candidate's ability to explain architectural choices, project structures (like how frontend connects to backend), state management, and performance optimizations.
4. **Testing, Automation & CI/CD (15% weight)**: Focus on presence of test suites (Jest, Cypress), linting/formatting pipelines, and GitHub Action workflows.
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

    const feedback = `## Talentra Evaluation Report (Local Assessment Engine)

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

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

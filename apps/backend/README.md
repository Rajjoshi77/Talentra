# Talentra AI — Backend Server

High-performance Express + TypeScript API server powering candidate profile analysis, multi-provider LLM interview dialogue, OpenAI Realtime WebRTC sessions, and structured evaluation scorecard generation.

---

## 🚀 Features

- **Profile Ingestion**: Scrapes public GitHub metadata, repository commit statistics, primary languages, and parses candidate resumes.
- **Dynamic Context Prompting**: Tailors questions to role requirements (`Software Engineer`, `AI Engineer`, `Full Stack Engineer`, `Frontend Engineer`, `Backend Engineer`) and actual candidate codebases.
- **Multi-Model LLM Resilience**: Automated cascade across Google Gemini (`gemini-2.5-flash-lite`, `gemini-3.5-flash`), Groq, OpenRouter, Ollama, and OpenAI.
- **Realtime WebRTC Voice**: Generates ephemeral session tokens for ultra-low latency audio conversations.
- **5-Factor Evaluation Engine**: Computes weighted scores ($20\% + 30\% + 20\% + 15\% + 15\%$) with anti-hallucination and proctoring telemetry audit.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/pre-interview` | Ingests GitHub URL & resume, initializes session in PostgreSQL. |
| `GET` | `/api/v1/interview/:id` | Retrieves interview session metadata and conversation history. |
| `POST` | `/api/v1/interview/:id/message` | Saves chat messages from user or assistant. |
| `POST` | `/api/v1/interview/:id/chat` | Generates next contextual interview question using active LLM. |
| `POST` | `/api/v1/interview/:id/evaluate` | Computes 5-pillar composite evaluation scorecard and feedback report. |
| `POST` | `/session` | Generates WebRTC session token for OpenAI Realtime voice. |
| `GET` | `/api/v1/health-llm` | Live diagnostic health check of all configured LLM API keys. |

---

## 🧪 Testing

```bash
# Run all backend unit tests
bun test
```

---

## 🛠️ Environment Variables

Create `.env` inside `apps/backend/`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_interviewer"
APP_PASSCODE="Rajjoshi_Talentra_Secured_2026"

# Voice & AI Keys
OPENAI_KEY=""
GEMINI_API_KEY=""
GROQ_API_KEY=""
OPENROUTER_API_KEY=""
```


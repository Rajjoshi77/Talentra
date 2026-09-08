# Talentra AI — Next-Gen AI Technical Interviewer & Proctoring Platform

Talentra AI is an intelligent, full-stack mock technical interview platform that crafts personalized, conversational technical interviews based on a candidate's GitHub repositories and parsed resume. It features real-time voice synthesis, multi-model AI resilience, compulsory hardware & fullscreen proctoring, incident telemetry logging, and a 5-factor weighted performance evaluation scorecard.

---

## 🌟 Key Highlights

- 🔍 **GitHub & Resume Personalization**: Scrapes public repositories and parses uploaded resumes to ask targeted, architectural questions tailored to the candidate's actual projects and tech stack.
- 🎙️ **Real-Time Voice & WebRTC**: Direct voice conversations powered by OpenAI Realtime WebRTC with browser speech synthesis and recognition fallback.
- 🛡️ **Compulsory Hardware & Proctoring Barrier**:
  - Mandatory Camera & Microphone permission verification before entering the interview sandbox.
  - Compulsory Fullscreen Lock barrier: candidate cannot interact or proceed unless full screen is active.
  - Live anti-cheating telemetry tracking: tab switches, window blur events, clipboard paste interception, and devtools access.
- ⚡ **Multi-Provider LLM Resilience**:
  - Automated fallback cascade across Google Gemini (`gemini-2.5-flash-lite`, `gemini-3.5-flash`), Groq, OpenRouter, local Ollama, and OpenAI.
  - High-availability offline evaluation fallback engine.
- 📊 **5-Factor Weighted Competency Scorecard**:
  - Interactive SVG circular score gauge with dynamic color coding (Emerald $\ge 80$, Amber $60-79$, Rose $< 60$).
  - Animated progress bars displaying individual factor scores, weights, and exact points contributions:
    1. **GitHub Code Quality & Portfolio (20% Weight)**
    2. **Technical Depth & Accuracy (30% Weight)**
    3. **Problem-Solving & System Design (20% Weight)**
    4. **Testing, Automation & CI/CD (15% Weight)**
    5. **Verbal Communication, Professionalism & Integrity (15% Weight)**
  - Transparent mathematical formula summation ($\Sigma\ \text{Points} = \text{Overall Score}$).
- 📝 **Proctoring Incident Audit & Resume Highlights**: Detailed violation timelines and extracted resume achievements displayed directly on the results dashboard.

---

## 🏗️ Architecture & Monorepo Structure

```text
AI_Interviewer/
├── apps/
│   ├── backend/                     # Express + TypeScript + Bun API Server
│   │   ├── prisma/                  # Prisma schema & PostgreSQL migrations
│   │   ├── scrapers/                # GitHub profile & repository scraper
│   │   ├── db.ts                    # Prisma database client
│   │   ├── helpers.ts               # JSON cleaners, username parsers, signal helpers
│   │   ├── index.ts                 # Express routes (pre-interview, voice, chat, evaluate)
│   │   ├── index.test.ts            # Bun test suite (15 unit tests)
│   │   └── types.ts                 # Zod validation schemas
│   │
│   ├── frontend/                    # React 18 + Vite + Tailwind CSS + Bun
│   │   ├── src/
│   │   │   ├── components/          # UI Components (Form, Interview, Result, UI primitives)
│   │   │   │   ├── Form.tsx         # Setup wizard (Role selection, GitHub URL, Resume upload)
│   │   │   │   ├── Interview.tsx    # Live interview sandbox with Audio visualizer & Proctoring HUD
│   │   │   │   ├── Result.tsx       # 5-Pillar Scorecard, Proctoring Audit, Resume Highlights
│   │   │   │   └── ui/              # shadcn-style modular UI primitives
│   │   │   ├── hooks/
│   │   │   │   └── useProctoring.ts # Hardware validation, fullscreen lock & telemetry listener
│   │   │   ├── lib/                 # Backend URL configuration & Tailwind utility helpers
│   │   │   └── assets/              # Premium background gradients & illustrations
│   │   └── build.ts                 # Bun production build script
│   └── (clean workspace)
│
├── packages/                        # Shared workspace configurations & UI packages
│   ├── eslint-config/               # Shared ESLint rules
│   ├── typescript-config/           # Shared TypeScript tsconfig presets
│   └── ui/                          # Shared React UI components
│
├── Images/                          # Platform preview screenshots
├── package.json                     # Monorepo root scripts & dependencies
├── turbo.json                       # Turborepo task pipeline configuration
└── README.md                        # Master documentation
```

---

## ⚙️ Prerequisites & Environment Setup

- **Runtime**: [Bun](https://bun.sh/) 1.3 or higher
- **Database**: PostgreSQL 14+ (or Docker / cloud hosted)
- **AI Keys**: (At least one active key recommended for live AI generation)
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY`
  - `OPENAI_KEY` (Required for OpenAI Realtime voice)
  - `GROQ_API_KEY` (Optional)
  - `OPENROUTER_API_KEY` (Optional)

### Backend Environment Configuration (`apps/backend/.env`)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_interviewer"
APP_PASSCODE="Rajjoshi_Talentra_Secured_2026"

# Realtime WebRTC Voice
OPENAI_KEY="sk-..."

# Fallback AI Providers
GEMINI_API_KEY="AIzaSy..."
GROQ_API_KEY="gsk_..."
OPENROUTER_API_KEY="sk-or-v1-..."

# Optional Local Ollama
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3"
```

### Frontend Environment Configuration (`apps/frontend/.env`)

```env
VITE_BACKEND_URL="http://localhost:3001"
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
bun install
```

### 2. Initialize Database & Run Migrations
```bash
cd apps/backend
bunx prisma db push
```

### 3. Start Development Servers
From the root directory:
```bash
bun run dev
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API Server**: `http://localhost:3001`
- **LLM Health Diagnostics**: `http://localhost:3001/api/v1/health-llm`

---

## 🧪 Comprehensive Testing Suite

Talentra AI includes automated unit and integration tests written with `bun:test`.

```bash
# Run all backend unit tests
cd apps/backend
bun test
```

### Test Coverage Summary:
- ✅ **JSON Response Sanitization**: Stripping markdown wrappers and fixing raw LLM outputs.
- ✅ **Timeout & AbortSignals**: Preventing hanging external API requests.
- ✅ **GitHub Username Parser**: Normalizing profiles, query strings, and raw URLs.
- ✅ **Zod Request Validation**: Validating required pre-interview fields.
- ✅ **5-Factor Score Calculations**: Mathematically verifying weighted ratings ($20\% + 30\% + 20\% + 15\% + 15\%$).
- ✅ **Anti-Hallucination & 0-Answer Penalties**: Accurate scoring of incomplete/empty submissions.
- ✅ **EVAL_FACTORS Telemetry Extraction**: Parsing embedded structured factor metadata.
- ✅ **Proctoring Telemetry Trust Deductions**: Validating penalty scoring for tab switches and fullscreen exits.

---

## 📊 Evaluation Rubric & Scoring Weights

$$\text{Overall Rating} = \sum (\text{Factor Score} \times \text{Weight})$$

| Factor | Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **GitHub Code Quality & Portfolio** | **20%** | Repository structure, stack modernism, commit frequency, star ratings, and documentation. |
| **Technical Depth & Accuracy** | **30%** | Correctness of explanations, technical vocabulary, and foundational knowledge during Q&A. |
| **Problem-Solving & System Design** | **20%** | Ability to explain architecture, scalability trade-offs, and edge-case handling. |
| **Testing, Automation & CI/CD** | **15%** | Presence of test suites (Jest/Cypress/Playwright), linting rules, and CI/CD pipelines. |
| **Verbal Communication & Integrity** | **15%** | Speech articulation, professional delivery, and proctoring session trust score. |

---

## 🔒 Security & Proctoring Details

- **Camera & Mic Lock**: Verified via `navigator.mediaDevices.getUserMedia` before entry.
- **Fullscreen Guard**: Monitored via document fullscreen events (`fullscreenchange`). The candidate cannot see questions or speak until full screen is restored.
- **Tab & Window Focus**: Tracks `visibilitychange` and window `blur` events with precise timestamps.
- **Clipboard & Devtools Lock**: Prevents pasting code answers from external sources and detects inspection attempts.
- **Privacy First**: Resumes and session telemetry are stored securely and never committed to version control.

---

## 📄 License

Proprietary © 2026 Talentra AI. All rights reserved.


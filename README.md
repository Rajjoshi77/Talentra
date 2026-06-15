# Talentra AI Interviewer (Monorepo)

Talentra is a technical AI interviewer dashboard. It analyzes a candidate's public GitHub repositories and conducts real-time verbal or text-based mock interviews tailored to their exact technology stack. It evaluates candidates across 5 weighted dimensions and generates rich technical scorecards.

---

## 🚀 Key Features

* **GitHub Portfolio Scraper**: Automatically analyzes public repositories, star counts, and dominant languages.
* **Dual Interview Session Modes**:
  * **Real-time WebRTC Audio (Paid)**: Direct high-fidelity voice link with OpenAI Realtime API.
  * **Interactive Voice/Text Sandbox (100% Free)**: Graceful fallback utilizing browser-native Speech Synthesis (voice output) and Speech Recognition (speech-to-text) if OpenAI quota limits are exceeded.
* **Unified Multi-LLM Engine**: Dynamic failover support for:
  1. **Google Gemini 1.5 Flash** (Free Tier - 15 requests/min)
  2. **Groq Cloud** (Free Tier - Llama 3.3 / Llama 3.1)
  3. **OpenRouter** (Free Tier - Llama 3.0 / Gemma)
  4. **Local Ollama** (Fully Offline - Llama 3 / Qwen)
  5. **OpenAI GPT-4o** (Paid)
* **Structured Evaluation Scorecard**: Weighted performance analytics across 5 key metrics:
  * *GitHub Portfolio Health* (20%)
  * *Technical Depth & Accuracy* (30%)
  * *Problem-Solving & System Design* (20%)
  * *Testing & CI/CD Best Practices* (15%)
  * *Verbal Communication & Professionalism* (15%)
* **Sleek UI/UX**: Dark mode glassmorphic React dashboard with pulsing audio volume halo visualizers.

---

## 📁 Project Structure

```text
AI_Interviewer/
├── apps/
│   ├── backend/                # Express, Prisma ORM, and Bun Server
│   │   ├── prisma/             # Schema definitions and database clients
│   │   ├── scrapers/           # GitHub profile scraper
│   │   ├── index.ts            # REST server routes & CallLLM routing logic
│   │   ├── index.test.ts       # Backend unit test suites
│   │   └── .env.example        # Environment variable template
│   └── frontend/               # React (TSX) SPA UI Dashboard
│       └── src/
│           ├── components/     # UI Pages (Form, Interview Screen, Result Scorecard)
│           └── lib/            # Configuration constants
├── package.json                # Turborepo configurations
└── README.md                   # Project documentation
```

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
Ensure you have [Bun](https://bun.sh) and [PostgreSQL](https://www.postgresql.org/) installed and active.

### 2. Database Setup
Ensure a database named `ai_interviewer` is initialized on your local Postgres instance.

### 3. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/Rajjoshi77/Talentra.git
cd AI_Interviewer

# Install all monorepo dependencies
bun install
```

### 4. Configuration Setup
Navigate to the backend app, copy the configuration template, and add your API credentials:
```bash
cd apps/backend
cp .env.example .env
```
*Modify `.env` to include your Database Connection String and your preferred free API Keys (like `GROQ_API_KEY` or `GEMINI_API_KEY`).*

### 5. Synchronize Schema
Ensure database schemas match the Prisma configuration:
```bash
bunx prisma db push
```

### 6. Start Development Servers
From the root workspace, run the following command to boot up both the frontend and backend servers:
```bash
bun run dev
```
* The **Frontend** will be served at `http://localhost:3000`
* The **Backend** will be served at `http://localhost:3001`

---

## 🧪 Testing

We use Bun's built-in high-performance test runner for unit testing backend helpers.

### Run tests in backend:
```bash
cd apps/backend
bun test
```

### Run tests via Monorepo workspace (from root):
```bash
bun run test
```

---

## 📝 License
Proprietary / Monorepo setup. Developed by Rajjoshi77.

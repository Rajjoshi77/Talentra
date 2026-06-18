# Talentra AI Interviewer

Talentra AI Interviewer is a full-stack technical interview platform that creates personalized mock interviews from a candidate's public GitHub profile. It combines repository analysis, real-time voice interaction, multi-provider LLM fallback, transcript capture, and structured performance evaluation in one monorepo.

## Highlights

- GitHub-based interview personalization from public repository metadata.
- Real-time voice interviews through the OpenAI Realtime API.
- Offline-friendly mock mode using browser speech synthesis and speech recognition.
- Multi-provider response generation with Gemini, Groq, OpenRouter, Ollama, and OpenAI fallback support.
- Persistent interview transcripts and evaluation reports through Prisma.
- Weighted scorecard covering code quality, technical depth, system design, testing, and communication.
- React interview room with voice activity visualization and animated interviewer presence.

## Tech Stack

- Runtime and package manager: Bun
- Monorepo orchestration: Turborepo
- Frontend: React, TypeScript, Tailwind CSS, shadcn-style UI primitives
- Backend: Express, TypeScript, Prisma
- Database: PostgreSQL
- AI providers: OpenAI Realtime, OpenAI Chat Completions, Gemini, Groq, OpenRouter, Ollama

## Repository Structure

```text
AI_Interviewer/
|-- apps/
|   |-- backend/
|   |   |-- generated/          # Generated Prisma client
|   |   |-- prisma/             # Prisma schema and migrations
|   |   |-- scrapers/           # GitHub metadata scraper
|   |   |-- db.ts               # Prisma database client
|   |   |-- index.ts            # API server and interview workflow
|   |   `-- types.ts            # Request validation schemas
|   |-- frontend/
|   |   |-- src/
|   |   |   |-- components/     # Form, interview, result, and UI components
|   |   |   `-- lib/            # Shared frontend configuration
|   |   `-- build.ts            # Bun frontend build script
|   |-- docs/                   # Documentation app scaffold
|   `-- web/                    # Web app scaffold
|-- packages/                   # Shared configuration and UI package workspace
|-- package.json
|-- turbo.json
`-- README.md
```

## Prerequisites

- Bun 1.3 or newer
- PostgreSQL database
- At least one supported LLM provider key for dynamic interview generation
- OpenAI API key for real-time voice interviews

The application can still run in fallback paths when some providers are not configured, but the best experience requires both database access and at least one LLM provider.

## Environment Variables

Create `apps/backend/.env` and configure the values you need:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
APP_PASSCODE="Rajjoshi_Talentra_Secured_2026"

OPENAI_KEY=""
GEMINI_API_KEY=""
GROQ_API_KEY=""
OPENROUTER_API_KEY=""

OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL=""
```

Set this variable for deployed frontend builds:

```env
BACKEND_URL="https://your-backend-domain.example.com"
```

`APP_PASSCODE` is required by the backend startup guard. `OPENAI_KEY` is required for the real-time WebRTC voice session. The other AI keys are optional fallback providers for text interview generation and evaluation.

## Setup

Install dependencies from the repository root:

```bash
bun install
```

Prepare the database:

```bash
cd apps/backend
bunx prisma db push
```

Start the full development workspace:

```bash
cd ../..
bun run dev
```

Default local services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Common Commands

```bash
bun run dev
bun run build
bun run test
bun run check-types
```

Run the frontend directly:

```bash
cd apps/frontend
bun run dev
bun run build
```

Run backend tests:

```bash
cd apps/backend
bun test
```

## Interview Flow

1. The candidate enters a GitHub username or profile URL.
2. The backend normalizes the GitHub input and scrapes public repository metadata.
3. The backend creates an interview record.
4. The interview room starts a WebRTC voice session when OpenAI Realtime is available.
5. If real-time audio cannot start, the app falls back to mock mode with browser-native speech.
6. Responses are stored as transcript messages.
7. The evaluation endpoint creates a structured report and scorecard from the transcript and repository metadata.

## Evaluation Model

The scorecard is organized around five weighted dimensions:

- GitHub code quality and portfolio: 20%
- Technical depth and accuracy: 30%
- Problem solving and system design: 20%
- Testing, automation, and CI/CD: 15%
- Verbal communication and professionalism: 15%

## Deployment Notes

- Set `BACKEND_URL` during the frontend build so deployed clients do not call `localhost`.
- Configure `APP_PASSCODE` in the backend environment before starting the server.
- Configure `OPENAI_KEY` for real-time voice mode.
- Proxy variables are optional; the GitHub scraper only enables proxy mode when all proxy settings are present.
- GitHub profile inputs may be provided as usernames, `github.com/user`, or full profile URLs.

## Development Notes

- Keep generated files and unrelated workspace scaffolds out of feature changes unless they are required.
- Prefer focused changes in `apps/frontend/src/components` and `apps/backend/index.ts` for interview behavior.
- Avoid logging sensitive environment values, SDP payloads, or provider responses in production paths.
- Regenerate or push Prisma schema changes whenever the database model changes.

## License

This project is proprietary. See [LICENSE](LICENSE) for details.

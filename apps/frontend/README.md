# Talentra AI — Frontend Client

Modern, responsive React 18 single-page application built with Vite, TypeScript, and Tailwind CSS. Provides a live mock interview sandbox, compulsory hardware & fullscreen proctoring barrier, audio visualizers, and interactive 5-pillar scorecard dashboards.

---

## 🎨 Key Features

- **Setup & Ingestion Wizard (`Form.tsx`)**: Target role selection, GitHub profile validation, PDF resume upload with live preview.
- **Proctoring Barrier & Live HUD (`Interview.tsx`, `useProctoring.ts`)**:
  - Compulsory Camera & Microphone permission barrier.
  - Fullscreen Lock enforcement — freezes test until full screen is restored.
  - Real-time Trust indicator (100% $\rightarrow$ deductions on focus loss or paste).
- **Interactive Voice & Audio Visualizer**: Live audio waveforms for candidate microphone and AI assistant speech.
- **5-Pillar Scorecard Dashboard (`Result.tsx`)**: Dynamic SVG score gauge, animated progress bars for each competency pillar, proctoring incident timeline, and parsed resume highlights.

---

## 🏗️ Folder Layout

```text
src/
├── components/
│   ├── Form.tsx             # Setup wizard
│   ├── Interview.tsx        # Live sandbox & voice UI
│   ├── Result.tsx           # 5-Pillar Scorecard & Proctoring Audit
│   └── ui/                  # Buttons, cards, inputs, dialogs
├── hooks/
│   └── useProctoring.ts     # Telemetry & proctoring event listeners
├── lib/
│   ├── config.ts            # Backend API base URL
│   └── utils.ts             # Tailwind class merges (clsx + twMerge)
└── assets/                  # High-resolution dark theme backgrounds
```

---

## 🚀 Running Locally

```bash
# Start development server
bun dev

# Production build
bun run build.ts
```


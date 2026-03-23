# EU Cosmetics Compliance Agent

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-8E75B2?logo=google&logoColor=white)
![Mastra](https://img.shields.io/badge/Mastra-AI_Agent-000000)
![License](https://img.shields.io/badge/License-MIT-green)

Full-stack application that checks cosmetic ingredient compliance against **Regulation (EC) No 1223/2009** through a natural-language interface.

The user types a free-form question ("is phenoxyethanol at 1% allowed in a leave-on cream?") and gets an instant, deterministic, auditable regulatory verdict — with annex references and usage conditions.

---

## What this project demonstrates

This project illustrates a responsible AI architecture where the LLM is confined to a single task: **parsing natural language**. All regulatory logic is deterministic, LLM-free, and network-free. Verdicts are fully auditable and reproducible — a hard requirement in any regulatory context.

---

## Architecture

```
User input (natural language)
        │
        ▼  LLM — Gemini 2.5 Flash (1 call, Zod-validated output)
  IngredientQuery  { name, concentration?, productType?, cas? }
        │
        ▼  Rule engine — pure functions, no LLM, no network
  Verdict  { status, conditions, warnings, annexReferences, confidence }
        │
        ▼  Mastra agent (formatting only) → React frontend
```

**No live EUR-Lex scraping.** 1,704 rules are extracted once from the official PDF into `rules.json` (Annexes II–VI).

---

## Key design decisions

**The LLM makes zero compliance decisions**
`generateObject` extracts a structured `IngredientQuery` from free text — one call, Zod-validated output. The rule engine then runs deterministically on that structure. Letting an LLM decide compliance would be non-deterministic and unauditable.

**Zod as the single source of truth**
`IngredientQuerySchema` is shared across three layers: constrains the LLM output (`generateObject`), validates the API input (`safeParse`), and serves as the Mastra tool's `inputSchema`. One schema to change, impossible to drift.

**Pure functions for the rule engine**
`resolve()` and `evaluate()` have no side effects and no I/O. Same input always produces the same output — testable without any mocking.

**Rule engine decision priority**
```
NOT_FOUND → PROHIBITED → EXCEEDS_LIMIT → RESTRICTED → ALLOWED
```
`PROHIBITED` (Annex II) always overrides everything else. `EXCEEDS_LIMIT` only triggers when a concentration is provided and exceeds the regulatory maximum.

**rules.json extracted once at build time**
1,704 rules parsed from the official PDF via a deterministic custom parser (`npm run extract-rules`). No network dependency on the request path.

**Mastra for interface contracts**
The rule engine is wrapped as a Mastra tool (structured input/output contracts). A separate formatting-only agent receives the verdict and presents it in readable form — the LLM never touches compliance logic.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, MUI |
| Backend | Node.js, Express, TypeScript |
| AI | Gemini 2.5 Flash via Vercel AI SDK |
| Agent | Mastra (tool use + formatting agent) |
| Validation | Zod (shared schema across LLM/API/tools) |
| PDF extraction | pdftotext + custom deterministic parser |

---

## Compliance statuses

| Status | Meaning |
|---|---|
| `PROHIBITED` | Listed in Annex II — unconditionally banned |
| `EXCEEDS_LIMIT` | Found but queried concentration exceeds the regulatory maximum |
| `RESTRICTED` | Permitted under specific conditions (Annex III/V/VI) |
| `NOT_FOUND` | Not listed in Annexes II–VI — generally allowed under Article 3 |

---

## Project structure

```
backend/src/
├── data/rules.json          # 1,704 rules extracted from the regulation PDF
├── schemas/                 # Zod schema — single source of truth for IngredientQuery
├── pipeline/                # parse-query (LLM) + run (orchestration)
├── engine/                  # resolver + evaluator — pure functions
├── utils/                   # normalize, concentration, match helpers
├── tools/                   # Mastra tool wrapping the rule engine
├── agents/                  # Formatting-only agent (no compliance decisions)
├── extractor/               # One-shot PDF parser (build time only)
└── index.ts                 # Express server

frontend/src/
├── services/api.ts          # API client
└── App.tsx                  # Natural-language input UI
```

---

## Getting started

### Prerequisites

- Node.js 20+
- Google AI API key (Gemini 2.5 Flash)

```bash
npm run install:all
cp backend/.env.example backend/.env
```

Set in `backend/.env`:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key
```

### Running

```bash
npm run dev           # backend + frontend in parallel
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

---

## API

### `POST /api/check-ingredient`

```json
{ "text": "is phenoxyethanol at 1% safe in a leave-on cream?" }
```

```json
{
  "query": { "name": "Phenoxyethanol", "concentration": 1, "productType": "leave-on" },
  "verdict": {
    "status": "RESTRICTED",
    "ingredient": "Phenoxyethanol",
    "maxConcentrationRaw": "1,0 %",
    "conditions": [],
    "warnings": [],
    "annexReferences": [{ "annex": "Annex V", "entry": "29", "description": "..." }],
    "confidence": "MEDIUM",
    "source": "Regulation (EC) No 1223/2009"
  }
}
```

---

## Tests

```bash
# Pure unit tests — rule engine only, no LLM, ~1s
cd backend && npm run test:engine

# Integration tests — full stack with real LLM calls, ~1-2 min
cd backend && npm run test:integration
```

---

## Rebuild the rules database

To re-extract rules from the regulation PDF:

```bash
cd backend && npm run extract-rules
```

Requires `pdftotext` (`brew install poppler`).

---

## Notes

- Compliance decisions are deterministic and reproducible — no LLM involvement beyond natural-language parsing.
- Scoped to the original 1223/2009 text only; subsequent amendments are not included by design.
- Results should be validated by a qualified regulatory professional before use in production.

---

## License

MIT — see [LICENSE](LICENSE)

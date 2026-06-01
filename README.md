# StudyTutor — Adaptive AI Tutor

> Upload your notes. Get a personalized AI tutor that targets your weakest concepts in real time.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org/)
[![Hono](https://img.shields.io/badge/Hono-4-orange)](https://hono.dev/)
[![LangGraph.js](https://img.shields.io/badge/LangGraph.js-0.2-purple)](https://langchain-ai.github.io/langgraphjs/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-green?logo=mongodb)](https://www.mongodb.com/)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-teal)](https://www.pinecone.io/)

---

## ✨ What it does

StudyTutor ingests your PDF/DOCX/Markdown notes into a vector database, tracks your mastery score per concept, and uses a LangGraph state machine to either:

- **Explain mode** — answer questions with RAG-grounded context
- **Quiz mode** — ask Socratic questions targeting your weakest concepts, evaluate your answers, and update your mastery score

Every retrieval call is mastery-weighted: content you struggle with is ranked higher. The tutor adapts in real time.

---

## 🏗 Architecture

```
apps/
├── backend/     Hono (Node.js 20) — API, RAG, LangGraph
└── frontend/    Next.js 14 App Router — UI, NextAuth v5

packages/
└── shared/      Zod schemas + TypeScript types (zero runtime)
```

### Key Technical Decisions

| Layer | Technology | Why |
|---|---|---|
| API | Hono 4 | Ultra-fast, runs on Node/Bun/Edge, first-class TypeScript |
| Auth | NextAuth v5 + GitHub OAuth | Session token mirrored to backend HTTP-only cookie |
| LLM | Ollama / OpenAI / Anthropic | User-selectable; keys stored in OS keychain via `keytar` |
| RAG | Hybrid BM25 + dense vectors → RRF | Better recall than dense-only; BM25 catches exact terms |
| Rerank | Cohere Rerank (optional) | Post-fusion reranking for precision; degrades gracefully |
| Vector DB | Pinecone | Managed serverless; namespace-scoped per `userId` |
| Graph | LangGraph.js | Stateful tutor loop with typed nodes and conditional edges |
| DB | MongoDB + Mongoose | Flexible document model for mastery, sessions, ingest jobs |
| Secrets | OS Keychain (`keytar`) | API keys never stored in MongoDB; `.env` fallback |

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- [Ollama](https://ollama.ai) installed locally **or** an OpenAI/Anthropic API key
- [Pinecone](https://pinecone.io) account — free tier works
- MongoDB — local Docker (`docker compose up mongo -d`) or Atlas URI

### 1 — Clone and install

```bash
git clone https://github.com/your-org/study-tutor
cd study-tutor
pnpm install
```

### 2 — Environment variables

**Backend** (`apps/backend/.env`):
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/studytutor

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=study-tutor

# Must be identical to frontend NEXTAUTH_SECRET
APP_SECRET=your_32_char_backend_secret_minimum
NEXTAUTH_SECRET=your_32_char_nextauth_secret_min

# Optional — enables Cohere reranking
COHERE_API_KEY=
```

**Frontend** (`apps/frontend/.env.local`):
```env
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
NEXTAUTH_SECRET=your_32_char_nextauth_secret_min   # same as backend!
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Critical**: `NEXTAUTH_SECRET` must be **identical** in both apps. The backend verifies tokens signed by the frontend.

### 3 — Create Pinecone index

Create a serverless index named `study-tutor` (or your custom name) with:
- **Dimensions**: `768` for Ollama `nomic-embed-text`, `1536` for OpenAI `text-embedding-3-small`
- **Metric**: cosine
- **Cloud/Region**: `aws us-east-1` (free tier)

### 4 — GitHub OAuth App

Go to [GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/applications/new):
- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

### 5 — Run

```bash
# Terminal 1 — backend
pnpm --filter @study-tutor/backend dev

# Terminal 2 — frontend
pnpm --filter @study-tutor/frontend dev
```

Open `http://localhost:3000` — sign in with GitHub.

---

## 🐳 Docker Compose (full stack)

```bash
# Copy and fill in your secrets
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

docker compose up -d
```

This starts: MongoDB, backend (port 8000), and optionally the frontend if you add a frontend service.

---

## 📁 Project Structure

```
apps/backend/src/
├── auth/              JWT helpers, auth middleware
├── generation/        explainer.ts, socratic.ts, evaluator.ts
├── graph/             LangGraph state machine (state.ts, nodes.ts, tutorGraph.ts)
├── ingestion/         parser.ts, chunker.ts, conceptTagger.ts, embedder.ts, pipeline.ts
├── models/            Mongoose models (User, IngestJob, Mastery, Session)
├── providers/         LLM/embedding providers + keychain
├── retrieval/         hybrid.ts (BM25+dense+RRF), masteryWeighter.ts, reranker.ts
├── routes/            auth, settings, ingest, chat, quiz, mastery, sessions, health
├── config.ts          Zod-validated env
├── database.ts        Mongoose connect + ping
└── index.ts           Hono app, middleware, route mounts

apps/frontend/
├── app/
│   ├── (app)/         Authenticated route group
│   │   ├── layout.tsx  Collapsible sidebar shell
│   │   ├── chat/       Streaming chat with session history
│   │   ├── dashboard/  Mastery stats + concept bars
│   │   ├── quiz/       Socratic quiz state machine
│   │   ├── settings/   Provider config + API key management
│   │   └── upload/     Drag-and-drop ingestion + progress polling
│   ├── api/auth/       NextAuth v5 handler
│   ├── api/sync-user/  Backend user sync (mirrors Set-Cookie)
│   ├── layout.tsx      Root layout
│   └── page.tsx        Landing page
├── auth.ts             NextAuth v5 config
├── middleware.ts       Route protection
└── lib/
    ├── api.ts          Typed API client
    ├── store.ts        Zustand global state
    ├── useStream.ts    fetch + ReadableStream SSE hook
    └── useMastery.ts   SWR mastery hooks + helpers
```

---

## 🧠 LangGraph Flow

```
[START]
   │
   ▼
[classify]          → Detect: explain vs quiz mode
   │
   ├─ explain ──► [retrieve] → [explain] → [END]
   │
   └─ quiz ─────► [retrieve] → [ask_question]
                                     │
                                (POST /quiz/answer)
                                     │
                               [evaluate] → [update_mastery] → [END]
```

**State** (`TutorState`):
- `userId`, `mode`, `query`
- `retrievedChunks[]`, `masteryContext{}`
- `response`, `quizQuestion`, `evalResult`

---

## 📐 Mastery Formula

```
newScore = clamp(oldScore + 0.15 × (correctness − oldScore), 0.05, 0.99)
```

- `correctness` ∈ [0, 1] — LLM evaluation score
- Score converges toward the user's actual knowledge level
- Clipped to never reach 0 (complete reset) or 1 (perfection)

---

## 🔌 LLM Provider Support

| Provider | Chat | Embeddings | Keys |
|---|---|---|---|
| **Ollama** | ✅ Any model | ✅ `nomic-embed-text` | No key needed |
| **OpenAI** | ✅ GPT-4o, 4o-mini | ✅ `text-embedding-3-small` | OS keychain |
| **Anthropic** | ✅ Claude 3.5, Haiku | ⚠️ Falls back to Ollama | OS keychain |
| **Cohere** | ❌ | ❌ | Optional — reranking only |

---

## 🧪 Running Tests

```bash
# Backend unit tests
pnpm --filter @study-tutor/backend test

# Type check all packages
pnpm -r type-check
```

---

## 🗂 API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/sync` | Bearer NextAuth JWT | Upsert user, set cookie |
| `POST` | `/auth/logout` | Cookie | Clear session |
| `GET` | `/auth/me` | Cookie | User profile |
| `GET` | `/settings` | Cookie | Provider config |
| `PATCH` | `/settings` | Cookie | Update provider |
| `POST` | `/settings/api-key` | Cookie | Save to keychain |
| `DELETE` | `/settings/api-key` | Cookie | Remove from keychain |
| `GET` | `/settings/test` | Cookie | Test LLM connectivity |
| `POST` | `/upload` | Cookie | Ingest files (multipart) |
| `GET` | `/ingest-status/:jobId` | Cookie | Poll job progress |
| `DELETE` | `/upload/:fileName` | Cookie | Remove file vectors |
| `POST` | `/chat` | Cookie | SSE streaming chat |
| `GET` | `/quiz/next` | Cookie | Generate question |
| `POST` | `/quiz/answer` | Cookie | Submit + evaluate |
| `GET` | `/mastery` | Cookie | All concepts |
| `GET` | `/mastery/summary` | Cookie | Stats + streak |
| `PATCH` | `/mastery/:concept/reset` | Cookie | Reset concept |
| `GET` | `/sessions` | Cookie | Session list |
| `GET` | `/sessions/:id` | Cookie | Full session detail |
| `DELETE` | `/sessions/:id` | Cookie | Delete session |
| `GET` | `/health` | Public | System health |
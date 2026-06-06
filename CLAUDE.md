# StudyTutor — Adaptive AI Tutor

## 🤖 AI Assistant Guidelines
This `CLAUDE.md` file provides context for AI assistants working on the **StudyTutor** monorepo. It details the architecture, features, workflows, and development guidelines.

## 📌 Project Overview
StudyTutor is a full-stack TypeScript application that acts as an adaptive AI tutor. It ingests study materials (PDF/DOCX/Markdown) into a vector database, tracks user mastery of different concepts, and adapts its teaching strategy based on the user's weaknesses.

**Core Stack:**
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, NextAuth v5 (GitHub OAuth), Zustand, SWR
- **Backend:** Hono embedded as Next.js API routes, LangGraph.js, Mongoose, Zod
- **Deployment:** Vercel (serverless functions)
- **Databases:** MongoDB Atlas (state, jobs, mastery), Pinecone (vector DB)
- **AI/LLM:** Local (Ollama - dev only) or Cloud (OpenAI, Anthropic). Embeddings via `nomic-embed-text` or `text-embedding-3-small`.

## 🏗 Architecture & Project Structure
The project is a monorepo managed with `pnpm` workspaces:

```text
study-tutor/
├── apps/
│   ├── backend/              # Original Hono backend (source of truth)
│   └── frontend/
│       ├── app/
│       │   ├── api/
│       │   │   └── [...backend]/route.ts  # Hono backend mounted as Next.js API routes
│       │   └── (app)/        # UI routes
│       └── lib/
│           └── backend-src/  # Copy of backend source for Vercel deployment
└── packages/
    └── shared/               # Zod schemas, shared types
```

**Deployment Architecture:**
- For **Vercel deployment**: The Hono backend runs as Next.js API routes at `/api/*`
- Backend source is copied to `apps/frontend/lib/backend-src/` for serverless compatibility
- All routes are accessible via the same domain (no CORS needed)
- MongoDB connection is cached across serverless function invocations
- API keys are encrypted (AES-256-GCM) and stored in MongoDB, not OS keychain

## ✨ Key Features & Workflows

### 1. Ingestion & RAG Pipeline (`apps/backend/src/ingestion/`)
- Users upload files (Drag & Drop in `/upload` route).
- Files are parsed, chunked, and tagged with core "concepts".
- Chunks are embedded and stored in Pinecone (namespaced per user).
- **Retrieval:** Uses Hybrid Search (BM25 + Dense Vectors) fused via Reciprocal Rank Fusion (RRF). Reranking available via Cohere.
- **Mastery Weighting:** The retrieval engine actively biases results towards concepts where the user has a low mastery score.

### 2. Adaptive LangGraph Flow (`apps/backend/src/graph/`)
The core tutor logic operates as a LangGraph state machine:
- **Classify Intent:** Detects if the user needs an explanation or wants to be quizzed.
- **Explain Mode:** Retrieves context and generates a grounded response.
- **Quiz Mode:** 
  - Retrieves the user's weakest concepts.
  - Asks a Socratic question.
  - Evaluates the user's submitted answer (via LLM evaluator).
  - Updates the mastery score.

### 3. Mastery Formula
Mastery scores per concept dictate the tutor's behavior. It is evaluated via:
`newScore = clamp(oldScore + 0.15 × (correctness − oldScore), 0.05, 0.99)`
(Where `correctness` is an LLM evaluation score between 0 and 1).

### 4. Authentication & Security
- Uses NextAuth v5 via GitHub OAuth.
- Frontend mints the session and mirrors it to the backend via a secure, HTTP-only cookie. Both apps share the `NEXTAUTH_SECRET` to verify signatures.
- **API Keys:** User LLM keys (OpenAI, Anthropic) are encrypted using AES-256-GCM with `APP_SECRET` and stored in MongoDB. This is serverless-compatible (no OS keychain dependency).

## 🖥 UI / Frontend Details (`apps/frontend/app/`)
- **`/(app)/dashboard`**: Main user hub. Visualizes mastery statistics, current streaks, and concept progress bars.
- **`/(app)/chat`**: Streaming chat interface with the AI tutor. Maintains session history (`useStream.ts` hook).
- **`/(app)/quiz`**: Dedicated UI for the Socratic quiz loop.
- **`/(app)/upload`**: Drag-and-drop ingestion interface with polling for job progress.
- **`/(app)/settings`**: UI to configure LLM providers, set API keys, and test connectivity.
- **`page.tsx`**: Landing page.

## 🚀 Common Commands

### Local Development
```bash
# Install dependencies
pnpm install

# Start frontend with integrated backend
cd apps/frontend
pnpm dev

# The app runs at http://localhost:3000
# Backend API is available at http://localhost:3000/api
```

### Production Build
```bash
# Build for Vercel deployment
cd apps/frontend
pnpm build

# Or from root
pnpm build
```

### Testing & Type Checking
```bash
# Type-check everything
pnpm type-check

# Run unit tests (backend)
cd apps/backend
pnpm test
```

### Deployment
See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete deployment instructions.

## 🛠 Guidelines for AI Agents modifying code
1. **Types & Schemas:** Always define and use `zod` schemas in `packages/shared` when creating contracts between frontend and backend.
2. **Environment Variables:** Be mindful of `.env` limits. `APP_SECRET` and `NEXTAUTH_SECRET` must match and be at least 32 characters.
3. **Database Operations:** Use Mongoose models in `apps/backend/src/models/` for persistent non-vector data. MongoDB connection is cached for serverless.
4. **LLM Agnosticism:** Always use the abstract provider interfaces in `apps/backend/src/providers/` so code remains compatible with Ollama, OpenAI, and Anthropic.
5. **Streaming UI:** UI modifications in the chat component should handle React Server Components and readable stream SSE hooks.
6. **Serverless Constraints:** Backend code must be stateless. No file system writes (except `/tmp`), no long-running processes, 60s function timeout max.
7. **Backend Source Sync:** When modifying backend code in `apps/backend/src/`, remember to sync changes to `apps/frontend/lib/backend-src/` for Vercel deployment.

## 📦 Deployment Notes
- **Vercel**: The primary deployment target. Backend runs as Next.js API routes.
- **MongoDB**: Use MongoDB Atlas (serverless-optimized connection pooling).
- **Pinecone**: Use Serverless index for auto-scaling.
- **API Keys**: Stored encrypted in MongoDB, not in environment variables.
- **Secrets Management**: All secrets via Vercel Environment Variables dashboard.

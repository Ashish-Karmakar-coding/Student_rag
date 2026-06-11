# StudyTutor — Adaptive AI Tutor

## 🤖 AI Assistant Guidelines
This `CLAUDE.md` file provides context for AI assistants working on the **StudyTutor** monorepo. It details the architecture, features, workflows, and development guidelines.

## 📌 Project Overview
StudyTutor is a full-stack TypeScript application that acts as an adaptive AI tutor. It ingests study materials (PDF/DOCX/Markdown) into a vector database, tracks user mastery of different concepts, and adapts its teaching strategy based on the user's weaknesses.

**Core Stack:**
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, NextAuth v5 (GitHub OAuth), Zustand, SWR
- **Backend:** Hono.js (standalone API), LangGraph.js, Mongoose, Zod
- **Deployment:** Two separate Vercel projects (frontend + backend)
- **Databases:** MongoDB Atlas (state, jobs, mastery), Pinecone (vector DB)
- **AI/LLM:** Local (Ollama - dev only) or Cloud (OpenAI, Anthropic). Embeddings via `nomic-embed-text` or `text-embedding-3-small`.

## 🏗 Architecture & Project Structure
The project is a monorepo managed with `pnpm` workspaces:

```text
study-tutor/
├── apps/
│   ├── backend/              # Standalone Hono API (deployed separately on Vercel)
│   │   ├── api/index.ts      # Vercel serverless entry point
│   │   ├── src/              # All backend source code
│   │   └── vercel.json       # Backend Vercel config
│   └── frontend/             # Next.js frontend (deployed separately on Vercel)
│       ├── app/
│       │   ├── api/
│       │   │   ├── auth/     # NextAuth routes + GitHub callback proxy
│       │   │   └── sync-user # Syncs NextAuth session → backend JWT
│       │   └── (app)/        # UI routes
│       ├── lib/              # API client, hooks, store
│       └── vercel.json       # Frontend Vercel config
└── packages/
    └── shared/               # Zod schemas, shared types
```

**Deployment Architecture:**
- **Backend** deploys as a standalone Hono API on Vercel at e.g. `api.yourdomain.com`
  - Uses `hono/vercel` adapter in `api/index.ts`
  - All routes accessible at the backend domain root (e.g., `/auth/sync`, `/chat`, `/upload`)
  - Vercel rewrites all requests to the single serverless function
- **Frontend** deploys as a Next.js app on Vercel at e.g. `app.yourdomain.com`
  - Communicates with backend via `NEXT_PUBLIC_API_URL` env var
  - No backend code embedded — frontend only makes HTTP requests
  - Auth via NextAuth v5 (GitHub OAuth), syncs session to backend via `/api/sync-user`
- **Cross-origin:** Backend CORS allows the frontend origin, cookies use `SameSite=None; Secure`
- **Shared secrets:** `NEXTAUTH_SECRET` must be identical in both deployments

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
- GitHub OAuth callback URL format: `/api/auth/github/callback`
- Frontend mints a short-lived JWT (signed with `NEXTAUTH_SECRET`) and sends it to the backend's `/auth/sync` endpoint.
- Backend verifies the JWT, upserts the user in MongoDB, and returns an `access_token` cookie.
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

# Start backend (standalone Hono dev server)
cd apps/backend
pnpm dev
# Backend runs at http://localhost:8000

# Start frontend (in another terminal)
cd apps/frontend
pnpm dev
# Frontend runs at http://localhost:3000
# It calls the backend at http://localhost:8000 (set via NEXT_PUBLIC_API_URL)
```

### Production Build
```bash
# Build shared package first
cd packages/shared && pnpm build

# Build backend
cd apps/backend && pnpm build

# Build frontend
cd apps/frontend && pnpm build
```

### Testing & Type Checking
```bash
# Type-check everything
pnpm type-check

# Run unit tests (backend)
cd apps/backend
pnpm test
```

## 🛠 Guidelines for AI Agents modifying code
1. **Types & Schemas:** Always define and use `zod` schemas in `packages/shared` when creating contracts between frontend and backend.
2. **Environment Variables:** Be mindful of env var separation. Backend env vars go in backend Vercel project, frontend env vars in frontend project. `NEXTAUTH_SECRET` must match in both.
3. **Database Operations:** Use Mongoose models in `apps/backend/src/models/` for persistent non-vector data. MongoDB connection is cached for serverless.
4. **LLM Agnosticism:** Always use the abstract provider interfaces in `apps/backend/src/providers/` so code remains compatible with Ollama, OpenAI, and Anthropic.
5. **Streaming UI:** UI modifications in the chat component should handle React Server Components and readable stream SSE hooks.
6. **Serverless Constraints:** Backend code must be stateless. No file system writes (except `/tmp`), no long-running processes, 60s function timeout max.
7. **No backend code in frontend:** The frontend only communicates with the backend via HTTP. Do NOT embed backend source in the frontend.

## 📦 Deployment Notes

### Two-Project Vercel Deployment (Production)

Both projects connect to the **same GitHub repository**, but with different Root Directory settings.

#### Backend Vercel Project

**Vercel Project Settings:**
- **Root Directory**: `apps/backend`
- **Framework**: Other
- **Build/Install Commands**: Defined in `apps/backend/vercel.json`

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `PINECONE_API_KEY` | ✅ | Pinecone vector DB API key |
| `PINECONE_INDEX_NAME` | ✅ | Pinecone index name (e.g. `studentrag`) |
| `APP_SECRET` | ✅ | 64-char hex for encrypting user API keys |
| `NEXTAUTH_SECRET` | ✅ | **Must match frontend** |
| `ALLOWED_ORIGINS` | ✅ | Frontend URL (e.g. `https://app.yourdomain.com`) |
| `NODE_ENV` | Optional | `production` |
| `COHERE_API_KEY` | Optional | Enables search reranking |
| `KEYTAR_FALLBACK_OPENAI_KEY` | Optional | Fallback OpenAI key |
| `KEYTAR_FALLBACK_ANTHROPIC_KEY` | Optional | Fallback Anthropic key |

#### Frontend Vercel Project

**Vercel Project Settings:**
- **Root Directory**: `apps/frontend`
- **Framework**: Next.js
- **Build/Install Commands**: Defined in `apps/frontend/vercel.json`

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (e.g. `https://api.yourdomain.com`) |
| `NEXTAUTH_SECRET` | ✅ | **Must match backend** |
| `AUTH_SECRET` | ✅ | Same as `NEXTAUTH_SECRET` |
| `NEXTAUTH_URL` | ✅ | Frontend URL (e.g. `https://app.yourdomain.com`) |
| `GITHUB_CLIENT_ID` | ✅ | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ | From GitHub OAuth App |
| `BACKEND_INTERNAL_URL` | Optional | Override for server-side backend calls |

#### GitHub OAuth Configuration

- **Homepage URL**: `https://app.yourdomain.com`
- **Authorization callback URL**: `https://app.yourdomain.com/api/auth/github/callback`

#### Custom Domains (Recommended)

Use subdomains under the same parent domain for cookie sharing:
- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

This allows the `access_token` cookie to be shared (with `SameSite=None; Secure`).

#### Deployment Process

1. Fork/clone repository to GitHub
2. Create **two** Vercel projects from the same repo
3. Set Root Directory to `apps/backend` for one, `apps/frontend` for the other
4. Add environment variables to each project
5. Deploy both

#### Deployment Verification

After deployment, verify:
1. **Backend:** `GET https://api.yourdomain.com/` → JSON service info
2. **Backend:** `GET https://api.yourdomain.com/health` → health check
3. **Frontend:** `GET https://app.yourdomain.com/` → landing page
4. **Auth flow:** GitHub sign-in → sync-user → backend cookie set
5. Check Vercel logs for any runtime errors

#### Key Technical Details

**1. Secret Storage (Backend only):**
- Replaced `keytar` (OS keychain) with AES-256-GCM encryption
- User API keys encrypted with `APP_SECRET` before MongoDB storage
- Location: `apps/backend/src/providers/keychain.ts`

**2. MongoDB Connection (Backend only):**
- Connection caching for serverless
- Reduced `minPoolSize` to 1 for faster cold starts
- Location: `apps/backend/src/database.ts`

**3. Config Validation:**
- Lazy validation via Proxy (validates on first property access, not at build time)
- Location: `apps/backend/src/config.ts`

**4. Cross-Origin Cookie:**
- Backend sets `SameSite=None; Secure` on the `access_token` cookie
- Frontend sends `credentials: "include"` on all API requests
- Requires HTTPS and matching domain setup

**5. API Entry Point:**
- Backend: `api/index.ts` → `hono/vercel` adapter
- All requests rewritten to this single function via `vercel.json` rewrites

#### Performance Considerations

**Cold Start Optimization:**
- First request after idle: ~1-3 seconds
- Subsequent requests: <100ms
- MongoDB connection cached across invocations

**Function Limits:**
- Timeout: 60 seconds (hobby tier), 300s (pro tier)
- Memory: 1024 MB default
- Payload: 4.5 MB for request/response

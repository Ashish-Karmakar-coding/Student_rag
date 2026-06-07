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

### Vercel Deployment (Production)

**Primary deployment target**: Vercel serverless platform

#### Architecture Changes for Vercel
- Backend runs as Next.js API routes (not separate server)
- All routes accessible at `/api/*` (e.g., `/api/chat`, `/api/upload`, `/api/settings`)
- Single unified deployment (no CORS, same domain)
- Serverless functions with 60-second timeout
- MongoDB connection caching across invocations

#### Required Configuration

**Vercel Project Settings:**
- **Root Directory**: `apps/frontend`
- **Framework**: Next.js
- **Build Command**: `pnpm build`
- **Install Command**: `pnpm install --filter=@study-tutor/frontend...`
- **Output Directory**: `.next` (default)

**Environment Variables** (Set in Vercel Dashboard):

**Critical (Required):**
```bash
NEXTAUTH_SECRET=<64-char-hex-string>        # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
APP_SECRET=<64-char-hex-string>             # Generate: same command
NEXTAUTH_URL=https://your-app.vercel.app    # Your actual Vercel domain
GITHUB_CLIENT_ID=<from-github-oauth-app>
GITHUB_CLIENT_SECRET=<from-github-oauth-app>
MONGODB_URI=mongodb+srv://...               # MongoDB Atlas connection string
PINECONE_API_KEY=<your-pinecone-api-key>
PINECONE_INDEX_NAME=study-tutor             # Or your index name
```

**Optional (Enhanced Features):**
```bash
COHERE_API_KEY=<cohere-api-key>                    # Enables search reranking
KEYTAR_FALLBACK_OPENAI_KEY=<shared-openai-key>     # Fallback OpenAI access
KEYTAR_FALLBACK_ANTHROPIC_KEY=<shared-anthropic>   # Fallback Claude access
NODE_ENV=production
NEXT_PUBLIC_API_URL=/api
```

**Important Notes:**
- ⚠️ Enter values WITHOUT quotes in Vercel dashboard
- ⚠️ NEXTAUTH_SECRET must be at least 32 characters (64-char hex recommended)
- ⚠️ APP_SECRET is used to encrypt user API keys in MongoDB
- ⚠️ Both secrets can be generated with: `openssl rand -hex 32`

#### GitHub OAuth Configuration

**Required Settings** (at https://github.com/settings/developers):
- **Homepage URL**: `https://your-app.vercel.app`
- **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`

**Note**: Use your actual Vercel production domain, not preview URLs.

#### External Services Setup

**MongoDB Atlas:**
- Create M0 (free tier) cluster
- Whitelist all IPs: `0.0.0.0/0` (for Vercel serverless)
- Create database user with read/write permissions
- Get connection string from "Connect → Drivers"

**Pinecone:**
- Create Serverless index
- Set dimensions: 768 (nomic-embed-text) or 1536 (OpenAI embeddings)
- Note: Choose based on which embedding model you'll use
- Copy API key from dashboard

#### Deployment Process

**Initial Setup:**
1. Fork/clone repository to GitHub
2. Connect repository to Vercel
3. Set Root Directory to `apps/frontend`
4. Add all environment variables
5. Deploy

**Subsequent Deployments:**
- Automatic on every push to `main` branch
- Manual via "Redeploy" button in Vercel dashboard
- Preview deployments for pull requests

#### Deployment Verification

After deployment, verify:
1. Visit `/` - Should show landing page
2. Visit `/api/` - Should return JSON service info
3. Visit `/api/auth/providers` - Should return GitHub provider config
4. Test GitHub sign-in flow
5. Check Vercel logs for any runtime errors

#### Troubleshooting

**Common Issues:**

1. **"No Next.js version detected"**
   - Solution: Ensure Root Directory is set to `apps/frontend`

2. **"Module not found: './types.js'"**
   - Solution: Ensure `packages/shared/src/index.ts` has NO `.js` extensions

3. **"MissingSecret" error**
   - Solution: Set `NEXTAUTH_SECRET` in Vercel environment variables

4. **Sign-in redirects back to same page**
   - Solution: Verify GitHub OAuth callback URL matches exactly
   - Verify `NEXTAUTH_URL` matches your Vercel domain

5. **401 Unauthorized on /api/sync-user**
   - Solution: Ensure `NEXTAUTH_SECRET` is set without quotes
   - Regenerate both secrets if needed

**Debug Tools:**
- Vercel Logs: `https://vercel.com/<team>/<project>/logs`
- Browser Console: Check for auth errors
- Test endpoint: `GET /api/health` for backend status

**Documentation Files:**
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Complete deployment guide
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - All changes made for Vercel
- [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md) - Environment variables reference
- [VERCEL_FIX.md](./VERCEL_FIX.md) - Troubleshooting guide

#### Key Technical Changes for Serverless

**1. Secret Storage:**
- Replaced `keytar` (OS keychain) with AES-256-GCM encryption
- User API keys encrypted with `APP_SECRET` before MongoDB storage
- Location: `apps/frontend/lib/backend-src/providers/keychain.ts`

**2. MongoDB Connection:**
- Implemented connection caching for serverless
- Reduced `minPoolSize` to 1 for faster cold starts
- Added `maxIdleTimeMS: 60000` to keep connections alive
- Location: `apps/frontend/lib/backend-src/database.ts`

**3. Environment Configuration:**
- Lazy validation (only validates when accessed, not at build time)
- Skips validation during Next.js build phase
- Location: `apps/frontend/lib/backend-src/config.ts`

**4. Import Resolution:**
- Removed all `.js` extensions from imports
- Changed to `moduleResolution: "Bundler"` in tsconfig
- Compatible with Next.js webpack bundler

**5. API Route Integration:**
- Hono app mounted at `/app/api/[...backend]/route.ts`
- Uses `hono/vercel` adapter for Next.js compatibility
- All backend routes accessible at `/api/*`
- Dynamic route config: `export const dynamic = 'force-dynamic'`

#### Performance Considerations

**Cold Start Optimization:**
- First request after idle: ~1-3 seconds
- Subsequent requests: <100ms
- MongoDB connection cached across invocations
- Consider upgrading to Vercel Pro for better cold start performance

**Function Limits:**
- Timeout: 60 seconds (hobby tier), 300s (pro tier)
- Memory: 1024 MB default
- Payload: 4.5 MB for request/response
- File uploads: Limited by payload size

**Scaling:**
- Auto-scales with traffic
- No manual configuration needed
- Concurrent function limit based on Vercel plan

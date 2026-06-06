# Vercel Deployment Guide for StudyTutor

This guide walks you through deploying StudyTutor to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Free tier at [mongodb.com/atlas](https://www.mongodb.com/atlas)
3. **Pinecone Account**: Free tier at [pinecone.io](https://www.pinecone.io)
4. **GitHub OAuth App**: Create at [github.com/settings/developers](https://github.com/settings/developers)

## Step 1: Prepare External Services

### MongoDB Atlas
1. Create a free M0 cluster
2. Create a database user with read/write permissions
3. Whitelist all IPs (0.0.0.0/0) for Vercel access
4. Copy your connection string (format: `mongodb+srv://...`)

### Pinecone
1. Create a Serverless index named `study-tutor`
2. Set dimensions based on your embedding model:
   - **768** for Ollama `nomic-embed-text` (free, local dev only)
   - **1536** for OpenAI `text-embedding-3-small` (recommended for production)
3. Copy your API key

### GitHub OAuth App
1. Go to Settings → Developer settings → OAuth Apps → New OAuth App
2. Set Homepage URL to your Vercel domain (or use placeholder initially)
3. Set Authorization callback URL: `https://your-app.vercel.app/api/auth/callback/github`
4. Copy Client ID and Client Secret

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **Important**: Set Root Directory to `apps/frontend`
4. Configure environment variables (see Step 3)
5. Deploy

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd apps/frontend

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Or deploy to production
vercel --prod
```

## Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

### Required Variables

```bash
# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-hex-32>

# GitHub OAuth
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studytutor

# Pinecone
PINECONE_API_KEY=<your-pinecone-api-key>
PINECONE_INDEX_NAME=study-tutor

# Security
APP_SECRET=<generate-with-openssl-rand-hex-32>

# API URL (for Vercel deployment)
NEXT_PUBLIC_API_URL=/api
```

### Generate Secrets

Use this command to generate secure random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Variables

```bash
# Cohere (enables reranking for better search results)
COHERE_API_KEY=<your-cohere-api-key>

# LLM Fallback Keys (shared keys for users who haven't set their own)
KEYTAR_FALLBACK_OPENAI_KEY=<your-openai-api-key>
KEYTAR_FALLBACK_ANTHROPIC_KEY=<your-anthropic-api-key>
```

## Step 4: Update GitHub OAuth Callback

After deployment, update your GitHub OAuth App:

1. Go to your OAuth App settings
2. Update Homepage URL: `https://your-app.vercel.app`
3. Update Callback URL: `https://your-app.vercel.app/api/auth/callback/github`

## Step 5: Test the Deployment

1. Visit your Vercel URL
2. Click "Sign in with GitHub"
3. Upload a test document (PDF/DOCX/Markdown)
4. Try the chat and quiz features

## Architecture Notes

- **Serverless Functions**: The backend runs as Next.js API routes (`/app/api/[...backend]/route.ts`)
- **Cold Starts**: First request after inactivity may be slower (MongoDB connection)
- **Function Timeout**: Set to 60 seconds for long-running operations (file ingestion, LLM streaming)
- **API Keys**: Stored encrypted in MongoDB using AES-256-GCM (no OS keychain needed)

## Troubleshooting

### "Database connection failed"
- Check MONGODB_URI is correct
- Verify MongoDB Atlas allows connections from 0.0.0.0/0
- Check MongoDB Atlas user has read/write permissions

### "Route not found" errors
- Verify Root Directory is set to `apps/frontend` in Vercel
- Check vercel.json is in the repository root

### GitHub OAuth fails
- Verify NEXTAUTH_URL matches your Vercel domain exactly
- Check GitHub OAuth callback URL is correct
- Ensure NEXTAUTH_SECRET is set and matches between deployments

### File upload fails
- Check function timeout is set to 60s minimum
- Verify Pinecone API key and index name are correct
- Check Pinecone index dimensions match your embedding model

### "Module not found" errors
- Run `pnpm install` locally to ensure dependencies are correct
- Check package.json includes all backend dependencies
- Clear Vercel build cache and redeploy

## Local Development

After setting up Vercel deployment, you can still develop locally:

```bash
# Install dependencies
pnpm install

# Copy environment file
cp apps/frontend/.env.vercel.example apps/frontend/.env.local

# Fill in your values in .env.local

# Run development server
cd apps/frontend
pnpm dev
```

The app will run on http://localhost:3000 with the backend integrated at `/api`.

## Monitoring

- **Vercel Logs**: Dashboard → Project → Logs
- **Function Metrics**: Dashboard → Project → Analytics
- **MongoDB Metrics**: MongoDB Atlas → Metrics
- **Pinecone Usage**: Pinecone Dashboard → Usage

## Scaling Considerations

- **Free Tier Limits**:
  - Vercel: 100GB bandwidth/month
  - MongoDB Atlas: 512MB storage (M0)
  - Pinecone: 1M vectors (Serverless free tier)

- **Upgrade Path**:
  - Vercel Pro: $20/month (more bandwidth, faster builds)
  - MongoDB M10: ~$10/month (dedicated cluster)
  - Pinecone Standard: Pay per usage

## Security Notes

- API keys are encrypted at rest in MongoDB using APP_SECRET
- All secrets should be added via Vercel Dashboard (never committed to Git)
- GitHub OAuth ensures only authenticated users can access the app
- CORS is configured to accept requests from the same origin only

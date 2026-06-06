## Required Environment Variables for Vercel

Copy and paste these into Vercel's Environment Variables section.
Generate secrets using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Critical (App won't work without these):

**NEXTAUTH_SECRET**
- Value: [Generate a random 32+ character string]
- Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`
- Command to generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**APP_SECRET** 
- Value: [Generate another random 32+ character string]
- Example: `z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4`
- Command to generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**NEXTAUTH_URL**
- Value: `https://student-rag-frontend.vercel.app`
- (Your actual Vercel domain)

**GITHUB_CLIENT_ID**
- Value: [From your GitHub OAuth App]
- Get from: https://github.com/settings/developers

**GITHUB_CLIENT_SECRET**
- Value: [From your GitHub OAuth App]
- Get from: https://github.com/settings/developers

**MONGODB_URI**
- Value: `mongodb+srv://username:password@cluster.mongodb.net/studytutor?retryWrites=true&w=majority`
- Get from: MongoDB Atlas → Connect → Drivers

**PINECONE_API_KEY**
- Value: [From Pinecone Dashboard]
- Get from: https://app.pinecone.io

**PINECONE_INDEX_NAME**
- Value: `study-tutor`
- (Or whatever you named your Pinecone index)

### Optional (Enable additional features):

**COHERE_API_KEY**
- Value: [From Cohere Dashboard]
- Get from: https://dashboard.cohere.com
- Enables: Search result reranking

**KEYTAR_FALLBACK_OPENAI_KEY**
- Value: [Your OpenAI API key]
- Get from: https://platform.openai.com/api-keys
- Enables: Shared OpenAI access

**KEYTAR_FALLBACK_ANTHROPIC_KEY**
- Value: [Your Anthropic API key]
- Get from: https://console.anthropic.com/settings/keys
- Enables: Shared Claude access

**NODE_ENV**
- Value: `production`

**NEXT_PUBLIC_API_URL**
- Value: `/api`
- (Already defaults to this, but you can set it explicitly)

---

## How to Add in Vercel:

1. Go to: Settings → Environment Variables
2. Click "Add New"
3. Enter Key: `NEXTAUTH_SECRET`
4. Enter Value: [your generated secret]
5. Select: Production, Preview, Development (all three)
6. Click "Save"
7. Repeat for each variable above

## After Adding Variables:

1. Go to Deployments tab
2. Click "Redeploy" on the latest deployment
3. Or just wait - Vercel will use them on next request

Your app will work once these are set!

# StudyTutor - Adaptive AI Tutor

A full-stack TypeScript application that acts as an adaptive AI tutor. It ingests study materials (PDF/DOCX/Markdown) into a vector database, tracks user mastery of different concepts, and adapts its teaching strategy based on the user's weaknesses.

## ✨ Features

- 📚 **Smart Document Ingestion**: Upload PDFs, DOCX, or Markdown files
- 🤖 **Adaptive AI Tutor**: Powered by OpenAI, Anthropic, or local Ollama
- 🎯 **Mastery Tracking**: Tracks your understanding of concepts over time
- 💬 **Interactive Chat**: Ask questions and get AI-powered explanations
- 📝 **Socratic Quizzing**: Adaptive quizzes that focus on your weak areas
- 🔍 **Hybrid Search**: BM25 + vector search with optional Cohere reranking
- 🔐 **Secure Authentication**: GitHub OAuth via NextAuth v5

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/studytutor)

### Prerequisites

1. **MongoDB Atlas** (free tier): [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Pinecone** (free tier): [pinecone.io](https://www.pinecone.io)
3. **GitHub OAuth App**: [github.com/settings/developers](https://github.com/settings/developers)

### Deployment Steps

1. Click the "Deploy with Vercel" button above
2. Configure environment variables (see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md))
3. Deploy!

For detailed deployment instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

## 💻 Local Development

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/frontend/.env.vercel.example apps/frontend/.env.local
# Edit .env.local with your credentials

# Run development server
cd apps/frontend
pnpm dev
```

Visit http://localhost:3000

## 🏗 Architecture

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Zustand
- **Backend**: Hono embedded as Next.js API routes
- **Auth**: NextAuth v5 with GitHub OAuth
- **Databases**: MongoDB Atlas, Pinecone Vector DB
- **AI**: OpenAI, Anthropic, or Ollama (local dev only)
- **Deployment**: Vercel (serverless functions)

## 📁 Project Structure

```
studytutor/
├── apps/
│   ├── backend/              # Original backend source
│   └── frontend/
│       ├── app/              # Next.js pages and routes
│       │   ├── api/[...backend]/  # Backend as API routes
│       │   └── (app)/        # UI pages
│       └── lib/
│           ├── backend-src/  # Backend deployed with frontend
│           └── *.ts          # Frontend utilities
├── packages/
│   └── shared/               # Shared types and schemas
└── VERCEL_DEPLOYMENT.md      # Deployment guide
```

## 🔑 Environment Variables

### Required

- `NEXTAUTH_URL` - Your Vercel domain
- `NEXTAUTH_SECRET` - Random 32+ char string
- `GITHUB_CLIENT_ID` - GitHub OAuth App ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App Secret
- `MONGODB_URI` - MongoDB Atlas connection string
- `PINECONE_API_KEY` - Pinecone API key
- `APP_SECRET` - Random 32+ char string (encrypts API keys)

### Optional

- `COHERE_API_KEY` - Enables search reranking
- `KEYTAR_FALLBACK_OPENAI_KEY` - Shared OpenAI key
- `KEYTAR_FALLBACK_ANTHROPIC_KEY` - Shared Anthropic key

## 🛠 Tech Stack

- **Framework**: Next.js 14
- **Backend**: Hono.js
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI/LLM**: LangGraph.js, OpenAI SDK, Anthropic SDK
- **Database**: MongoDB (Mongoose), Pinecone
- **Auth**: NextAuth v5
- **Deployment**: Vercel

## 📖 Documentation

- [Deployment Guide](./VERCEL_DEPLOYMENT.md) - Complete Vercel deployment instructions
- [Architecture](./CLAUDE.md) - Detailed technical documentation
- [API Documentation](#) - Coming soon

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org)
- [Hono](https://hono.dev)
- [LangChain/LangGraph](https://www.langchain.com)
- [Pinecone](https://www.pinecone.io)
- [MongoDB](https://www.mongodb.com)
- [Vercel](https://vercel.com)

---

Made with ❤️ by the StudyTutor Team

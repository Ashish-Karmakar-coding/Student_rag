# Vercel Deployment - Summary of Changes

This document summarizes all changes made to make StudyTutor deployable on Vercel.

## 🎯 Overview

The project has been successfully converted from a separate frontend + backend architecture to a unified Next.js application where the Hono backend runs as serverless API routes on Vercel.

## ✅ Changes Made

### 1. **Backend Integration** ✓
- Copied backend source from `apps/backend/src/` to `apps/frontend/lib/backend-src/`
- Created catch-all API route at `apps/frontend/app/api/[...backend]/route.ts`
- Mounted entire Hono app as Next.js API route using `hono/vercel` adapter
- Added `dynamic = 'force-dynamic'` to prevent build-time rendering

### 2. **Serverless-Compatible Secret Storage** ✓
- **Replaced `keytar`** (OS keychain, not serverless-compatible)
- **Implemented AES-256-GCM encryption** for API keys in MongoDB
- Keys are encrypted with `APP_SECRET` before storage
- Updated `apps/frontend/lib/backend-src/providers/keychain.ts`
- Updated User model with `encryptedKeys` field

### 3. **MongoDB Connection Optimization** ✓
- Updated `apps/frontend/lib/backend-src/database.ts`
- Added connection caching for serverless (reuses connections across invocations)
- Reduced `minPoolSize` to 1 for faster cold starts
- Added `maxIdleTimeMS` to keep connections alive

### 4. **Import Path Fixes** ✓
- Removed all `.js` extensions from imports (TypeScript → Next.js bundler)
- Updated imports in `apps/frontend/lib/backend-src/**/*.ts`
- Updated imports in `packages/shared/src/**/*.ts`
- Fixed package.json module resolution

### 5. **TypeScript Configuration** ✓
- Updated `apps/frontend/tsconfig.json`:
  - Set `target: "ES2020"` (fixes regex flag issues)
  - Changed `paths` from `"@/*": ["./app/*"]` to `"@/*": ["./*"]`
  - Excluded test files from compilation
- Updated `packages/shared/tsconfig.json`:
  - Changed to `moduleResolution: "Bundler"` for Next.js compatibility

### 6. **Environment Configuration** ✓
- Made env validation skip during build phase
- Updated `apps/frontend/lib/backend-src/config.ts` with build-time detection
- Validation now only runs at request time, not during `next build`

### 7. **Dependencies** ✓
- Merged backend dependencies into `apps/frontend/package.json`:
  - @anthropic-ai/sdk, @hono/node-server, @langchain/*, hono
  - mongoose, openai, pinecone, cohere-ai
  - pdf-parse, mammoth, marked, wink-* (NLP libraries)
- Removed `keytar` dependency (replaced with crypto)

### 8. **API URL Updates** ✓
- Changed `NEXT_PUBLIC_API_URL` default from `http://localhost:8000` to `/api`
- Updated `apps/frontend/lib/api.ts`
- Updated `apps/frontend/lib/useStream.ts`
- Updated `apps/frontend/app/api/sync-user/route.ts`

### 9. **Vercel Configuration** ✓
- Created `vercel.json` with function timeout settings
- Created `apps/frontend/vercel.json` with build configuration
- Created `apps/frontend/.vercelignore`
- Set API route timeout to 60 seconds (for file uploads/processing)

### 10. **Documentation** ✓
- Created [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Complete deployment guide
- Created `apps/frontend/.env.vercel.example` - Environment variable template
- Updated [CLAUDE.md](./CLAUDE.md) with serverless architecture notes
- Created this summary document

## 📦 File Changes Summary

### New Files
- `apps/frontend/app/api/[...backend]/route.ts` - Hono backend as Next.js API route
- `apps/frontend/lib/backend-src/**/*` - Copy of backend source
- `vercel.json` - Root Vercel config
- `apps/frontend/vercel.json` - Frontend Vercel config
- `apps/frontend/.vercelignore` - Build exclusions
- `apps/frontend/.env.vercel.example` - Environment template
- `VERCEL_DEPLOYMENT.md` - Deployment guide
- `README_VERCEL.md` - Updated README
- `DEPLOYMENT_SUMMARY.md` - This file

### Modified Files
- `apps/frontend/package.json` - Added backend dependencies
- `apps/frontend/tsconfig.json` - Updated target and paths
- `apps/frontend/lib/api.ts` - Changed API_URL default
- `apps/frontend/lib/useStream.ts` - Changed API_URL default
- `apps/frontend/app/api/sync-user/route.ts` - Fixed internal API calls
- `packages/shared/src/index.ts` - Removed .js extensions
- `CLAUDE.md` - Updated with serverless architecture

### Backend Source Changes (in `apps/frontend/lib/backend-src/`)
- `config.ts` - Skip validation during build
- `database.ts` - Serverless connection caching
- `models/User.ts` - Added `encryptedKeys` field
- `providers/keychain.ts` - AES-256-GCM encryption instead of keytar
- All `*.ts` files - Removed `.js` extensions from imports

## 🚀 Deployment Checklist

- [x] Backend integrated as API routes
- [x] Serverless-compatible secret storage
- [x] MongoDB connection optimized
- [x] Import paths fixed
- [x] TypeScript configuration updated
- [x] Environment validation works
- [x] Dependencies merged
- [x] API URLs updated
- [x] Vercel configuration created
- [x] Documentation complete
- [x] Build succeeds locally

## ✅ Build Status

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (10/10)
✓ Finalizing page optimization
```

**Build Output:**
- 10 routes generated
- 3 dynamic API routes (ƒ)
- 7 static pages (○)
- Total bundle: ~156 kB First Load JS

## 🔜 Next Steps

1. **Deploy to Vercel:**
   ```bash
   cd apps/frontend
   vercel
   ```

2. **Set Environment Variables** in Vercel Dashboard

3. **Update GitHub OAuth callback URL** with your Vercel domain

4. **Test the deployment:**
   - Sign in with GitHub
   - Upload a test document
   - Try chat and quiz features

## ⚠️ Known Issues

### Minor Warnings (Non-blocking)
- Mongoose duplicate index warnings (cosmetic, won't affect functionality)
- Next.js security advisory (upgrade to latest patch when available)

### Limitations
- Ollama (local LLM) not available in production (use OpenAI/Anthropic instead)
- File uploads limited by Vercel function payload size (4.5 MB)
- Function timeout: 60 seconds (Vercel hobby tier limit)

## 📊 Architecture Comparison

### Before (Development)
```
Frontend (Next.js :3000) ←→ Backend (Hono :8000)
                              ↓
                         MongoDB + Pinecone
```

### After (Vercel)
```
Next.js App (:443)
├── UI Pages (React)
└── API Routes (/api/*)
    └── Hono Backend (serverless)
        ↓
   MongoDB Atlas + Pinecone
```

## 🎉 Success Criteria

✅ Build completes without errors  
✅ Type checking passes  
✅ All routes properly configured  
✅ API routes marked as dynamic  
✅ Environment validation works  
✅ Documentation complete  

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Hono on Vercel](https://hono.dev/getting-started/vercel)
- [MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [Pinecone Serverless](https://docs.pinecone.io/docs/serverless)

---

**Deployment Ready**: This project is now fully configured for Vercel deployment. Follow [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for step-by-step deployment instructions.

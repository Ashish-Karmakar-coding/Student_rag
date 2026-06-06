# Vercel Deployment Fix

## Root Cause

Vercel was trying to build from the project root, but Next.js is installed in `apps/frontend/`. The monorepo structure requires proper configuration.

## Solution

### Step 1: Configure Root Directory in Vercel Dashboard

1. Go to your project settings in Vercel: `https://vercel.com/<your-project>/settings`
2. Navigate to **General** → **Root Directory**
3. Click **Edit**
4. Set Root Directory to: `apps/frontend`
5. Save

### Step 2: Verify Configuration

The `apps/frontend/vercel.json` has been configured with:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --filter=@study-tutor/frontend...",
  "framework": "nextjs",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Step 3: Redeploy

After setting the Root Directory:

```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push origin main
```

Vercel will automatically trigger a new deployment.

## Alternative: Deploy from Frontend Directory Only

If the above doesn't work, you can deploy only the frontend directory:

```bash
cd apps/frontend
vercel --prod
```

Then in Vercel Dashboard, ensure:
- Root Directory: `.` (current directory)
- Build Command: `pnpm build`
- Output Directory: `.next`
- Install Command: `pnpm install --filter=@study-tutor/frontend...`

## What Changed

1. ✅ Removed confusing root-level `vercel.json`
2. ✅ Simplified `apps/frontend/vercel.json`
3. ✅ Used proper pnpm workspace filter command
4. ✅ Set function timeout to 60 seconds for API routes

## Verification

After deployment, verify:
- ✅ Build succeeds
- ✅ Next.js is detected
- ✅ All dependencies install correctly
- ✅ API routes are accessible at `/api/*`

## If Still Failing

If you still see "No Next.js version detected":

1. **Check the install command** in Vercel build logs
2. **Ensure workspace dependencies are resolving** (@study-tutor/shared)
3. **Try explicit dependency installation**:
   ```json
   "installCommand": "cd ../.. && pnpm install && cd apps/frontend"
   ```

## Expected Build Log

After the fix, you should see:
```
✓ Detected Next.js version: 14.2.5
✓ Installing dependencies...
✓ Building Next.js app...
✓ Build completed successfully
```

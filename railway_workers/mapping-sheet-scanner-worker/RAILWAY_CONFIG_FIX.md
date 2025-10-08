# 🔧 Railway Configuration Fix

## What I Just Fixed

Simplified `railway.toml` to let Railway auto-detect the Dockerfile:

```diff
- [build]
- builder = "DOCKERFILE"
- dockerfilePath = "./Dockerfile"
-
  [deploy]
  startCommand = "npm start"
  ...
```

Railway will now automatically find the `Dockerfile` in the root directory.

## ✅ Steps to Fix Your Railway Deployment

### 1. Push the Fix

```bash
git push origin main
```

This will trigger a new deployment.

### 2. Verify Railway Project Settings

Go to your Railway dashboard and check these settings:

#### ⚙️ Settings → General
- **Root Directory**: `railway_workers/mapping-sheet-scanner-worker`
  - ❌ NO leading slash: `/railway_workers/...`
  - ❌ NO trailing slash: `railway_workers/.../`
  - ✅ Correct: `railway_workers/mapping-sheet-scanner-worker`

#### ⚙️ Settings → Build
If Railway added any build settings, **remove them** - let Railway auto-detect:
- Builder: Should auto-detect "Dockerfile"
- Build Command: Leave empty (Dockerfile handles it)

#### ⚙️ Settings → Deploy
Should show:
- Start Command: `npm start` (from railway.toml)

### 3. Alternative: Nixpacks Build (If Docker Still Fails)

If Railway still can't find the Dockerfile, try using Nixpacks instead:

**In Railway Dashboard:**
1. Settings → Build
2. Change Builder to "Nixpacks" 
3. Keep Root Directory: `railway_workers/mapping-sheet-scanner-worker`
4. Build command: `npm install && npm run build`
5. Start command: `npm start`

Then update `railway.toml`:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Note:** Nixpacks will automatically detect Node.js and install dependencies including the native modules (canvas, sharp, pdfjs-dist).

### 4. Check Build Logs

After pushing, watch the Railway build logs. You should see:

**With Dockerfile (preferred):**
```
Building Dockerfile...
Step 1/7 : FROM node:20-slim
Step 2/7 : RUN apt-get update && apt-get install -y...
...
Successfully built
```

**Or with Nixpacks:**
```
Setting up Node.js environment...
Installing dependencies...
Building TypeScript...
```

### 5. Verify Deployment

Once deployed, check the **Logs** tab:
```
[worker] Starting mapping sheet scanner worker
[worker] Configuration: { ... }
```

If you see this, **it's working!** 🎉

## 🐛 Still Having Issues?

### Error: "Dockerfile not found"
**Check these in Railway dashboard:**
1. Root Directory is exactly: `railway_workers/mapping-sheet-scanner-worker`
2. No extra settings in Build section
3. Branch is correct (probably `main` or `master`)

### Try Manual Trigger
1. Railway Dashboard → Deployments
2. Click "⋯" (three dots) → "Redeploy"

### Check Git Status
Make sure files are pushed:
```bash
git ls-remote --heads origin
git log origin/main --oneline -1 -- railway_workers/mapping-sheet-scanner-worker/
```

Should show recent commit with the railway.toml fix.

## 📸 Expected Railway Settings

Here's what your Railway project settings should look like:

```
Service Settings:
├── Root Directory: railway_workers/mapping-sheet-scanner-worker
├── Branch: main (or your default branch)
└── Build:
    └── Auto-detected: Dockerfile

Environment Variables:
├── SUPABASE_URL: https://your-project.supabase.co
├── SUPABASE_SERVICE_ROLE_KEY: eyJhb...
├── CLAUDE_API_KEY: sk-ant-...
└── OPENAI_API_KEY: sk-...
```

---

**Next:** Push to trigger new deployment, then check logs! 🚀


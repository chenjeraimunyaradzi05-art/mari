# Railway Project Configuration

## ⚠️ IMPORTANT: Delete the "mari" Service First!

Railway is currently building from the root directory, which is wrong. You need to:

1. **Delete the existing "mari" service** in Railway Dashboard
2. **Create separate services** for API and Web

---

## Step-by-Step Setup

### Step 1: Delete the "mari" Service
1. Go to https://railway.app/dashboard
2. Open your project
3. Click on the "mari" service
4. Go to Settings → Danger Zone → Delete Service
5. Confirm deletion

### Step 2: Add PostgreSQL Database
1. In your project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create `DATABASE_URL`
4. (Optional) Rename to `athena-db`

### Step 3: Add the API Service
1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository: `mari`
3. ⚠️ **CRITICAL**: Click **"Configure"** before deploying
4. Set **"Root Directory"** to: `athena-platform/server`
5. Click **"Deploy"**
6. After created, go to service **Settings** → rename to `athena-api`
7. Add these **Environment Variables**:
   ```
   DATABASE_URL = postgresql://${{Postgres.POSTGRES_USER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.POSTGRES_DB}}
   JWT_SECRET = (generate a 32+ character random string)
   NODE_ENV = production
   PORT = 5000
   ```

### Step 4: Add the Web Service
1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository: `mari`
3. ⚠️ **CRITICAL**: Click **"Configure"** before deploying
4. Set **"Root Directory"** to: `athena-platform/client`
5. Click **"Deploy"**
6. After created, go to service **Settings** → rename to `athena-web`
7. Add these **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL = (your athena-api URL, e.g., https://athena-api-production-xxxx.up.railway.app)
   NODE_ENV = production
   ```

### Step 5: Generate Public URLs
1. Go to each service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Update `NEXT_PUBLIC_API_URL` in athena-web with athena-api's domain

---

## 📱 About Mobile Apps

**Mobile apps (React Native/Expo) CANNOT run on Railway.**

Railway is for:
- ✅ Backend APIs (Node.js, Python, etc.)
- ✅ Web frontends (Next.js, React, etc.)
- ✅ Databases (PostgreSQL, Redis, etc.)

Mobile apps must be:
- Built with **EAS Build** (Expo Application Services)
- Distributed via **App Store** (iOS) and **Google Play** (Android)

See [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md) for mobile deployment.

---

## Final Project Structure in Railway

After setup, your Railway project should have:

```
Your Railway Project
├── athena-db (PostgreSQL)
├── athena-api (from athena-platform/server)
└── athena-web (from athena-platform/client)
```

---

## Environment Variables Reference

### API Service (athena-api)
| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `postgresql://${{Postgres.POSTGRES_USER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.POSTGRES_DB}}` |
| `JWT_SECRET` | Yes | `your-32-char-secret-key` |
| `NODE_ENV` | Yes | `production` |
| `PORT` | No | `3001` |
| `REDIS_URL` | No | `redis://...` |
| `STRIPE_SECRET_KEY` | No | `sk_live_...` |
| `OPENAI_API_KEY` | No | `sk-...` |

### Web Service (athena-web)
| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://athena-api-xxx.up.railway.app` |
| `NODE_ENV` | Yes | `production` |
| `NEXTAUTH_SECRET` | No | `random-string` |

---

## Troubleshooting

### "mari" keeps building
- The root `railway.json` and `package.json` have been updated to fail on purpose
- Delete the "mari" service and create new services with proper root directories

### Build Failing
- Check the build logs in Railway
- Ensure **Root Directory** is set correctly (`athena-platform/server` or `athena-platform/client`)
- Verify environment variables are set

### Database Connection Issues
- Use `${{Postgres.DATABASE_URL}}` syntax for variable references
- Ensure PostgreSQL service is running
- Check if service names match in variable references

---

## Using Railway CLI (Alternative)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy API
cd athena-platform/server
railway up --service athena-api

# Deploy Web
cd athena-platform/client
railway up --service athena-web
```

---

## GitHub Actions Auto-Deploy

The workflow at `.github/workflows/railway-deploy.yml` will auto-deploy on push to main.

### Required Secret
Add `RAILWAY_TOKEN` to GitHub Secrets:
1. Go to Railway → Account Settings → Tokens → Create Token
2. Go to GitHub → Repo Settings → Secrets → Actions → New Secret
3. Name: `RAILWAY_TOKEN`, Value: (paste token)

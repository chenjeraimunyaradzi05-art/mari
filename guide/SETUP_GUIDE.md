# Next.js PoC File Structure & Setup Guide

## Step 1: Create Project Directory
```bash
mkdir laravel-to-nextjs-poc
cd laravel-to-nextjs-poc
```

## Step 2: Copy These Files

### Root Level Files (already created)
- `docker-compose.yml` ✅
- `Dockerfile` ✅
- `package.json` ✅
- `README.md` ✅

### Create These Directories & Files

```bash
mkdir -p app/api/auth/\[...nextauth\]
mkdir -p app/auth/signin
mkdir -p app/auth/error
mkdir -p app/dashboard
mkdir -p lib
mkdir -p prisma
mkdir -p __tests__
```

## Step 3: Configuration Files

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "dom", "dom.iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### `next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig
```

### `.env.local`
```
DATABASE_URL=mysql://nextjs_user:nextjs_password@localhost:3306/nextjs_app
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=your_super_secret_key_change_this_in_production_12345
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
# Email settings
# EMAIL_PROVIDER: 'smtp' | 'sendgrid' | 'log' (default: 'log' will only print emails to the console)
EMAIL_PROVIDER=smtp
EMAIL_FROM="Support <no-reply@example.com>"
# If using SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
# If using SendGrid
SENDGRID_API_KEY=

# Queueing (optional)
# If you want resilient send/retry with Bull, configure Redis and enable queuing
REDIS_URL=redis://localhost:6379
EMAIL_USE_QUEUE=true
# Run the worker to process queued mails:
# npm --prefix guide run mail:worker
```

### `.eslintrc.json`
```json
{
  "extends": "next/core-web-vitals"
}
```

### `.prettierrc.json`
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 80
}
```

### `jest.config.js`
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
}

module.exports = createJestConfig(customJestConfig)
```

### `jest.setup.js`
```javascript
import '@testing-library/jest-dom'
```

## Step 4: Prisma Setup

### `prisma/.env` (symlink to root .env.local)
Your Prisma will read from `DATABASE_URL` in `.env.local`

### `prisma/schema.prisma`
Already created — put in `prisma/schema.prisma`

### Generate Migration
```bash
npx prisma migrate dev --name init
```

**Email verification & password reset (PoC)**

- Registration and password-reset endpoints in this PoC create entries in the `verification_tokens` table (Prisma model `VerificationToken`) and return `ok: true`.
- You must configure an email sender (SMTP/SendGrid/etc.) in production to send verification and reset links such as `/auth/verify?token=...` and `/auth/reset-password?token=...`. The PoC generates tokens and stores them; sending the email is left to your mailer of choice.

## Step 5: Create App Files

See the full file listings in the companion guide:
- `lib/prisma.ts`
- `lib/auth.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/api/auth/[...nextauth]/route.ts`
- `app/auth/signin/page.tsx`
- `app/dashboard/page.tsx`
- `__tests__/auth.test.ts`

## Step 6: Run Everything

```bash
# Terminal 1: Start Docker containers
docker-compose up -d

# Terminal 2: Install deps & migrate DB
npm install
npx prisma migrate dev --name init

# Terminal 3: Start dev server
npm run dev
```

Visit: http://localhost:3000

---

## File-by-File Checklist

- [ ] `docker-compose.yml` ✅
- [ ] `Dockerfile` ✅
- [ ] `package.json` ✅
- [ ] `tsconfig.json`
- [ ] `next.config.js`
- [ ] `.env.local`
- [ ] `.eslintrc.json`
- [ ] `.prettierrc.json`
- [ ] `jest.config.js`
- [ ] `jest.setup.js`
- [ ] `prisma/schema.prisma` ✅
- [ ] `lib/prisma.ts`
- [ ] `lib/auth.ts` ✅
- [ ] `app/layout.tsx`
- [ ] `app/page.tsx`
- [ ] `app/api/auth/[...nextauth]/route.ts`
- [ ] `app/auth/signin/page.tsx`
- [ ] `app/dashboard/page.tsx`
- [ ] `__tests__/auth.test.ts`

I'll provide the remaining files in the next message.

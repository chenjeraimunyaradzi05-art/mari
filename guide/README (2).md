# Laravel-to-Next.js Migration PoC

A complete starter scaffold for migrating your 22.6k PHP + 1.3k Blade template Laravel app to Next.js 14 + Prisma + NextAuth.js with MySQL.

## Quick Start (3 steps)

### 1. Start Docker (MySQL + Redis)
```bash
docker-compose up -d
```

### 2. Install dependencies & initialize DB
```bash
npm install
npx prisma migrate dev --name init
```

### 3. Run dev server
```bash
npm run dev
```

Open **http://localhost:3000** → you'll see the home page.

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts           # NextAuth.js API handler
│   │   └── (routes)/               # Future API endpoints (Blade Controllers → here)
│   ├── auth/
│   │   ├── signin/page.tsx         # Login page
│   │   └── error/page.tsx          # Auth error page
│   ├── layout.tsx                  # Root layout (shared across pages)
│   ├── page.tsx                    # Home page (Blade → React)
│   └── dashboard/page.tsx          # Protected page example
├── lib/
│   ├── auth.ts                     # NextAuth.js configuration
│   ├── prisma.ts                   # Prisma client instance
│   └── middleware.ts               # Protected routes middleware
├── prisma/
│   ├── schema.prisma               # Database schema (Maps Laravel models)
│   └── migrations/                 # Auto-generated DB migrations
├── __tests__/
│   ├── auth.test.ts                # Auth flow tests
│   └── pages.test.tsx              # Page component tests
├── .env.local                      # Environment variables (not in git)
├── docker-compose.yml              # MySQL + Redis containers
├── Dockerfile                      # Node.js container
├── next.config.js                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
├── jest.config.js                  # Jest test configuration
└── package.json                    # Dependencies & scripts
```

---

## Key Files Explained

### `prisma/schema.prisma`
Maps your Laravel models to Prisma schema. **Add your models here** (copy structure from your Laravel app):

```prisma
// Example: Your Product model
model Product {
  id    Int     @id @default(autoincrement())
  title String
  price Float
  userId String
  user  User    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@map("products")
}
```

### `app/api/auth/[...nextauth]/route.ts`
NextAuth.js endpoint. Handles `/api/auth/signin`, `/api/auth/callback`, `/api/auth/session`, etc.

### `app/page.tsx`
Home page (converted from `resources/views/home.blade.php` → React). Edit here to see changes.

### `lib/auth.ts`
Authentication logic. Validates credentials against Prisma User model. Add custom logic here.

### `lib/middleware.ts`
Protects routes. Add routes that require authentication (e.g., `/dashboard`).

---

## Available Scripts

```bash
# Development
npm run dev                # Start Next.js dev server (http://localhost:3000)
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Lint code (ESLint)

# Testing
npm run test               # Run tests (Jest)
npm run test:watch        # Watch mode for tests

# Database
npm run prisma:migrate    # Create & apply DB migrations
npm run prisma:studio    # Open Prisma Studio (web UI for database)
npm run prisma:generate  # Generate Prisma client (auto on build)
```

---

## Test User

The DB is pre-seeded with a test user:

- **Email:** test@example.com
- **Password:** password123

Log in at http://localhost:3000/auth/signin

---

## Database Connection

Environment variables (in `.env.local`):

```env
DATABASE_URL=mysql://nextjs_user:nextjs_password@localhost:3306/nextjs_app
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

**MySQL Admin:**
- Host: `localhost:3306`
- User: `nextjs_user`
- Password: `nextjs_password`
- Database: `nextjs_app`

---

## Migration Checklist (Phase 1)

- [ ] Add Prisma models matching your Laravel models (copy from `app/Models/`)
- [ ] Run `npm run prisma:migrate` to sync DB schema
- [ ] Convert 1-2 controllers to API routes in `app/api/`
- [ ] Convert related Blade templates to React components in `app/`
- [ ] Add tests for each API route and component
- [ ] Test locally via `npm run dev` and `npm run test`
- [ ] Deploy PoC to Vercel/Netlify for team review

---

## Next Steps

1. **Add your models:** Edit `prisma/schema.prisma` with your Laravel models
2. **Seed test data:** Create `prisma/seed.ts` for test fixtures
3. **Convert auth controller:** Map Laravel auth logic → NextAuth.js
4. **Convert home page:** Map `home.blade.php` → `app/page.tsx`
5. **Add API routes:** Pick one controller, convert to `app/api/route.ts`
6. **Deploy to staging:** Push to GitHub, connect Vercel, deploy preview
7. **Iterate Phase 1** until you're confident in the pattern

---

## Troubleshooting

**Docker won't start:**
```bash
docker-compose down
docker-compose up --build
```

**Prisma migrate fails:**
```bash
rm prisma/dev.db  # (SQLite only, not MySQL)
npx prisma migrate reset
```

**Port 3000 already in use:**
```bash
# Change in docker-compose.yml:
ports:
  - '3001:3000'  # Map to 3001 locally
```

**Node modules stuck:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Support

- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **NextAuth.js Docs:** https://next-auth.js.org
- **Testing:** https://jestjs.io/

---

**You're ready to migrate! 🚀**

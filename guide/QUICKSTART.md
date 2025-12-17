# 🚀 Next.js PoC - Quick Start (5 minutes to running code)

## Your Files Are Ready

I've scaffolded a complete Next.js 14 + Prisma + NextAuth.js + MySQL PoC. Here's what you need to do:

---

## Step 1: Create Project Directory

```bash
mkdir laravel-to-nextjs-poc
cd laravel-to-nextjs-poc
git init
```

---

## Step 2: Copy These Files Into Your Project

### Root Level (Copy as-is)
- `docker-compose.yml`
- `Dockerfile`
- `package.json`
- `.env.local`
- `README.md`

### Configuration Files
Create these exactly:
- `tsconfig.json`
- `next.config.js`
- `.eslintrc.json`
- `.prettierrc.json`
- `jest.config.js`
- `jest.setup.js`

### Directory & File Structure
```
laravel-to-nextjs-poc/
├── prisma/
│   ├── schema.prisma          # Your Prisma schema (MySQL models)
│   └── migrations/            # Auto-generated
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   └── auth.ts                # NextAuth.js config
├── app/
│   ├── layout.tsx             # Root layout wrapper
│   ├── page.tsx               # Home page (Blade → React)
│   ├── api/
│   │   └── auth/[...nextauth]/
│   │       └── route.ts       # NextAuth API handler
│   ├── auth/
│   │   └── signin/
│   │       └── page.tsx       # Login page
│   └── dashboard/
│       └── page.tsx           # Protected page example
├── __tests__/
│   └── auth.test.ts           # Example tests
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.local
└── [other configs]
```

---

## Step 3: Start Docker (MySQL + Redis)

```bash
docker-compose up -d
```

You should see:
```
✓ Container laravel_to_nextjs_db started
✓ Container laravel_to_nextjs_cache started
```

Check with:
```bash
docker ps
# Should show 2 containers running
```

---

## Step 4: Install & Initialize

```bash
npm install

# Generate Prisma client & create tables
npx prisma migrate dev --name init

# When prompted: "Would you like me to create it?" → YES
```

After this completes, your MySQL database is ready with:
- `users` table
- `accounts` table (OAuth support)
- `sessions` table (NextAuth sessions)
- `verification_tokens` table

---

## Step 5: Run Dev Server

```bash
npm run dev
```

You'll see:
```
 ▲ Next.js 14.0.0
 - Local:        http://localhost:3000
```

---

## Step 6: Test It! 🎉

Open browser: **http://localhost:3000**

You should see:
1. ✅ Home page loads
2. ✅ Shows "System Status" (all green)
3. ✅ Click "Sign In" button
4. ✅ Login page appears with test credentials pre-filled:
   - Email: `test@example.com`
   - Password: `password123`
5. ✅ Click "Sign In"
6. ✅ Redirects back to home, now shows "Logged in as: test@example.com"
7. ✅ Click "Dashboard" link or navigate to `/dashboard`
8. ✅ Shows user details (protected page works!)
9. ✅ Click "Sign Out"

**If all ✅, your PoC is working!**

---

## Quick Troubleshooting

### Port 3000 already in use
Edit `docker-compose.yml`:
```yaml
ports:
  - '3001:3000'  # Now access http://localhost:3001
```

### Docker containers won't start
```bash
docker-compose down
docker-compose up --build
```

### Database errors
```bash
docker exec laravel_to_nextjs_db mysql -u nextjs_user -pnextjs_password -e "SELECT 1"
# Should return: 1
```

### Prisma client missing
```bash
npx prisma generate
```

---

## Useful Commands

```bash
# Database
npm run prisma:studio       # Open Prisma Studio (web UI) at http://localhost:5555
npm run prisma:migrate      # Create new migration (after schema changes)

# Development
npm run dev                 # Start dev server
npm run lint               # Lint code (ESLint)

# Testing
npm run test               # Run tests
npm run test:watch        # Watch mode

# Production
npm run build              # Build for production
npm run start              # Start production server
```

---

## Next: Add Your Models

1. Open `prisma/schema.prisma`
2. Add your Laravel models (copy structure from your `app/Models/`)
3. Run `npm run prisma:migrate`
4. Continue to Phase 1 (convert controllers → API routes)

Example - convert Laravel model:

**Laravel (app/Models/Product.php):**
```php
class Product extends Model {
    protected $fillable = ['title', 'price'];
}
```

**Prisma (prisma/schema.prisma):**
```prisma
model Product {
  id    Int     @id @default(autoincrement())
  title String
  price Float
  createdAt DateTime @default(now())

  @@map("products")  // Maps to "products" table
}
```

Then migrate:
```bash
npm run prisma:migrate
```

---

## You're Ready! 🎯

This PoC validates:
- ✅ Next.js 14 runs locally
- ✅ MySQL + Prisma connected
- ✅ NextAuth.js authentication works
- ✅ Protected pages work
- ✅ Docker dev environment works

**Next: Phase 1 - Convert your first controller + model + views → API route + React components**

Questions? Check:
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- NextAuth.js: https://next-auth.js.org

Go! 🚀

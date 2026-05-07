# 🏛️ Athena Platform

## The Career SuperApp for Young Professionals

Athena is a comprehensive career development platform designed to help young professionals navigate their career journey through jobs, mentorship, education, community, and AI-powered guidance.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or later
- PostgreSQL 16+
- Redis 7+
- npm or yarn

### Local Development

```bash
# Clone the repository
git clone https://github.com/chenjeraimunyaradzi05-art/mari.git
cd mari/athena-platform

# Start infrastructure (PostgreSQL, Redis, OpenSearch)
docker-compose up -d db redis

# Setup server
cd server
npm install
cp .env.example .env  # Edit with your values
npx prisma generate
npx prisma migrate dev
npm run dev

# Setup client (in another terminal)
cd client
npm install
cp .env.local.example .env.local  # Edit with your values
npm run dev
```

The app will be available at:

- **Frontend:** <http://localhost:3000>
- **Backend API:** <http://localhost:5000>
- **API Docs:** <http://localhost:5000/api/docs>

---

## 📁 Project Structure

```text
athena-platform/
├── client/          # Next.js 14 frontend
├── server/          # Express.js backend API
├── mobile/          # React Native mobile app
├── ml/              # Python ML services (FastAPI)
├── shared/          # Shared TypeScript utilities
├── infrastructure/  # Terraform IaC
└── docs/            # Documentation
```

---

## 🧩 Key Features

### For Job Seekers

- 🔍 AI-powered job matching and recommendations
- 📝 Resume builder with AI suggestions
- 🎯 Interview preparation coach
- 📊 Salary transparency tools
- 🌐 Professional networking

### For Employers

- 📢 Job posting and applicant management
- 🤖 AI-assisted candidate screening
- 📈 Employer branding tools
- 💼 Company culture showcase

### For Creators & Mentors

- 🎓 Course creation platform
- 👥 Mentorship programs
- 💰 Monetization tools
- 📹 Video content hosting

### Community Features

- 🗣️ Professional groups and events
- 📱 Real-time messaging
- 📰 Content feed with engagement
- 🏆 Achievement badges

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Caching | Redis 7 |
| Search | OpenSearch 2.11 |
| ML | Python, FastAPI, scikit-learn |
| Mobile | React Native, Expo |
| Infrastructure | Terraform, AWS, Docker |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [docs/product/BUSINESS_SOCIAL_OVERVIEW.md](./docs/product/BUSINESS_SOCIAL_OVERVIEW.md) | Strategic business model, positioning, and social-product overview |
| [docs/marketing/LANDING_PAGE_COPY.md](./docs/marketing/LANDING_PAGE_COPY.md) | Reusable landing-page messaging and CTA copy |
| [docs/investors/INVESTOR_ONE_PAGER.md](./docs/investors/INVESTOR_ONE_PAGER.md) | Investor-facing summary of the product, business model, and moat |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Production deployment checklist |
| [docs/api/API_OVERVIEW.md](./docs/api/API_OVERVIEW.md) | API documentation |
| [docs/runbooks/ONCALL.md](./docs/runbooks/ONCALL.md) | On-call procedures |
| [docs/compliance/GDPR_CHECKLIST.md](./docs/compliance/GDPR_CHECKLIST.md) | GDPR compliance |

---

## 🧪 Testing

```bash
# Server tests
cd server
npm test

# Client type check & build
cd client
npm run build

# E2E tests (requires running app)
cd client
npm run e2e
```

**Test Coverage:**

- Server: 22 test suites, 99 tests ✅
- Client: TypeScript build passes ✅

---

## 🔐 Security

- 🔒 JWT authentication with refresh tokens
- 🛡️ Helmet.js security headers
- 🚦 Rate limiting per endpoint
- 🔐 Password hashing with bcrypt
- ✅ Input validation with express-validator
- 🗄️ SQL injection prevention via Prisma

---

## 🚢 Deployment

### Backend API (Node container host)

The Express API ships with a multi-stage `Dockerfile` and is portable across any
container host (Render, Fly.io, AWS App Runner, your own VM, etc.).

1. Connect your GitHub repository on the host of your choice
2. Set root directory to `athena-platform/server`
3. Use the bundled `Dockerfile` (no extra build config required)
4. Entry point: `node dist/start.js` (runs Prisma migrations then boots the server)
5. Set the env vars from [`server/.env.production.example`](./server/.env.production.example)
   (at minimum: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`,
   `ALLOWED_ORIGINS`, `TRUST_PROXY=true`)

### Frontend (Netlify)

1. Connect your GitHub repository
2. Set base directory to `athena-platform/client`
3. `@netlify/plugin-nextjs` handles SSR, API routes, and middleware automatically
4. Add environment variables: `NEXT_PUBLIC_API_URL` (backend API URL),
   `NEXT_PUBLIC_APP_URL` (this Netlify site's URL),
   `NEXT_PUBLIC_SOCKET_URL` (defaults to `NEXT_PUBLIC_API_URL`)

### Database (Neon)

- Use Neon's pooled URL for `DATABASE_URL` (hostname includes `-pooler`).
- Use Neon's direct/unpooled URL for `DIRECT_DATABASE_URL` (used by Prisma migrations).
- Migrations run automatically on every deploy from `start.ts`.
- Netlify users can provision Neon directly via the official Neon integration.

See [DEPLOY.md](./DEPLOY.md) for the complete deployment guide.

---

## 📊 Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health check |
| `GET /health/ready` | Readiness probe (checks DB) |
| `GET /health/detailed` | Detailed dependency status |
| `GET /health/auth-diag` | Auth flow diagnostics (temporary) |
| `GET /livez` | Kubernetes liveness probe |
| `GET /readyz` | Kubernetes readiness probe |
| `GET /metrics` | Prometheus metrics |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

For support, please contact the development team.

---

**Built with love for the next generation of professionals**

# ATHENA Frontend (prototype)

Minimal Next.js + TypeScript + Tailwind skeleton for the ATHENA frontend.


Setup

```bash
cd athena-frontend
npm install
npm run dev
# in another terminal (optional) run a mock API for onboarding/auth
npm run mock-api
```

Set `NEXT_PUBLIC_MOCK_API_URL` to change the mock API base URL.

What's included:

- Root layout with `Header` and `Footer`
- Tailwind theme colors reflecting ATHENA brand
- `lib/stores/authStore.ts` — basic auth store using `zustand`
- `lib/constants/copy.ts` — copy strings with `Member` terminology

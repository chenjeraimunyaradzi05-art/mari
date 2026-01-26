# ATHENA Web Client

This folder is a deployment stub. **Do not use this as Railway's root directory.**

## Railway Deployment

For Railway deployment, set the **Root Directory** to:
```
athena-platform/client
```

The actual source code is located in `../athena-platform/client/`.

## Local Development

```bash
cd athena-platform/client
npm install --legacy-peer-deps
npm run dev
```

## Environment Variables

Copy the environment template from the client folder:
```bash
cp ../athena-platform/client/.env.local.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `NEXTAUTH_URL` - NextAuth URL
- `NEXTAUTH_SECRET` - NextAuth secret

See `../athena-platform/client/.env.local.example` for full list.

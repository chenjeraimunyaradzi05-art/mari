# ATHENA Web Client

This folder provides deployment configuration for the ATHENA web client.

The actual source code is located in `../athena-platform/client/`.

## Deployment

For platforms that expect a `web` folder at root:

```bash
cd web
npm install
npm run build
npm start
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

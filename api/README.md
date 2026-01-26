# ATHENA API

This folder is a deployment stub. **Do not use this as Railway's root directory.**

## Railway Deployment

For Railway deployment, set the **Root Directory** to:
```
athena-platform/server
```

The actual source code is located in `../athena-platform/server/`.

## Local Development

```bash
cd athena-platform/server
npm install
npm run dev
```

## Environment Variables

Copy the environment template from the server folder:
```bash
cp ../athena-platform/server/.env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT tokens
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `STRIPE_SECRET_KEY` - Stripe secret key for payments

See `../athena-platform/server/.env.example` for full list.

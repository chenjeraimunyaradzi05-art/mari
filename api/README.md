# ATHENA API

This folder provides deployment configuration for the ATHENA API server.

The actual source code is located in `../athena-platform/server/`.

## Deployment

For platforms that expect an `api` folder at root:

```bash
cd api
npm install
npm run build
npm start
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

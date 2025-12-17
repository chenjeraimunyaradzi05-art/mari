# ATHENA Auth Service (dev)

Small Express service providing JWT-based authentication for local development and integration tests.

Endpoints:
- `POST /register` { email, password, name }
- `POST /login` { email, password } => { token, user }
- `GET /me` (Bearer token)

Start:

```bash
cd auth-service
npm install
npm start
```

Use `AUTH_JWT_SECRET` to set a production-ready secret.

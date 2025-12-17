#!/bin/bash

# Setup script for Laravel-to-Next.js migration PoC

echo "🚀 Installing dependencies..."
npm install

echo "📦 Generating Prisma client..."
npx prisma generate

echo "🗄️ Running database migrations..."
npx prisma migrate dev --name init

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start Docker: docker-compose up"
echo "2. In another terminal, run: npm run dev"
echo "3. Visit http://localhost:3000"
echo "4. Sign in with test@example.com / password123"
echo ""
echo "Useful commands:"
echo "- npm run prisma:studio   # View database in Prisma Studio"
echo "- npm run test            # Run tests"
echo "- npm run lint            # Lint code"

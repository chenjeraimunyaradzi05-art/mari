FROM node:18-bullseye-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build || true

EXPOSE 3000

CMD ["npm", "run", "dev"]

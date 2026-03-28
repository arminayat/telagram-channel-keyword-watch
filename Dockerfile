# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack and prepare pnpm (uses version from package.json)
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install tzdata for timezone support
RUN apk add --no-cache tzdata

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]

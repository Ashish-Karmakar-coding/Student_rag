# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared types first
RUN pnpm --filter shared build

# Build backend
RUN pnpm --filter backend build

EXPOSE 8000

CMD ["node", "apps/backend/dist/index.js"]

# Multi-stage build. Stage 1 installs full deps + builds; stage 2 ships
# a slim image with just node_modules and the compiled .next output.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build placeholders — the validator just wants these defined; runtime
# replaces them via deploy-environment env vars.
ARG DATABASE_URL=postgres://placeholder@localhost/placeholder
ARG JWT_SECRET=ci-only-32bytes-base64-aaaaaaaa=
ARG PROVIDER_ENCRYPTION_KEY=ci-only-32bytes-base64-aaaaaaaa=
ENV DATABASE_URL=$DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV PROVIDER_ENCRYPTION_KEY=$PROVIDER_ENCRYPTION_KEY
RUN npm run build

# ── Web (Next.js server) ────────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S pablo && adduser -S pablo -G pablo
COPY --from=build --chown=pablo:pablo /app/.next ./.next
COPY --from=build --chown=pablo:pablo /app/public ./public
COPY --from=build --chown=pablo:pablo /app/node_modules ./node_modules
COPY --from=build --chown=pablo:pablo /app/package.json ./
USER pablo
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]

# ── Worker ─────────────────────────────────────────────────────────────────
# Build with: docker build --target worker -t pablo-worker .
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S pablo && adduser -S pablo -G pablo
COPY --from=build --chown=pablo:pablo /app/node_modules ./node_modules
COPY --from=build --chown=pablo:pablo /app/src ./src
COPY --from=build --chown=pablo:pablo /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=pablo:pablo /app/package.json ./
USER pablo
CMD ["npx", "tsx", "src/worker/index.ts"]

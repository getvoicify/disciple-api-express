# Multi-stage Dockerfile for Node.js API

# Build arguments
ARG VERSION=dev
ARG BUILD_DATE
ARG COMMIT_SHA

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN touch .build_trigger
RUN npm run build && ls -la dist/ && echo "Build successful - dist directory contains:" && ls dist/

# Stage 3: Production
FROM node:20-alpine AS runner

# Re-declare build arguments for this stage
ARG VERSION=dev
ARG BUILD_DATE
ARG COMMIT_SHA

WORKDIR /app

# Install PostgreSQL client for migrations
RUN apk add --no-cache postgresql-client

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Add labels for image metadata
LABEL org.opencontainers.image.title="Disciple API" \
      org.opencontainers.image.description="Church and worship API for managing notes and scripture references" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${COMMIT_SHA}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/tom/disciple-api" \
      org.opencontainers.image.documentation="https://github.com/tom/disciple-api/blob/main/README.md"

# Set version as environment variable
ENV APP_VERSION=${VERSION} \
    BUILD_DATE=${BUILD_DATE} \
    COMMIT_SHA=${COMMIT_SHA}

# Copy dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

# Copy migration files and scripts
COPY --chown=nodejs:nodejs migrations ./migrations
COPY --chown=nodejs:nodejs scripts/run-migrations.sh ./scripts/
COPY --chown=nodejs:nodejs scripts/run-migrations-only.sh ./scripts/
RUN chmod +x ./scripts/run-migrations.sh ./scripts/run-migrations-only.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start the application with migrations
ENTRYPOINT ["/app/scripts/run-migrations.sh"]
CMD ["node", "dist/index.js"]
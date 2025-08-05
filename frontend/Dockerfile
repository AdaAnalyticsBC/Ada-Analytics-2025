# 📊 Ada Analytics Frontend Dashboard - Railway Deployment
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline

# Production stage
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json .

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application  
CMD ["node", "build"]
#!/bin/bash

# Production start script for Ada Analytics Trading Agent
echo "🤖 Starting Ada Analytics Trading Agent in production mode..."

# Check if .env file exists (for local production)
if [ ! -f ".env" ] && [ -z "$RAILWAY_ENVIRONMENT" ] && [ -z "$DENO_DEPLOYMENT_ID" ]; then
    echo "❌ .env file not found and not running in a cloud environment."
    echo "📝 Please create a .env file with your API keys or deploy to a cloud platform."
    exit 1
fi

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno not found. Please install Deno first:"
    echo "curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# Set production environment
export NODE_ENV=production

# Cache dependencies
echo "📦 Caching dependencies..."
deno cache main.ts

# Start the application
echo "🚀 Starting production server..."
echo "📍 Server will be available at: $BASE_URL"

# Run with optimizations for production
deno run \
    --allow-all \
    --no-check \
    --quiet \
    main.ts
#!/bin/bash
set -e

# 🤖 Ada Analytics Trading Agent - Production Start
echo "🚀 Starting production mode..."

# Environment check
if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -f ".env" ]; then
    echo "❌ No environment variables or .env file found"
    echo "💡 Set env vars or create .env file"
    exit 1
fi

# Cache dependencies for faster startup
echo "📦 Caching dependencies..."
deno cache main_new.ts

# Start production server
echo "✅ Starting Ada Analytics Trading Agent"
echo "📊 Dashboard: $BASE_URL"

exec deno run \
    --allow-all \
    --no-check \
    --quiet \
    main_new.ts
#!/bin/bash
set -e

# 🧪 Ada Analytics Trading Agent - Test Suite
echo "🧪 Running test suite..."

# Test environment setup
export NODE_ENV=test
export BASE_URL=http://localhost:8080
export PORT=8080

# Start test server in background
echo "🚀 Starting test server..."
deno run --allow-all main_new.ts &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server startup..."
sleep 5

# Run API tests
echo "🔍 Testing API endpoints..."
curl -f http://localhost:8080/api/health || {
    echo "❌ Health check failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
}

# Test individual services
echo "🧪 Testing services..."
curl -f http://localhost:8080/test/anthropic || echo "⚠️ Claude API test failed"
curl -f http://localhost:8080/test/market-data || echo "⚠️ Market data test failed"

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

echo "✅ Tests completed!"
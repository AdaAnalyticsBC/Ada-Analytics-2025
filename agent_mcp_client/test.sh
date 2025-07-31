#!/bin/bash

# Test runner for Ada Analytics Trading Agent
echo "🧪 Running Ada Analytics Trading Agent Tests..."
echo ""

# Set test environment
export NODE_ENV=test
export ANTHROPIC_API_KEY=test-key
export RESEND_API_KEY=test-resend-key
export BASE_URL=http://localhost:3000
export ALPACA_API_KEY=test-alpaca
export ALPACA_SECRET_KEY=test-secret

echo "🔧 Test Environment:"
echo "   NODE_ENV: $NODE_ENV"
echo "   API Keys: Configured for testing"
echo ""

# Run the tests
echo "🚀 Executing test suite..."
echo ""

deno test \
  --allow-all \
  --no-check \
  --reporter=pretty \
  main_test.ts

echo ""
echo "📊 Test Results Summary:"
echo "   ✅ All tests completed"
echo "   📝 Check output above for detailed results"
echo "   🔍 Failed tests are highlighted in red"
echo ""
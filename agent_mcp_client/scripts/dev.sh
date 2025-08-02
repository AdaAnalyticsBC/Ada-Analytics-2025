#!/bin/bash
set -e

# 🤖 Ada Analytics Trading Agent - Development Mode
echo "🚀 Starting development mode..."

# Check for Deno
if ! command -v deno &> /dev/null; then
    echo "❌ Deno not found. Installing..."
    curl -fsSL https://deno.land/install.sh | sh
    export PATH="$HOME/.deno/bin:$PATH"
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating .env template..."
    cat << 'EOF' > .env
# 🤖 Ada Analytics Trading Agent - Environment Variables

# Core AI & Communication
ANTHROPIC_API_KEY=your_anthropic_key_here
RESEND_API_KEY=your_resend_key_here

# Trading & Data
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_here
SUPABASE_ACCESS_TOKEN=your_supabase_token_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
QUIVER_API_TOKEN=your_quiver_token_here

# Application
BASE_URL=http://localhost:8080
PORT=8080
NODE_ENV=development
EOF
    echo "⚠️ Please fill in your API keys in .env file"
    echo "📖 Refer to REFACTORING_GUIDE.md for details"
    exit 1
fi

# Start with hot reload
echo "🔄 Starting with hot reload..."
echo "📊 Dashboard: http://localhost:8080"
echo "🧪 Tests: http://localhost:8080/test"

deno run --allow-all --watch main_new.ts
#!/bin/bash

# Development script for Ada Analytics Trading Agent
echo "🤖 Starting Ada Analytics Trading Agent in development mode..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Creating from template..."
    echo "📝 Please create a .env file with your API keys."
        cat << EOF > .env
# Trading Agent Environment Variables
# Copy this file to .env and fill in your actual values

# Core API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
RESEND_API_KEY=your_resend_api_key_here

# Trading API Keys  
ALPACA_API_KEY=your_alpaca_api_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here

# Data Sources
SUPABASE_ACCESS_TOKEN=your_supabase_token_here
QUIVER_API_TOKEN=your_quiver_token_here

# Application Configuration
BASE_URL=http://localhost:3000
PORT=3000
TZ=America/New_York

# Development
NODE_ENV=development
DEBUG=true
EOF
        echo "📝 Created .env template. Please fill in your actual API keys."
        exit 1
fi

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno not found. Please install Deno first:"
    echo "curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# Cache dependencies
echo "📦 Caching dependencies..."
deno cache main.ts

# Start in development mode with file watching
echo "🚀 Starting development server with file watching..."
echo "📍 Server will be available at: http://localhost:3000"
echo "🔄 Files are being watched for changes..."
echo "🛑 Press Ctrl+C to stop"

deno run --allow-all --watch main.ts
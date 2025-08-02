#!/bin/bash
set -e

# 🚀 Deploy Ada Analytics Trading Agent to Railway
echo "🚀 Deploying to Railway..."

# Install Railway CLI if needed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    if command -v npm &> /dev/null; then
        npm install -g @railway/cli
    elif command -v yarn &> /dev/null; then
        yarn global add @railway/cli
    else
        echo "❌ Need npm or yarn to install Railway CLI"
        exit 1
    fi
fi

# Login check
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

# Project setup
if [ ! -f "railway.toml" ]; then
    echo "📦 Initializing Railway project..."
    railway init
fi

# Environment variables from .env
if [ -f ".env" ]; then
    echo "🔧 Setting environment variables..."
    
    # Upload environment variables
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ $line =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        
        # Set variable
        if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            # Remove quotes
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/')
            echo "Setting $key..."
            railway variables set "$key=$value"
        fi
    done < .env
else
    echo "⚠️ No .env file found. Using Railway environment variables."
fi

# Deploy
echo "🚀 Deploying..."
railway up --detach

# Get deployment info
echo "✅ Deployment complete!"
echo "🌐 App URL: $(railway domain)"
echo "📊 Logs: railway logs"
echo "⚙️ Dashboard: https://railway.app/dashboard"
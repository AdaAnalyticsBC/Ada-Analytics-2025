#!/bin/bash

# Deploy Ada Analytics Trading Agent to Railway
echo "🚀 Deploying Ada Analytics Trading Agent to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
railway login

# Create new project (or use existing)
echo "📦 Setting up Railway project..."
railway init

# Set environment variables from .env file
echo "🔧 Setting environment variables..."

if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    
    # Read .env file and set variables
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ $line =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
            continue
        fi
        
        # Extract key=value pairs
        if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            
            # Remove quotes if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/')
            
            echo "Setting $key..."
            railway variables set "$key=$value"
        fi
    done < .env
else
    echo "❌ .env file not found. Please create one with your API keys."
    echo "Use the template: cp .env.template .env"
    exit 1
fi

# Deploy the application
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your app will be available at: https://your-app.railway.app"
echo "📊 Check logs with: railway logs"
echo "⚙️  Manage at: https://railway.app/dashboard"
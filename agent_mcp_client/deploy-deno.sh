#!/bin/bash

# Deploy Ada Analytics Trading Agent to Deno Deploy
echo "🦕 Deploying Ada Analytics Trading Agent to Deno Deploy..."

# Check if deployctl is installed
if ! command -v deployctl &> /dev/null; then
    echo "❌ deployctl not found. Installing..."
    deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one with your API keys."
    echo "Use the template: cp .env.template .env"
    exit 1
fi

# Project name (change this to your actual project name)
PROJECT_NAME="ada-analytics-trading-agent"

echo "🔧 Setting up deployment..."

# Read environment variables and prepare them for deployment
ENV_VARS=""
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
        
        ENV_VARS="$ENV_VARS --env=$key=$value"
    fi
done < .env

echo "🚀 Deploying to Deno Deploy..."

# Deploy with environment variables
deployctl deploy \
    --project=$PROJECT_NAME \
    --prod \
    $ENV_VARS \
    main.ts

echo "✅ Deployment complete!"
echo "🌐 Your app will be available at: https://$PROJECT_NAME.deno.dev"
echo "📊 Manage at: https://dash.deno.com/projects/$PROJECT_NAME"
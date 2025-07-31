#!/bin/bash

# Ada Analytics Trading Agent Restart Script
# Safely shuts down and restarts the trading agent

set -e

echo "🔄 Ada Analytics Agent Restart Script"
echo "===================================="

# Function to check if agent is running
check_agent() {
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        return 0  # Agent is running
    else
        return 1  # Agent is not running
    fi
}

# Function to wait for shutdown
wait_for_shutdown() {
    echo "⏳ Waiting for graceful shutdown..."
    local count=0
    while check_agent && [ $count -lt 30 ]; do
        sleep 2
        count=$((count + 1))
        echo "   Waiting... ($count/30)"
    done
    
    if check_agent; then
        echo "⚠️  Agent still running after 60 seconds"
        return 1
    else
        echo "✅ Agent has shut down"
        return 0
    fi
}

echo ""
echo "📊 Current Agent Status:"
./ada-control status || echo "❌ Agent not responding"

echo ""
echo "🛑 Step 1: Initiating graceful shutdown..."

if check_agent; then
    echo "   Agent is running - requesting shutdown..."
    echo "   Opening web interface for shutdown confirmation..."
    
    # Try to open shutdown page in browser (if available)
    if command -v open >/dev/null 2>&1; then
        # macOS
        open "http://localhost:3000/shutdown" || true
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open "http://localhost:3000/shutdown" || true
    elif command -v start >/dev/null 2>&1; then
        # Windows
        start "http://localhost:3000/shutdown" || true
    fi
    
    echo ""
    echo "🌐 Please use the web interface to shutdown the agent:"
    echo "   http://localhost:3000/shutdown"
    echo ""
    echo "⏳ Waiting for you to confirm shutdown in browser..."
    
    # Wait for user to shutdown via web interface
    if wait_for_shutdown; then
        echo "✅ Graceful shutdown completed"
    else
        echo ""
        echo "⚠️  Graceful shutdown timed out or failed"
        echo "🚨 Would you like to force kill the agent? (y/N)"
        read -r response
        
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "🔥 Force killing agent..."
            ./ada-control kill
            sleep 3
        else
            echo "❌ Restart cancelled - agent still running"
            exit 1
        fi
    fi
else
    echo "ℹ️  Agent is not running"
fi

echo ""
echo "⏱️  Waiting 5 seconds before restart..."
sleep 5

echo ""
echo "🚀 Step 2: Starting agent..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found - copying from template..."
    if [ -f env.template ]; then
        cp env.template .env
        echo "✅ Created .env from template"
        echo "📝 Please edit .env with your API keys before running"
        echo ""
        echo "Required environment variables:"
        echo "  - ANTHROPIC_API_KEY"
        echo "  - RESEND_API_KEY"
        echo "  - And MCP server configurations"
        echo ""
        echo "❌ Restart cancelled - please configure .env first"
        exit 1
    else
        echo "❌ No env.template found - please create .env manually"
        exit 1
    fi
fi

# Start the agent
echo "🤖 Starting Ada Analytics Trading Agent..."
echo ""

# Choose start method based on available scripts
if [ -f "./start.sh" ]; then
    echo "📋 Using production start script..."
    ./start.sh
elif [ -f "./dev.sh" ]; then
    echo "📋 Using development start script..."
    ./dev.sh
else
    echo "📋 Using deno directly..."
    deno run --allow-all main.ts
fi
#!/bin/bash
set -e

# 📊 Ada Analytics Trading Agent - Railway Monitoring
echo "📊 Ada Analytics Trading Agent - Monitoring Dashboard"

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

# Function to display colored output
show_status() {
    local status=$1
    local message=$2
    case $status in
        "healthy") echo "✅ $message" ;;
        "unhealthy") echo "❌ $message" ;;
        "degraded") echo "⚠️ $message" ;;
        *) echo "ℹ️ $message" ;;
    esac
}

# Get Railway app URL
APP_URL=$(railway domain 2>/dev/null || echo "http://localhost:3000")

echo "🌐 App URL: $APP_URL"
echo "=" $(printf '=%.0s' {1..50})

# Main monitoring loop
monitor_loop() {
    while true; do
        clear
        echo "📊 Ada Analytics Trading Agent - Live Monitoring"
        echo "🌐 App: $APP_URL"
        echo "🕐 $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=" $(printf '=%.0s' {1..60})
        
        # Health Check
        echo "🏥 HEALTH STATUS:"
        if health_data=$(curl -s "$APP_URL/api/health" 2>/dev/null); then
            status=$(echo "$health_data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            show_status "$status" "Overall Status: $status"
            
            # Service Status
            echo "🔧 SERVICES:"
            echo "$health_data" | grep -o '"[a-z]*":{"status":"[^"]*"' | while read -r service; do
                service_name=$(echo "$service" | cut -d'"' -f2)
                service_status=$(echo "$service" | cut -d'"' -f6)
                show_status "$service_status" "$service_name: $service_status"
            done
        else
            show_status "unhealthy" "Cannot reach application"
        fi
        
        echo ""
        echo "💰 TRADING STATUS:"
        if metrics_data=$(curl -s "$APP_URL/api/metrics" 2>/dev/null); then
            is_paused=$(echo "$metrics_data" | grep -o '"is_paused":[^,]*' | cut -d':' -f2)
            balance=$(echo "$metrics_data" | grep -o '"account_balance":[^,]*' | cut -d':' -f2)
            total_trades=$(echo "$metrics_data" | grep -o '"total_trades":[^,]*' | cut -d':' -f2)
            
            if [ "$is_paused" = "true" ]; then
                show_status "unhealthy" "Trading: PAUSED"
            else
                show_status "healthy" "Trading: ACTIVE"
            fi
            
            echo "💵 Account Balance: \$$(echo $balance | sed 's/[^0-9.]//g')"
            echo "📈 Total Trades: $(echo $total_trades | sed 's/[^0-9]//g')"
        fi
        
        echo ""
        echo "🔄 QUICK ACTIONS:"
        echo "  [L] View Logs    [H] Health Check    [M] Metrics    [Q] Quit"
        echo "  [P] Performance  [T] Test Services   [D] Dashboard"
        
        # Wait for input (with timeout)
        read -t 10 -n 1 action 2>/dev/null || continue
        
        case $action in
            l|L) railway logs --tail 20 ;;
            h|H) curl -s "$APP_URL/api/health" | jq . 2>/dev/null || echo "Health check failed" ;;
            m|M) curl -s "$APP_URL/api/metrics" | jq . 2>/dev/null || echo "Metrics unavailable" ;;
            p|P) open "$APP_URL/performance" 2>/dev/null || echo "Dashboard: $APP_URL/performance" ;;
            t|T) open "$APP_URL/test" 2>/dev/null || echo "Tests: $APP_URL/test" ;;
            d|D) open "$APP_URL" 2>/dev/null || echo "Dashboard: $APP_URL" ;;
            q|Q) echo "👋 Goodbye!"; exit 0 ;;
        esac
    done
}

# Start monitoring
echo "🚀 Starting live monitoring... (Press Q to quit)"
sleep 2
monitor_loop
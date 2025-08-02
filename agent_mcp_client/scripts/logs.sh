#!/bin/bash
set -e

# 📜 Ada Analytics Trading Agent - Log Viewer
echo "📜 Ada Analytics Trading Agent - Log Viewer"

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

# Function to show logs with different options
show_logs() {
    local option=$1
    case $option in
        "live"|"")
            echo "🔴 Live logs (Press Ctrl+C to stop):"
            railway logs --follow
            ;;
        "errors")
            echo "❌ Error logs (last 100):"
            railway logs --tail 100 | grep -i "error\|fail\|exception" || echo "No errors found"
            ;;
        "trading")
            echo "💰 Trading logs:"
            railway logs --tail 100 | grep -i "trade\|buy\|sell\|order" || echo "No trading activity found"
            ;;
        "health")
            echo "🏥 Health check logs:"
            railway logs --tail 50 | grep -i "health\|status" || echo "No health logs found"
            ;;
        "all")
            echo "📜 All recent logs (last 100):"
            railway logs --tail 100
            ;;
        *)
            echo "❓ Unknown option: $option"
            show_help
            ;;
    esac
}

show_help() {
    echo ""
    echo "📖 Usage: ./logs.sh [option]"
    echo ""
    echo "Options:"
    echo "  live     - Show live logs (default)"
    echo "  errors   - Show only error logs"
    echo "  trading  - Show trading-related logs"
    echo "  health   - Show health check logs"
    echo "  all      - Show all recent logs"
    echo ""
    echo "Examples:"
    echo "  ./logs.sh live"
    echo "  ./logs.sh errors"
    echo "  ./logs.sh trading"
}

# Parse command line arguments
case "${1:-live}" in
    "help"|"-h"|"--help")
        show_help
        exit 0
        ;;
    *)
        show_logs "$1"
        ;;
esac
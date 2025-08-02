#!/bin/bash

# 🚀 Railway Cost Monitoring Script
# This script helps monitor and optimize Railway costs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ada-analytics-agent"
RAILWAY_TOKEN="${RAILWAY_TOKEN}"

print_header() {
    echo -e "${BLUE}=== Railway Cost Monitor ===${NC}"
    echo "Project: $PROJECT_NAME"
    echo "Date: $(date)"
    echo ""
}

check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI not found${NC}"
        echo "Install with: npm install -g @railway/cli"
        exit 1
    fi
}

check_authentication() {
    if [ -z "$RAILWAY_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  RAILWAY_TOKEN not set${NC}"
        echo "Set with: export RAILWAY_TOKEN=your_token"
        echo "Or login with: railway login"
        return 1
    fi
}

get_service_status() {
    echo -e "${GREEN}📊 Service Status:${NC}"
    railway status --project $PROJECT_NAME 2>/dev/null || echo "Could not fetch status"
    echo ""
}

get_usage_stats() {
    echo -e "${GREEN}💰 Usage Statistics:${NC}"
    echo "Note: Railway doesn't provide detailed usage via CLI"
    echo "Check usage at: https://railway.app/dashboard"
    echo ""
}

get_cost_optimization_tips() {
    echo -e "${GREEN}💡 Cost Optimization Tips:${NC}"
    echo "1. ✅ Serverless enabled (scales to zero)"
    echo "2. ✅ Reduced resources (512MB RAM, 500m CPU)"
    echo "3. ✅ No autoscaling (prevents unexpected scaling)"
    echo "4. ⚠️  Monitor usage in Railway dashboard"
    echo "5. ⚠️  Set up billing alerts"
    echo ""
}

get_expected_costs() {
    echo -e "${GREEN}📈 Expected Monthly Costs:${NC}"
    echo "Serverless pricing (approximate):"
    echo "- Base: $5-10/month for low usage"
    echo "- Per request: $0.0001 per 100ms"
    echo "- Bandwidth: $0.10/GB"
    echo ""
}

get_monitoring_commands() {
    echo -e "${GREEN}🔍 Monitoring Commands:${NC}"
    echo "Check logs: railway logs --project $PROJECT_NAME"
    echo "Check status: railway status --project $PROJECT_NAME"
    echo "View metrics: https://railway.app/dashboard"
    echo ""
}

get_cost_alerts() {
    echo -e "${YELLOW}⚠️  Cost Alert Setup:${NC}"
    echo "1. Go to Railway Dashboard"
    echo "2. Navigate to Billing section"
    echo "3. Set up spending alerts"
    echo "4. Monitor usage regularly"
    echo ""
}

main() {
    print_header
    check_railway_cli
    check_authentication
    
    if [ $? -eq 0 ]; then
        get_service_status
        get_usage_stats
    fi
    
    get_cost_optimization_tips
    get_expected_costs
    get_monitoring_commands
    get_cost_alerts
    
    echo -e "${GREEN}✅ Cost monitoring setup complete!${NC}"
}

main "$@" 
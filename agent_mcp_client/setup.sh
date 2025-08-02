#!/bin/bash
set -e

# 🤖 Ada Analytics Trading Agent - Quick Setup
echo "🤖 Ada Analytics Trading Agent - Quick Setup"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

# Check Deno
if command -v deno &> /dev/null; then
    print_status "Deno is installed: $(deno --version | head -n 1)"
else
    print_warning "Deno not found. Installing..."
    curl -fsSL https://deno.land/install.sh | sh
    export PATH="$HOME/.deno/bin:$PATH"
    print_status "Deno installed successfully"
fi

# Check Node.js/npm (for Railway CLI)
if command -v npm &> /dev/null; then
    print_status "npm is available: $(npm --version)"
else
    print_error "npm not found. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Install Railway CLI
echo ""
echo "🚄 Setting up Railway CLI..."
if command -v railway &> /dev/null; then
    print_status "Railway CLI is already installed"
else
    print_info "Installing Railway CLI..."
    npm install -g @railway/cli
    print_status "Railway CLI installed"
fi

# Create environment file
echo ""
echo "📝 Setting up environment variables..."
if [ ! -f ".env" ]; then
    print_info "Creating .env template..."
    cat << 'EOF' > .env
# 🤖 Ada Analytics Trading Agent - Environment Variables
# Fill in your actual API keys and tokens

# Core AI & Communication
ANTHROPIC_API_KEY=your_anthropic_key_here
RESEND_API_KEY=your_resend_key_here

# Trading & Data
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_here
SUPABASE_ACCESS_TOKEN=your_supabase_token_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
QUIVER_API_TOKEN=your_quiver_token_here

# Application Configuration
BASE_URL=http://localhost:8080
PORT=8080
NODE_ENV=development
TZ=America/New_York
EOF
    print_warning "Created .env template. Please fill in your API keys!"
    print_info "Refer to RAILWAY_DEPLOYMENT.md for API key setup instructions"
else
    print_status ".env file already exists"
fi

# Make scripts executable
echo ""
echo "🔧 Setting up scripts..."
chmod +x scripts/*.sh
print_status "Made all scripts executable"

# Test installation
echo ""
echo "🧪 Testing installation..."
if deno cache main_new.ts; then
    print_status "Dependencies cached successfully"
else
    print_error "Failed to cache dependencies"
    exit 1
fi

# Display next steps
echo ""
echo "🎉 Setup complete!"
echo "=================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 📝 Fill in your API keys in the .env file:"
echo "   nano .env"
echo ""
echo "2. 🔒 Setup Supabase RLS (choose one):"
echo "   ./scripts/setup-supabase-rls.sh      # Production (recommended)"
echo "   ./scripts/disable-supabase-rls.sh    # Development only"
echo ""
echo "3. 🧪 Test locally:"
echo "   ./scripts/dev.sh"
echo ""
echo "4. 🚀 Deploy to Railway:"
echo "   ./scripts/deploy.sh"
echo ""
echo "5. 📊 Monitor your deployment:"
echo "   ./scripts/monitor.sh"
echo ""
echo "📖 Documentation:"
echo "   • Database Setup: SUPABASE_RLS_GUIDE.md"
echo "   • Deployment: RAILWAY_DEPLOYMENT.md"
echo "   • Architecture: REFACTORING_GUIDE.md"
echo ""
echo "🌐 After deployment, access:"
echo "   • Dashboard: https://your-app.railway.app/"
echo "   • Health Check: https://your-app.railway.app/api/health"
echo "   • Test Suite: https://your-app.railway.app/test"
echo ""
print_status "Ready to deploy your Agentic AI Trading Agent! 🚀"
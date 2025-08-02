#!/bin/bash
set -e

# 🔒 Supabase RLS Setup for Ada Analytics Trading Agent
echo "🔒 Setting up Supabase RLS policies for Ada Analytics Trading Agent"

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

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_warning "Supabase CLI not found. Installing..."
    # Install Supabase CLI
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        curl -sSfL https://supabase.com/docs/guides/cli | sh
    fi
    print_status "Supabase CLI installed"
fi

# Check if logged in
if ! supabase status &> /dev/null; then
    print_info "Please login to Supabase CLI:"
    supabase login
fi

PROJECT_REF="wcbjlcyecwzwsgfnqncz"

print_info "Setting up RLS policies for project: $PROJECT_REF"

# Create the SQL file for RLS policies
cat << 'EOF' > rls_policies.sql
-- 🔒 RLS Policies for Ada Analytics Trading Agent

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Allow service role full access" ON trades;
DROP POLICY IF EXISTS "Allow service role full access" ON trade_plans;
DROP POLICY IF EXISTS "Allow service role full access" ON predictions;
DROP POLICY IF EXISTS "Allow service role full access" ON agent_logs;
DROP POLICY IF EXISTS "Allow service role full access" ON agent_events;

-- Create policies that allow service role full access
-- This allows the trading agent to operate while keeping data secure

-- Trades table policies
CREATE POLICY "Allow service role full access" ON trades
    FOR ALL USING (auth.role() = 'service_role');

-- Trade plans table policies  
CREATE POLICY "Allow service role full access" ON trade_plans
    FOR ALL USING (auth.role() = 'service_role');

-- Predictions table policies
CREATE POLICY "Allow service role full access" ON predictions
    FOR ALL USING (auth.role() = 'service_role');

-- Agent logs table policies
CREATE POLICY "Allow service role full access" ON agent_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Agent events table policies
CREATE POLICY "Allow service role full access" ON agent_events
    FOR ALL USING (auth.role() = 'service_role');

-- Optional: Create more restrictive policies for authenticated users
-- Uncomment these if you want to allow authenticated users read-only access

-- CREATE POLICY "Allow authenticated users read access" ON trades
--     FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated users read access" ON trade_plans  
--     FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated users read access" ON predictions
--     FOR SELECT USING (auth.role() = 'authenticated');

EOF

print_info "Created RLS policies SQL file"

# Apply the policies
print_info "Applying RLS policies to your Supabase project..."

if supabase db push --project-ref="$PROJECT_REF" --file=rls_policies.sql; then
    print_status "RLS policies applied successfully!"
else
    print_error "Failed to apply RLS policies. You may need to run them manually in the SQL editor."
    print_info "SQL file created at: ./rls_policies.sql"
    print_info "Copy and paste the contents into your Supabase SQL editor:"
    print_info "https://supabase.com/dashboard/project/$PROJECT_REF/sql"
fi

# Get service role key instructions
echo ""
print_info "🔑 Next steps:"
echo ""
echo "1. Get your SERVICE ROLE key from Supabase dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
echo ""
echo "2. Update your .env file with:"
echo "   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here"
echo ""
echo "3. The service role key allows the agent to bypass RLS policies"
echo "   while keeping your data secure from public access."
echo ""

# Cleanup
rm -f rls_policies.sql

print_status "RLS setup complete! Your trading agent can now work with RLS enabled."
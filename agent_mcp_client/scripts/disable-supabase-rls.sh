#!/bin/bash
set -e

# 🔓 Disable Supabase RLS for Ada Analytics Trading Agent (Development Only)
echo "🔓 Disabling Supabase RLS for Development (NOT recommended for production)"

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

# Warning about security
print_warning "⚠️  WARNING: Disabling RLS makes your database tables publicly accessible!"
print_warning "⚠️  This should ONLY be used for development/testing purposes."
print_warning "⚠️  For production, use the setup-supabase-rls.sh script instead."

echo ""
read -p "Are you sure you want to disable RLS? (type 'yes' to continue): " confirm

if [ "$confirm" != "yes" ]; then
    print_info "RLS disable cancelled. Good choice for security!"
    exit 0
fi

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

print_info "Disabling RLS for project: $PROJECT_REF"

# Create the SQL file to disable RLS
cat << 'EOF' > disable_rls.sql
-- 🔓 Disable RLS for Ada Analytics Trading Agent (Development Only)

-- Disable RLS on all tables
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE trade_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Allow service role full access" ON trades;
DROP POLICY IF EXISTS "Allow service role full access" ON trade_plans;
DROP POLICY IF EXISTS "Allow service role full access" ON predictions;
DROP POLICY IF EXISTS "Allow service role full access" ON agent_logs;
DROP POLICY IF EXISTS "Allow service role full access" ON agent_events;

-- Note: With RLS disabled, your tables are now publicly accessible
-- Make sure your anon key permissions are properly configured

EOF

print_info "Created disable RLS SQL file"

# Apply the changes
print_info "Disabling RLS on your Supabase project..."

if supabase db push --project-ref="$PROJECT_REF" --file=disable_rls.sql; then
    print_status "RLS disabled successfully!"
    print_warning "Your database tables are now publicly accessible via the anon key"
else
    print_error "Failed to disable RLS. You may need to run the SQL manually."
    print_info "SQL file created at: ./disable_rls.sql"
    print_info "Copy and paste the contents into your Supabase SQL editor:"
    print_info "https://supabase.com/dashboard/project/$PROJECT_REF/sql"
fi

# Next steps
echo ""
print_info "📝 Your trading agent should now work without RLS issues"
print_info "💡 Remember: This is only for development/testing!"
print_info "🔒 For production, re-enable RLS using: ./scripts/setup-supabase-rls.sh"
echo ""

# Cleanup
rm -f disable_rls.sql

print_status "RLS disabled. Your trading agent should now work properly."
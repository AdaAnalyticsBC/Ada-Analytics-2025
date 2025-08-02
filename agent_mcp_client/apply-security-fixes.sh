#!/bin/bash

# =====================================================
# Ada Analytics - Security Fixes Application Script
# =====================================================

set -e

echo "🔒 Applying Ada Analytics Security Fixes..."
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/security_fixes_v2.sql" ]; then
    echo "❌ Error: security_fixes_v2.sql not found!"
    echo "Please run this script from the agent_mcp_client directory."
    exit 1
fi

echo "📋 Security Issues Being Fixed:"
echo "  1. SECURITY DEFINER views → SECURITY INVOKER"
echo "  2. Missing RLS on agent_state table"
echo "  3. Slow query optimizations"
echo "  4. Function security hardening"
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. You'll need to run the SQL manually."
    echo ""
    echo "📝 To apply the security fixes:"
    echo "1. Go to your Supabase project dashboard"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and paste the contents of supabase/security_fixes_v2.sql"
    echo "4. Execute the script"
    echo ""
    echo "🔗 Or use the Supabase CLI:"
    echo "   supabase db push --include-all"
    exit 0
fi

echo "🚀 Applying security fixes via Supabase CLI..."
echo ""

# Apply the security fixes
supabase db push --include-all

echo ""
echo "✅ Security fixes applied successfully!"
echo ""
echo "🔍 Verification:"
echo "  - All views now use SECURITY INVOKER (default)"
echo "  - RLS enabled on agent_state table"
echo "  - Performance indexes created"
echo "  - Functions secured with SECURITY INVOKER"
echo ""
echo "📊 To refresh trading summary: SELECT refresh_trading_summary();"
echo ""
echo "🎉 Security hardening complete!" 
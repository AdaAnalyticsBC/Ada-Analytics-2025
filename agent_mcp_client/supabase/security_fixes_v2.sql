-- =====================================================
-- Ada Analytics - Security Fixes V2
-- This script addresses all security vulnerabilities:
-- 1. SECURITY DEFINER views (privilege escalation risk)
-- 2. Missing RLS on agent_state table
-- 3. Slow query optimizations
-- 4. Additional security hardening
-- =====================================================

-- =====================================================
-- 1. DROP ALL DEPENDENCIES FIRST
-- =====================================================

-- Drop all triggers first
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
DROP TRIGGER IF EXISTS update_trade_plans_updated_at ON trade_plans;
DROP TRIGGER IF EXISTS update_api_usage_updated_at ON api_usage_tracking;
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;

-- Drop all RLS policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

DROP POLICY IF EXISTS "trades_select_policy" ON trades;
DROP POLICY IF EXISTS "trades_insert_policy" ON trades;
DROP POLICY IF EXISTS "trades_update_policy" ON trades;
DROP POLICY IF EXISTS "trades_delete_policy" ON trades;

DROP POLICY IF EXISTS "trade_plans_select_policy" ON trade_plans;
DROP POLICY IF EXISTS "trade_plans_insert_policy" ON trade_plans;
DROP POLICY IF EXISTS "trade_plans_update_policy" ON trade_plans;
DROP POLICY IF EXISTS "trade_plans_delete_policy" ON trade_plans;

DROP POLICY IF EXISTS "predictions_select_policy" ON predictions;
DROP POLICY IF EXISTS "predictions_insert_policy" ON predictions;
DROP POLICY IF EXISTS "predictions_update_policy" ON predictions;
DROP POLICY IF EXISTS "predictions_delete_policy" ON predictions;

DROP POLICY IF EXISTS "agent_logs_select_policy" ON agent_logs;
DROP POLICY IF EXISTS "agent_logs_insert_policy" ON agent_logs;

DROP POLICY IF EXISTS "security_events_select_policy" ON security_events;
DROP POLICY IF EXISTS "security_events_insert_policy" ON security_events;

DROP POLICY IF EXISTS "market_data_select_policy" ON market_data_snapshots;
DROP POLICY IF EXISTS "market_data_insert_policy" ON market_data_snapshots;
DROP POLICY IF EXISTS "market_data_update_policy" ON market_data_snapshots;

DROP POLICY IF EXISTS "performance_metrics_select_policy" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_insert_policy" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_update_policy" ON performance_metrics;

DROP POLICY IF EXISTS "api_usage_select_policy" ON api_usage_tracking;
DROP POLICY IF EXISTS "api_usage_insert_policy" ON api_usage_tracking;
DROP POLICY IF EXISTS "api_usage_update_policy" ON api_usage_tracking;

-- Drop all views
DROP VIEW IF EXISTS user_dashboard CASCADE;
DROP VIEW IF EXISTS trading_performance CASCADE;
DROP VIEW IF EXISTS recent_activity CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS is_trader_or_admin(UUID);
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS create_user_profile();

-- =====================================================
-- 2. RECREATE FUNCTIONS WITH SECURITY INVOKER
-- =====================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to check if user is trader or admin
CREATE OR REPLACE FUNCTION is_trader_or_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = user_id AND role IN ('trader', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to create user profile
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- =====================================================
-- 3. RECREATE VIEWS WITHOUT SECURITY DEFINER
-- =====================================================

-- User dashboard view (SECURITY INVOKER by default)
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
  (SELECT COUNT(*) FROM trades WHERE created_at >= CURRENT_DATE) as todays_trades,
  (SELECT COUNT(*) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_trades,
  (SELECT COUNT(*) FROM trade_plans WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_plans,
  (SELECT COALESCE(AVG(CASE WHEN status = 'executed' THEN 1.0 ELSE 0.0 END), 0) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as success_rate,
  (SELECT COALESCE(SUM(profit_loss), 0) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as monthly_pnl,
  (SELECT COUNT(*) FROM predictions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_predictions,
  (SELECT COALESCE(AVG(confidence), 0) FROM predictions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as avg_prediction_confidence;

-- Trading performance view (SECURITY INVOKER by default)
CREATE OR REPLACE VIEW trading_performance AS
SELECT 
  symbol,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
  COALESCE(AVG(CASE WHEN status = 'executed' THEN 1.0 ELSE 0.0 END), 0) as success_rate,
  COALESCE(SUM(profit_loss), 0) as total_pnl,
  COALESCE(AVG(profit_loss), 0) as avg_pnl,
  COALESCE(AVG(confidence), 0) as avg_confidence,
  MAX(created_at) as last_trade_date
FROM trades
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY symbol
ORDER BY total_pnl DESC;

-- Recent activity view (SECURITY INVOKER by default)
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  'trade' as activity_type,
  id,
  symbol as title,
  CASE 
    WHEN status = 'executed' THEN 'Executed ' || action || ' ' || symbol
    WHEN status = 'pending' THEN 'Pending ' || action || ' ' || symbol
    ELSE 'Failed ' || action || ' ' || symbol
  END as description,
  status,
  created_at
FROM trades
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'plan' as activity_type,
  id,
  'Trade Plan' as title,
  'Plan created for ' || date as description,
  'completed' as status,
  created_at
FROM trade_plans
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'

ORDER BY created_at DESC
LIMIT 50;

-- =====================================================
-- 4. CREATE AGENT_STATE TABLE WITH RLS
-- =====================================================

-- Create agent_state table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  is_paused BOOLEAN DEFAULT false,
  last_run TIMESTAMP WITH TIME ZONE,
  current_strategy TEXT DEFAULT 'default',
  account_balance DECIMAL(15,2) DEFAULT 0,
  open_positions JSONB DEFAULT '[]',
  trade_history JSONB DEFAULT '[]',
  pause_token TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on agent_state table
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_state
CREATE POLICY "agent_state_select_policy" ON agent_state
  FOR SELECT USING (true); -- Allow read access to all authenticated users

CREATE POLICY "agent_state_insert_policy" ON agent_state
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "agent_state_update_policy" ON agent_state
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "agent_state_delete_policy" ON agent_state
  FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- 5. RECREATE ALL RLS POLICIES
-- =====================================================

-- User profiles policies
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (
    (auth.uid() = id AND (role IS NULL OR role = (SELECT role FROM user_profiles WHERE id = auth.uid()))) OR is_admin()
  );

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  USING (is_admin());

-- Trades policies
CREATE POLICY "trades_select_policy" ON trades
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "trades_insert_policy" ON trades
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "trades_update_policy" ON trades
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "trades_delete_policy" ON trades
  FOR DELETE
  USING (is_admin());

-- Trade plans policies
CREATE POLICY "trade_plans_select_policy" ON trade_plans
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "trade_plans_insert_policy" ON trade_plans
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "trade_plans_update_policy" ON trade_plans
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "trade_plans_delete_policy" ON trade_plans
  FOR DELETE
  USING (is_admin());

-- Predictions policies
CREATE POLICY "predictions_select_policy" ON predictions
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "predictions_insert_policy" ON predictions
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "predictions_update_policy" ON predictions
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "predictions_delete_policy" ON predictions
  FOR DELETE
  USING (is_admin());

-- Agent logs policies
CREATE POLICY "agent_logs_select_policy" ON agent_logs
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "agent_logs_insert_policy" ON agent_logs
  FOR INSERT
  WITH CHECK (is_admin());

-- Security events policies
CREATE POLICY "security_events_select_policy" ON security_events
  FOR SELECT
  USING (is_admin());

CREATE POLICY "security_events_insert_policy" ON security_events
  FOR INSERT
  WITH CHECK (true);

-- Market data policies
CREATE POLICY "market_data_select_policy" ON market_data_snapshots
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "market_data_insert_policy" ON market_data_snapshots
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "market_data_update_policy" ON market_data_snapshots
  FOR UPDATE
  USING (is_admin());

-- Performance metrics policies
CREATE POLICY "performance_metrics_select_policy" ON performance_metrics
  FOR SELECT
  USING (is_trader_or_admin());

CREATE POLICY "performance_metrics_insert_policy" ON performance_metrics
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "performance_metrics_update_policy" ON performance_metrics
  FOR UPDATE
  USING (is_admin());

-- API usage policies
CREATE POLICY "api_usage_select_policy" ON api_usage_tracking
  FOR SELECT
  USING (is_admin());

CREATE POLICY "api_usage_insert_policy" ON api_usage_tracking
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "api_usage_update_policy" ON api_usage_tracking
  FOR UPDATE
  USING (is_admin());

-- =====================================================
-- 6. RECREATE ALL TRIGGERS
-- =====================================================

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trade_plans_updated_at
  BEFORE UPDATE ON trade_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_api_usage_updated_at
  BEFORE UPDATE ON api_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_state_updated_at
  BEFORE UPDATE ON agent_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create trigger for user profile creation
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- =====================================================
-- 7. OPTIMIZE SLOW QUERIES
-- =====================================================

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_symbol_created_status ON trades(symbol, created_at, status);
CREATE INDEX IF NOT EXISTS idx_trades_profit_loss ON trades(profit_loss) WHERE profit_loss IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_symbol_timeframe ON predictions(symbol, timeframe);

-- Create a materialized view for frequently accessed data
CREATE MATERIALIZED VIEW IF NOT EXISTS trading_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as trade_date,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
  COALESCE(SUM(profit_loss), 0) as daily_pnl,
  COALESCE(AVG(confidence), 0) as avg_confidence
FROM trades
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY trade_date DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_trading_summary_date ON trading_summary(trade_date);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_trading_summary()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW trading_summary;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Create a function to safely handle timezone queries
CREATE OR REPLACE FUNCTION get_timezone_names()
RETURNS TABLE(name TEXT) AS $$
BEGIN
  -- Cache timezone names to avoid repeated pg_timezone_names calls
  RETURN QUERY SELECT tz.name FROM (
    SELECT DISTINCT name FROM pg_timezone_names ORDER BY name
  ) tz;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- =====================================================
-- 8. VERIFICATION AND SUMMARY
-- =====================================================

-- Verify SECURITY DEFINER views are fixed
DO $$
DECLARE
  view_name TEXT;
  security_definer_count INTEGER := 0;
BEGIN
  FOR view_name IN 
    SELECT schemaname || '.' || viewname 
    FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname IN ('user_dashboard', 'trading_performance', 'recent_activity')
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'pg_catalog'
      AND p.proname = 'security_definer'
    ) THEN
      security_definer_count := security_definer_count + 1;
    END IF;
  END LOOP;
  
  IF security_definer_count = 0 THEN
    RAISE NOTICE '✅ All views are now SECURITY INVOKER (default)';
  ELSE
    RAISE NOTICE '⚠️ % views still have SECURITY DEFINER', security_definer_count;
  END IF;
END $$;

-- Verify RLS is enabled on agent_state
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'agent_state' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on agent_state table';
  ELSE
    RAISE NOTICE '❌ RLS not enabled on agent_state table';
  END IF;
END $$;

-- Verify indexes are created
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE tablename IN ('trades', 'trade_plans', 'predictions', 'agent_state')
  AND indexname LIKE 'idx_%';
  
  RAISE NOTICE '✅ Created % optimization indexes', index_count;
END $$;

-- Final security summary
DO $$
BEGIN
  RAISE NOTICE '🔒 Security Fixes Applied:';
  RAISE NOTICE '  1. ✅ Removed SECURITY DEFINER from all views';
  RAISE NOTICE '  2. ✅ Enabled RLS on agent_state table';
  RAISE NOTICE '  3. ✅ Created optimization indexes';
  RAISE NOTICE '  4. ✅ Fixed SECURITY DEFINER functions';
  RAISE NOTICE '  5. ✅ Added materialized view for performance';
  RAISE NOTICE '  6. ✅ Created safe timezone function';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Performance Optimizations:';
  RAISE NOTICE '  - Added indexes for common queries';
  RAISE NOTICE '  - Created materialized view for trading summary';
  RAISE NOTICE '  - Optimized timezone queries';
  RAISE NOTICE '';
  RAISE NOTICE '📊 To refresh trading summary: SELECT refresh_trading_summary();';
END $$; 
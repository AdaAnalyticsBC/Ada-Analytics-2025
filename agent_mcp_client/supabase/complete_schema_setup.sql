-- =====================================================
-- Ada Analytics Trading System - Complete Database Setup
-- Run this script in Supabase SQL Editor to create all tables and RLS policies
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================

-- Drop existing table and policies if they exist
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'trader', 'user')),
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TRADES TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS trades CASCADE;

CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_target DECIMAL(10,4),
  stop_loss DECIMAL(10,4),
  take_profit DECIMAL(10,4),
  executed_price DECIMAL(10,4),
  executed_quantity INTEGER DEFAULT 0,
  filled_avg_price DECIMAL(10,4),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'failed')),
  order_id TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  profit_loss DECIMAL(12,4),
  fees DECIMAL(10,4) DEFAULT 0,
  execution_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TRADE PLANS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS trade_plans CASCADE;

CREATE TABLE trade_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  market_analysis TEXT NOT NULL,
  risk_assessment TEXT,
  total_risk_exposure DECIMAL(5,4) DEFAULT 0 CHECK (total_risk_exposure >= 0 AND total_risk_exposure <= 1),
  strategy_used TEXT,
  market_conditions TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  account_balance_snapshot DECIMAL(15,2),
  trades_planned INTEGER DEFAULT 0,
  trades_executed INTEGER DEFAULT 0,
  plan_performance JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. PREDICTIONS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS predictions CASCADE;

CREATE TABLE predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_plan_id UUID REFERENCES trade_plans(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('price_target', 'direction', 'volatility')),
  predicted_value DECIMAL(10,4),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1h', '4h', '1d', '1w')),
  model_used TEXT,
  input_features JSONB DEFAULT '{}',
  actual_value DECIMAL(10,4),
  accuracy_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 5. AGENT LOGS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS agent_logs CASCADE;

CREATE TABLE agent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('INFO', 'ALERT', 'STATUS', 'ANALYSIS', 'PLAN', 'TRADE')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  source TEXT DEFAULT 'trading_agent',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. SECURITY EVENTS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS security_events CASCADE;

CREATE TABLE security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT,
  severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. MARKET DATA SNAPSHOTS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS market_data_snapshots CASCADE;

CREATE TABLE market_data_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  market_overview JSONB DEFAULT '{}',
  indicators JSONB DEFAULT '{}',
  watchlist JSONB DEFAULT '[]',
  sector_performance JSONB DEFAULT '{}',
  volatility_metrics JSONB DEFAULT '{}',
  volume_analysis JSONB DEFAULT '{}',
  sentiment_scores JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. PERFORMANCE METRICS TABLE
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS performance_metrics CASCADE;

CREATE TABLE performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,4) DEFAULT 0,
  total_profit_loss DECIMAL(15,4) DEFAULT 0,
  avg_profit_per_trade DECIMAL(12,4) DEFAULT 0,
  max_drawdown DECIMAL(12,4) DEFAULT 0,
  sharpe_ratio DECIMAL(6,4),
  risk_adjusted_return DECIMAL(6,4),
  account_balance DECIMAL(15,2),
  portfolio_value DECIMAL(15,2),
  detailed_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- =====================================================
-- 9. API USAGE TRACKING TABLE (For cost monitoring)
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS api_usage_tracking CASCADE;

CREATE TABLE api_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usage_date DATE NOT NULL,
  usage_month TEXT NOT NULL, -- Format: YYYY-MM
  service_name TEXT NOT NULL CHECK (service_name IN ('claude', 'alpaca', 'quiver')),
  request_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(8,4) DEFAULT 0,
  request_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usage_date, service_name)
);

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is trader or admin
CREATE OR REPLACE FUNCTION is_trader_or_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = user_id AND role IN ('trader', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - USER PROFILES
-- =====================================================

-- Users can view their own profile, admins can view all
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id OR is_admin());

-- Users can insert their own profile on first login
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile (except role), admins can update all
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (
    (auth.uid() = id AND (role IS NULL OR role = (SELECT role FROM user_profiles WHERE id = auth.uid()))) OR is_admin()
  );

-- Only admins can delete user profiles
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - TRADES
-- =====================================================

-- Traders and admins can view trades
CREATE POLICY "trades_select_policy" ON trades
  FOR SELECT
  USING (is_trader_or_admin());

-- Only admins can insert trades (system operations)
CREATE POLICY "trades_insert_policy" ON trades
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update trades
CREATE POLICY "trades_update_policy" ON trades
  FOR UPDATE
  USING (is_admin());

-- Only admins can delete trades
CREATE POLICY "trades_delete_policy" ON trades
  FOR DELETE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - TRADE PLANS
-- =====================================================

-- Traders and admins can view trade plans
CREATE POLICY "trade_plans_select_policy" ON trade_plans
  FOR SELECT
  USING (is_trader_or_admin());

-- Only admins can create trade plans (system operations)
CREATE POLICY "trade_plans_insert_policy" ON trade_plans
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update trade plans
CREATE POLICY "trade_plans_update_policy" ON trade_plans
  FOR UPDATE
  USING (is_admin());

-- Only admins can delete trade plans
CREATE POLICY "trade_plans_delete_policy" ON trade_plans
  FOR DELETE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - PREDICTIONS
-- =====================================================

-- Traders and admins can view predictions
CREATE POLICY "predictions_select_policy" ON predictions
  FOR SELECT
  USING (is_trader_or_admin());

-- Only admins can create predictions (system operations)
CREATE POLICY "predictions_insert_policy" ON predictions
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update predictions
CREATE POLICY "predictions_update_policy" ON predictions
  FOR UPDATE
  USING (is_admin());

-- Only admins can delete predictions
CREATE POLICY "predictions_delete_policy" ON predictions
  FOR DELETE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - AGENT LOGS
-- =====================================================

-- Traders and admins can view logs
CREATE POLICY "agent_logs_select_policy" ON agent_logs
  FOR SELECT
  USING (is_trader_or_admin());

-- Only system (admin role) can insert logs
CREATE POLICY "agent_logs_insert_policy" ON agent_logs
  FOR INSERT
  WITH CHECK (is_admin());

-- No updates or deletes on logs for audit trail
-- Logs are append-only

-- =====================================================
-- RLS POLICIES - SECURITY EVENTS
-- =====================================================

-- Only admins can view security events
CREATE POLICY "security_events_select_policy" ON security_events
  FOR SELECT
  USING (is_admin());

-- System can insert security events (no user restriction)
CREATE POLICY "security_events_insert_policy" ON security_events
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes on security events for audit trail

-- =====================================================
-- RLS POLICIES - MARKET DATA SNAPSHOTS
-- =====================================================

-- Traders and admins can view market data
CREATE POLICY "market_data_select_policy" ON market_data_snapshots
  FOR SELECT
  USING (is_trader_or_admin());

-- Only admins can create market data snapshots
CREATE POLICY "market_data_insert_policy" ON market_data_snapshots
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update market data
CREATE POLICY "market_data_update_policy" ON market_data_snapshots
  FOR UPDATE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - PERFORMANCE METRICS
-- =====================================================

-- Traders and admins can view performance metrics
CREATE POLICY "performance_metrics_select_policy" ON performance_metrics
  FOR SELECT
  USING (is_trader_or_admin());

-- Only admins can create performance metrics
CREATE POLICY "performance_metrics_insert_policy" ON performance_metrics
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update performance metrics
CREATE POLICY "performance_metrics_update_policy" ON performance_metrics
  FOR UPDATE
  USING (is_admin());

-- =====================================================
-- RLS POLICIES - API USAGE TRACKING
-- =====================================================

-- Only admins can view usage tracking
CREATE POLICY "api_usage_select_policy" ON api_usage_tracking
  FOR SELECT
  USING (is_admin());

-- Only system can insert usage data
CREATE POLICY "api_usage_insert_policy" ON api_usage_tracking
  FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update usage tracking
CREATE POLICY "api_usage_update_policy" ON api_usage_tracking
  FOR UPDATE
  USING (is_admin());

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Trades indexes
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_symbol_date ON trades(symbol, created_at DESC);

-- Trade plans indexes
CREATE INDEX idx_trade_plans_date ON trade_plans(date DESC);
CREATE INDEX idx_trade_plans_strategy ON trade_plans(strategy_used);

-- Predictions indexes
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_symbol ON predictions(symbol);
CREATE INDEX idx_predictions_trade_plan ON predictions(trade_plan_id);
CREATE INDEX idx_predictions_type ON predictions(prediction_type);

-- Agent logs indexes
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at DESC);
CREATE INDEX idx_agent_logs_level ON agent_logs(level);
CREATE INDEX idx_agent_logs_category ON agent_logs(category);

-- Security events indexes
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_ip ON security_events(ip_address);

-- Market data indexes
CREATE INDEX idx_market_data_date ON market_data_snapshots(snapshot_date DESC);

-- Performance metrics indexes
CREATE INDEX idx_performance_metrics_date ON performance_metrics(metric_date DESC);

-- API usage tracking indexes
CREATE INDEX idx_api_usage_date ON api_usage_tracking(usage_date DESC);
CREATE INDEX idx_api_usage_month ON api_usage_tracking(usage_month);
CREATE INDEX idx_api_usage_service ON api_usage_tracking(service_name);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tables with updated_at columns
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

-- =====================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =====================================================

-- Function to automatically create user profile on signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto profile creation
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- =====================================================
-- VIEWS FOR DASHBOARD AND REPORTING
-- =====================================================

-- User dashboard view (automatically filtered by RLS)
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
  (SELECT COUNT(*) FROM trades WHERE created_at >= CURRENT_DATE) as todays_trades,
  (SELECT COUNT(*) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_trades,
  (SELECT COUNT(*) FROM trade_plans WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_plans,
  (SELECT COALESCE(AVG(CASE WHEN status = 'executed' THEN 1.0 ELSE 0.0 END), 0) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as success_rate,
  (SELECT COALESCE(SUM(profit_loss), 0) FROM trades WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as monthly_pnl,
  (SELECT COUNT(*) FROM predictions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_predictions,
  (SELECT COALESCE(AVG(confidence), 0) FROM predictions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as avg_prediction_confidence;

-- Trading performance view
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

-- Recent activity view
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
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT ON trades TO authenticated;
GRANT SELECT ON trade_plans TO authenticated;
GRANT SELECT ON predictions TO authenticated;
GRANT SELECT ON agent_logs TO authenticated;
GRANT SELECT ON market_data_snapshots TO authenticated;
GRANT SELECT ON performance_metrics TO authenticated;
GRANT SELECT ON user_dashboard TO authenticated;
GRANT SELECT ON trading_performance TO authenticated;
GRANT SELECT ON recent_activity TO authenticated;

-- Grant permissions for usage tracking (admin only via RLS)
GRANT SELECT, INSERT, UPDATE ON api_usage_tracking TO authenticated;

-- Grant insert permissions for security events (system logging)
GRANT INSERT ON security_events TO authenticated, anon;

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Insert sample admin user profile (replace with actual admin user ID)
-- INSERT INTO user_profiles (id, email, role, full_name) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@ada-analytics.com', 'admin', 'Admin User')
-- ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('user_profiles', 'trades', 'trade_plans', 'predictions', 'agent_logs', 'security_events', 'market_data_snapshots', 'performance_metrics', 'api_usage_tracking');
    
    IF table_count = 9 THEN
        RAISE NOTICE 'SUCCESS: All 9 tables created successfully!';
    ELSE
        RAISE NOTICE 'WARNING: Expected 9 tables, found %', table_count;
    END IF;
END $$;

-- Verify RLS is enabled
DO $$
DECLARE
    rls_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname IN ('user_profiles', 'trades', 'trade_plans', 'predictions', 'agent_logs', 'security_events', 'market_data_snapshots', 'performance_metrics', 'api_usage_tracking')
    AND c.relrowsecurity = true;
    
    IF rls_count = 9 THEN
        RAISE NOTICE 'SUCCESS: RLS enabled on all tables!';
    ELSE
        RAISE NOTICE 'WARNING: RLS should be enabled on 9 tables, found %', rls_count;
    END IF;
END $$;

-- Verify policies were created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'INFO: Created % RLS policies', policy_count;
END $$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Ada Analytics Database Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created: 9';
    RAISE NOTICE 'RLS enabled: ✅';
    RAISE NOTICE 'Policies applied: ✅';
    RAISE NOTICE 'Indexes created: ✅';
    RAISE NOTICE 'Views created: ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create your first admin user in Supabase Auth';
    RAISE NOTICE '2. Update their role to "admin" in user_profiles table';
    RAISE NOTICE '3. Test the secure API endpoints';
    RAISE NOTICE '';
END $$;
/**
 * Configuration settings for the Ada Analytics Trading Agent
 */

import { MCPServerConfig, EmailConfig, WebServerConfig } from './types/interfaces.ts';

// MCP Server Configuration
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  alpaca: {
    command: "python",
    args: ["./alpaca-mcp-server/alpaca_mcp_server.py"],
    env: {
      ALPACA_API_KEY: Deno.env.get('ALPACA_API_KEY') || "",
      ALPACA_SECRET_KEY: Deno.env.get('ALPACA_SECRET_KEY') || ""
    }
  },
  supabase: {
    command: "npx",
    args: ["-y", "@supabase/mcp-server-supabase@latest", `--project-ref=${Deno.env.get('SUPABASE_PROJECT_REF') || ''}`],
    env: {
      SUPABASE_ACCESS_TOKEN: Deno.env.get('SUPABASE_ACCESS_TOKEN') || "",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
    }
  },
  "quiver-quant": {
    command: "deno",
    args: ["run", "--allow-net", "--allow-env", "./quiver-mcp-server/main.ts"],
    env: {
      QUIVER_API_TOKEN: Deno.env.get('QUIVER_API_TOKEN') || ""
    }
  }
};

// Trading Constants
export const TRADING_CONFIG = {
  MAX_TRADES_PER_DAY: 2,
  RISK_PER_TRADE: 0.01, // 1% of account balance
  STOP_LOSS_PERCENTAGE: 0.05, // 5% stop loss
  TAKE_PROFIT_PERCENTAGE: 0.10, // 10% take profit
  MIN_CONFIDENCE_THRESHOLD: 0.6,
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 30,
  MARKET_CLOSE_HOUR: 16,
  MARKET_CLOSE_MINUTE: 0,
  REQUEST_DELAY_MS: 1000 // 1 second delay between requests
};

// Email Configuration
export const EMAIL_CONFIG: EmailConfig = {
  from: Deno.env.get('EMAIL_FROM') || 'noreply@localhost',
  recipients: Deno.env.get('EMAIL_RECIPIENTS')?.split(',').map(email => email.trim()) || []
};

// Cron Schedule Configuration
export const CRON_SCHEDULES = {
  DAILY_TRADING: "0 6 * * 1-5",      // 6 AM EST, weekdays
  END_OF_DAY_SUMMARY: "0 17 * * 1-5", // 5 PM EST, weekdays
  WEEKLY_CLEANUP: "0 0 * * 0"         // Sunday midnight
};

// Database Configuration
export const DATABASE_CONFIG = {
  CLEANUP_RETENTION_DAYS: 365, // Keep logs for 1 year
  PERFORMANCE_ANALYSIS_DAYS: 90,
  RECENT_TRADES_DAYS: 30,
  SYMBOL_ANALYSIS_DAYS: 180
};

// AI/Claude Configuration
export const AI_CONFIG = {
  MODEL: "claude-3-5-sonnet-20241022",
  MAX_TOKENS_TRADE_PLAN: 2000,
  MAX_TOKENS_PREDICTIONS: 1500,
  MAX_TOKENS_PERFORMANCE_ANALYSIS: 1000,
  MAX_TOKENS_ADJUSTMENTS: 1500,
  TEMPERATURE: 0.7
};

// Web Server Configuration
export const WEB_SERVER_CONFIG: WebServerConfig = {
  port: parseInt(Deno.env.get("PORT") || "3000"),
  baseUrl: Deno.env.get("BASE_URL") || 'https://your-railway-app.railway.app'
};

// Environment Variable Keys
export const ENV_KEYS = {
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  RESEND_API_KEY: 'RESEND_API_KEY',
  BASE_URL: 'BASE_URL',
  PORT: 'PORT',
  EMAIL_FROM: 'EMAIL_FROM',
  EMAIL_RECIPIENTS: 'EMAIL_RECIPIENTS',
  NOTIFICATION_EMAIL: 'NOTIFICATION_EMAIL',
  ALPACA_API_KEY: 'ALPACA_API_KEY',
  ALPACA_SECRET_KEY: 'ALPACA_SECRET_KEY',
  SUPABASE_ACCESS_TOKEN: 'SUPABASE_ACCESS_TOKEN',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  SUPABASE_PROJECT_REF: 'SUPABASE_PROJECT_REF',
  QUIVER_API_TOKEN: 'QUIVER_API_TOKEN'
};

// Logging Configuration
export const LOGGING_CONFIG = {
  COLORS: {
    'PLAN': '\x1b[36m',    // Cyan
    'TRADE': '\x1b[33m',   // Yellow  
    'ANALYSIS': '\x1b[35m', // Magenta
    'ALERT': '\x1b[31m',   // Red
    'STATUS': '\x1b[32m'   // Green
  },
  ICONS: {
    'PLAN': '📋',
    'TRADE': '🔄', 
    'ANALYSIS': '📊',
    'ALERT': '🚨',
    'STATUS': '✅'
  },
  RESET: '\x1b[0m',
  TIMEZONE: 'America/New_York'
};

// Market Data Collection Configuration
export const MARKET_DATA_CONFIG = {
  MAX_TOOLS_PER_COLLECTION: 5,
  TOOL_FILTERS: [
    'data',
    'market',
    'sentiment',
    'options',
    'insider'
  ],
  REQUEST_DELAY_MS: 1000, // 1 second between requests
  DEFAULT_LIMIT: 50,
  DEFAULT_TIMEFRAME: '1d'
};

// File Paths
export const FILE_PATHS = {
  AGENT_STATE: './agent_state.json',
  LOG_FILE: './trading_agent.log'
};

// Default Agent State
export const DEFAULT_AGENT_STATE = {
  is_paused: false,
  last_run: '',
  current_strategy: 'momentum_reversal',
  account_balance: 0,
  open_positions: [],
  trade_history: []
};

// Trading Strategy Configuration
export const STRATEGY_CONFIG = {
  MOMENTUM_REVERSAL: {
    name: 'momentum_reversal',
    description: 'Momentum reversal strategy with RSI and EMA indicators',
    risk_multiplier: 1.0,
    confidence_threshold: 0.6
  },
  BREAKOUT: {
    name: 'breakout',
    description: 'Breakout strategy focusing on volume and price action',
    risk_multiplier: 1.2,
    confidence_threshold: 0.7
  },
  MEAN_REVERSION: {
    name: 'mean_reversion',
    description: 'Mean reversion strategy for oversold/overbought conditions',
    risk_multiplier: 0.8,
    confidence_threshold: 0.65
  }
};

// Error Configuration
export const ERROR_CONFIG = {
  CRITICAL_KEYWORDS: ['CRITICAL', 'API_ERROR', 'AUTHENTICATION', 'NETWORK'],
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  PAUSE_ON_CRITICAL: true
};

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  MIN_WIN_RATE: 0.5,
  MIN_AVG_RETURN: 0.01,
  MAX_CONSECUTIVE_LOSSES: 3,
  STRATEGY_ADJUSTMENT_THRESHOLD: 0.4,
  STRONG_BUY_WIN_RATE: 0.7,
  STRONG_BUY_CONFIDENCE: 0.8,
  AVOID_WIN_RATE: 0.4,
  AVOID_CONFIDENCE: 0.5
};

/**
 * Get environment variables as object
 */
export function getEnvObject(): Record<string, string> {
  const env: Record<string, string> = {};
  
  for (const varName of Object.values(ENV_KEYS)) {
    const value = Deno.env.get(varName);
    if (value) {
      env[varName] = value;
    }
  }
  
  return env;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    ENV_KEYS.ANTHROPIC_API_KEY,
    ENV_KEYS.ALPACA_API_KEY,
    ENV_KEYS.ALPACA_SECRET_KEY,
    ENV_KEYS.SUPABASE_ACCESS_TOKEN,
    ENV_KEYS.SUPABASE_PROJECT_REF,
    ENV_KEYS.QUIVER_API_TOKEN
  ];
  
  const missing: string[] = [];
  
  for (const key of required) {
    if (!Deno.env.get(key)) {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Check if email is properly configured
 */
export function isEmailConfigured(): boolean {
  return !!Deno.env.get(ENV_KEYS.RESEND_API_KEY);
}

/**
 * Get current market hours status
 */
export function isMarketHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();
  
  // Check if it's a weekday (Monday = 1, Friday = 5)
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Check if within market hours (9:30 AM - 4:00 PM EST)
  const currentTime = hour * 60 + minute;
  const marketOpen = TRADING_CONFIG.MARKET_OPEN_HOUR * 60 + TRADING_CONFIG.MARKET_OPEN_MINUTE;
  const marketClose = TRADING_CONFIG.MARKET_CLOSE_HOUR * 60 + TRADING_CONFIG.MARKET_CLOSE_MINUTE;
  
  return currentTime >= marketOpen && currentTime < marketClose;
}

/**
 * Get next market open time
 */
export function getNextMarketOpen(): Date {
  const now = new Date();
  const marketOpen = new Date();
  marketOpen.setHours(TRADING_CONFIG.MARKET_OPEN_HOUR, TRADING_CONFIG.MARKET_OPEN_MINUTE, 0, 0);
  
  // If market already opened today or it's weekend, move to next weekday
  if (now >= marketOpen || now.getDay() === 0 || now.getDay() === 6) {
    marketOpen.setDate(marketOpen.getDate() + 1);
    
    // Skip weekends
    while (marketOpen.getDay() === 0 || marketOpen.getDay() === 6) {
      marketOpen.setDate(marketOpen.getDate() + 1);
    }
  }
  
  return marketOpen;
}
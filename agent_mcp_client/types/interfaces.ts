/**
 * Core type definitions and interfaces for the Ada Analytics Trading Agent
 */

// MCP Server Configuration
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Position Type
export interface Position {
  symbol: string;
  qty: number;
  side: 'long' | 'short';
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  current_price: number;
}

// Market Data Response Type
export interface TradingPerformanceData {
  total_trades: number;
  win_rate: number;
  avg_return: number;
  symbols_traded: string[];
  last_ten_trades?: Array<{
    profit_loss: number;
    symbol: string;
    executed_at: string;
  }>;
  max_drawdown?: number;
  sharpe_ratio?: number;
  profit_factor?: number;
}

export interface MarketDataResponse {
  trading_performance?: TradingPerformanceData;
  recent_trades?: TradeRecord[];
  market_sentiment?: string;
  indicators?: Record<string, unknown>;
  timestamp?: string;
  symbols?: string[];
  [key: string]: unknown;
}

// API Response Type
export type APIResponse = {
  content?: Array<{ text?: string; type?: string }>;
  data?: unknown;
  error?: string;
  message?: string;
} | unknown;

// Executed Trade Type
export interface ExecutedTrade extends TradeDecision {
  executed_quantity: number;
  execution_result: TradeExecutionResult;
  executed_at: string;
  order_id?: string;
  filled_avg_price?: number;
  status: 'executed' | 'failed' | 'pending';
}

// Trade Execution Result
export interface TradeExecutionResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  error?: string;
}

// Order Type
export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop' | 'stop_limit';
  qty: number;
  filled_qty?: number;
  limit_price?: number;
  stop_price?: number;
  status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  created_at: string;
  updated_at?: string;
}

// Note: TradeRecord is defined below in Database Record Types section

// Trading Decision Types
export interface TradeDecision {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price_target: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasoning: string;
}

export interface TradePlan {
  id: string;
  date: string;
  market_analysis: string;
  trades: TradeDecision[];
  risk_assessment: string;
  total_risk_exposure: number;
  created_at: string;
}

// Agent State Management
export interface AgentState {
  is_paused: boolean;
  last_run: string;
  current_strategy: string;
  account_balance: number;
  open_positions: Position[];
  trade_history: TradeRecord[];
  pause_token?: string;
}

// Market Data Types
export interface CongressTrade {
  Representative: string;
  ReportDate: string;
  TransactionDate: string;
  Ticker: string;
  Transaction: string;
  Range: string;
  District: string;
  House: string;
  Amount: number;
  Party: string;
  TickerType: string;
  Description: string;
  ExcessReturn: number;
  PriceChange: number;
  SPYChange: number;
  last_modified: string | null;
}

export interface InsiderTrade {
  Ticker: string;
  CompanyName: string;
  InsiderName: string;
  InsiderTitle: string;
  TradeDate: string;
  Transaction: string;
  Shares: number;
  Price: number;
  Value: number;
  SharesAfter: number;
  OwnershipType: string;
  FormType: string;
  SecurityType: string;
  last_modified: string | null;
}

export interface LobbyingRecord {
  Client: string;
  ClientID: number;
  Registrant: string;
  RegistrantID: number;
  Amount: number;
  IssueAreaCode: string;
  IssueAreaGeneral: string;
  IssueText: string;
  Year: number;
  Quarter: number;
  Date: string;
  last_modified: string | null;
}

export interface SEC13FChange {
  Ticker: string;
  CompanyName: string;
  InstitutionName: string;
  FilingDate: string;
  Quarter: string;
  SharesChange: number;
  SharesChangePercent: number;
  SharesTotal: number;
  MarketValue: number;
  MarketValueChange: number;
  ReportDate: string;
  FormType: string;
  last_modified: string | null;
}

export interface OffExchangeData {
  Ticker: string;
  Date: string;
  TotalVolume: number;
  TotalShares: number;
  ATS_Volume: number;
  ATS_Shares: number;
  NonATS_Volume: number;
  NonATS_Shares: number;
  OffExchangePercent: number;
  ATS_Percent: number;
  NonATS_Percent: number;
  Price: number;
  last_modified: string | null;
}

export interface ETFHolding {
  Ticker: string;
  CompanyName: string;
  ETF: string;
  ETFName: string;
  Shares: number;
  MarketValue: number;
  Weight: number;
  Date: string;
  last_modified: string | null;
}

// Performance Analytics
export interface TradingPerformance {
  total_trades: number;
  win_rate: number;
  avg_return: number;
  total_return: number;
  best_trade: TradeRecord | null;
  worst_trade: TradeRecord | null;
  symbols_traded: string[];
  symbol_frequency: Record<string, number>;
  recent_trades: TradeRecord[];
}

export interface SymbolAnalysis {
  symbol: string;
  trade_count: number;
  avg_confidence: number;
  win_rate: number;
  avg_return: number;
  last_trade: TradeRecord | null;
  patterns: TradePattern[];
  recommendation: string;
}

export interface TradePattern {
  type: string;
  max_win_streak?: number;
  max_loss_streak?: number;
  day_frequency?: Record<number, number>;
  most_active_day?: string;
}

// Database Record Types
export interface TradeRecord {
  id?: string;
  session_id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price_target: number;
  executed_price?: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasoning: string;
  executed_at: string;
  status: 'executed' | 'failed' | 'pending';
  strategy?: string;
  account_balance?: number;
  thought_chain?: string;
  market_analysis?: string;
  risk_assessment?: string;
  trade_plan_id?: string;
  historical_win_rate: number;
  historical_avg_return?: number;
  total_trades_before?: number;
  created_at?: string;
  // Allow additional properties for compatibility
  [key: string]: unknown;
}

export interface LogRecord {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  created_at: string;
}

export interface PredictionRecord {
  id: string;
  date: string;
  market_analysis: string;
  predictions: string; // JSON string
  risk_assessment: string;
  total_risk_exposure: number;
  strategy_used: string;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  event_type: string;
  reason: string;
  timestamp: string;
  account_balance: number;
  open_positions: number;
}

// Email Types
export interface EmailConfig {
  from: string;
  recipients: string[];
  tradePlanRecipients: string[];
  dailySummaryRecipients: string[];
  errorAlertRecipients: string[];
  startupShutdownRecipients: string[];
  resendApiKey?: string;
}

// Performance Analysis
export interface PerformanceAnalysis {
  should_adjust: boolean;
  performance_summary: string;
  suggested_adjustments: string;
  new_strategy_focus: string;
}

// Account Information
export interface AccountDetails {
  balance: number;
  buying_power: number;
  portfolio_value: number;
  day_pnl: number;
  cash: number;
  equity: number;
}

// Logging Types
export type LogLevel = 'PLAN' | 'TRADE' | 'ANALYSIS' | 'ALERT' | 'STATUS';

export interface TradingLogger {
  log(type: LogLevel, message: string): void;
}

// Service Interfaces
export interface IMarketDataService {
  collectMarketData(): Promise<MarketDataResponse>;
  collectMarketDataWithHistory(): Promise<MarketDataResponse>;
  testConnection(): Promise<{ success: boolean; message: string; toolCount?: number }>;
}

export interface ITradingService {
  executeTrades(tradePlan: TradePlan, agentState?: AgentState): Promise<ExecutedTrade[]>;
  setStopLossAndTakeProfit(trade: TradeDecision, orderId: string): Promise<void>;
  getAccountDetails(): Promise<AccountDetails>;
  getCurrentPositions(): Promise<Position[]>;
  getPendingOrders(): Promise<Order[]>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  // Additional methods for compatibility
  setAlpacaClient(client: unknown): void;
  updateClient(client: unknown): void;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<AlpacaOrder | null>;
  getMarketData(symbol: string): Promise<Record<string, unknown>>;
  waitForMarketOpen(): Promise<void>;
  cancelAllOrders(): Promise<boolean>;
}

export interface IEmailService {
  sendEmail(to: string, subject: string, content: string): Promise<boolean>;
  sendTradePlanEmail(tradePlan: TradePlan): Promise<string>;
  sendDailySummary(accountDetails: AccountDetails, trades: TradeRecord[]): Promise<void>;
  sendErrorAlert(error: Error): Promise<void>;
  sendResumeEmail(resumeToken: string): Promise<void>;
  isConfigured(): boolean;
  sendTestEmail(recipient?: string): Promise<boolean>;
  getCurrentEmailCount(): Promise<{ count: number; limit: number; canSend: boolean }>;
}

export interface IDatabaseService {
  storeTrades(trades: ExecutedTrade[], tradePlan?: TradePlan, thoughtChain?: string[]): Promise<void>;
  getHistoricalTrades(days: number, symbol?: string): Promise<TradeRecord[]>;
  getTradingPerformance(): Promise<TradingPerformance>;
  getSymbolAnalysis(symbol: string): Promise<SymbolAnalysis>;
  storePredictions(tradePlan: TradePlan): Promise<void>;
  log(level: 'INFO' | 'WARN' | 'ERROR', message: string): Promise<void>;
  cleanupOldLogs(): Promise<void>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  getTodayTrades(): Promise<TradeRecord[]>;
  getYesterdayTrades(): Promise<TradeRecord[]>;
  storeAgentEvent(eventType: string, reason: string, context?: Record<string, unknown>): Promise<void>;
  getMonthlyUsage(month: string): Promise<{
    claude_requests: number;
    estimated_cost: number;
    trades_count: number;
    daily_requests: number;
  } | null>;
  trackApiUsage(service: 'claude' | 'alpaca' | 'quiver', requestCount: number, tokensUsed: number, estimatedCost: number): Promise<void>;
  storeAgentState(state: AgentState): Promise<void>;
  getAgentState(): Promise<AgentState | null>;
  updateAgentState(updates: Partial<AgentState>): Promise<void>;
}

export interface IAIService {
  craftTradePlan(marketData: MarketDataResponse, agentState?: AgentState): Promise<TradePlan>;
  makePredictions(tradePlan: TradePlan, marketData: MarketDataResponse, agentState?: AgentState): Promise<TradePlan>;
  analyzeTradePerformance(trades: Array<Record<string, unknown>>): Promise<PerformanceAnalysis>;
  adjustTradePlan(tradePlan: TradePlan, analysis: PerformanceAnalysis): Promise<TradePlan>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

// Error Types
export class TradingError extends Error {
  constructor(
    message: string,
    public readonly type: 'CRITICAL' | 'API_ERROR' | 'VALIDATION' | 'CONNECTION',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

// API Response Types
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: 'ACTIVE' | 'INACTIVE';
  currency: 'USD';
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  multiplier: string;
  day_trade_count: number;
  day_trading_buying_power: string;
  created_at: string;
  trade_suspended_by_user: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  trading_blocked: boolean;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: 'us_equity';
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  avg_entry_price: string;
  change_today: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  asset_id: string;
  symbol: string;
  asset_class: 'us_equity';
  qty: string;
  filled_qty: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  status: 'new' | 'partially_filled' | 'filled' | 'done_for_day' | 'canceled' | 'expired' | 'accepted' | 'pending_new' | 'accepted_for_bidding' | 'pending_cancel' | 'pending_replace' | 'replaced' | 'rejected' | 'suspended' | 'calculated';
  extended_hours: boolean;
  legs?: Array<Record<string, unknown>>;
}

export interface SupabaseResponse<T = unknown> {
  data: T;
  error: SupabaseError | null;
  count?: number;
  status: number;
  statusText: string;
}

export interface SupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// MCP Content Types - Specific types for MCP SDK responses
export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface MCPResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    text?: string;
  };
}

export type MCPContentItem = MCPTextContent | MCPImageContent | MCPResourceContent | Record<string, unknown>;

export interface MCPResponse {
  content?: MCPContentItem[];
  isError?: boolean;
  _meta?: {
    httpStatusCode?: number;
  };
  // Allow any additional properties from MCP SDK
  [key: string]: unknown;
}

// Alpaca specific response types
export interface AlpacaAccountResponse extends MCPResponse {
  id?: string;
  account_number?: string;
  status?: string;
  currency?: string;
  buying_power?: string;
  cash?: string;
  portfolio_value?: string;
  equity?: string;
}

export interface AlpacaTradeResponse extends MCPResponse {
  id?: string;
  status?: string;
  filled_avg_price?: string;
  limit_price?: string;
  qty?: string;
  filled_qty?: string;
}

export interface AlpacaPositionsResponse extends MCPResponse {
  positions?: AlpacaPosition[];
  data?: AlpacaPosition[];
}

export interface AlpacaOrdersResponse extends MCPResponse {
  orders?: AlpacaOrder[];
  data?: AlpacaOrder[];
}

export interface QuiverResponse {
  data: Array<{
    Date: string;
    Ticker: string;
    [key: string]: string | number;
  }>;
  success: boolean;
  message?: string;
}

// Web Server Types
export interface WebServerConfig {
  port: number;
  baseUrl: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface APIHealthStatus {
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
  supabase: ServiceStatus;
  quiver: ServiceStatus;
  resend: ServiceStatus;
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
}

export interface ServiceStatus {
  status: 'online' | 'offline' | 'error';
  response_time: number;
  last_checked: string;
  error_message?: string;
}

export interface SystemMetrics {
  timestamp: string;
  uptime_seconds: number;
  memory_usage: Record<string, number>;
  agent_state: AgentState;
  trading_performance: TradingPerformance;
  recent_activity: {
    trades_today: number;
    last_trade_time?: string;
    emails_sent_today: number;
    api_calls_today: number;
  };
}
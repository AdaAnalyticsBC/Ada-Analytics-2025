/**
 * Database Service - Handles all Supabase database operations
 */

import { Client } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js";
import { 
  IDatabaseService, 
  TradePlan, 
  TradingPerformance, 
  SymbolAnalysis, 
  TradePattern,
  TradingLogger,
  AgentState,
  ExecutedTrade,
  TradeRecord,
  SupabaseResponse,
  MCPResponse
} from '../types/interfaces.ts';
import { DATABASE_CONFIG, PERFORMANCE_THRESHOLDS } from '../config.ts';
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

export class DatabaseService implements IDatabaseService {
  private supabaseClient: Client | null = null;
  private logger: TradingLogger;

  constructor(supabaseClient: Client | null, logger: TradingLogger) {
    this.supabaseClient = supabaseClient;
    this.logger = logger;
  }

  /**
   * Set the Supabase client after connection
   */
  setSupabaseClient(client: Client): void {
    this.supabaseClient = client;
  }

  /**
   * Store trades in Supabase with enhanced data
   */
  async storeTrades(executedTrades: ExecutedTrade[], tradePlan?: TradePlan, thoughtChain?: string[]): Promise<void> {
    this.logger.log('STATUS', 'Storing trades in Supabase...');

    if (!this.supabaseClient) {
      throw new Error('Supabase client not available');
    }

    try {
      const sessionId = crypto.randomUUID();
      const performance = await this.getTradingPerformance();
      
      for (const trade of executedTrades) {
        const tradeData = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          symbol: trade.symbol,
          action: trade.action,
          quantity: trade.executed_quantity || trade.quantity,
          price_target: trade.price_target,
          executed_price: trade.filled_avg_price || trade.price_target,
          stop_loss: trade.stop_loss,
          take_profit: trade.take_profit,
          confidence: trade.confidence,
          reasoning: trade.reasoning,
          executed_at: trade.executed_at || new Date().toISOString(),
          status: trade.status || 'executed',
          
          // Enhanced data (not available in ExecutedTrade, using defaults)
          strategy: 'momentum_reversal', // Default strategy
          account_balance: 0, // Will be updated by agent
          thought_chain: thoughtChain ? JSON.stringify(thoughtChain) : null,
          market_analysis: tradePlan?.market_analysis || null,
          risk_assessment: tradePlan?.risk_assessment || null,
          trade_plan_id: tradePlan?.id || null,
          
          // Performance context
          historical_win_rate: performance.win_rate || 0,
          historical_avg_return: performance.avg_return || 0,
          total_trades_before: performance.total_trades || 0,
          
          created_at: new Date().toISOString()
        };

        await this.supabaseClient.callTool({
          name: 'insert',
          arguments: {
            table: 'trades',
            data: tradeData
          }
        });

        this.logger.log('STATUS', `💾 Stored ${trade.symbol} trade with full context`);
      }

      this.logger.log('STATUS', `Stored ${executedTrades.length} trades with enhanced data`);
    } catch (error) {
      this.logger.log('ALERT', `Failed to store trades: ${error}`);
      throw error;
    }
  }

  /**
   * Get historical trades from Supabase
   */
  async getHistoricalTrades(days: number = DATABASE_CONFIG.RECENT_TRADES_DAYS, symbol?: string): Promise<TradeRecord[]> {
    if (!this.supabaseClient) {
      this.logger.log('ALERT', 'Supabase client not available for trade history');
      return [];
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      let query = `executed_at >= '${cutoffDate.toISOString()}'`;
      if (symbol) {
        query += ` AND symbol = '${symbol}'`;
      }

      const result = await this.supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: query,
          order: 'executed_at DESC'
        }
      });

      const rawTrades = this.extractDataFromResult(result);
      const trades = this.convertToTradeRecords(rawTrades);
      this.logger.log('ANALYSIS', `Retrieved ${trades.length} historical trades (${days} days)`);
      return trades;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get historical trades: ${error}`);
      return [];
    }
  }

  /**
   * Get trading performance analytics
   */
  async getTradingPerformance(): Promise<TradingPerformance> {
    const trades = await this.getHistoricalTrades(DATABASE_CONFIG.PERFORMANCE_ANALYSIS_DAYS);
    
    if (trades.length === 0) {
      return {
        total_trades: 0,
        win_rate: 0,
        avg_return: 0,
        total_return: 0,
        best_trade: null,
        worst_trade: null,
        symbols_traded: [],
        symbol_frequency: {},
        recent_trades: []
      };
    }

    // Calculate performance metrics
    const winningTrades = trades.filter(t => this.calculateTradeReturn(t) > 0);
    const winRate = winningTrades.length / trades.length;
    
    const returns = trades.map(t => this.calculateTradeReturn(t));
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    
    const bestTrade = trades.reduce((best, trade) => {
      const tradeReturn = this.calculateTradeReturn(trade);
      const bestReturn = this.calculateTradeReturn(best);
      return tradeReturn > bestReturn ? trade : best;
    }, trades[0]);
    
    const worstTrade = trades.reduce((worst, trade) => {
      const tradeReturn = this.calculateTradeReturn(trade);
      const worstReturn = this.calculateTradeReturn(worst);
      return tradeReturn < worstReturn ? trade : worst;
    }, trades[0]);

    const symbolCounts = trades.reduce((acc, trade) => {
      acc[trade.symbol] = (acc[trade.symbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const performance: TradingPerformance = {
      total_trades: trades.length,
      win_rate: winRate,
      avg_return: avgReturn,
      total_return: totalReturn,
      best_trade: bestTrade,
      worst_trade: worstTrade,
      symbols_traded: Object.keys(symbolCounts),
      symbol_frequency: symbolCounts,
      recent_trades: trades.slice(0, 5)
    };

    this.logger.log('ANALYSIS', `Performance: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, ${(avgReturn * 100).toFixed(2)}% avg return`);
    return performance;
  }

  /**
   * Get symbol-specific analysis
   */
  async getSymbolAnalysis(symbol: string): Promise<SymbolAnalysis> {
    const trades = await this.getHistoricalTrades(DATABASE_CONFIG.SYMBOL_ANALYSIS_DAYS, symbol);
    
    if (trades.length === 0) {
      return {
        symbol,
        trade_count: 0,
        avg_confidence: 0,
        win_rate: 0,
        avg_return: 0,
        last_trade: null,
        patterns: [],
        recommendation: "Insufficient data for recommendation"
      };
    }

    const avgConfidence = trades.reduce((sum, t) => sum + (t.confidence || 0), 0) / trades.length;
    const winningTrades = trades.filter(t => this.calculateTradeReturn(t) > 0);
    const winRate = winningTrades.length / trades.length;
    const avgReturn = trades.reduce((sum, t) => sum + this.calculateTradeReturn(t), 0) / trades.length;

    // Analyze patterns
    const patterns = this.analyzeTradePatterns(trades);

    const analysis: SymbolAnalysis = {
      symbol,
      trade_count: trades.length,
      avg_confidence: avgConfidence,
      win_rate: winRate,
      avg_return: avgReturn,
      last_trade: trades[0],
      patterns,
      recommendation: this.generateSymbolRecommendation(trades, patterns)
    };

    this.logger.log('ANALYSIS', `${symbol}: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    return analysis;
  }

  /**
   * Store predictions in database
   */
  async storePredictions(tradePlan: TradePlan): Promise<void> {
    if (!this.supabaseClient) {
      this.logger.log('ALERT', 'Supabase client not available for storing predictions');
      return;
    }

    try {
      await this.supabaseClient.callTool({
        name: 'insert',
        arguments: {
          table: 'predictions',
          data: {
            id: tradePlan.id,
            date: tradePlan.date,
            market_analysis: tradePlan.market_analysis,
            predictions: JSON.stringify(tradePlan.trades),
            risk_assessment: tradePlan.risk_assessment,
            total_risk_exposure: tradePlan.total_risk_exposure,
            strategy_used: 'momentum_reversal', // Should be passed from agent state
            created_at: tradePlan.created_at
          }
        }
      });

      this.logger.log('STATUS', 'Predictions stored in database');
    } catch (error) {
      this.logger.log('ALERT', `Failed to store predictions: ${error}`);
    }
  }

  /**
   * Log messages to database
   */
  async log(level: 'INFO' | 'WARN' | 'ERROR', message: string): Promise<void> {
    if (!this.supabaseClient) {
      return; // Fail silently if database not available
    }

    try {
      const timestamp = new Date().toISOString();
      
      await this.supabaseClient.callTool({
        name: 'insert',
        arguments: {
          table: 'logs',
          data: {
            id: crypto.randomUUID(),
            timestamp,
            level,
            message,
            created_at: timestamp
          }
        }
      });
    } catch (error) {
      // Don't log database logging errors to avoid recursion
      console.error('Failed to store log in database:', error);
    }
  }

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(): Promise<void> {
    if (!this.supabaseClient) {
      this.logger.log('ALERT', 'Supabase client not available for log cleanup');
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DATABASE_CONFIG.CLEANUP_RETENTION_DAYS);
      const cutoffDateStr = cutoffDate.toISOString();

      await this.supabaseClient.callTool({
        name: 'delete',
        arguments: {
          table: 'logs',
          filter: `created_at < '${cutoffDateStr}'`
        }
      });

      this.logger.log('STATUS', `Cleaned up logs older than ${DATABASE_CONFIG.CLEANUP_RETENTION_DAYS} days`);
    } catch (error) {
      this.logger.log('ALERT', `Log cleanup failed: ${error}`);
    }
  }

  /**
   * Get yesterday's trades
   */
  async getYesterdayTrades(): Promise<TradeRecord[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      if (!this.supabaseClient) return [];

      const result = await this.supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: `executed_at::date = '${yesterdayStr}'`
        }
      });

      const rawTrades = this.extractDataFromResult(result);
    return this.convertToTradeRecords(rawTrades);
    } catch (error) {
      this.logger.log('ALERT', `Failed to fetch yesterday's trades: ${error}`);
      return [];
    }
  }

  /**
   * Get today's trades
   */
  async getTodayTrades(): Promise<TradeRecord[]> {
    const today = new Date().toISOString().split('T')[0];

    try {
      if (!this.supabaseClient) return [];

      const result = await this.supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: `executed_at::date = '${today}'`
        }
      });

      const rawTrades = this.extractDataFromResult(result);
    return this.convertToTradeRecords(rawTrades);
    } catch (error) {
      this.logger.log('ALERT', `Failed to fetch today's trades: ${error}`);
      return [];
    }
  }

  /**
   * Store agent event (startup, shutdown, error, etc.)
   */
  async storeAgentEvent(eventType: string, reason: string, context?: Record<string, unknown>): Promise<void> {
    if (!this.supabaseClient) return;

    try {
      await this.supabaseClient.callTool({
        name: 'insert',
        arguments: {
          table: 'agent_events',
          data: {
            id: crypto.randomUUID(),
            event_type: eventType,
            reason: reason,
            timestamp: new Date().toISOString(),
            context: context ? JSON.stringify(context) : null,
            created_at: new Date().toISOString()
          }
        }
      });

      this.logger.log('STATUS', `Stored agent event: ${eventType}`);
    } catch (error) {
      this.logger.log('ALERT', `Failed to store agent event: ${error}`);
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.supabaseClient) {
      return {
        success: false,
        message: 'Supabase client not available'
      };
    }

    try {
      // Test by getting recent trades (limit 1)
      const result = await this.supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          limit: 1,
          order: 'created_at DESC'
        }
      });

      this.logger.log('STATUS', 'Database connection test successful');
      return {
        success: true,
        message: 'Database connection successful'
      };
      
    } catch (error) {
      this.logger.log('ALERT', `Database connection test failed: ${error}`);
      return {
        success: false,
        message: `Database connection failed: ${error}`
      };
    }
  }

  // Private helper methods

  private calculateTradeReturn(trade: TradeRecord): number {
    if (!trade) return 0;
    const entry = trade.price_target || 0;
    const exit = trade.executed_price || entry;
    return trade.action === 'BUY' ? (exit - entry) / entry : (entry - exit) / entry;
  }

  private analyzeTradePatterns(trades: TradeRecord[]): TradePattern[] {
    const patterns: TradePattern[] = [];
    
    // Consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    for (const trade of trades) {
      const isWin = this.calculateTradeReturn(trade) > 0;
      if (isWin) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxWinStreak = Math.max(maxWinStreak, consecutiveWins);
      } else {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxLossStreak = Math.max(maxLossStreak, consecutiveLosses);
      }
    }
    
    patterns.push({
      type: 'streak_analysis',
      max_win_streak: maxWinStreak,
      max_loss_streak: maxLossStreak
    });

    // Trading frequency patterns
    const tradeDates = trades.map(t => new Date(t.executed_at).getDay());
    const dayFrequency: Record<number, number> = tradeDates.reduce((acc, day) => {
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const mostActiveDay = Object.entries(dayFrequency).reduce((a, b) => 
      dayFrequency[parseInt(a[0])] > dayFrequency[parseInt(b[0])] ? a : b
    )?.[0];
    
    patterns.push({
      type: 'timing_patterns',
      day_frequency: dayFrequency,
      most_active_day: mostActiveDay
    });

    return patterns;
  }

  private generateSymbolRecommendation(trades: TradeRecord[], patterns: TradePattern[]): string {
    if (trades.length < 3) return "Insufficient data for recommendation";
    
    const winRate = trades.filter(t => this.calculateTradeReturn(t) > 0).length / trades.length;
    const avgConfidence = trades.reduce((sum, t) => sum + (t.confidence || 0), 0) / trades.length;
    
    if (winRate > PERFORMANCE_THRESHOLDS.STRONG_BUY_WIN_RATE && avgConfidence > PERFORMANCE_THRESHOLDS.STRONG_BUY_CONFIDENCE) {
      return "STRONG BUY - High historical success";
    } else if (winRate > PERFORMANCE_THRESHOLDS.MIN_WIN_RATE && avgConfidence > PERFORMANCE_THRESHOLDS.MIN_AVG_RETURN) {
      return "BUY - Good historical performance";
    } else if (winRate < PERFORMANCE_THRESHOLDS.AVOID_WIN_RATE || avgConfidence < PERFORMANCE_THRESHOLDS.AVOID_CONFIDENCE) {
      return "AVOID - Poor historical performance";
    } else {
      return "NEUTRAL - Mixed historical results";
    }
  }

  private extractDataFromResult(result: Record<string, unknown>): Array<Record<string, unknown>> {
    // Handle different result formats from Supabase MCP
    if (Array.isArray(result)) {
      return result;
    }
    if (result && typeof result === 'object') {
      if (result.data && Array.isArray(result.data)) {
        return result.data;
      }
      if (result.content && Array.isArray(result.content)) {
        return result.content;
      }
    }
    return [];
  }

  /**
   * Convert raw database results to TradeRecord objects
   */
  private convertToTradeRecords(rawData: Array<Record<string, unknown>>): TradeRecord[] {
    return rawData.map(row => ({
      id: String(row.id || ''),
      session_id: String(row.session_id || ''),
      symbol: String(row.symbol || ''),
      action: (row.action === 'BUY' || row.action === 'SELL') ? row.action : 'BUY',
      quantity: Number(row.quantity || 0),
      price_target: Number(row.price_target || 0),
      executed_price: row.executed_price ? Number(row.executed_price) : undefined,
      stop_loss: Number(row.stop_loss || 0),
      take_profit: Number(row.take_profit || 0),
      confidence: Number(row.confidence || 0),
      reasoning: String(row.reasoning || ''),
      executed_at: String(row.executed_at || new Date().toISOString()),
      status: (row.status === 'executed' || row.status === 'failed' || row.status === 'pending') 
        ? row.status 
        : 'pending',
      strategy: String(row.strategy || ''),
      account_balance: row.account_balance ? Number(row.account_balance) : undefined,
      thought_chain: String(row.thought_chain || ''),
      market_analysis: String(row.market_analysis || ''),
      risk_assessment: String(row.risk_assessment || ''),
      trade_plan_id: String(row.trade_plan_id || ''),
      historical_win_rate: Number(row.historical_win_rate || 0),
      historical_avg_return: row.historical_avg_return ? Number(row.historical_avg_return) : undefined,
      total_trades_before: row.total_trades_before ? Number(row.total_trades_before) : undefined,
      created_at: String(row.created_at || new Date().toISOString())
    }));
  }

  /**
   * Update client connection (for stopping/starting services)
   */
  updateClient(client: Client | null): void {
    this.supabaseClient = client;
  }

  /**
   * Get monthly usage statistics for cost tracking
   */
  async getMonthlyUsage(month: string): Promise<{
    claude_requests: number;
    estimated_cost: number;
    trades_count: number;
    daily_requests: number;
  } | null> {
    if (!this.supabaseClient) {
      return null;
    }

    try {
      const response = await this.supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'api_usage_tracking',
          query: `usage_month=eq.${month}`,
          columns: 'service_name,request_count,estimated_cost_usd'
        }
      }) as MCPResponse;

      if (response && 'data' in response) {
        const usageData = Array.isArray(response.data) ? response.data : [];
        
        const claudeUsage = usageData.find((row: Record<string, unknown>) => row.service_name === 'claude');
        const tradesThisMonth = await this.getHistoricalTrades(30);
        
        return {
          claude_requests: Number(claudeUsage?.request_count || 0),
          estimated_cost: Number(claudeUsage?.estimated_cost_usd || 0),
          trades_count: tradesThisMonth.length,
          daily_requests: Math.floor(Number(claudeUsage?.request_count || 0) / 30) // Rough estimate
        };
      }
      
      return null;
    } catch (error) {
      this.logger.log('ALERT', `Failed to get monthly usage: ${error}`);
      return null;
    }
  }

  /**
   * Track API usage for cost monitoring
   */
  async trackApiUsage(service: 'claude' | 'alpaca' | 'quiver', requestCount: number, tokensUsed: number, estimatedCost: number): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }

    try {
      const today = new Date();
      const usageDate = today.toISOString().split('T')[0];
      const usageMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      await this.supabaseClient.callTool({
        name: 'upsert',
        arguments: {
          table: 'api_usage_tracking',
          data: {
            usage_date: usageDate,
            usage_month: usageMonth,
            service_name: service,
            request_count: requestCount,
            tokens_used: tokensUsed,
            estimated_cost_usd: estimatedCost,
            request_details: {
              timestamp: new Date().toISOString(),
              tokens_per_request: Math.floor(tokensUsed / requestCount)
            }
          },
          options: {
            onConflict: 'usage_date,service_name',
            ignoreDuplicates: false
          }
        }
      });

      this.logger.log('STATUS', `📊 Tracked ${service} API usage: ${requestCount} requests, $${estimatedCost.toFixed(4)}`);
    } catch (error) {
      this.logger.log('ALERT', `Failed to track API usage: ${error}`);
    }
  }
}
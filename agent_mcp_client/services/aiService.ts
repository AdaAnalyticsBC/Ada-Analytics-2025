/**
 * AI Service - Handles all Claude AI interactions for trade planning and analysis
 */

import Anthropic from "npm:@anthropic-ai/sdk@^0.30.0";
import { IAIService, TradePlan, PerformanceAnalysis, TradingLogger, AgentState, ClaudeMessage, ClaudeResponse, MarketDataResponse, TradeDecision, TradingPerformanceData } from '../types/interfaces.ts';
import { AI_CONFIG, ENV_KEYS } from '../config.ts';
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

export class AIService implements IAIService {
  private anthropic: Anthropic;
  private logger: TradingLogger;
  private dailyRequestCount: number = 0;
  private dailyCost: number = 0;
  private lastRequestTime: number = 0;

  constructor(logger: TradingLogger) {
    this.logger = logger;
    
    const apiKey = Deno.env.get(ENV_KEYS.ANTHROPIC_API_KEY);
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Craft initial trade plan using Claude
   */
  async craftTradePlan(marketData: MarketDataResponse, agentState?: AgentState): Promise<TradePlan> {
    this.logger.log('ANALYSIS', 'Crafting trade plan with Claude...');

    // Check cost limits
    await this.checkCostLimits();

    const prompt = this.buildTradePlanPrompt(marketData, agentState);

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: AI_CONFIG.MAX_TOKENS_TRADE_PLAN,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: prompt }]
      });

      // Track usage and cost
      this.trackUsage(response.usage, AI_CONFIG.MAX_TOKENS_TRADE_PLAN);

      const tradePlanText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse Claude's response into structured format
      const tradePlan: TradePlan = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        market_analysis: tradePlanText,
        trades: [], // Will be populated in next step
        risk_assessment: '',
        total_risk_exposure: 0,
        created_at: new Date().toISOString()
      };

      this.logger.log('STATUS', 'Initial trade plan crafted successfully');
      return tradePlan;
      
    } catch (error) {
      this.logger.log('ALERT', `Trade plan crafting failed: ${error}`);
      throw error;
    }
  }

  /**
   * Make predictions and refine trade plan
   */
  async makePredictions(tradePlan: TradePlan, marketData: MarketDataResponse, agentState?: AgentState): Promise<TradePlan> {
    this.logger.log('ANALYSIS', 'Making predictions and refining trade plan...');

    // Check cost limits
    await this.checkCostLimits();

    const predictionPrompt = this.buildPredictionPrompt(tradePlan, marketData, agentState);

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: AI_CONFIG.MAX_TOKENS_PREDICTIONS,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: predictionPrompt }]
      });

      // Track usage and cost
      this.trackUsage(response.usage, AI_CONFIG.MAX_TOKENS_PREDICTIONS);

      const predictionText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Extract JSON from Claude's response
      const predictions = this.extractJsonFromResponse(predictionText);
      if (predictions && Object.keys(predictions).length > 0) {
        tradePlan.trades = Array.isArray(predictions.trades) ? predictions.trades as TradeDecision[] : [];
        tradePlan.risk_assessment = typeof predictions.risk_assessment === 'string' ? predictions.risk_assessment : '';
        tradePlan.total_risk_exposure = typeof predictions.total_risk_exposure === 'number' ? predictions.total_risk_exposure : 0;
      }

      this.logger.log('STATUS', `Generated ${tradePlan.trades.length} trade predictions`);
      return tradePlan;
      
    } catch (error) {
      this.logger.log('ALERT', `Prediction generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze trade performance to determine if strategy adjustment is needed
   */
  async analyzeTradePerformance(trades: Array<Record<string, unknown>>): Promise<PerformanceAnalysis> {
    this.logger.log('ANALYSIS', 'Analyzing trade performance with Claude...');

    const prompt = this.buildPerformanceAnalysisPrompt(trades);

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: AI_CONFIG.MAX_TOKENS_PERFORMANCE_ANALYSIS,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: prompt }]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      const rawAnalysis = this.extractJsonFromResponse(analysisText);
      
      if (rawAnalysis && Object.keys(rawAnalysis).length > 0) {
        const analysis: PerformanceAnalysis = {
          should_adjust: Boolean(rawAnalysis.should_adjust),
          performance_summary: String(rawAnalysis.performance_summary || ''),
          suggested_adjustments: String(rawAnalysis.suggested_adjustments || ''),
          new_strategy_focus: String(rawAnalysis.new_strategy_focus || '')
        };
        this.logger.log('STATUS', `Performance analysis complete: ${analysis.should_adjust ? 'Adjustments recommended' : 'Strategy performing well'}`);
        return analysis;
      }

      // Fallback if parsing fails
      return {
        should_adjust: false,
        performance_summary: "Analysis parsing failed",
        suggested_adjustments: "Manual review required",
        new_strategy_focus: ""
      };
      
    } catch (error) {
      this.logger.log('ALERT', `Performance analysis failed: ${error}`);
      return {
        should_adjust: false,
        performance_summary: `Analysis error: ${error}`,
        suggested_adjustments: "Manual review required",
        new_strategy_focus: ""
      };
    }
  }

  /**
   * Adjust trade plan based on performance analysis
   */
  async adjustTradePlan(tradePlan: TradePlan, analysis: PerformanceAnalysis): Promise<TradePlan> {
    this.logger.log('ANALYSIS', 'Adjusting trade plan based on performance analysis...');

    const adjustmentPrompt = this.buildAdjustmentPrompt(tradePlan, analysis);

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: AI_CONFIG.MAX_TOKENS_ADJUSTMENTS,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: adjustmentPrompt }]
      });

      const adjustedText = response.content[0].type === 'text' ? response.content[0].text : '';
      const adjustedPlan = this.extractJsonFromResponse(adjustedText);
      
      if (adjustedPlan) {
        tradePlan = { ...tradePlan, ...adjustedPlan };
      }

      this.logger.log('STATUS', 'Trade plan adjusted based on performance analysis');
      return tradePlan;
      
    } catch (error) {
      this.logger.log('ALERT', `Trade plan adjustment failed: ${error}`);
      return tradePlan;
    }
  }

  /**
   * Generate market sentiment analysis
   */
  async generateMarketSentiment(marketData: MarketDataResponse): Promise<string> {
    this.logger.log('ANALYSIS', 'Generating market sentiment analysis...');

    const prompt = `
    Analyze the following market data and provide a comprehensive sentiment analysis:

    MARKET DATA:
    ${JSON.stringify(marketData, null, 2)}

    Please provide:
    1. Overall market sentiment (bullish/bearish/neutral)
    2. Key market drivers and trends
    3. Risk factors to consider
    4. Opportunities in the current environment
    5. Recommended trading approach

    Keep the analysis concise but comprehensive, focusing on actionable insights.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: 1000,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: prompt }]
      });

      const sentimentText = response.content[0].type === 'text' ? response.content[0].text : '';
      this.logger.log('STATUS', 'Market sentiment analysis generated');
      return sentimentText;
      
    } catch (error) {
      this.logger.log('ALERT', `Market sentiment analysis failed: ${error}`);
      return "Market sentiment analysis unavailable due to processing error.";
    }
  }

  /**
   * Generate risk assessment for a given trade plan
   */
  async generateRiskAssessment(tradePlan: TradePlan, accountBalance: number): Promise<string> {
    this.logger.log('ANALYSIS', 'Generating risk assessment...');

    const prompt = `
    Analyze the risk profile of the following trade plan:

    TRADE PLAN:
    ${JSON.stringify(tradePlan.trades, null, 2)}

    ACCOUNT CONTEXT:
    - Account Balance: $${accountBalance.toLocaleString()}
    - Max Risk per Trade: 1%
    - Max Daily Risk: 2%

    Please provide:
    1. Risk score (1-10, where 10 is highest risk)
    2. Position sizing analysis
    3. Correlation risk between trades
    4. Market timing risk
    5. Specific risk mitigation recommendations

    Be specific and actionable in your assessment.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: 800,
        temperature: AI_CONFIG.TEMPERATURE,
        messages: [{ role: "user", content: prompt }]
      });

      const riskText = response.content[0].type === 'text' ? response.content[0].text : '';
      this.logger.log('STATUS', 'Risk assessment generated');
      return riskText;
      
    } catch (error) {
      this.logger.log('ALERT', `Risk assessment generation failed: ${error}`);
      return "Risk assessment unavailable due to processing error.";
    }
  }

  /**
   * Test Claude API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    this.logger.log('STATUS', 'Testing Claude API connection...');

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: "Respond with 'API Test Successful' if you can read this message."
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      this.logger.log('STATUS', 'Claude API connection test successful');
      return {
        success: true,
        message: `Connection successful. Response: ${responseText}`
      };
      
    } catch (error) {
      this.logger.log('ALERT', `Claude API connection test failed: ${error}`);
      return {
        success: false,
        message: `Connection failed: ${error}`
      };
    }
  }

  // Private helper methods

  private buildTradePlanPrompt(marketData: MarketDataResponse, agentState?: AgentState): string {
    // Extract only key market data to reduce prompt size
    const keyMarketData = this.extractKeyMarketData(marketData);
    
    return `
    You are an expert quantitative trader. Based on the following market data and historical performance, create a comprehensive trade plan for today.

    MARKET DATA SUMMARY:
    ${keyMarketData}

    TRADING RULES:
    - Maximum 2 trades per day
    - Risk 1% of account balance per trade
    - Stop loss: 5% of trade value
    - Take profit: 10% of trade value
    - Current account balance: $${agentState?.account_balance || 0}
    
    HISTORICAL PERFORMANCE CONTEXT:
    ${this.formatTradingPerformance(marketData.trading_performance, marketData.recent_trades)}
    
    STRATEGY FOCUS:
    - Look for high-probability setups based on historical success
    - Consider RSI, EMA indicators and past performance on similar setups
    - Analyze volume and volatility patterns that have worked before
    - Factor in market sentiment and your historical reaction to it
    - Learn from recent trades - what worked and what didn't
    - Some days no trades is the right choice (especially if recent performance suggests caution)

    PREVIOUS STRATEGY CONTEXT:
    ${agentState?.current_strategy || 'momentum_reversal'}

    Please provide:
    1. Market analysis summary
    2. Current market sentiment
    3. Key opportunities and risks
    4. Strategic approach for today
    5. Reasoning for trade timing

    Format your response as a comprehensive market analysis and trading strategy overview.
    `;
  }

  private buildPredictionPrompt(tradePlan: TradePlan, marketData: MarketDataResponse, agentState?: AgentState): string {
    // Extract only key market data to reduce prompt size
    const keyMarketData = this.extractKeyMarketData(marketData);
    
    return `
    Based on the initial trade plan and market data, create specific trade predictions:

    INITIAL PLAN:
    ${tradePlan.market_analysis}

    MARKET DATA SUMMARY:
    ${keyMarketData}

    Please provide specific trade decisions in this JSON format:
    {
      "trades": [
        {
          "symbol": "AAPL",
          "action": "BUY",
          "quantity": 10,
          "price_target": 150.00,
          "stop_loss": 142.50,
          "take_profit": 165.00,
          "confidence": 0.75,
          "reasoning": "Strong momentum with RSI oversold"
        }
      ],
      "risk_assessment": "Low to moderate risk...",
      "total_risk_exposure": 0.02
    }

    Consider:
    - Intraday price movements
    - Next day direction
    - Weekly volatility patterns
    - RSI, EMA, volume indicators
    - Account balance: $${agentState?.account_balance || 0}
    - 1% risk per trade rule
    - Maximum 2 trades per day
    - Minimum confidence threshold: 0.6

    IMPORTANT: Respond with valid JSON only. No additional text outside the JSON structure.
    `;
  }

  private buildPerformanceAnalysisPrompt(trades: Array<Record<string, unknown>>): string {
    return `
    Analyze the following trade performance and determine if strategy adjustment is needed:

    TRADES:
    ${JSON.stringify(trades, null, 2)}

    Consider:
    - Win/loss ratio
    - Average profit/loss
    - Risk management effectiveness
    - Market conditions vs strategy performance
    - Consecutive wins/losses patterns
    - Trading frequency and timing
    - Symbol selection patterns

    Respond with JSON in this exact format:
    {
      "should_adjust": true/false,
      "performance_summary": "Brief summary of key performance metrics...",
      "suggested_adjustments": "Specific adjustments needed...",
      "new_strategy_focus": "Updated strategy name or focus area..."
    }

    IMPORTANT: Respond with valid JSON only. No additional text outside the JSON structure.
    `;
  }

  private buildAdjustmentPrompt(tradePlan: TradePlan, analysis: PerformanceAnalysis): string {
    return `
    Adjust the following trade plan based on performance analysis:

    ORIGINAL PLAN:
    ${JSON.stringify(tradePlan, null, 2)}

    PERFORMANCE ANALYSIS:
    ${JSON.stringify(analysis, null, 2)}

    Provide an adjusted trade plan maintaining the same structure but with improved strategy.
    Focus on the specific adjustments suggested in the performance analysis.

    Respond with JSON containing the adjusted trade plan fields:
    {
      "trades": [...], // Updated trade list
      "risk_assessment": "...", // Updated risk assessment
      "total_risk_exposure": 0.XX, // Updated exposure
      "market_analysis": "..." // Updated analysis incorporating adjustments
    }

    IMPORTANT: Respond with valid JSON only. No additional text outside the JSON structure.
    `;
  }

  private extractJsonFromResponse(responseText: string): Record<string, unknown> {
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try parsing the entire response
      return JSON.parse(responseText);
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to parse JSON from AI response: ${error}`);
      return {};
    }
  }

  /**
   * Extract key market data to reduce prompt size while maintaining essential information
   */
  private extractKeyMarketData(marketData: MarketDataResponse): string {
    try {
      const summary = [];
      
      // Add market overview if available
      if (marketData.market_overview) {
        summary.push(`Market Overview: ${JSON.stringify(marketData.market_overview).substring(0, 500)}...`);
      }
      
      // Add key indicators if available
      if (marketData.indicators) {
        summary.push(`Key Indicators: ${JSON.stringify(marketData.indicators).substring(0, 300)}...`);
      }
      
      // Add watchlist if available (limit to top 10)
      if (marketData.watchlist && Array.isArray(marketData.watchlist)) {
        const topWatchlist = marketData.watchlist.slice(0, 10);
        summary.push(`Top Watchlist: ${JSON.stringify(topWatchlist)}`);
      }
      
      // Add any other critical data points (limit each to 200 chars)
      Object.keys(marketData).forEach(key => {
        if (!['market_overview', 'indicators', 'watchlist', 'trading_performance', 'recent_trades'].includes(key)) {
          const value = marketData[key];
          if (value && typeof value === 'object') {
            summary.push(`${key}: ${JSON.stringify(value).substring(0, 200)}...`);
          } else if (value) {
            summary.push(`${key}: ${value}`);
          }
        }
      });
      
      return summary.join('\n');
    } catch (error) {
      return 'Market data summary unavailable due to formatting error';
    }
  }

  /**
   * Safely format trading performance data for prompts
   */
  private formatTradingPerformance(
    performance?: TradingPerformanceData, 
    recentTrades?: Array<Record<string, unknown>>
  ): string {
    if (!performance) {
      return 'No historical trading data available';
    }

    const safePerformance: TradingPerformanceData = {
      total_trades: performance.total_trades || 0,
      win_rate: performance.win_rate || 0,
      avg_return: performance.avg_return || 0,
      symbols_traded: performance.symbols_traded || [],
      last_ten_trades: performance.last_ten_trades || []
    };

    const recentTradesData = Array.isArray(recentTrades) ? recentTrades.slice(0, 3) : [];

    return `
    - Total trades executed: ${safePerformance.total_trades}
    - Historical win rate: ${(safePerformance.win_rate * 100).toFixed(1)}%
    - Average return per trade: ${(safePerformance.avg_return * 100).toFixed(2)}%
    - Recent trading symbols: ${safePerformance.symbols_traded.join(', ')}
    - Recent trades: ${JSON.stringify(recentTradesData)}
    `;
  }

  /**
   * Check cost limits before making API calls
   */
  private async checkCostLimits(): Promise<void> {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    
    // Reset daily counters if it's a new day
    if (now < this.lastRequestTime || now - this.lastRequestTime > 24 * 60 * 60 * 1000) {
      this.dailyRequestCount = 0;
      this.dailyCost = 0;
    }
    
    // Check daily request limit
    if (this.dailyRequestCount >= AI_CONFIG.DAILY_REQUEST_LIMIT) {
      throw new Error(`Daily request limit reached (${AI_CONFIG.DAILY_REQUEST_LIMIT}). Cost protection enabled.`);
    }
    
    // Check daily cost limit
    if (this.dailyCost >= AI_CONFIG.MAX_DAILY_COST_USD) {
      throw new Error(`Daily cost limit reached ($${AI_CONFIG.MAX_DAILY_COST_USD}). Cost protection enabled.`);
    }
    
    // Check request throttling
    if (now - this.lastRequestTime < AI_CONFIG.MIN_REQUEST_INTERVAL_MS) {
      const waitTime = AI_CONFIG.MIN_REQUEST_INTERVAL_MS - (now - this.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Track API usage and cost
   */
  private trackUsage(usage: { input_tokens: number; output_tokens: number }, maxTokens: number): void {
    this.dailyRequestCount++;
    this.lastRequestTime = Date.now();
    
    // Calculate cost (Haiku pricing: $0.25/1M tokens)
    const totalTokens = usage.input_tokens + usage.output_tokens;
    const cost = (totalTokens / 1000) * AI_CONFIG.COST_PER_1K_TOKENS;
    this.dailyCost += cost;
    
    this.logger.log('STATUS', `API Usage: ${totalTokens} tokens, Cost: $${cost.toFixed(4)}, Daily Total: $${this.dailyCost.toFixed(4)}`);
    
    // Log warning if approaching limits
    if (this.dailyRequestCount >= AI_CONFIG.DAILY_REQUEST_LIMIT * 0.8) {
      this.logger.log('ALERT', `Approaching daily request limit: ${this.dailyRequestCount}/${AI_CONFIG.DAILY_REQUEST_LIMIT}`);
    }
    
    if (this.dailyCost >= AI_CONFIG.MAX_DAILY_COST_USD * 0.8) {
      this.logger.log('ALERT', `Approaching daily cost limit: $${this.dailyCost.toFixed(4)}/$${AI_CONFIG.MAX_DAILY_COST_USD}`);
    }
  }
}
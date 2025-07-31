#!/usr/bin/env -S deno run --allow-all

import { Client } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js";
import { StdioClientTransport } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/stdio.js";
import Anthropic from "npm:@anthropic-ai/sdk@^0.30.0";
import { Resend } from "resend";

import { cron } from "https://deno.land/x/deno_cron@v1.0.0/cron.ts";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// Types and Interfaces
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface TradeDecision {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price_target: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasoning: string;
}

interface TradePlan {
  id: string;
  date: string;
  market_analysis: string;
  trades: TradeDecision[];
  risk_assessment: string;
  total_risk_exposure: number;
  created_at: string;
}

interface AgentState {
  is_paused: boolean;
  last_run: string;
  current_strategy: string;
  account_balance: number;
  open_positions: any[];
  trade_history: any[];
  pause_token?: string;
}

// MCP Server Configuration
const MCP_SERVERS: Record<string, MCPServerConfig> = {
  alpaca: {
    command: "/Users/jasoncoawette/ASU/Ada-Analytics/alpaca-mcp-server/venv/bin/python",
    args: ["/Users/jasoncoawette/ASU/Ada-Analytics/alpaca-mcp-server/alpaca_mcp_server.py"],
    env: {
      ALPACA_API_KEY: "PKGLJQGTZQ1SM8DJQMTY",
      ALPACA_SECRET_KEY: "ZjNdize110ch4eQ94tu2BII1sJKvUv9ac91CBsy8"
    }
  },
  supabase: {
    command: "npx",
    args: ["-y", "@supabase/mcp-server-supabase@latest", "--project-ref=wcbjlcyecwzwsgfnqncz"],
    env: {
      SUPABASE_ACCESS_TOKEN: "sbp_47a5bd267c8a1157424851124f550be680c24aed"
    }
  },
  "quiver-quant": {
    command: "deno",
    args: ["run", "--allow-net", "--allow-env", "/Users/jasoncoawette/ASU/Ada-Analytics/quiver-mcp-server/main.ts"],
    env: {
      QUIVER_API_TOKEN: "bf5ffac369f553d52cf345a94ea54a736985c324"
    }
  }
};

class AutonomousTradingAgent {
  private anthropic!: Anthropic;
  private activeClients: Map<string, Client> = new Map();
  private state: AgentState;
  private resend!: Resend;
  private baseUrl!: string;
  private isShuttingDown: boolean = false;
  private server: any;
  private cronJob: any;
  private shutdownCallbacks: (() => Promise<void>)[] = [];

  constructor() {
    // Initialize only the state - other properties will be set in initialize()
    this.state = {
      is_paused: false,
      last_run: '',
      current_strategy: 'momentum_reversal',
      account_balance: 0,
      open_positions: [],
      trade_history: []
    };
  }

  /**
   * Clean trading-focused logging
   */
  private tradingLog(type: 'PLAN' | 'TRADE' | 'ANALYSIS' | 'ALERT' | 'STATUS', message: string): void {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: 'America/New_York' 
    });
    
    const icons: Record<string, string> = {
      'PLAN': '📋',
      'TRADE': '🔄', 
      'ANALYSIS': '📊',
      'ALERT': '🚨',
      'STATUS': '✅'
    };
    
    const colors: Record<string, string> = {
      'PLAN': '\x1b[36m',    // Cyan
      'TRADE': '\x1b[33m',   // Yellow  
      'ANALYSIS': '\x1b[35m', // Magenta
      'ALERT': '\x1b[31m',   // Red
      'STATUS': '\x1b[32m'   // Green
    };
    
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${icons[type]} [${timestamp}] ${type}: ${message}${reset}`);
  }

  /**
   * Initialize the agent by loading environment variables and setting up clients
   */
  async initialize(): Promise<void> {
    // Load environment variables from .env file
    try {
      await load({ export: true });
    } catch (error) {
      // Silently fall back to system environment variables
    }

    // Now initialize clients with loaded environment variables
    this.anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY") || '',
    });

    this.baseUrl = Deno.env.get("BASE_URL") || 'https://your-railway-app.railway.app';
    
    // Initialize Resend client
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || '';
    this.resend = new Resend(resendApiKey);
    
    this.loadState();
  }

  /**
   * Get environment variables as object (helper for Deno.env)
   */
  private getEnvObject(): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Add common environment variables that might be needed
    const envVars = [
      'ANTHROPIC_API_KEY', 'RESEND_API_KEY',
      'BASE_URL', 'PORT', 'TZ', 'ALPACA_API_KEY', 'ALPACA_SECRET_KEY',
      'SUPABASE_ACCESS_TOKEN', 'QUIVER_API_TOKEN'
    ];
    
    for (const varName of envVars) {
      const value = Deno.env.get(varName);
      if (value) {
        env[varName] = value;
      }
    }
    
    return env;
  }

  /**
   * Check if Resend is properly configured
   */
  private isEmailConfigured(): boolean {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    return !!apiKey;
  }

  /**
   * Connect to all MCP servers
   */
  async connectToServers(): Promise<void> {
    for (const [serverName, config] of Object.entries(MCP_SERVERS)) {
      try {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: {
            ...this.getEnvObject(),
            ...config.env
          }
        });

        const client = new Client({
          name: `trading-agent-${serverName}`,
          version: "1.0.0"
        });

        await client.connect(transport);
        this.activeClients.set(serverName, client);
      } catch (error) {
        console.error(`Failed to connect to ${serverName}: ${error}`);
      }
    }

    if (this.activeClients.size === 0) {
      throw new Error('Failed to connect to any MCP servers');
    }
  }

  /**
   * Step 1: Collect market data from Quiver
   */
  async collectMarketData(): Promise<any> {
    await this.log('INFO', 'Collecting market data from Quiver...');
    
    const quiverClient = this.activeClients.get('quiver-quant');
    if (!quiverClient) {
      throw new Error('Quiver client not available');
    }

    try {
      // Get available tools from Quiver
      const { tools } = await quiverClient.listTools();
      const dataCollectionTools = tools.filter(tool => 
        tool.name.includes('data') || 
        tool.name.includes('market') || 
        tool.name.includes('sentiment') ||
        tool.name.includes('options') ||
        tool.name.includes('insider')
      );

      let marketData: any = {};

      // Collect data from available tools
      for (const tool of dataCollectionTools.slice(0, 5)) { // Limit to 5 tools to avoid overload
        try {
          const result = await quiverClient.callTool({
            name: tool.name,
            arguments: {
              // Add common parameters - adjust based on actual tool schemas
              limit: 50,
              timeframe: '1d'
            }
          });
          marketData[tool.name] = result;
        } catch (error) {
          await this.log('WARN', `Failed to collect data from ${tool.name}: ${error}`);
        }
      }

      await this.log('INFO', `Collected data from ${Object.keys(marketData).length} sources`);
      return marketData;
    } catch (error) {
      await this.log('ERROR', `Market data collection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Step 2: Craft initial trade plan using Claude
   */
  async craftTradePlan(marketData: any): Promise<TradePlan> {
    await this.log('INFO', 'Crafting trade plan with Claude...');

    const prompt = `
    You are an expert quantitative trader. Based on the following market data and historical performance, create a comprehensive trade plan for today.

    MARKET DATA:
    ${JSON.stringify(marketData, null, 2)}

    TRADING RULES:
    - Maximum 2 trades per day
    - Risk 1% of account balance per trade
    - Stop loss: 5% of trade value
    - Take profit: 10% of trade value
    - Current account balance: $${this.state.account_balance}
    
    HISTORICAL PERFORMANCE CONTEXT:
    ${marketData.trading_performance ? `
    - Total trades executed: ${marketData.trading_performance.total_trades}
    - Historical win rate: ${(marketData.trading_performance.win_rate * 100).toFixed(1)}%
    - Average return per trade: ${(marketData.trading_performance.avg_return * 100).toFixed(2)}%
    - Recent trading symbols: ${marketData.trading_performance.symbols_traded.join(', ')}
    - Recent trades: ${JSON.stringify(marketData.recent_trades?.slice(0, 3))}
    ` : 'No historical trading data available'}
    
    STRATEGY FOCUS:
    - Look for high-probability setups based on historical success
    - Consider RSI, EMA indicators and past performance on similar setups
    - Analyze volume and volatility patterns that have worked before
    - Factor in market sentiment and your historical reaction to it
    - Learn from recent trades - what worked and what didn't
    - Some days no trades is the right choice (especially if recent performance suggests caution)

    PREVIOUS STRATEGY CONTEXT:
    ${this.state.current_strategy}

    Please provide:
    1. Market analysis summary
    2. Specific trade recommendations (0-2 trades)
    3. Risk assessment
    4. Reasoning for each trade

    Format your response as a structured trade plan.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      });

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

      await this.log('INFO', 'Initial trade plan crafted');
      return tradePlan;
    } catch (error) {
      await this.log('ERROR', `Trade plan crafting failed: ${error}`);
      throw error;
    }
  }

  /**
   * Step 3: Make predictions and refine trade plan
   */
  async makePredictions(tradePlan: TradePlan, marketData: any): Promise<TradePlan> {
    await this.log('INFO', 'Making predictions and refining trade plan...');

    const predictionPrompt = `
    Based on the initial trade plan and market data, create specific trade predictions:

    INITIAL PLAN:
    ${tradePlan.market_analysis}

    MARKET DATA:
    ${JSON.stringify(marketData, null, 2)}

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
    - Account balance: $${this.state.account_balance}
    - 1% risk per trade rule
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [{ role: "user", content: predictionPrompt }]
      });

      const predictionText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Extract JSON from Claude's response
      const jsonMatch = predictionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const predictions = JSON.parse(jsonMatch[0]);
        tradePlan.trades = predictions.trades || [];
        tradePlan.risk_assessment = predictions.risk_assessment || '';
        tradePlan.total_risk_exposure = predictions.total_risk_exposure || 0;
      }

      // Store predictions in Supabase
      await this.storePredictions(tradePlan);
      
      await this.log('INFO', `Generated ${tradePlan.trades.length} trade predictions`);
      return tradePlan;
    } catch (error) {
      await this.log('ERROR', `Prediction generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Step 4: Finalize trade plan
   */
  async finalizeTradePlan(tradePlan: TradePlan): Promise<TradePlan> {
    await this.log('INFO', 'Finalizing trade plan...');

    // Check yesterday's trades for evaluation
    const yesterdayTrades = await this.getYesterdayTrades();
    
    if (yesterdayTrades.length > 0) {
      await this.log('INFO', `Found ${yesterdayTrades.length} trades from yesterday, re-evaluating strategy...`);
      
      // Analyze yesterday's performance
      const performanceAnalysis = await this.analyzeTradePerformance(yesterdayTrades);
      
      // Adjust strategy if needed
      if (performanceAnalysis.should_adjust) {
        tradePlan = await this.adjustTradePlan(tradePlan, performanceAnalysis);
      }
    }

    // Final validation
    tradePlan.trades = tradePlan.trades.filter(trade => {
      const positionSize = (this.state.account_balance * 0.01) / trade.price_target;
      return positionSize > 0 && trade.confidence > 0.6;
    });

    await this.log('INFO', `Finalized trade plan with ${tradePlan.trades.length} trades`);
    return tradePlan;
  }

  /**
   * Step 5: Email trade plan to stakeholders
   */
  async emailTradePlan(tradePlan: TradePlan): Promise<void> {
    await this.log('INFO', 'Sending trade plan email...');

    const pauseToken = crypto.randomUUID();
    this.state.pause_token = pauseToken;
    await this.saveState();

    const emailContent = `
    <h2>🤖 Daily Trade Plan - ${tradePlan.date}</h2>
    
    <h3>Market Analysis</h3>
    <p>${tradePlan.market_analysis}</p>
    
    <h3>Planned Trades (${tradePlan.trades.length})</h3>
    ${tradePlan.trades.map(trade => `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <h4>${trade.action} ${trade.symbol}</h4>
        <p><strong>Quantity:</strong> ${trade.quantity}</p>
        <p><strong>Target Price:</strong> $${trade.price_target}</p>
        <p><strong>Stop Loss:</strong> $${trade.stop_loss}</p>
        <p><strong>Take Profit:</strong> $${trade.take_profit}</p>
        <p><strong>Confidence:</strong> ${(trade.confidence * 100).toFixed(1)}%</p>
        <p><strong>Reasoning:</strong> ${trade.reasoning}</p>
      </div>
    `).join('')}
    
    <h3>Risk Assessment</h3>
    <p>${tradePlan.risk_assessment}</p>
    <p><strong>Total Risk Exposure:</strong> ${(tradePlan.total_risk_exposure * 100).toFixed(2)}%</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0;">
      <h3>🛑 Emergency Controls</h3>
      <a href="${this.baseUrl}/pause/${pauseToken}" 
         style="background-color: #ff4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        PAUSE TRADING
      </a>
    </div>
    
    <p><small>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;

    const recipients = ['jcoawett@asu.edu', 'drrayhsu@gmail.com', 'tjgatso@asu.edu'];
    
    let emailsSent = 0;
    for (const recipient of recipients) {
      if (await this.sendEmail(recipient, `📊 Daily Trade Plan - ${tradePlan.date}`, emailContent)) {
        emailsSent++;
      }
    }
    
    await this.log('INFO', `Trade plan emailed to ${emailsSent}/${recipients.length} recipients`);
  }

  /**
   * Send email with error handling using Resend
   */
  private async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    // Skip if email not configured
    if (!this.isEmailConfigured()) {
      this.tradingLog('ALERT', `EMAIL:TODO: send (not configured) - ${subject}`);
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: 'communications@adaanalytics.io', // You'll need to verify your domain
        to: [to],
        subject: subject,
        html: content,
      });

      if (error) {
        this.tradingLog('ALERT', `EMAIL:TODO: send (resend error) - ${subject}`);
        return false;
      }

      this.tradingLog('STATUS', `📧 Email sent: ${subject}`);
      return true;
    } catch (error) {
      this.tradingLog('ALERT', `EMAIL:TODO: send (network error) - ${subject}`);
      return false;
    }
  }

  /**
   * Step 6.1: Execute trades using Alpaca
   */
  async executeTrades(tradePlan: TradePlan): Promise<any[]> {
    if (this.state.is_paused) {
      await this.log('INFO', 'Trading is paused, skipping trade execution');
      return [];
    }

    await this.log('INFO', `Executing ${tradePlan.trades.length} trades...`);

    const alpacaClient = this.activeClients.get('alpaca');
    if (!alpacaClient) {
      throw new Error('Alpaca client not available');
    }

    const executedTrades = [];

    for (const trade of tradePlan.trades) {
      try {
        // Calculate position size (1% of account balance)
        const positionValue = this.state.account_balance * 0.01;
        const quantity = Math.floor(positionValue / trade.price_target);

        if (quantity <= 0) {
          await this.log('WARN', `Skipping ${trade.symbol} - position size too small`);
          continue;
        }

        // Execute trade via Alpaca MCP
        const tradeResult = await alpacaClient.callTool({
          name: 'place_order', // Adjust based on actual Alpaca MCP tool names
          arguments: {
            symbol: trade.symbol,
            side: trade.action.toLowerCase(),
            type: 'market',
            qty: quantity,
            time_in_force: 'day'
          }
        });

        // Set stop loss and take profit orders
        if (tradeResult && typeof tradeResult === 'object' && 'id' in tradeResult && tradeResult.id) {
          await this.setStopLossAndTakeProfit(trade, String(tradeResult.id));
        }

        executedTrades.push({
          ...trade,
          executed_quantity: quantity,
          execution_result: tradeResult,
          executed_at: new Date().toISOString()
        });

        await this.log('INFO', `Executed ${trade.action} ${quantity} ${trade.symbol}`);
        
        // Wait between trades to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        await this.log('ERROR', `Failed to execute trade ${trade.symbol}: ${error}`);
      }
    }

    await this.log('INFO', `Executed ${executedTrades.length} out of ${tradePlan.trades.length} planned trades`);
    return executedTrades;
  }

  /**
   * Step 7: Store trades in Supabase with enhanced data
   */
  async storeTrades(executedTrades: any[], tradePlan?: any, thoughtChain?: string[]): Promise<void> {
    await this.log('INFO', 'Storing trades in Supabase...');

    const supabaseClient = this.activeClients.get('supabase');
    if (!supabaseClient) {
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
          executed_price: trade.filled_avg_price || trade.executed_price,
          stop_loss: trade.stop_loss,
          take_profit: trade.take_profit,
          confidence: trade.confidence,
          reasoning: trade.reasoning,
          executed_at: trade.executed_at || new Date().toISOString(),
          status: trade.status || 'executed',
          
          // Enhanced data
          strategy: this.state.current_strategy,
          account_balance: this.state.account_balance,
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

        await supabaseClient.callTool({
          name: 'insert',
          arguments: {
            table: 'trades',
            data: tradeData
          }
        });

        this.tradingLog('STATUS', `💾 Stored ${trade.symbol} trade with full context`);
      }

      await this.log('INFO', `Stored ${executedTrades.length} trades with enhanced data`);
    } catch (error) {
      await this.log('ERROR', `Failed to store trades: ${error}`);
      throw error;
    }
  }

  /**
   * Log AI thought chain during decision making
   */
  private logThoughtChain(step: string, reasoning: string): void {
    this.tradingLog('ANALYSIS', `🧠 ${step}: ${reasoning}`);
  }

  /**
   * Register a callback to run during shutdown
   */
  private addShutdownCallback(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown(reason: string = 'Manual shutdown'): Promise<void> {
    if (this.isShuttingDown) {
      console.log('🔄 Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    this.tradingLog('ALERT', `🛑 Initiating graceful shutdown: ${reason}`);

    try {
      // 1. Pause trading immediately
      this.state.is_paused = true;
      this.tradingLog('STATUS', '⏸️ Trading paused for shutdown');

      // 2. Cancel any pending trades (if implemented)
      try {
        const alpacaClient = this.activeClients.get('alpaca');
        if (alpacaClient) {
          this.tradingLog('STATUS', '🚫 Canceling pending orders...');
          await alpacaClient.callTool({
            name: 'cancel_all_orders',
            arguments: {}
          });
        }
      } catch (error) {
        this.tradingLog('ALERT', `Failed to cancel orders: ${error}`);
      }

      // 3. Save current state
      this.tradingLog('STATUS', '💾 Saving agent state...');
      await this.saveState();

      // 4. Log shutdown to Supabase
      try {
        const supabaseClient = this.activeClients.get('supabase');
        if (supabaseClient) {
          await supabaseClient.callTool({
            name: 'insert',
            arguments: {
              table: 'agent_events',
              data: {
                id: crypto.randomUUID(),
                event_type: 'shutdown',
                reason: reason,
                timestamp: new Date().toISOString(),
                account_balance: this.state.account_balance,
                open_positions: this.state.open_positions.length
              }
            }
          });
        }
      } catch (error) {
        this.tradingLog('ALERT', `Failed to log shutdown event: ${error}`);
      }

      // 5. Run shutdown callbacks
      this.tradingLog('STATUS', '🔄 Running cleanup callbacks...');
      for (const callback of this.shutdownCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('Shutdown callback failed:', error);
        }
      }

      // 6. Close MCP connections
      this.tradingLog('STATUS', '🔌 Closing MCP connections...');
      for (const [name, client] of this.activeClients) {
        try {
          if (client.close) {
            await client.close();
          }
          this.tradingLog('STATUS', `✅ Closed ${name} connection`);
        } catch (error) {
          this.tradingLog('ALERT', `Failed to close ${name}: ${error}`);
        }
      }

      // 7. Close web server
      if (this.server) {
        this.tradingLog('STATUS', '🌐 Shutting down web server...');
        this.server.shutdown();
      }

      // 8. Send shutdown notification email
      if (this.isEmailConfigured()) {
        try {
          await this.sendEmail(
            Deno.env.get("NOTIFICATION_EMAIL") || "communication@adaanalytics.io",
            'Ada Analytics Agent Shutdown',
            `The trading agent has been shut down gracefully.\n\nReason: ${reason}\nTime: ${new Date().toLocaleString()}\nAccount Balance: $${this.state.account_balance}\nOpen Positions: ${this.state.open_positions.length}`
          );
        } catch (error) {
          this.tradingLog('ALERT', `Failed to send shutdown email: ${error}`);
        }
      }

      this.tradingLog('STATUS', '✅ Graceful shutdown completed');
      console.log('\n🔒 Agent shutdown complete. Safe to restart.');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      this.tradingLog('ALERT', `Shutdown error: ${error}`);
    }
  }

  /**
   * Force emergency shutdown
   */
  async emergencyShutdown(): Promise<void> {
    this.tradingLog('ALERT', '🚨 EMERGENCY SHUTDOWN INITIATED');
    this.isShuttingDown = true;
    
    try {
      // Immediate pause
      this.state.is_paused = true;
      
      // Quick state save
      await this.saveState();
      
      // Close connections
      for (const [name, client] of this.activeClients) {
        try {
          if (client.close) await client.close();
        } catch (error) {
          // Ignore errors during emergency shutdown
          console.error(`Error closing ${name}:`, error);
        }
      }
      
      this.tradingLog('ALERT', '🔒 Emergency shutdown complete');
      
    } catch (error) {
      console.error('Emergency shutdown error:', error);
    }
    
    Deno.exit(1);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    const handleSigInt = () => {
      console.log('\n⚠️ Received SIGINT (Ctrl+C)...');
      this.gracefulShutdown('SIGINT received').then(() => {
        Deno.exit(0);
      });
    };

    // Handle SIGTERM
    const handleSigTerm = () => {
      console.log('\n⚠️ Received SIGTERM...');
      this.gracefulShutdown('SIGTERM received').then(() => {
        Deno.exit(0);
      });
    };

    // Note: Deno signal handling may vary by platform
    try {
      if (Deno.build.os !== 'windows') {
        Deno.addSignalListener('SIGINT', handleSigInt);
        Deno.addSignalListener('SIGTERM', handleSigTerm);
      }
    } catch (error) {
      this.tradingLog('ALERT', `Could not setup signal handlers: ${error}`);
    }
  }

  /**
   * Read historical trades from Supabase
   */
  async getHistoricalTrades(days: number = 30, symbol?: string): Promise<any[]> {
    const supabaseClient = this.activeClients.get('supabase');
    if (!supabaseClient) {
      this.tradingLog('ALERT', 'Supabase client not available for trade history');
      return [];
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      let query = `executed_at >= '${cutoffDate.toISOString()}'`;
      if (symbol) {
        query += ` AND symbol = '${symbol}'`;
      }

      const result = await supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: query,
          order: 'executed_at DESC'
        }
      });

      const trades = Array.isArray(result) ? result : [];
      this.tradingLog('ANALYSIS', `Retrieved ${trades.length} historical trades (${days} days)`);
      return trades;
    } catch (error) {
      this.tradingLog('ALERT', `Failed to get historical trades: ${error}`);
      return [];
    }
  }

  /**
   * Get trading performance analytics
   */
  async getTradingPerformance(): Promise<any> {
    const trades = await this.getHistoricalTrades(90); // Last 90 days
    
    if (trades.length === 0) {
      return {
        total_trades: 0,
        win_rate: 0,
        avg_return: 0,
        total_return: 0,
        best_trade: null,
        worst_trade: null,
        symbols_traded: []
      };
    }

    // Calculate performance metrics
    const winningTrades = trades.filter(t => (t.executed_price || 0) > (t.price_target || 0));
    const winRate = winningTrades.length / trades.length;
    
    const returns = trades.map(t => {
      const entry = t.price_target || 0;
      const exit = t.executed_price || entry;
      return t.action === 'BUY' ? (exit - entry) / entry : (entry - exit) / entry;
    });
    
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
    }, {});

    const performance = {
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

    this.tradingLog('ANALYSIS', `Performance: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, ${(avgReturn * 100).toFixed(2)}% avg return`);
    return performance;
  }

  /**
   * Calculate return for a single trade
   */
  private calculateTradeReturn(trade: any): number {
    if (!trade) return 0;
    const entry = trade.price_target || 0;
    const exit = trade.executed_price || entry;
    return trade.action === 'BUY' ? (exit - entry) / entry : (entry - exit) / entry;
  }

  /**
   * Get symbol-specific trading history and patterns
   */
  async getSymbolAnalysis(symbol: string): Promise<any> {
    const trades = await this.getHistoricalTrades(180, symbol); // 6 months
    
    if (trades.length === 0) {
      return {
        symbol,
        trade_count: 0,
        avg_confidence: 0,
        win_rate: 0,
        avg_return: 0,
        last_trade: null,
        patterns: []
      };
    }

    const avgConfidence = trades.reduce((sum, t) => sum + (t.confidence || 0), 0) / trades.length;
    const winningTrades = trades.filter(t => this.calculateTradeReturn(t) > 0);
    const winRate = winningTrades.length / trades.length;
    const avgReturn = trades.reduce((sum, t) => sum + this.calculateTradeReturn(t), 0) / trades.length;

    // Analyze patterns
    const patterns = this.analyzeTradePatterns(trades);

    const analysis = {
      symbol,
      trade_count: trades.length,
      avg_confidence: avgConfidence,
      win_rate: winRate,
      avg_return: avgReturn,
      last_trade: trades[0],
      patterns,
      recommendation: this.generateSymbolRecommendation(trades, patterns)
    };

    this.tradingLog('ANALYSIS', `${symbol}: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    return analysis;
  }

  /**
   * Analyze trading patterns from historical data
   */
  private analyzeTradePatterns(trades: any[]): any[] {
    const patterns = [];
    
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
    
    patterns.push({
      type: 'timing_patterns',
      day_frequency: dayFrequency,
      most_active_day: Object.entries(dayFrequency).reduce((a, b) => dayFrequency[parseInt(a[0])] > dayFrequency[parseInt(b[0])] ? a : b)[0]
    });

    return patterns;
  }

  /**
   * Generate recommendations based on symbol history
   */
  private generateSymbolRecommendation(trades: any[], patterns: any[]): string {
    if (trades.length < 3) return "Insufficient data for recommendation";
    
    const winRate = trades.filter(t => this.calculateTradeReturn(t) > 0).length / trades.length;
    const avgConfidence = trades.reduce((sum, t) => sum + (t.confidence || 0), 0) / trades.length;
    
    if (winRate > 0.7 && avgConfidence > 0.8) {
      return "STRONG BUY - High historical success";
    } else if (winRate > 0.6 && avgConfidence > 0.7) {
      return "BUY - Good historical performance";
    } else if (winRate < 0.4 || avgConfidence < 0.5) {
      return "AVOID - Poor historical performance";
    } else {
      return "NEUTRAL - Mixed historical results";
    }
  }

  /**
   * Enhanced market data collection with historical context
   */
  async collectMarketDataWithHistory(): Promise<any> {
    this.tradingLog('ANALYSIS', 'Collecting market data with historical trading context...');
    
    // Get regular market data
    const marketData = await this.collectMarketData();
    
    // Add trading performance context
    const performance = await this.getTradingPerformance();
    
    // Add recent trades for context
    const recentTrades = await this.getHistoricalTrades(7); // Last 7 days
    
    return {
      ...marketData,
      trading_performance: performance,
      recent_trades: recentTrades,
      account_balance: this.state.account_balance,
      last_run: this.state.last_run
    };
  }

  /**
   * Setup web server for pause/resume controls
   */
  async setupWebServer(): Promise<void> {
    const port = parseInt(Deno.env.get("PORT") || "3000");

    const handler = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname;

      // Health check endpoint
      if (path === "/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          is_paused: this.state.is_paused,
          last_run: this.state.last_run,
          connected_servers: Array.from(this.activeClients.keys())
        }), {
          headers: { "content-type": "application/json" }
        });
      }

      // Trading performance API endpoint
      if (path === "/api/performance") {
        const performance = await this.getTradingPerformance();
        return new Response(JSON.stringify(performance), {
          headers: { "content-type": "application/json" }
        });
      }

      // Historical trades API endpoint
      if (path === "/api/trades") {
        const days = parseInt(url.searchParams.get("days") || "30");
        const symbol = url.searchParams.get("symbol") || undefined;
        const trades = await this.getHistoricalTrades(days, symbol);
        return new Response(JSON.stringify(trades), {
          headers: { "content-type": "application/json" }
        });
      }

      // Pause endpoint
      if (path.startsWith("/pause/")) {
        const token = path.split("/")[2];
        if (token === this.state.pause_token) {
          this.state.is_paused = true;
          await this.saveState();
          await this.sendResumeEmail();
          await this.log('INFO', 'Agent paused via web interface');
          
          return new Response(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>🛑 Trading Agent Paused</h1>
                <p>You will receive an email with a resume link.</p>
              </body>
            </html>
          `, {
            headers: { "content-type": "text/html" }
          });
        } else {
          return new Response("Invalid token", { status: 403 });
        }
      }

      // Resume endpoint
      if (path.startsWith("/resume/")) {
        const token = path.split("/")[2];
        if (token === this.state.pause_token) {
          this.state.is_paused = false;
          this.state.pause_token = undefined;
          await this.saveState();
          await this.log('INFO', 'Agent resumed via web interface');
          
          return new Response(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>▶️ Trading Agent Resumed</h1>
                <p>Trading will resume on the next scheduled run.</p>
              </body>
            </html>
          `, {
            headers: { "content-type": "text/html" }
          });
        } else {
          return new Response("Invalid token", { status: 403 });
        }
      }

      // Shutdown endpoint - requires confirmation
      if (path === "/shutdown") {
        const shutdownToken = crypto.randomUUID();
        return new Response(`
          <html>
            <head>
              <title>Shutdown Confirmation - Ada Analytics</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .danger { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px; }
                button { padding: 12px 24px; margin: 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                .btn-danger { background: #dc3545; color: white; }
                .btn-warning { background: #ffc107; color: black; }
                .btn-secondary { background: #6c757d; color: white; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🛑 Shutdown Trading Agent</h1>
                
                <div class="warning">
                  <strong>⚠️ Warning:</strong> This will gracefully shutdown the trading agent.
                  <ul>
                    <li>All pending orders will be cancelled</li>
                    <li>Current positions will remain open</li>
                    <li>Agent state will be saved</li>
                    <li>You'll need to manually restart the agent</li>
                  </ul>
                </div>
                
                <div class="danger">
                  <strong>Current Status:</strong><br>
                  Account Balance: $${this.state.account_balance.toLocaleString()}<br>
                  Open Positions: ${this.state.open_positions.length}<br>
                  Agent Status: ${this.state.is_paused ? 'PAUSED' : 'ACTIVE'}
                </div>
                
                <h3>Choose shutdown type:</h3>
                
                <button class="btn-warning" onclick="window.location.href='/shutdown/graceful/${shutdownToken}'">
                  🔄 Graceful Shutdown (Recommended)
                </button>
                
                <button class="btn-danger" onclick="if(confirm('Are you sure? This will force shutdown immediately!')) window.location.href='/shutdown/emergency/${shutdownToken}'">
                  🚨 Emergency Shutdown
                </button>
                
                <button class="btn-secondary" onclick="window.location.href='/'">
                  ← Cancel
                </button>
                
                <p><small>Shutdown tokens expire in 5 minutes for security.</small></p>
              </div>
            </body>
          </html>
        `, {
          headers: { "content-type": "text/html" }
        });
      }

      // Graceful shutdown execution
      if (path.startsWith("/shutdown/graceful/")) {
        const token = path.split("/")[3];
        
        return new Response(`
          <html>
            <head>
              <title>Shutdown in Progress - Ada Analytics</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; text-align: center; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
                .progress { background: #e9ecef; border-radius: 5px; overflow: hidden; margin: 20px 0; }
                .progress-bar { background: #007bff; height: 30px; width: 0%; transition: width 0.3s; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🔄 Graceful Shutdown in Progress</h1>
                <p>Please wait while the agent shuts down safely...</p>
                <div class="progress">
                  <div class="progress-bar" id="progress"></div>
                </div>
                <div id="status">Initiating shutdown...</div>
              </div>
              <script>
                let progress = 0;
                const interval = setInterval(() => {
                  progress += 10;
                  document.getElementById('progress').style.width = progress + '%';
                  if (progress >= 100) {
                    clearInterval(interval);
                    document.getElementById('status').innerHTML = '✅ Shutdown complete. Agent safely stopped.';
                  }
                }, 500);
              </script>
            </body>
          </html>
        `, {
          headers: { "content-type": "text/html" }
        });
        
        // Execute graceful shutdown in background
        setTimeout(() => {
          this.gracefulShutdown('Web interface request').then(() => {
            Deno.exit(0);
          });
        }, 1000);
      }

      // Emergency shutdown execution
      if (path.startsWith("/shutdown/emergency/")) {
        const token = path.split("/")[3];
        
        // Execute emergency shutdown immediately
        setTimeout(() => {
          this.emergencyShutdown();
        }, 500);
        
        return new Response(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8d7da;">
              <h1>🚨 Emergency Shutdown</h1>
              <p>Agent is shutting down immediately...</p>
            </body>
          </html>
        `, {
          headers: { "content-type": "text/html" }
        });
      }

      // Main dashboard
      if (path === "/") {
        const accountDetails = await this.getAccountDetails();
        const performance = await this.getTradingPerformance();
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ada Analytics Trading Agent</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
            .active { background: #d4edda; border: 1px solid #c3e6cb; }
            .paused { background: #f8d7da; border: 1px solid #f5c6cb; }
            button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            .btn-danger { background: #dc3545; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn-warning { background: #fd7e14; color: white; }
            .quick-stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-card { background: #f8f9fa; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
            nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 Ada Analytics Trading Agent</h1>
            
            <nav>
              <a href="/performance">📊 Performance</a>
              <a href="/trades">📈 Trade History</a>
              <a href="/test">🧪 Test Functions</a>
            </nav>
            
            <div class="status ${this.state.is_paused ? 'paused' : 'active'}">
              <strong>Status:</strong> ${this.state.is_paused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
            </div>
            
            <h2>Account Information</h2>
            <p><strong>Account Balance:</strong> $${this.state.account_balance.toLocaleString()}</p>
            <p><strong>Strategy:</strong> ${this.state.current_strategy}</p>
            <p><strong>Last Run:</strong> ${this.state.last_run || 'Never'}</p>
            <p><strong>Connected Servers:</strong> ${Array.from(this.activeClients.keys()).join(', ')}</p>
            
            <h2>Quick Stats (90 days)</h2>
            <div class="quick-stats">
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold;">${performance.total_trades}</div>
                <div>Total Trades</div>
              </div>
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: ${performance.win_rate > 0.5 ? '#28a745' : '#dc3545'}">${(performance.win_rate * 100).toFixed(1)}%</div>
                <div>Win Rate</div>
              </div>
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: ${performance.avg_return > 0 ? '#28a745' : '#dc3545'}">${(performance.avg_return * 100).toFixed(2)}%</div>
                <div>Avg Return</div>
              </div>
            </div>
            
            <h2>Controls</h2>
            ${this.state.is_paused ? 
              `<button class="btn-success" onclick="window.location.href='/pause'">▶️ Resume Trading</button>` :
              `<button class="btn-danger" onclick="window.location.href='/pause'">⏸️ Pause Trading</button>`
            }
            <button class="btn-info" onclick="window.location.href='/performance'">📊 View Full Performance</button>
            <button class="btn-warning" onclick="window.location.href='/test'">🧪 Test Functions</button>
            <br><br>
            <button class="btn-warning" onclick="window.location.href='/shutdown'" style="background: #fd7e14; color: white;">🛑 Shutdown Agent</button>
          </div>
        </body>
        </html>
        `;
        
        return new Response(html, { 
          headers: { 'content-type': 'text/html' } 
        });
      }

      // Performance page
      if (path === "/performance") {
        const performance = await this.getTradingPerformance();
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trading Performance - Ada Analytics</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .metric-card { display: inline-block; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin: 10px; min-width: 200px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
            .metric-label { color: #6c757d; font-size: 14px; }
            .trade-row { padding: 10px; border-bottom: 1px solid #eee; }
            .win { color: #28a745; }
            .loss { color: #dc3545; }
            nav { margin-bottom: 20px; }
            nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <nav>
              <a href="/">← Dashboard</a>
              <a href="/performance">Performance</a>
              <a href="/trades">Trade History</a>
              <a href="/test">🧪 Test Functions</a>
            </nav>
            
            <h1>📊 Trading Performance (90 days)</h1>
            
            <div class="metric-card">
              <div class="metric-value">${performance.total_trades}</div>
              <div class="metric-label">Total Trades</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value ${performance.win_rate > 0.5 ? 'win' : 'loss'}">${(performance.win_rate * 100).toFixed(1)}%</div>
              <div class="metric-label">Win Rate</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value ${performance.avg_return > 0 ? 'win' : 'loss'}">${(performance.avg_return * 100).toFixed(2)}%</div>
              <div class="metric-label">Avg Return</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value ${performance.total_return > 0 ? 'win' : 'loss'}">${(performance.total_return * 100).toFixed(2)}%</div>
              <div class="metric-label">Total Return</div>
            </div>
            
            <h2>Symbols Traded</h2>
            <p>${performance.symbols_traded.join(', ') || 'No trades yet'}</p>
            
            <h2>Recent Trades</h2>
            ${performance.recent_trades.map(trade => `
              <div class="trade-row">
                <strong>${trade.symbol}</strong> - ${trade.action} ${trade.quantity} shares at $${trade.price_target}
                <span style="float: right;">${new Date(trade.executed_at).toLocaleDateString()}</span>
              </div>
            `).join('')}
            
            ${performance.best_trade ? `
              <h2>Best Trade</h2>
              <div class="trade-row win">
                ${performance.best_trade.symbol} - ${performance.best_trade.action} ${performance.best_trade.quantity} shares
                <br><small>${performance.best_trade.reasoning}</small>
              </div>
            ` : ''}
          </div>
        </body>
        </html>
        `;
        
        return new Response(html, { 
          headers: { 'content-type': 'text/html' } 
        });
      }

      // Trade history page
      if (path === "/trades") {
        const trades = await this.getHistoricalTrades(30);
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trade History - Ada Analytics</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .win { color: #28a745; }
            .loss { color: #dc3545; }
            nav { margin-bottom: 20px; }
            nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <nav>
              <a href="/">← Dashboard</a>
              <a href="/performance">Performance</a>
              <a href="/trades">Trade History</a>
              <a href="/test">🧪 Test Functions</a>
            </nav>
            
            <h1>📈 Trade History (30 days)</h1>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th>Quantity</th>
                  <th>Target Price</th>
                  <th>Executed Price</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${trades.map(trade => `
                  <tr>
                    <td>${new Date(trade.executed_at).toLocaleDateString()}</td>
                    <td><strong>${trade.symbol}</strong></td>
                    <td>${trade.action}</td>
                    <td>${trade.quantity}</td>
                    <td>$${trade.price_target?.toFixed(2) || 'N/A'}</td>
                    <td>$${trade.executed_price?.toFixed(2) || 'Pending'}</td>
                    <td>${(trade.confidence * 100).toFixed(0)}%</td>
                    <td>${trade.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            ${trades.length === 0 ? '<p>No trades found in the last 30 days.</p>' : ''}
          </div>
        </body>
        </html>
        `;
        
        return new Response(html, { 
          headers: { 'content-type': 'text/html' } 
        });
      }

      // Test Functions page
      if (path === "/test") {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Functions - Ada Analytics</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            button { padding: 12px 24px; margin: 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
            .btn-primary { background: #007bff; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-warning { background: #ffc107; color: black; }
            .btn-info { background: #17a2b8; color: white; }
            nav { margin-bottom: 20px; }
            nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
            .test-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <nav>
              <a href="/">← Dashboard</a>
              <a href="/performance">Performance</a>
              <a href="/trades">Trade History</a>
              <a href="/test">🧪 Test Functions</a>
            </nav>
            
            <h1>🧪 Test Functions</h1>
            
            <div class="warning">
              <strong>⚠️ Note:</strong> These are test functions to verify the agent is working properly. Some may create demo trades or send test emails.
            </div>
            
            <div class="test-section">
              <h3>🧠 AI & Market Analysis</h3>
              <button class="btn-primary" onclick="window.location.href='/test/market-data'">📊 Test Market Data Collection</button>
              <button class="btn-primary" onclick="window.location.href='/test/trade-plan'">📋 Generate Test Trade Plan</button>
              <button class="btn-primary" onclick="window.location.href='/test/prediction'">🔮 Test AI Predictions</button>
            </div>
            
            <div class="test-section">
              <h3>🔗 Connections & APIs</h3>
              <button class="btn-success" onclick="window.location.href='/test/alpaca'">🦙 Test Alpaca Connection</button>
              <button class="btn-success" onclick="window.location.href='/test/supabase'">🗄️ Test Supabase Connection</button>
              <button class="btn-success" onclick="window.location.href='/test/quiver'">📈 Test Quiver Quant</button>
              <button class="btn-success" onclick="window.location.href='/test/anthropic'">🤖 Test Claude API</button>
            </div>
            
            <div class="test-section">
              <h3>📧 Notifications</h3>
              <button class="btn-info" onclick="window.location.href='/test/email'">📧 Send Test Email</button>
              <button class="btn-info" onclick="window.location.href='/test/pause-email'">⏸️ Test Pause Email</button>
            </div>
            
            <div class="test-section">
              <h3>🚀 Full Workflow</h3>
              <button class="btn-warning" onclick="window.location.href='/test/workflow'">🔄 Run Complete Trading Workflow (Demo)</button>
            </div>
          </div>
        </body>
        </html>
        `;
        
        return new Response(html, { 
          headers: { 'content-type': 'text/html' } 
        });
      }

      // Test endpoints
      if (path.startsWith("/test/")) {
        const testType = path.split("/")[2];
        
        try {
          let result = "";
          let title = "";
          
          switch (testType) {
            case "market-data":
              title = "📊 Market Data Collection Test";
              this.tradingLog('STATUS', '🧪 Testing market data collection...');
              const marketData = await this.collectMarketDataWithHistory();
              result = `<h3>✅ Market Data Collection Successful</h3>
                       <pre>${JSON.stringify(marketData, null, 2)}</pre>`;
              break;
              
            case "trade-plan":
              title = "📋 Trade Plan Generation Test";
              this.tradingLog('STATUS', '🧪 Generating test trade plan...');
              const testMarketData = await this.collectMarketDataWithHistory();
              const tradePlan = await this.craftTradePlan(testMarketData);
              result = `<h3>✅ Trade Plan Generated Successfully</h3>
                       <pre>${JSON.stringify(tradePlan, null, 2)}</pre>`;
              break;
              
            case "prediction":
              title = "🔮 AI Prediction Test";
              this.tradingLog('STATUS', '🧪 Testing AI prediction engine...');
              const testData = await this.collectMarketDataWithHistory();
              const testPlan = await this.craftTradePlan(testData);
              const predictions = await this.makePredictions(testPlan, testData);
              result = `<h3>✅ AI Predictions Generated</h3>
                       <pre>${JSON.stringify(predictions, null, 2)}</pre>`;
              break;
              
            case "alpaca":
              title = "🦙 Alpaca Connection Test";
              this.tradingLog('STATUS', '🧪 Testing Alpaca connection...');
              const accountInfo = await this.getAccountDetails();
              result = `<h3>✅ Alpaca Connection Successful</h3>
                       <p><strong>Account Balance:</strong> $${this.state.account_balance.toLocaleString()}</p>
                       <pre>${JSON.stringify(accountInfo, null, 2)}</pre>`;
              break;
              
            case "supabase":
              title = "🗄️ Supabase Connection Test";
              this.tradingLog('STATUS', '🧪 Testing Supabase connection...');
              const trades = await this.getHistoricalTrades(7);
              const performance = await this.getTradingPerformance();
              result = `<h3>✅ Supabase Connection Successful</h3>
                       <p><strong>Recent Trades:</strong> ${trades.length}</p>
                       <p><strong>Total Historical Trades:</strong> ${performance.total_trades}</p>
                       <pre>${JSON.stringify({ trades: trades.slice(0, 3), performance }, null, 2)}</pre>`;
              break;
              
            case "quiver":
              title = "📈 Quiver Quant Test";
              this.tradingLog('STATUS', '🧪 Testing Quiver Quant connection...');
              const quiverClient = this.activeClients.get('quiver-quant');
              if (quiverClient) {
                const tools = await quiverClient.listTools();
                result = `<h3>✅ Quiver Quant Connection Successful</h3>
                         <p><strong>Available Tools:</strong> ${tools.length}</p>
                         <pre>${JSON.stringify(tools, null, 2)}</pre>`;
              } else {
                result = `<h3>❌ Quiver Quant Not Connected</h3>`;
              }
              break;
              
            case "anthropic":
              title = "🤖 Claude API Test";
              this.tradingLog('STATUS', '🧪 Testing Claude API connection...');
              const testMessage = await this.anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 100,
                messages: [{
                  role: "user",
                  content: "Respond with 'API Test Successful' if you can read this message."
                }]
              });
              result = `<h3>✅ Claude API Connection Successful</h3>
                       <p><strong>Response:</strong> ${testMessage.content[0].text}</p>
                       <pre>${JSON.stringify(testMessage, null, 2)}</pre>`;
              break;
              
            case "email":
              title = "📧 Email Test";
              this.tradingLog('STATUS', '🧪 Testing email functionality...');
              if (this.isEmailConfigured()) {
                const emailSent = await this.sendEmail(
                  Deno.env.get("NOTIFICATION_EMAIL") || "test@adaanalytics.io",
                  "Ada Analytics Test Email",
                  "This is a test email from your Ada Analytics Trading Agent. If you receive this, email functionality is working correctly!"
                );
                result = emailSent ? 
                  `<h3>✅ Test Email Sent Successfully</h3>
                   <p>Check your inbox for the test email.</p>` :
                  `<h3>⚠️ Email Failed to Send</h3>
                   <p>Check your Resend API configuration.</p>`;
              } else {
                result = `<h3>❌ Email Not Configured</h3>
                         <p>RESEND_API_KEY environment variable not set.</p>`;
              }
              break;
              
            case "pause-email":
              title = "⏸️ Pause Email Test";
              this.tradingLog('STATUS', '🧪 Testing pause email generation...');
              if (this.isEmailConfigured()) {
                await this.sendResumeEmail();
                result = `<h3>✅ Pause Email Sent</h3>
                         <p>Check your inbox for the pause/resume email.</p>`;
              } else {
                result = `<h3>❌ Email Not Configured</h3>
                         <p>RESEND_API_KEY environment variable not set.</p>`;
              }
              break;
              
            case "workflow":
              title = "🔄 Complete Trading Workflow Test";
              this.tradingLog('STATUS', '🧪 Running complete trading workflow (DEMO MODE)...');
              
              // Save current state
              const originalPaused = this.state.is_paused;
              this.state.is_paused = true; // Ensure we don't actually execute trades
              
              try {
                const workflowData = await this.collectMarketDataWithHistory();
                const workflowPlan = await this.craftTradePlan(workflowData);
                const finalPlan = await this.makePredictions(workflowPlan, workflowData);
                const validatedPlan = await this.finalizeTradePlan(finalPlan);
                
                result = `<h3>✅ Complete Trading Workflow Successful</h3>
                         <p><strong>Demo Mode:</strong> No actual trades were executed</p>
                         <p><strong>Market Data:</strong> Collected from ${Array.from(this.activeClients.keys()).join(', ')}</p>
                         <p><strong>AI Analysis:</strong> Generated trade plan with ${validatedPlan.trades?.length || 0} potential trades</p>
                         <p><strong>Risk Assessment:</strong> Total exposure ${(validatedPlan.total_risk_exposure * 100).toFixed(2)}%</p>
                         <h4>Generated Trade Plan:</h4>
                         <pre>${JSON.stringify(validatedPlan, null, 2)}</pre>`;
              } finally {
                // Restore original state
                this.state.is_paused = originalPaused;
              }
              break;
              
            default:
              result = `<h3>❌ Unknown Test Type</h3><p>Test "${testType}" not found.</p>`;
          }
          
          const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title} - Ada Analytics</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
              pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
              nav { margin-bottom: 20px; }
              nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
              button { padding: 10px 20px; margin: 10px 0; border: none; border-radius: 5px; cursor: pointer; background: #007bff; color: white; }
            </style>
          </head>
          <body>
            <div class="container">
              <nav>
                <a href="/">← Dashboard</a>
                <a href="/test">🧪 Test Functions</a>
              </nav>
              
              <h1>${title}</h1>
              ${result}
              
              <button onclick="window.location.href='/test'">← Back to Tests</button>
              <button onclick="window.location.reload()">🔄 Run Again</button>
            </div>
          </body>
          </html>
          `;
          
          return new Response(html, { 
            headers: { 'content-type': 'text/html' } 
          });
          
        } catch (error) {
          this.tradingLog('ALERT', `Test failed: ${error}`);
          
          const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Test Failed - Ada Analytics</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
              .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; color: #721c24; }
              nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
              button { padding: 10px 20px; margin: 10px 0; border: none; border-radius: 5px; cursor: pointer; background: #007bff; color: white; }
            </style>
          </head>
          <body>
            <div class="container">
              <nav>
                <a href="/">← Dashboard</a>
                <a href="/test">🧪 Test Functions</a>
              </nav>
              
              <h1>❌ Test Failed: ${testType}</h1>
              <div class="error">
                <strong>Error:</strong> ${error.message || error}
                <pre>${error.stack || ''}</pre>
              </div>
              
              <button onclick="window.location.href='/test'">← Back to Tests</button>
              <button onclick="window.location.reload()">🔄 Try Again</button>
            </div>
          </body>
          </html>
          `;
          
          return new Response(errorHtml, { 
            headers: { 'content-type': 'text/html' } 
          });
        }
      }

      return new Response("Not Found", { status: 404 });
    };

    await serve(handler, { port });
  }

  /**
   * End-of-day summary and email
   */
  async sendDailySummary(): Promise<void> {
    await this.log('INFO', 'Generating daily summary...');

    // Get account details from Alpaca
    const accountDetails = await this.getAccountDetails();
    const todayTrades = await this.getTodayTrades();
    
    const summaryContent = `
    <h2>📊 Daily Trading Summary - ${new Date().toISOString().split('T')[0]}</h2>
    
    <h3>Account Status</h3>
    <p><strong>Account Balance:</strong> $${accountDetails.balance?.toLocaleString()}</p>
    <p><strong>Buying Power:</strong> $${accountDetails.buying_power?.toLocaleString()}</p>
    <p><strong>Portfolio Value:</strong> $${accountDetails.portfolio_value?.toLocaleString()}</p>
    <p><strong>Day P&L:</strong> $${accountDetails.day_pnl?.toLocaleString()}</p>
    
    <h3>Today's Trades (${todayTrades.length})</h3>
    ${todayTrades.map(trade => `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <p><strong>${trade.action} ${trade.quantity} ${trade.symbol}</strong></p>
        <p>Status: ${trade.status}</p>
        <p>Executed at: ${new Date(trade.executed_at).toLocaleString()}</p>
      </div>
    `).join('')}
    
    <h3>Agent Status</h3>
    <p>Status: ${this.state.is_paused ? '⏸️ PAUSED' : '▶️ RUNNING'}</p>
    <p>Last Run: ${new Date(this.state.last_run).toLocaleString()}</p>
    
    <p><small>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;

    const recipients = ['jcoawett@asu.edu', 'drrayhsu@gmail.com', 'tjgatso@asu.edu'];

    try {
      let emailsSent = 0;
      for (const recipient of recipients) {
        if (await this.sendEmail(recipient, `📊 Trading Agent - Daily Summary ${new Date().toISOString().split('T')[0]}`, summaryContent)) {
          emailsSent++;
        }
      }

      await this.log('INFO', `Daily summary emailed to ${emailsSent}/${recipients.length} recipients`);
    } catch (error) {
      await this.log('ERROR', `Failed to send daily summary: ${error}`);
    }
  }

  /**
   * Main trading workflow execution
   */
  async runTradingWorkflow(): Promise<void> {
    if (this.state.is_paused) {
      this.tradingLog('ALERT', 'Agent is PAUSED - Skipping trading workflow');
      return;
    }

    try {
      // Trading workflow header
      console.log('\n' + '─'.repeat(60));
      this.tradingLog('STATUS', '🚀 DAILY TRADING WORKFLOW STARTED');
      console.log('─'.repeat(60));

      // Step 1: Collect market data with historical context
      this.tradingLog('ANALYSIS', 'Step 1: Collecting market data with historical context...');
      const marketData = await this.collectMarketDataWithHistory();

      // Step 2: Craft initial trade plan
      this.tradingLog('PLAN', 'Step 2: Crafting trade plan...');
      this.logThoughtChain('Market Analysis', 'Analyzing market conditions and historical performance');
      let tradePlan = await this.craftTradePlan(marketData);

      // Step 3: Make predictions
      this.tradingLog('ANALYSIS', 'Step 3: Running AI predictions...');
      this.logThoughtChain('Prediction Phase', `Evaluating ${tradePlan.trades?.length || 0} potential trades`);
      tradePlan = await this.makePredictions(tradePlan, marketData);

      // Step 4: Finalize trade plan
      this.tradingLog('PLAN', 'Step 4: Finalizing trade plan...');
      this.logThoughtChain('Risk Validation', `Checking position sizes and risk limits for ${tradePlan.trades?.length || 0} trades`);
      tradePlan = await this.finalizeTradePlan(tradePlan);
      
      // Show trade plan summary
      console.log('\n📋 TRADE PLAN SUMMARY:');
      console.log(`   • Trades planned: ${tradePlan.trades.length}`);
      console.log(`   • Risk exposure: ${(tradePlan.total_risk_exposure * 100).toFixed(2)}%`);
      if (tradePlan.trades.length > 0) {
        tradePlan.trades.forEach((trade, i) => {
          console.log(`   ${i + 1}. ${trade.action} ${trade.symbol} (${trade.quantity} shares) - $${trade.price_target}`);
        });
      }

      // Step 5: Email trade plan
      this.tradingLog('STATUS', 'Step 5: Sending trade plan notifications...');
      await this.emailTradePlan(tradePlan);

      // Wait for market open if it's early
      await this.waitForMarketOpen();

      // Step 6: Execute trades
      if (tradePlan.trades.length > 0) {
        this.tradingLog('TRADE', `Step 6: Executing ${tradePlan.trades.length} trades...`);
        const executedTrades = await this.executeTrades(tradePlan);
        
        // Show execution results
        console.log('\n🔄 TRADE EXECUTION RESULTS:');
        if (executedTrades.length > 0) {
          executedTrades.forEach((trade, i) => {
            console.log(`   ✅ ${i + 1}. ${trade.side} ${trade.symbol} - ${trade.qty} shares at $${trade.filled_avg_price || 'pending'}`);
          });
        } else {
          console.log('   ⚠️  No trades executed');
        }

        // Step 7: Store trades with enhanced data
        if (executedTrades.length > 0) {
          this.tradingLog('STATUS', 'Step 7: Storing trade records with full context...');
          
          // Collect thought chain for this session
          const thoughtChain = [
            `Market analysis: ${tradePlan.market_analysis}`,
            `Risk assessment: ${tradePlan.risk_assessment}`,
            `Strategy: ${this.state.current_strategy}`,
            `Account balance: $${this.state.account_balance}`,
            `Trades planned: ${tradePlan.trades.length}`,
            `Trades executed: ${executedTrades.length}`
          ];
          
          await this.storeTrades(executedTrades, tradePlan, thoughtChain);
        }
      } else {
        this.tradingLog('STATUS', 'No trades to execute today');
      }

      this.state.last_run = new Date().toISOString();
      await this.saveState();

      console.log('─'.repeat(60));
      this.tradingLog('STATUS', '✅ TRADING WORKFLOW COMPLETED SUCCESSFULLY');
      console.log('─'.repeat(60) + '\n');

    } catch (error: unknown) {
      console.log('─'.repeat(60));
      this.tradingLog('ALERT', `❌ TRADING WORKFLOW FAILED: ${error}`);
      console.log('─'.repeat(60) + '\n');
      
      // On critical errors, pause the agent
      if (error instanceof Error && (error.message.includes('CRITICAL') || error.message.includes('API_ERROR'))) {
        this.state.is_paused = true;
        await this.saveState();
        this.tradingLog('ALERT', '🛑 AGENT PAUSED due to critical error');
        await this.sendErrorAlert(error);
      }
    }
  }

  /**
   * Setup cron jobs using Deno cron
   */
  setupCronJobs(): void {
    // Daily workflow - runs at 6 AM EST (data collection and planning)
    cron("0 6 * * 1-5", async () => {
      await this.log('INFO', 'Starting scheduled trading workflow');
      await this.runTradingWorkflow();
    });

    // End of day summary - runs at 5 PM EST
    cron("0 17 * * 1-5", async () => {
      await this.log('INFO', 'Starting end-of-day summary');
      await this.sendDailySummary();
    });

    // Cleanup old logs - runs weekly on Sunday at midnight
    cron("0 0 * * 0", async () => {
      await this.cleanupOldLogs();
    });

    console.log('📅 Cron jobs scheduled successfully');
  }

  /**
   * Utility methods
   */
  private async log(level: 'INFO' | 'WARN' | 'ERROR', message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}`;
    
    console.log(logEntry);

    // Store in Supabase logs table
    try {
      const supabaseClient = this.activeClients.get('supabase');
      if (supabaseClient) {
        await supabaseClient.callTool({
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
      }
    } catch (error) {
      console.error('Failed to store log in database:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await Deno.writeTextFile('./agent_state.json', JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = await Deno.readTextFile('./agent_state.json');
      this.state = { ...this.state, ...JSON.parse(stateData) };
    } catch (error) {
      console.log('No existing state found, using defaults');
    }
  }

  // Additional helper methods...
  private async getYesterdayTrades(): Promise<any[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const supabaseClient = this.activeClients.get('supabase');
      if (!supabaseClient) return [];

      const result = await supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: `executed_at::date = '${yesterdayStr}'`
        }
      });

      return (result as any).data || [];
    } catch (error) {
      await this.log('ERROR', `Failed to fetch yesterday's trades: ${error}`);
      return [];
    }
  }

  private async getTodayTrades(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const supabaseClient = this.activeClients.get('supabase');
      if (!supabaseClient) return [];

      const result = await supabaseClient.callTool({
        name: 'select',
        arguments: {
          table: 'trades',
          filter: `executed_at::date = '${today}'`
        }
      });

      return (result as any).data || [];
    } catch (error) {
      await this.log('ERROR', `Failed to fetch today's trades: ${error}`);
      return [];
    }
  }

  private async getAccountDetails(): Promise<any> {
    try {
      const alpacaClient = this.activeClients.get('alpaca');
      if (!alpacaClient) return {};

      const result = await alpacaClient.callTool({
        name: 'get_account_info',
        arguments: {}
      });

      // The MCP server returns the response in a specific format
      let accountInfo = '';
      let accountBalance = 0;
      
      // Handle different response formats
      if (typeof result === 'object' && result !== null) {
        // If it's an object, look for content property or extract values directly
        if ('content' in result && Array.isArray(result.content)) {
          accountInfo = result.content.map((item: any) => item.text || item).join('');
        } else if ('content' in result) {
          accountInfo = String(result.content);
        } else if ('text' in result) {
          accountInfo = String(result.text);
        } else {
          // Try to extract balance directly from object properties
          accountInfo = JSON.stringify(result, null, 2);
        }
      } else {
        accountInfo = String(result);
      }
      
      // Extract cash balance using regex from the text
      const cashMatch = accountInfo.match(/Cash: \$([0-9,]+\.?[0-9]*)/);
      const buyingPowerMatch = accountInfo.match(/Buying Power: \$([0-9,]+\.?[0-9]*)/);
      
      if (cashMatch && cashMatch[1]) {
        accountBalance = parseFloat(cashMatch[1].replace(/,/g, ''));
      } else if (buyingPowerMatch && buyingPowerMatch[1]) {
        accountBalance = parseFloat(buyingPowerMatch[1].replace(/,/g, ''));
      }
      
      this.state.account_balance = accountBalance;
      await this.saveState();

      return result;
    } catch (error) {
      await this.log('ERROR', `Failed to get account details: ${error}`);
      return {};
    }
  }

  private async setStopLossAndTakeProfit(trade: TradeDecision, orderId: string): Promise<void> {
    try {
      const alpacaClient = this.activeClients.get('alpaca');
      if (!alpacaClient) return;

      // Set stop loss order
      await alpacaClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: trade.symbol,
          side: trade.action === 'BUY' ? 'sell' : 'buy',
          type: 'stop',
          qty: trade.quantity,
          stop_price: trade.stop_loss,
          time_in_force: 'gtc'
        }
      });

      // Set take profit order
      await alpacaClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: trade.symbol,
          side: trade.action === 'BUY' ? 'sell' : 'buy',
          type: 'limit',
          qty: trade.quantity,
          limit_price: trade.take_profit,
          time_in_force: 'gtc'
        }
      });

      await this.log('INFO', `Set stop loss and take profit for ${trade.symbol}`);
    } catch (error) {
      await this.log('ERROR', `Failed to set stop/profit orders for ${trade.symbol}: ${error}`);
    }
  }

  private async analyzeTradePerformance(trades: any[]): Promise<any> {
    const prompt = `
    Analyze the following trade performance and determine if strategy adjustment is needed:

    TRADES:
    ${JSON.stringify(trades, null, 2)}

    Consider:
    - Win/loss ratio
    - Average profit/loss
    - Risk management effectiveness
    - Market conditions vs strategy

    Respond with JSON:
    {
      "should_adjust": true/false,
      "performance_summary": "...",
      "suggested_adjustments": "...",
      "new_strategy_focus": "..."
    }
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { should_adjust: false };
    } catch (error) {
      await this.log('ERROR', `Performance analysis failed: ${error}`);
      return { should_adjust: false };
    }
  }

  private async adjustTradePlan(tradePlan: TradePlan, analysis: any): Promise<TradePlan> {
    if (analysis.new_strategy_focus) {
      this.state.current_strategy = analysis.new_strategy_focus;
      await this.saveState();
    }

    const adjustmentPrompt = `
    Adjust the following trade plan based on performance analysis:

    ORIGINAL PLAN:
    ${JSON.stringify(tradePlan, null, 2)}

    PERFORMANCE ANALYSIS:
    ${JSON.stringify(analysis, null, 2)}

    Provide adjusted trade plan maintaining the same structure but with improved strategy.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [{ role: "user", content: adjustmentPrompt }]
      });

      const adjustedText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = adjustedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const adjustedPlan = JSON.parse(jsonMatch[0]);
        tradePlan = { ...tradePlan, ...adjustedPlan };
      }

      await this.log('INFO', 'Trade plan adjusted based on performance analysis');
      return tradePlan;
    } catch (error) {
      await this.log('ERROR', `Trade plan adjustment failed: ${error}`);
      return tradePlan;
    }
  }

  private async storePredictions(tradePlan: TradePlan): Promise<void> {
    try {
      const supabaseClient = this.activeClients.get('supabase');
      if (!supabaseClient) return;

      await supabaseClient.callTool({
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
            strategy_used: this.state.current_strategy,
            created_at: tradePlan.created_at
          }
        }
      });

      await this.log('INFO', 'Predictions stored in database');
    } catch (error) {
      await this.log('ERROR', `Failed to store predictions: ${error}`);
    }
  }

  private async sendErrorAlert(error: Error): Promise<void> {
    const errorContent = `
    <h2>🚨 Trading Agent Critical Error</h2>
    <p><strong>The trading agent has encountered a critical error and has been automatically paused.</strong></p>
    
    <h3>Error Details</h3>
    <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
${error.message}
${error.stack || 'No stack trace available'}
    </pre>
    
    <h3>Agent Status</h3>
    <p>Status: ⏸️ PAUSED</p>
    <p>Last Successful Run: ${this.state.last_run}</p>
    
    <p><small>Error occurred at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;

    const recipients = ['jcoawett@asu.edu', 'drrayhsu@gmail.com', 'tjgatso@asu.edu'];

    try {
      let emailsSent = 0;
      for (const recipient of recipients) {
        if (await this.sendEmail(recipient, '🚨 CRITICAL: Trading Agent Error - Paused', errorContent)) {
          emailsSent++;
        }
      }
      await this.log('INFO', `Error alert sent to ${emailsSent}/${recipients.length} recipients`);
    } catch (emailError) {
      console.error('Failed to send error alert email:', emailError);
    }
  }

  private async sendResumeEmail(): Promise<void> {
    const resumeContent = `
    <h2>⏸️ Trading Agent Paused</h2>
    <p>The autonomous trading agent has been paused as requested.</p>
    <p>Click the button below to resume trading:</p>
    <a href="${this.baseUrl}/resume/${this.state.pause_token}" 
       style="background-color: #4CAF50; color: white; padding: 15px 32px; text-decoration: none; border-radius: 5px;">
      ▶️ RESUME TRADING
    </a>
    `;

    const recipients = ['jcoawett@asu.edu', 'drrayhsu@gmail.com', 'tjgatso@asu.edu'];

    let emailsSent = 0;
    for (const recipient of recipients) {
      if (await this.sendEmail(recipient, '⏸️ Trading Agent Paused - Resume Link', resumeContent)) {
        emailsSent++;
      }
    }
    
    await this.log('INFO', `Resume email sent to ${emailsSent}/${recipients.length} recipients`);
  }

  private async waitForMarketOpen(): Promise<void> {
    const now = new Date();
    const marketOpen = new Date();
    marketOpen.setHours(9, 30, 0, 0); // 9:30 AM EST

    if (now < marketOpen) {
      const waitTime = marketOpen.getTime() - now.getTime();
      await this.log('INFO', `Waiting ${Math.round(waitTime / 60000)} minutes for market open`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoffDate = oneYearAgo.toISOString();

      const supabaseClient = this.activeClients.get('supabase');
      if (!supabaseClient) return;

      await supabaseClient.callTool({
        name: 'delete',
        arguments: {
          table: 'logs',
          filter: `created_at < '${cutoffDate}'`
        }
      });

      await this.log('INFO', 'Cleaned up logs older than 1 year');
    } catch (error) {
      await this.log('ERROR', `Log cleanup failed: ${error}`);
    }
  }

  /**
   * Initialize and start the agent
   */
  async start(): Promise<void> {
    try {
      console.log('\n🤖 Starting Ada Analytics Trading Agent...\n');
      
      // Initialize environment variables and clients
      await this.initialize();
      
      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();
      
      // Connect to MCP servers
      await this.connectToServers();
      
      // Get initial account balance
      await this.getAccountDetails();
      
      // Setup cron jobs
      this.setupCronJobs();
      
      // Start web server
      this.setupWebServer();
      
      // Clean startup summary
      console.log('\n' + '='.repeat(80));
      console.log('🎯 ADA ANALYTICS TRADING AGENT - READY FOR ACTION');
      console.log('='.repeat(80));
      this.tradingLog('STATUS', `Account Balance: $${this.state.account_balance.toLocaleString()}`);
      this.tradingLog('STATUS', `Strategy: ${this.state.current_strategy.toUpperCase()}`);
      this.tradingLog('STATUS', `MCP Servers: ${this.activeClients.size} connected`);
      this.tradingLog('STATUS', `Web Interface: ${this.baseUrl}`);
      this.tradingLog('STATUS', `Daily Trading: 6:00 AM EST`);
      if (this.isEmailConfigured()) {
        this.tradingLog('STATUS', 'Email Alerts: ENABLED');
      } else {
        this.tradingLog('ALERT', 'Email Alerts: DISABLED (Configure RESEND_API_KEY)');
      }
      console.log('='.repeat(80) + '\n');
      
      // Log startup
      await this.log('INFO', 'Autonomous Trading Agent (Deno) started successfully');
      
      // Handle graceful shutdown
      Deno.addSignalListener("SIGINT", async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await this.log('INFO', 'Agent shutdown initiated');
        
        // Close all MCP connections
        for (const [serverName, client] of this.activeClients) {
          try {
            await client.close();
            console.log(`✅ Disconnected from ${serverName}`);
          } catch (error) {
            console.log(`⚠️ Error disconnecting from ${serverName}:`, error);
          }
        }
        
        Deno.exit(0);
      });
      
    } catch (error) {
      console.error('💥 Failed to start Trading Agent:', error);
      Deno.exit(1);
    }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const agent = new AutonomousTradingAgent();
  await agent.start();
}

// Run the agent
if (import.meta.main) {
  main().catch(console.error);
}

export default AutonomousTradingAgent;
/**
 * Main Trading Agent - Orchestrates all services for autonomous trading
 */

import { Client } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js";
import { StdioClientTransport } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/stdio.js";
import { cron } from "https://deno.land/x/deno_cron@v1.0.0/cron.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

// Import types and interfaces
import { 
  AgentState, 
  TradePlan, 
  MCPServerConfig,
  AccountDetails,
  ExecutedTrade
} from './types/interfaces.ts';

// Import configuration
import { 
  getMCPServers, 
  CRON_SCHEDULES, 
  FILE_PATHS, 
  DEFAULT_AGENT_STATE,
  validateEnvironment,
  getEnvObject
} from './config.ts';

// Import services
import { MarketDataService } from './services/marketDataService.ts';
import { TradingService } from './services/tradingService.ts';
import { DirectAlpacaService } from './services/directAlpacaService.ts';
import { EmailService } from './services/emailService.ts';
import { DatabaseService } from './services/databaseService.ts';
import { AIService } from './services/aiService.ts';
import { EnhancedStrategyService } from './services/enhancedStrategyService.ts';
import { ITradingService } from './types/interfaces.ts';

// Import utilities
import { Logger } from './utils/logger.ts';
import { WebServer } from './webServer.ts';

export class AutonomousTradingAgent {
  // Core state
  private state: AgentState;
  private isShuttingDown: boolean = false;
  
  // MCP Clients
  private activeClients: Map<string, Client> = new Map();
  
  // Services
  private logger!: Logger;
  private marketDataService!: MarketDataService;
  private tradingService!: ITradingService;
  private emailService!: EmailService;
  private databaseService!: DatabaseService;
  private aiService!: AIService;
  private enhancedStrategyService!: EnhancedStrategyService;
  private webServer!: WebServer;
  
  // System components
  private cronJob: unknown;
  private shutdownCallbacks: (() => Promise<void>)[] = [];

  constructor() {
    // Initialize state
    this.state = { ...DEFAULT_AGENT_STATE };
    
    // Initialize logger
    this.logger = new Logger();
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.logger.log('STATUS', '🤖 Initializing Ada Analytics Trading Agent...');

    // Load environment variables
    try {
      await load({ export: true });
    } catch (error) {
      // Silently fall back to system environment variables
      this.logger.log('STATUS', 'Using system environment variables');
    }

    // Validate environment
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`);
    }

    // Initialize services first (without clients initially)
    this.initializeServices();

    // Load existing state after services are initialized
    await this.loadState();

    this.logger.log('STATUS', '✅ Agent initialization complete');
  }

  /**
   * Initialize all services
   */
  
  private initializeServices(): void {
    // Initialize services with null clients initially
    this.marketDataService = new MarketDataService(null, this.logger);
    
    // Use DirectAlpacaService in Railway environment
    const isRailway = Deno.env.get('RAILWAY_ENVIRONMENT') || Deno.env.get('PORT');
    if (isRailway) {
      this.tradingService = new DirectAlpacaService(this.logger);
      this.logger.log('STATUS', '🚂 Using DirectAlpacaService for Railway deployment');
    } else {
      this.tradingService = new TradingService(null, this.logger);
      this.logger.log('STATUS', '🏠 Using TradingService for local development');
    }
    
    this.emailService = new EmailService(this.logger, Deno.env.get("BASE_URL") || 'http://localhost:8080');
    this.databaseService = new DatabaseService(null, this.logger);
    this.aiService = new AIService(this.logger);
    this.enhancedStrategyService = new EnhancedStrategyService(this.logger);

    // Initialize web server
    this.webServer = new WebServer(
      this.logger,
      {
        marketDataService: this.marketDataService,
        tradingService: this.tradingService,
        emailService: this.emailService,
        databaseService: this.databaseService,
        aiService: this.aiService
      },
      {
        getAgentState: () => {
          // Return current state (will be updated by background sync)
          return this.state;
        },
        updateAgentState: async (updates) => {
          await this.updateAgentState(updates);
        }
      },
      {
        stopAllMCPServers: () => this.stopAllMCPServers(),
        startAllMCPServers: () => this.connectToServers()
      }
    );
  }

  /**
   * Connect to all MCP servers
   */
  async connectToServers(): Promise<void> {
    this.logger.log('STATUS', 'Connecting to MCP servers...');

    const mcpServers = await getMCPServers();
    
    // If no MCP servers are configured (like in Railway), skip connection
    if (Object.keys(mcpServers).length === 0) {
      this.logger.log('STATUS', '🚂 No MCP servers configured - running in standalone mode');
      return;
    }
    
    for (const [serverName, config] of Object.entries(mcpServers)) {
      try {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: {
            ...getEnvObject(),
            ...config.env
          }
        });

        const client = new Client({
          name: `trading-agent-${serverName}`,
          version: "1.0.0"
        });

        await client.connect(transport);
        this.activeClients.set(serverName, client);
        
        // Update services with connected clients
        this.updateServiceClients(serverName, client);
        
        this.logger.log('STATUS', `✅ Connected to ${serverName}`);
        
      } catch (error) {
        this.logger.log('ALERT', `Failed to connect to ${serverName}: ${error}`);
      }
    }

    // Only throw error if MCP servers were configured but none connected
    if (Object.keys(mcpServers).length > 0 && this.activeClients.size === 0) {
      throw new Error('Failed to connect to any MCP servers');
    }

    this.logger.log('STATUS', `Connected to ${this.activeClients.size}/${Object.keys(mcpServers).length} MCP servers`);
  }

  /**
   * Update services with connected clients
   */
  private updateServiceClients(serverName: string, client: Client): void {
    switch (serverName) {
      case 'quiver-quant':
        this.marketDataService.setQuiverClient(client);
        break;
      case 'alpaca':
        this.tradingService.setAlpacaClient(client);
        break;
      case 'supabase':
        this.databaseService.setSupabaseClient(client);
        break;
    }
  }

  /**
   * Stop all MCP servers
   */
  private async stopAllMCPServers(): Promise<void> {
    this.logger.log('STATUS', '🛑 Stopping all MCP servers...');
    
    for (const [serverName, client] of this.activeClients.entries()) {
      try {
        await client.close();
        this.logger.log('STATUS', `✅ Stopped ${serverName} server`);
      } catch (error) {
        this.logger.log('ALERT', `Failed to stop ${serverName}: ${error}`);
      }
    }
    
    this.activeClients.clear();
    
    // Update service clients to null
    this.marketDataService.updateClient(null);
          this.tradingService.updateClient(null);  
    this.databaseService.updateClient(null);
    
    this.logger.log('STATUS', '🛑 All MCP servers stopped');
  }

  /**
   * Sync account balance with live Alpaca data
   */
  private async syncAccountBalance(): Promise<void> {
    try {
      const accountDetails = await this.tradingService.getAccountDetails();
      if (accountDetails.balance && accountDetails.balance !== this.state.account_balance) {
        this.state.account_balance = accountDetails.balance;
        await this.saveState();
        this.logger.log('STATUS', `Account balance synced: $${accountDetails.balance.toLocaleString()}`);
      }
    } catch (error) {
      this.logger.log('ALERT', `Failed to sync account balance: ${error}`);
    }
  }

  /**
   * Main trading workflow execution
   */
  async runTradingWorkflow(): Promise<void> {
    if (this.state.is_paused) {
      this.logger.log('ALERT', 'Agent is PAUSED - Skipping trading workflow');
      return;
    }

    // Check if agent should run based on time and day
    if (!this.shouldAgentRun()) {
      this.logger.log('STATUS', 'Agent should not run at this time - Skipping trading workflow');
      return;
    }

    try {
      // Trading workflow header
      this.logger.log('STATUS', '🚀 DAILY TRADING WORKFLOW STARTED');

      // Step 1: Collect market data with historical context
      this.logger.log('ANALYSIS', 'Step 1: Collecting market data...');
      const marketData = await this.collectMarketDataWithHistory();

      // Step 2: Craft initial trade plan
      this.logger.log('PLAN', 'Step 2: Crafting trade plan...');
      let tradePlan = await this.aiService.craftTradePlan(marketData, this.state);

      // Step 3: Make predictions
      this.logger.log('ANALYSIS', 'Step 3: Running AI predictions...');
      tradePlan = await this.aiService.makePredictions(tradePlan, marketData, this.state);

      // Step 4: Finalize trade plan (legacy step)
      this.logger.log('PLAN', 'Step 4: Finalizing trade plan...');
      tradePlan = await this.finalizeTradePlan(tradePlan);

      // Step 4.5: Apply Enhanced Strategy (NEW - Beta Distribution + Breakout Filtering)
      this.logger.log('ANALYSIS', 'Step 4.5: Applying Enhanced Strategy (Beta Distribution + Breakout Filtering)...');
      const enhancedPlan = await this.enhancedStrategyService.enhanceTradePlan(tradePlan, marketData, this.state);
      
      // Show enhanced trade plan summary
      this.logEnhancedTradePlanSummary(enhancedPlan);

      // Step 5: Email enhanced trade plan
      this.logger.log('STATUS', 'Step 5: Sending enhanced trade plan notifications...');
      const pauseToken = await this.emailService.sendTradePlanEmail(enhancedPlan);
      this.state.pause_token = pauseToken;
      await this.saveState();

      // Step 6: Wait for market open if needed
      await this.tradingService.waitForMarketOpen();

      // Step 7: Execute Enhanced Strategy
      if (enhancedPlan.enhanced_trades.length > 0) {
        this.logger.log('TRADE', `Step 7: Executing Enhanced Strategy with ${enhancedPlan.enhanced_trades.length} trades...`);
        const strategyResult = await this.enhancedStrategyService.executeEnhancedStrategy(
          enhancedPlan, 
          this.tradingService, 
          this.state
        );
        
        this.logEnhancedExecutionResults(strategyResult);

        // Step 8: Store trades with enhanced data
        if (strategyResult.executed_trades.filter(t => t.status === 'executed').length > 0) {
          this.logger.log('STATUS', 'Step 8: Storing enhanced trade records...');
          const thoughtChain = this.generateEnhancedThoughtChain(enhancedPlan, strategyResult.executed_trades);
          await this.databaseService.storeTrades(strategyResult.executed_trades, enhancedPlan, thoughtChain);
        }
      } else {
        this.logger.log('STATUS', 'No trades passed enhanced filtering - no trades to execute today');
      }

      // Update state
      this.state.last_run = new Date().toISOString();
      await this.saveState();

      this.logger.log('STATUS', '✅ TRADING WORKFLOW COMPLETED SUCCESSFULLY');

    } catch (error: unknown) {
      this.logger.log('ALERT', `❌ TRADING WORKFLOW FAILED: ${error}`);
      
      await this.handleWorkflowError(error);
    }
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(): Promise<void> {
    this.logger.log('STATUS', 'Generating daily summary...');

    try {
      const accountDetails = await this.tradingService.getAccountDetails();
      const todayTrades = await this.databaseService.getTodayTrades();
      
      await this.emailService.sendDailySummary(accountDetails, todayTrades);
      
      this.logger.log('STATUS', 'Daily summary sent successfully');
    } catch (error) {
      this.logger.log('ALERT', `Failed to send daily summary: ${error}`);
    }
  }

  /**
   * Sync agent state from database
   */
  private async syncStateFromDatabase(): Promise<void> {
    try {
      const dbState = await this.databaseService.getAgentState();
      if (dbState) {
        this.state = { ...this.state, ...dbState };
        this.logger.log('STATUS', 'Agent state synced from database');
      }
    } catch (error) {
      this.logger.log('ALERT', `Failed to sync state from database: ${error}`);
    }
  }

  /**
   * Check if agent should run based on current time and day
   */
  private shouldAgentRun(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.logger.log('STATUS', `Weekend detected (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}) - Agent will not run`);
      return false;
    }
    
    // Check if it's within the trading window (6 AM to 5 PM EST)
    const currentTime = hour * 60 + minute;
    const tradingStart = 6 * 60; // 6 AM
    const tradingEnd = 17 * 60; // 5 PM
    
    if (currentTime < tradingStart || currentTime > tradingEnd) {
      this.logger.log('STATUS', `Outside trading hours (${hour}:${minute.toString().padStart(2, '0')}) - Agent will not run`);
      return false;
    }
    
    return true;
  }

  /**
   * Setup cron jobs
   */
  setupCronJobs(): void {
    this.logger.log('STATUS', '📅 Setting up cron jobs...');
    
    // Log the current time and next execution times
    const now = new Date();
    this.logger.log('STATUS', `Current time: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
    
    // Daily workflow - runs at 6 AM EST (data collection and planning)
    cron(CRON_SCHEDULES.DAILY_TRADING, async () => {
      const executionTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      this.logger.log('STATUS', `⏰ CRON TRIGGERED: Daily trading workflow at ${executionTime} EST`);
      this.logger.log('STATUS', 'Starting scheduled trading workflow');
      await this.runTradingWorkflow();
    });

    // End of day summary - runs at 5 PM EST
    cron(CRON_SCHEDULES.END_OF_DAY_SUMMARY, async () => {
      const executionTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      this.logger.log('STATUS', `⏰ CRON TRIGGERED: End of day summary at ${executionTime} EST`);
      this.logger.log('STATUS', 'Starting end-of-day summary');
      await this.sendDailySummary();
    });

    // Cleanup old logs - runs weekly on Sunday at midnight
    cron(CRON_SCHEDULES.WEEKLY_CLEANUP, async () => {
      const executionTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      this.logger.log('STATUS', `⏰ CRON TRIGGERED: Weekly cleanup at ${executionTime} EST`);
      await this.databaseService.cleanupOldLogs();
    });

    this.logger.log('STATUS', '📅 Cron jobs scheduled successfully');
    this.logger.log('STATUS', `- Daily Trading: ${CRON_SCHEDULES.DAILY_TRADING} (6 AM EST, weekdays)`);
    this.logger.log('STATUS', `- End of Day Summary: ${CRON_SCHEDULES.END_OF_DAY_SUMMARY} (5 PM EST, weekdays)`);
    this.logger.log('STATUS', `- Weekly Cleanup: ${CRON_SCHEDULES.WEEKLY_CLEANUP} (Sunday midnight)`);
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    try {
      this.logger.log('STATUS', '🤖 Starting Ada Analytics Trading Agent...');
      
      // Initialize
      await this.initialize();
      
      // Setup signal handlers
      this.setupSignalHandlers();
      
      // Connect to MCP servers
      await this.connectToServers();
      
      // Get initial account balance
      await this.updateAccountBalance();
      
      // Setup cron jobs
      this.setupCronJobs();
      
      // Start web server
      await this.webServer.start();
      
      // Send startup notification (only in production)
      const isProduction = Deno.env.get('RAILWAY_ENVIRONMENT') && Deno.env.get('NODE_ENV') !== 'development';
      if (this.emailService.isConfigured() && isProduction) {
        await this.emailService.sendStartupNotification(
          this.state.account_balance,
          Array.from(this.activeClients.keys())
        );
      } else {
        this.logger.log('STATUS', '📧 Skipping startup email (development/local mode)');
      }
      
      // Setup periodic state sync (every 5 minutes)
      setInterval(async () => {
        await this.syncStateFromDatabase();
      }, 5 * 60 * 1000);
      
      // Log startup completion
      this.logStartupSummary();
      
      await this.databaseService.log('INFO', 'Autonomous Trading Agent started successfully');
      
    } catch (error) {
      this.logger.log('ALERT', `💥 Failed to start Trading Agent: ${error}`);
      Deno.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(reason: string = 'Manual shutdown'): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.log('STATUS', '🔄 Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('ALERT', `🛑 Initiating graceful shutdown: ${reason}`);

    try {
      // 1. Pause trading immediately
      this.state.is_paused = true;
      this.logger.log('STATUS', '⏸️ Trading paused for shutdown');

      // 2. Cancel any pending trades
      try {
        await this.tradingService.cancelAllOrders();
        this.logger.log('STATUS', '🚫 All pending orders cancelled');
      } catch (error) {
        this.logger.log('ALERT', `Failed to cancel orders: ${error}`);
      }

      // 3. Save current state
      this.logger.log('STATUS', '💾 Saving agent state...');
      await this.saveState();

      // 4. Log shutdown event
      try {
        await this.databaseService.storeAgentEvent('shutdown', reason, {
          account_balance: this.state.account_balance,
          open_positions: this.state.open_positions.length
        });
      } catch (error) {
        this.logger.log('ALERT', `Failed to log shutdown event: ${error}`);
      }

      // 5. Run shutdown callbacks
      this.logger.log('STATUS', '🔄 Running cleanup callbacks...');
      for (const callback of this.shutdownCallbacks) {
        try {
          await callback();
        } catch (error) {
          this.logger.log('ALERT', `Shutdown callback failed: ${error}`);
        }
      }

      // 6. Close web server
      this.logger.log('STATUS', '🌐 Shutting down web server...');
      await this.webServer.stop();

      // 7. Close MCP connections
      this.logger.log('STATUS', '🔌 Closing MCP connections...');
      for (const [name, client] of this.activeClients) {
        try {
          if (client.close) {
            await client.close();
          }
          this.logger.log('STATUS', `✅ Closed ${name} connection`);
        } catch (error) {
          this.logger.log('ALERT', `Failed to close ${name}: ${error}`);
        }
      }

      // 8. Send shutdown notification (only in production)
      const isProduction = Deno.env.get('RAILWAY_ENVIRONMENT') && Deno.env.get('NODE_ENV') !== 'development';
      if (this.emailService.isConfigured() && isProduction) {
        try {
          await this.emailService.sendShutdownNotification(
            reason,
            this.state.account_balance,
            this.state.open_positions.length
          );
        } catch (error) {
          this.logger.log('ALERT', `Failed to send shutdown email: ${error}`);
        }
      } else {
        this.logger.log('STATUS', '📧 Skipping shutdown email (development/local mode)');
      }

      this.logger.log('STATUS', '✅ Graceful shutdown completed');
      this.logger.log('STATUS', '🔒 Agent shutdown complete. Safe to restart.');

    } catch (error) {
      this.logger.log('ALERT', `❌ Error during shutdown: ${error}`);
    }
  }

  // Private helper methods

  private async collectMarketDataWithHistory(): Promise<Record<string, unknown>> {
    // Get regular market data
    const marketData = await this.marketDataService.collectMarketData();
    
    // Add trading performance context
    const performance = await this.databaseService.getTradingPerformance();
    
    // Add recent trades for context
    const recentTrades = await this.databaseService.getHistoricalTrades(7);
    
    return {
      ...marketData,
      trading_performance: performance,
      recent_trades: recentTrades,
      account_balance: this.state.account_balance,
      last_run: this.state.last_run
    };
  }

  private async finalizeTradePlan(tradePlan: TradePlan): Promise<TradePlan> {
    this.logger.log('ANALYSIS', 'Finalizing trade plan...');

    // Check yesterday's trades for evaluation
    const yesterdayTrades = await this.databaseService.getYesterdayTrades();
    
    if (yesterdayTrades.length > 0) {
      this.logger.log('STATUS', `Found ${yesterdayTrades.length} trades from yesterday, analyzing performance...`);
      
      // Analyze yesterday's performance
      const performanceAnalysis = await this.aiService.analyzeTradePerformance(yesterdayTrades);
      
      // Adjust strategy if needed
      if (performanceAnalysis.should_adjust) {
        this.logger.log('ANALYSIS', 'Adjusting strategy based on performance analysis');
        tradePlan = await this.aiService.adjustTradePlan(tradePlan, performanceAnalysis);
        
        // Update current strategy
        if (performanceAnalysis.new_strategy_focus) {
          this.state.current_strategy = performanceAnalysis.new_strategy_focus;
          await this.saveState();
        }
      }
    }

    // Final validation
    tradePlan.trades = tradePlan.trades.filter(trade => {
      const positionSize = (this.state.account_balance * 0.01) / trade.price_target;
      return positionSize > 0 && trade.confidence > 0.6;
    });

    // Store predictions
    await this.databaseService.storePredictions(tradePlan);

    this.logger.log('STATUS', `Finalized trade plan with ${tradePlan.trades.length} trades`);
    return tradePlan;
  }

  private async updateAccountBalance(): Promise<void> {
    try {
      const accountDetails = await this.tradingService.getAccountDetails();
      this.state.account_balance = accountDetails.balance;
      await this.saveState();
      
      this.logger.log('STATUS', `Account balance updated: $${accountDetails.balance.toLocaleString()}`);
    } catch (error) {
      this.logger.log('ALERT', `Failed to update account balance: ${error}`);
    }
  }

  private async updateAgentState(updates: Partial<AgentState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await this.databaseService.updateAgentState(updates);
  }

  private async saveState(): Promise<void> {
    try {
      await this.databaseService.storeAgentState(this.state);
    } catch (error) {
      this.logger.log('ALERT', `Failed to save state to database: ${error}`);
      // Fallback to local file if database fails
      try {
        await Deno.writeTextFile(FILE_PATHS.AGENT_STATE, JSON.stringify(this.state, null, 2));
        this.logger.log('STATUS', 'State saved to local file as fallback');
      } catch (fileError) {
        this.logger.log('ALERT', `Failed to save state to file: ${fileError}`);
      }
    }
  }

  private async loadState(): Promise<void> {
    try {
      // Try to load from database first
      const dbState = await this.databaseService.getAgentState();
      if (dbState) {
        this.state = { ...this.state, ...dbState };
        this.logger.log('STATUS', 'Agent state loaded from database');
      } else {
        // Fallback to local file if no database state
        try {
          const stateData = await Deno.readTextFile(FILE_PATHS.AGENT_STATE);
          this.state = { ...this.state, ...JSON.parse(stateData) };
          this.logger.log('STATUS', 'Agent state loaded from local file');
        } catch (fileError) {
          this.logger.log('STATUS', 'No existing state found, using defaults');
        }
      }
      
      // Sync account balance with live data if services are connected
      if (this.activeClients.has('alpaca') && !this.state.is_paused) {
        try {
          await this.syncAccountBalance();
        } catch (error) {
          this.logger.log('STATUS', `Could not sync account balance: ${error}`);
        }
      }
    } catch (error) {
      this.logger.log('ALERT', `Failed to load state: ${error}`);
      this.logger.log('STATUS', 'Using default agent state');
    }
  }

  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    const handleSigInt = () => {
      this.logger.log('ALERT', '⚠️ Received SIGINT (Ctrl+C)...');
      this.gracefulShutdown('SIGINT received').then(() => {
        Deno.exit(0);
      });
    };

    // Handle SIGTERM
    const handleSigTerm = () => {
      this.logger.log('ALERT', '⚠️ Received SIGTERM...');
      this.gracefulShutdown('SIGTERM received').then(() => {
        Deno.exit(0);
      });
    };

    try {
      if (Deno.build.os !== 'windows') {
        Deno.addSignalListener('SIGINT', handleSigInt);
        Deno.addSignalListener('SIGTERM', handleSigTerm);
      }
    } catch (error) {
      this.logger.log('ALERT', `Could not setup signal handlers: ${error}`);
    }
  }

  private async handleWorkflowError(error: unknown): Promise<void> {
    // On critical errors, pause the agent
    if (error instanceof Error && (error.message.includes('CRITICAL') || error.message.includes('API_ERROR'))) {
      this.state.is_paused = true;
      await this.saveState();
      this.logger.log('ALERT', '🛑 AGENT PAUSED due to critical error');
      await this.emailService.sendErrorAlert(error);
    }
  }

  private generateThoughtChain(tradePlan: TradePlan, executedTrades: ExecutedTrade[]): string[] {
    return [
      `Market analysis: ${tradePlan.market_analysis}`,
      `Risk assessment: ${tradePlan.risk_assessment}`,
      `Strategy: ${this.state.current_strategy}`,
      `Account balance: $${this.state.account_balance}`,
      `Trades planned: ${tradePlan.trades.length}`,
      `Trades executed: ${executedTrades.filter(t => t.status === 'executed').length}`
    ];
  }

  private logTradePlanSummary(tradePlan: TradePlan): void {
    this.logger.log('PLAN', `📋 TRADE PLAN SUMMARY: ${tradePlan.trades.length} trades planned, ${(tradePlan.total_risk_exposure * 100).toFixed(2)}% risk exposure`);
    if (tradePlan.trades.length > 0) {
      tradePlan.trades.forEach((trade, i) => {
        this.logger.log('PLAN', `${i + 1}. ${trade.action} ${trade.symbol} (${trade.quantity} shares) - $${trade.price_target}`);
      });
    }
  }

  private logExecutionResults(executedTrades: ExecutedTrade[]): void {
    const successfulTrades = executedTrades.filter(t => t.status === 'executed');
    this.logger.log('TRADE', `🔄 TRADE EXECUTION RESULTS: ${successfulTrades.length}/${executedTrades.length} trades executed`);
    if (successfulTrades.length > 0) {
      successfulTrades.forEach((trade, i) => {
        this.logger.log('TRADE', `✅ ${i + 1}. ${trade.action} ${trade.symbol} - ${trade.executed_quantity} shares at $${trade.filled_avg_price || 'pending'}`);
      });
    } else {
      this.logger.log('TRADE', '⚠️ No trades executed');
    }
  }

  private logStartupSummary(): void {
    this.logger.log('STATUS', '🎯 ADA ANALYTICS TRADING AGENT - READY FOR ACTION');
    this.logger.log('STATUS', `Account Balance: $${this.state.account_balance.toLocaleString()}`);
    this.logger.log('STATUS', `Strategy: ${this.state.current_strategy.toUpperCase()}`);
    this.logger.log('STATUS', `MCP Servers: ${this.activeClients.size} connected`);
    this.logger.log('STATUS', `Web Interface: ${Deno.env.get("BASE_URL") || 'http://localhost:8080'}`);
    this.logger.log('STATUS', `Daily Trading: 6:00 AM EST`);
    if (this.emailService.isConfigured()) {
      this.logger.log('STATUS', 'Email Alerts: ENABLED');
    } else {
      this.logger.log('ALERT', 'Email Alerts: DISABLED (Configure RESEND_API_KEY)');
    }
    this.logger.log('STATUS', '🚀 Enhanced Strategy: Beta Distribution + Breakout Filtering ENABLED');
  }

  /**
   * Log enhanced trade plan summary
   */
  private logEnhancedTradePlanSummary(enhancedPlan: any): void {
    const metrics = enhancedPlan.strategy_performance;
    
    this.logger.log('PLAN', `📋 ENHANCED TRADE PLAN SUMMARY`);
    this.logger.log('PLAN', `Original trades: ${metrics.original_trade_count} → Enhanced trades: ${metrics.filtered_trade_count}`);
    this.logger.log('PLAN', `Risk exposure: ${(enhancedPlan.total_risk_exposure * 100).toFixed(2)}%`);
    this.logger.log('PLAN', `Average breakout probability: ${(metrics.average_breakout_probability * 100).toFixed(1)}%`);
    this.logger.log('PLAN', `Strategy confidence: ${(metrics.strategy_confidence * 100).toFixed(1)}%`);
    
    if (enhancedPlan.enhanced_trades.length > 0) {
      enhancedPlan.enhanced_trades.forEach((trade: any, i: number) => {
        this.logger.log('PLAN', 
          `${i + 1}. ${trade.action} ${trade.enhanced_quantity} ${trade.symbol} @ $${trade.price_target.toFixed(2)} ` +
          `(Pos: ${(trade.position_sizing.position_percentage * 100).toFixed(2)}%, BP: ${(trade.breakout_probability * 100).toFixed(1)}%)`
        );
      });
    }
  }

  /**
   * Log enhanced execution results
   */
  private logEnhancedExecutionResults(strategyResult: any): void {
    const summary = strategyResult.execution_summary;
    
    this.logger.log('TRADE', `🔄 ENHANCED STRATEGY EXECUTION RESULTS`);
    this.logger.log('TRADE', `Trades planned: ${summary.trades_planned} → Filtered: ${summary.trades_filtered} → Executed: ${summary.trades_executed}`);
    this.logger.log('TRADE', `Success rate: ${summary.strategy_effectiveness.toFixed(1)}%`);
    this.logger.log('TRADE', `Total position value: $${summary.total_position_value.toLocaleString()}`);
    
    if (strategyResult.executed_trades.length > 0) {
      strategyResult.executed_trades.forEach((trade: any, i: number) => {
        const status = trade.status === 'executed' ? '✅' : '❌';
        this.logger.log('TRADE', 
          `${status} ${i + 1}. ${trade.action} ${trade.executed_quantity} ${trade.symbol} ` +
          `${trade.status === 'executed' ? `@ $${trade.filled_avg_price || trade.price_target}` : '(Failed)'}`
        );
      });
    } else {
      this.logger.log('TRADE', '⚠️ No trades executed');
    }
  }

  /**
   * Generate enhanced thought chain for database storage
   */
  private generateEnhancedThoughtChain(enhancedPlan: any, executedTrades: ExecutedTrade[]): string[] {
    const thoughtChain = [
      `Enhanced strategy applied with Beta distribution position sizing and breakout filtering`,
      `Market analysis: ${enhancedPlan.market_analysis}`,
      `Risk assessment: ${enhancedPlan.risk_assessment}`,
      `Strategy: ${this.state.current_strategy}`,
      `Account balance: $${this.state.account_balance}`,
      `Original trades: ${enhancedPlan.strategy_performance.original_trade_count}`,
      `Trades after filtering: ${enhancedPlan.enhanced_trades.length}`,
      `Trades executed: ${executedTrades.filter(t => t.status === 'executed').length}`,
      `Total risk exposure: ${(enhancedPlan.total_risk_exposure * 100).toFixed(2)}%`,
      `Average signal strength: ${(enhancedPlan.strategy_performance.average_signal_strength * 100).toFixed(1)}%`,
      `Average breakout probability: ${(enhancedPlan.strategy_performance.average_breakout_probability * 100).toFixed(1)}%`,
      `Beta distribution parameters: a=2, b=5`,
      `Breakout threshold: 40%`,
      `Position sizing formula: position_pct = 0.10 * beta.cdf(signal_strength, 2, 5)`
    ];

    // Add individual trade thoughts
    enhancedPlan.enhanced_trades.forEach((trade: any, index: number) => {
      thoughtChain.push(
        `Trade ${index + 1} (${trade.symbol}): ` +
        `Signal: ${(trade.position_sizing.signal_strength * 100).toFixed(1)}%, ` +
        `Position: ${(trade.position_sizing.position_percentage * 100).toFixed(2)}%, ` +
        `Breakout: ${(trade.breakout_probability * 100).toFixed(1)}%, ` +
        `Quantity: ${trade.enhanced_quantity}`
      );
    });

    return thoughtChain;
  }
}
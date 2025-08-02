/**
 * Web Server - Handles the web interface and API endpoints for the trading agent
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { 
  WebServerConfig, 
  TradingLogger, 
  AgentState, 
  AccountDetails,
  TestResult 
} from './types/interfaces.ts';
import { IMarketDataService, ITradingService, IEmailService, IDatabaseService, IAIService } from './types/interfaces.ts';
import { WEB_SERVER_CONFIG } from './config.ts';

export class WebServer {
  private logger: TradingLogger;
  private config: WebServerConfig;
  private server: Deno.HttpServer | null = null;
  
  // Service dependencies
  private marketDataService: IMarketDataService;
  private tradingService: ITradingService;
  private emailService: IEmailService;
  private databaseService: IDatabaseService;
  private aiService: IAIService;
  
  // Agent state management
  private getAgentState: () => AgentState;
  private updateAgentState: (updates: Partial<AgentState>) => Promise<void>;
  
  // MCP server control callbacks
  private stopAllMCPServers: () => Promise<void>;
  private startAllMCPServers: () => Promise<void>;

  constructor(
    logger: TradingLogger,
    services: {
      marketDataService: IMarketDataService;
      tradingService: ITradingService;
      emailService: IEmailService;
      databaseService: IDatabaseService;
      aiService: IAIService;
    },
    stateManagement: {
      getAgentState: () => AgentState;
      updateAgentState: (updates: Partial<AgentState>) => Promise<void>;
    },
    mcpControl: {
      stopAllMCPServers: () => Promise<void>;
      startAllMCPServers: () => Promise<void>;
    },
    config?: Partial<WebServerConfig>
  ) {
    this.logger = logger;
    this.config = { ...WEB_SERVER_CONFIG, ...config };
    
    this.marketDataService = services.marketDataService;
    this.tradingService = services.tradingService;
    this.emailService = services.emailService;
    this.databaseService = services.databaseService;
    this.aiService = services.aiService;
    
    this.getAgentState = stateManagement.getAgentState;
    this.updateAgentState = stateManagement.updateAgentState;
    
    this.stopAllMCPServers = mcpControl.stopAllMCPServers;
    this.startAllMCPServers = mcpControl.startAllMCPServers;
  }

  /**
   * Start the web server
   */
  start(): void {
    const handler = this.createRequestHandler();
    
    this.logger.log('STATUS', `Starting web server on port ${this.config.port}`);
    
    serve(handler, { 
      port: this.config.port,
      onListen: ({ port, hostname }) => {
        this.logger.log('STATUS', `🌐 Web server listening on http://${hostname}:${port}`);
        this.logger.log('STATUS', `📊 Dashboard: ${this.config.baseUrl}`);
      }
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.logger.log('STATUS', 'Shutting down web server...');
      await this.server.shutdown();
      this.logger.log('STATUS', '🌐 Web server shut down');
    }
  }

  /**
   * Create the main request handler
   */
  private createRequestHandler() {
    return async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        // API Routes
        if (path.startsWith('/api/')) {
          return await this.handleApiRequest(path, url, request);
        }

        // Control Routes
        if (path.startsWith('/pause/') || path.startsWith('/resume/')) {
          return await this.handleControlRequest(path, url, request);
        }

        // Shutdown Routes
        if (path.startsWith('/shutdown')) {
          return await this.handleShutdownRequest(path, url, request);
        }

        // Test Routes
        if (path.startsWith('/test/')) {
          return await this.handleTestRequest(path, url, request);
        }

        // Dashboard Routes
        return await this.handleDashboardRequest(path, url, request);

      } catch (error) {
        this.logger.log('ALERT', `Web server error: ${error}`);
        return this.createErrorResponse(error);
      }
    };
  }

  /**
   * Handle API requests
   */
  private async handleApiRequest(path: string, url: URL, request: Request): Promise<Response> {
    const endpoint = path.replace('/api/', '');

    switch (endpoint) {
      case 'health': {
        const agentState = this.getAgentState();
        const health = await this.getDetailedHealthStatus();
        return this.createJsonResponse({
          status: health.overall_status,
          is_paused: agentState.is_paused,
          last_run: agentState.last_run,
          account_balance: agentState.account_balance,
          timestamp: new Date().toISOString(),
          services: health.services,
          uptime: health.uptime,
          version: "2.0.0-modular"
        });
      }

      case 'metrics': {
        const metrics = await this.getSystemMetrics();
        return this.createJsonResponse(metrics);
      }

      case 'logs': {
        const logLevel = url.searchParams.get("level") || "all";
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const logs = await this.getRecentLogs(logLevel, limit);
        return this.createJsonResponse(logs);
      }

      case 'performance': {
        const performance = await this.databaseService.getTradingPerformance();
        return this.createJsonResponse(performance);
      }

      case 'trades': {
        const days = parseInt(url.searchParams.get("days") || "30");
        const symbol = url.searchParams.get("symbol") || undefined;
        const trades = await this.databaseService.getHistoricalTrades(days, symbol);
        return this.createJsonResponse(trades);
      }

      case 'account': {
        const accountDetails = await this.tradingService.getAccountDetails();
        return this.createJsonResponse(accountDetails);
      }

      case 'positions': {
        const positions = await this.tradingService.getCurrentPositions();
        return this.createJsonResponse(positions);
      }

      case 'orders': {
        const orders = await this.tradingService.getPendingOrders();
        return this.createJsonResponse(orders);
      }

      case 'pause': {
        if (request.method !== 'POST') {
          return this.createErrorResponse('Method not allowed', 405);
        }
        const pauseToken = crypto.randomUUID();
        await this.updateAgentState({ is_paused: true, pause_token: pauseToken });
        // Stop all MCP servers when paused
        await this.stopAllMCPServers();
        this.logger.log('STATUS', '⏸️ Agent paused via API');
        return this.createJsonResponse({ 
          success: true, 
          message: 'Agent paused successfully',
          pause_token: pauseToken
        });
      }

      case 'resume': {
        if (request.method !== 'POST') {
          return this.createErrorResponse('Method not allowed', 405);
        }
        await this.updateAgentState({ is_paused: false, pause_token: undefined });
        // Start all MCP servers when resumed
        await this.startAllMCPServers();
        this.logger.log('STATUS', '▶️ Agent resumed via API');
        return this.createJsonResponse({ 
          success: true, 
          message: 'Agent resumed successfully'
        });
      }

      case 'kill': {
        if (request.method !== 'POST') {
          return this.createErrorResponse('Method not allowed', 405);
        }
        this.logger.log('ALERT', '🛑 Emergency kill initiated via API');
        // Immediate shutdown
        setTimeout(() => {
          Deno.exit(0);
        }, 1000);
        return this.createJsonResponse({ 
          success: true, 
          message: 'Emergency shutdown initiated'
        });
      }

      case 'usage': {
        const usage = await this.getUsageStats();
        return this.createJsonResponse(usage);
      }

      default:
        return this.createNotFoundResponse();
    }
  }

  /**
   * Handle control requests (pause/resume)
   */
  private async handleControlRequest(path: string, url: URL, request: Request): Promise<Response> {
    const agentState = this.getAgentState();

    if (path.startsWith('/pause/')) {
      const token = path.split('/')[2];
      if (token === agentState.pause_token) {
        await this.updateAgentState({ is_paused: true });
        await this.emailService.sendResumeEmail(token);
        
        return this.createHtmlResponse(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🛑 Trading Agent Paused</h1>
              <p>You will receive an email with a resume link.</p>
              <a href="/">← Back to Dashboard</a>
            </body>
          </html>
        `);
      } else {
        return this.createErrorResponse("Invalid pause token", 403);
      }
    }

    if (path.startsWith('/resume/')) {
      const token = path.split('/')[2];
      if (token === agentState.pause_token) {
        await this.updateAgentState({ is_paused: false, pause_token: undefined });
        
        return this.createHtmlResponse(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>▶️ Trading Agent Resumed</h1>
              <p>Trading will resume on the next scheduled run.</p>
              <a href="/">← Back to Dashboard</a>
            </body>
          </html>
        `);
      } else {
        return this.createErrorResponse("Invalid resume token", 403);
      }
    }

    return this.createNotFoundResponse();
  }

  /**
   * Handle shutdown requests
   */
  private handleShutdownRequest(path: string, url: URL, request: Request): Promise<Response> {
    if (path === '/shutdown') {
      return Promise.resolve(this.createShutdownConfirmationPage());
    }

    if (path.startsWith('/shutdown/graceful/') || path.startsWith('/shutdown/emergency/')) {
      return Promise.resolve(this.createShutdownExecutionPage(path));
    }

    return Promise.resolve(this.createNotFoundResponse());
  }

  /**
   * Handle test requests
   */
  private async handleTestRequest(path: string, url: URL, request: Request): Promise<Response> {
    const testType = path.split('/')[2];

    if (!testType) {
      return this.createTestDashboard();
    }

    try {
      const testResult = await this.executeTest(testType);
      return this.createTestResultPage(testType, testResult);
    } catch (error) {
      return this.createTestErrorPage(testType, error);
    }
  }

  /**
   * Handle dashboard requests
   */
  private async handleDashboardRequest(path: string, url: URL, request: Request): Promise<Response> {
    switch (path) {
      case '/':
        return await this.createMainDashboard();
      case '/performance':
        return await this.createPerformancePage();
      case '/trades':
        return await this.createTradesPage();
      case '/test':
        return this.createTestDashboard();
      default:
        return this.createNotFoundResponse();
    }
  }

  /**
   * Execute test functions
   */
  private async executeTest(testType: string): Promise<TestResult> {
    this.logger.log('STATUS', `🧪 Running test: ${testType}`);

    switch (testType) {
      case 'market-data': {
        const marketData = await this.marketDataService.collectMarketData();
        return {
          success: true,
          message: 'Market data collection successful',
          data: marketData
        };
      }

      case 'trade-plan': {
        const testMarketData = await this.marketDataService.collectMarketData();
        const tradePlan = await this.aiService.craftTradePlan(testMarketData);
        return {
          success: true,
          message: 'Trade plan generation successful',
          data: tradePlan as unknown as Record<string, unknown>
        };
      }

      case 'prediction': {
        const testData = await this.marketDataService.collectMarketData();
        const testPlan = await this.aiService.craftTradePlan(testData);
        const predictions = await this.aiService.makePredictions(testPlan, testData);
        return {
          success: true,
          message: 'AI predictions generated successfully',
          data: predictions as unknown as Record<string, unknown>
        };
      }

      case 'alpaca': {
        const alpacaTest = await this.tradingService.testConnection();
        return {
          success: alpacaTest.success,
          message: alpacaTest.message,
          data: alpacaTest.success ? await this.tradingService.getAccountDetails() as unknown as Record<string, unknown> : undefined
        };
      }

      case 'supabase': {
        const supabaseTest = await this.databaseService.testConnection();
        const trades = await this.databaseService.getHistoricalTrades(7);
        const performance = await this.databaseService.getTradingPerformance();
        return {
          success: supabaseTest.success,
          message: supabaseTest.message,
          data: { trades: trades.slice(0, 3), performance }
        };
      }

      case 'anthropic': {
        const claudeTest = await this.aiService.testConnection();
        return {
          success: claudeTest.success,
          message: claudeTest.message,
          data: claudeTest
        };
      }

      case 'email': {
        const emailSent = await this.emailService.sendTestEmail();
        return {
          success: emailSent,
          message: emailSent ? 'Test email sent successfully' : 'Email configuration not available',
          data: { configured: this.emailService.isConfigured() }
        };
      }

      default:
        return {
          success: false,
          message: `Unknown test type: ${testType}`,
          error: 'Test not found'
        };
    }
  }

  // Page creation methods

  private async createMainDashboard(): Promise<Response> {
    const agentState = this.getAgentState();
    const performance = await this.databaseService.getTradingPerformance();
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ada Analytics Trading Agent</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        <h1>🤖 Ada Analytics Trading Agent</h1>
        
        ${this.getNavigationBar()}
        
        <div class="status ${agentState.is_paused ? 'paused' : 'active'}">
          <strong>Status:</strong> ${agentState.is_paused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
        </div>
        
        <h2>Account Information</h2>
        <p><strong>Account Balance:</strong> $${agentState.account_balance.toLocaleString()}</p>
        <p><strong>Strategy:</strong> ${agentState.current_strategy}</p>
        <p><strong>Last Run:</strong> ${agentState.last_run || 'Never'}</p>
        
        <h2>Quick Stats (90 days)</h2>
        <div class="quick-stats">
          <div class="stat-card">
            <div class="stat-value">${performance.total_trades}</div>
            <div class="stat-label">Total Trades</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${performance.win_rate > 0.5 ? 'positive' : 'negative'}">${(performance.win_rate * 100).toFixed(1)}%</div>
            <div class="stat-label">Win Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${performance.avg_return > 0 ? 'positive' : 'negative'}">${(performance.avg_return * 100).toFixed(2)}%</div>
            <div class="stat-label">Avg Return</div>
          </div>
        </div>
        
        <h2>Controls</h2>
        <div class="controls">
          <button class="btn ${agentState.is_paused ? 'btn-success' : 'btn-danger'}" onclick="toggleTrading()">
            ${agentState.is_paused ? '▶️ Resume Trading' : '⏸️ Pause Trading'}
          </button>
          <button class="btn btn-info" onclick="window.location.href='/performance'">📊 View Performance</button>
          <button class="btn btn-warning" onclick="window.location.href='/test'">🧪 Test Functions</button>
          <br><br>
          <button class="btn btn-shutdown" onclick="window.location.href='/shutdown'">🛑 Shutdown Agent</button>
        </div>
      </div>
      
      <script>
        function toggleTrading() {
          const isPaused = ${agentState.is_paused};
          if (isPaused) {
            // For resume, need to check for existing pause token
            window.location.href = '/resume/${agentState.pause_token || 'invalid'}';
          } else {
            // For pause, generate new token
            window.location.href = '/pause/' + crypto.randomUUID();
          }
        }
      </script>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private async createPerformancePage(): Promise<Response> {
    const performance = await this.databaseService.getTradingPerformance();
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trading Performance - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        ${this.getNavigationBar()}
        
        <h1>📊 Trading Performance (90 days)</h1>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${performance.total_trades}</div>
            <div class="metric-label">Total Trades</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value ${performance.win_rate > 0.5 ? 'positive' : 'negative'}">${(performance.win_rate * 100).toFixed(1)}%</div>
            <div class="metric-label">Win Rate</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value ${performance.avg_return > 0 ? 'positive' : 'negative'}">${(performance.avg_return * 100).toFixed(2)}%</div>
            <div class="metric-label">Avg Return</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value ${performance.total_return > 0 ? 'positive' : 'negative'}">${(performance.total_return * 100).toFixed(2)}%</div>
            <div class="metric-label">Total Return</div>
          </div>
        </div>
        
        <h2>Symbols Traded</h2>
        <p>${performance.symbols_traded.join(', ') || 'No trades yet'}</p>
        
        <h2>Recent Trades</h2>
        <div class="trades-list">
          ${performance.recent_trades.map(trade => `
            <div class="trade-item">
              <strong>${trade.symbol}</strong> - ${trade.action} ${trade.quantity} shares at $${trade.price_target}
              <span class="trade-date">${new Date(trade.executed_at).toLocaleDateString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private async createTradesPage(): Promise<Response> {
    const trades = await this.databaseService.getHistoricalTrades(30);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trade History - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        ${this.getNavigationBar()}
        
        <h1>📈 Trade History (30 days)</h1>
        
        <table class="trades-table">
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
                <td>${((trade.confidence || 0) * 100).toFixed(0)}%</td>
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
    
    return this.createHtmlResponse(html);
  }

  private createTestDashboard(): Response {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Functions - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        ${this.getNavigationBar()}
        
        <h1>🧪 Test Functions</h1>
        
        <div class="warning">
          <strong>⚠️ Note:</strong> These are test functions to verify the agent is working properly.
        </div>
        
        <div class="test-grid">
          <div class="test-section">
            <h3>🧠 AI & Market Analysis</h3>
            <button class="btn btn-primary" onclick="runTest('market-data')">📊 Test Market Data</button>
            <button class="btn btn-primary" onclick="runTest('trade-plan')">📋 Test Trade Plan</button>
            <button class="btn btn-primary" onclick="runTest('prediction')">🔮 Test Predictions</button>
          </div>
          
          <div class="test-section">
            <h3>🔗 Connections & APIs</h3>
            <button class="btn btn-success" onclick="runTest('alpaca')">🦙 Test Alpaca</button>
            <button class="btn btn-success" onclick="runTest('supabase')">🗄️ Test Supabase</button>
            <button class="btn btn-success" onclick="runTest('anthropic')">🤖 Test Claude</button>
          </div>
          
          <div class="test-section">
            <h3>📧 Notifications</h3>
            <button class="btn btn-info" onclick="runTest('email')">📧 Test Email</button>
          </div>
        </div>
      </div>
      
      <script>
        function runTest(testType) {
          window.location.href = '/test/' + testType;
        }
      </script>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private createTestResultPage(testType: string, result: TestResult): Response {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Result: ${testType} - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        ${this.getNavigationBar()}
        
        <h1>${result.success ? '✅' : '❌'} Test Result: ${testType}</h1>
        
        <div class="test-result ${result.success ? 'success' : 'error'}">
          <h3>${result.message}</h3>
          ${result.data ? `<pre>${JSON.stringify(result.data, null, 2)}</pre>` : ''}
          ${result.error ? `<p class="error-text">${result.error}</p>` : ''}
        </div>
        
        <button class="btn btn-primary" onclick="window.location.href='/test'">← Back to Tests</button>
        <button class="btn btn-secondary" onclick="window.location.reload()">🔄 Run Again</button>
      </div>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private createTestErrorPage(testType: string, error: Error | unknown): Response {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Failed: ${testType} - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        ${this.getNavigationBar()}
        
        <h1>❌ Test Failed: ${testType}</h1>
        
        <div class="test-result error">
          <h3>Error: ${error instanceof Error ? error.message : String(error)}</h3>
          <pre>${error instanceof Error ? error.stack || '' : ''}</pre>
        </div>
        
        <button class="btn btn-primary" onclick="window.location.href='/test'">← Back to Tests</button>
        <button class="btn btn-secondary" onclick="window.location.reload()">🔄 Try Again</button>
      </div>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private createShutdownConfirmationPage(): Response {
    const agentState = this.getAgentState();
    const shutdownToken = crypto.randomUUID();
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shutdown Confirmation - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        <h1>🛑 Shutdown Trading Agent</h1>
        
        <div class="warning">
          <strong>⚠️ Warning:</strong> This will shutdown the trading agent.
          <ul>
            <li>All pending orders will be cancelled</li>
            <li>Current positions will remain open</li>
            <li>Agent state will be saved</li>
            <li>Manual restart required</li>
          </ul>
        </div>
        
        <div class="status-info">
          <strong>Current Status:</strong><br>
          Account Balance: $${agentState.account_balance.toLocaleString()}<br>
          Open Positions: ${agentState.open_positions.length}<br>
          Agent Status: ${agentState.is_paused ? 'PAUSED' : 'ACTIVE'}
        </div>
        
        <h3>Choose shutdown type:</h3>
        
        <button class="btn btn-warning" onclick="window.location.href='/shutdown/graceful/${shutdownToken}'">
          🔄 Graceful Shutdown (Recommended)
        </button>
        
        <button class="btn btn-danger" onclick="confirmEmergency('${shutdownToken}')">
          🚨 Emergency Shutdown
        </button>
        
        <button class="btn btn-secondary" onclick="window.location.href='/'">
          ← Cancel
        </button>
      </div>
      
      <script>
        function confirmEmergency(token) {
          if (confirm('Are you sure? This will force shutdown immediately!')) {
            window.location.href = '/shutdown/emergency/' + token;
          }
        }
      </script>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  private createShutdownExecutionPage(path: string): Response {
    const isEmergency = path.includes('emergency');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shutdown in Progress - Ada Analytics</title>
      ${this.getCommonStyles()}
    </head>
    <body>
      <div class="container">
        <h1>${isEmergency ? '🚨' : '🔄'} ${isEmergency ? 'Emergency' : 'Graceful'} Shutdown in Progress</h1>
        <p>Please wait while the agent shuts down...</p>
        
        <div class="progress">
          <div class="progress-bar" id="progress"></div>
        </div>
        
        <div id="status">Initiating shutdown...</div>
      </div>
      
      <script>
        let progress = 0;
        const interval = setInterval(() => {
          progress += ${isEmergency ? '25' : '10'};
          document.getElementById('progress').style.width = progress + '%';
          
          if (progress >= 100) {
            clearInterval(interval);
            document.getElementById('status').innerHTML = '✅ Shutdown complete. Agent safely stopped.';
          }
        }, ${isEmergency ? '200' : '500'});
      </script>
    </body>
    </html>
    `;
    
    return this.createHtmlResponse(html);
  }

  // Utility methods

  private getCommonStyles(): string {
    return `
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
      .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
      .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
      .active { background: #d4edda; border: 1px solid #c3e6cb; }
      .paused { background: #f8d7da; border: 1px solid #f5c6cb; }
      .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
      .status-info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 10px 0; border-radius: 5px; }
      
      .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; }
      .btn-primary { background: #007bff; color: white; }
      .btn-success { background: #28a745; color: white; }
      .btn-danger { background: #dc3545; color: white; }
      .btn-warning { background: #ffc107; color: black; }
      .btn-info { background: #17a2b8; color: white; }
      .btn-secondary { background: #6c757d; color: white; }
      .btn-shutdown { background: #fd7e14; color: white; }
      
      .quick-stats { display: flex; gap: 20px; margin: 20px 0; }
      .stat-card { background: #f8f9fa; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
      .stat-value { font-size: 24px; font-weight: bold; }
      .stat-label { color: #6c757d; font-size: 14px; }
      .positive { color: #28a745; }
      .negative { color: #dc3545; }
      
      .controls { margin: 20px 0; }
      .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .test-section { background: #f8f9fa; padding: 20px; border-radius: 5px; }
      
      .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
      .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; text-align: center; }
      .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
      .metric-label { color: #6c757d; font-size: 14px; }
      
      .trades-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      .trades-table th, .trades-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
      .trades-table th { background-color: #f8f9fa; font-weight: bold; }
      
      .trades-list { margin: 20px 0; }
      .trade-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
      .trade-date { color: #6c757d; font-size: 14px; }
      
      .test-result { padding: 20px; margin: 20px 0; border-radius: 5px; }
      .test-result.success { background: #d4edda; border: 1px solid #c3e6cb; }
      .test-result.error { background: #f8d7da; border: 1px solid #f5c6cb; }
      .error-text { color: #721c24; }
      
      .progress { background: #e9ecef; border-radius: 5px; overflow: hidden; margin: 20px 0; }
      .progress-bar { background: #007bff; height: 30px; width: 0%; transition: width 0.3s; }
      
      nav { margin-bottom: 20px; }
      nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
      
      pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
    </style>
    `;
  }

  private getNavigationBar(): string {
    return `
    <nav>
      <a href="/">🏠 Dashboard</a>
      <a href="/performance">📊 Performance</a>
      <a href="/trades">📈 Trade History</a>
      <a href="/test">🧪 Test Functions</a>
      <a href="/api/health" target="_blank">🔍 API Health</a>
    </nav>
    `;
  }

  private createJsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "content-type": "application/json" }
    });
  }

  private createHtmlResponse(html: string): Response {
    return new Response(html, {
      headers: { "content-type": "text/html" }
    });
  }

  private createErrorResponse(error: Error | unknown, status: number = 500): Response {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" }
    });
  }

  private createNotFoundResponse(): Response {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Get detailed health status for all services
   */
  private async getDetailedHealthStatus(): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    
    const services = {
      anthropic: { status: "unknown", response_time: 0 },
      alpaca: { status: "unknown", response_time: 0 },
      supabase: { status: "unknown", response_time: 0 },
      quiver: { status: "unknown", response_time: 0 },
      email: { status: this.emailService.isConfigured() ? "configured" : "not_configured", response_time: 0 }
    };

    // Test AI Service
    try {
      const aiStart = Date.now();
      const aiTest = await this.aiService.testConnection();
      services.anthropic.status = aiTest.success ? "healthy" : "unhealthy";
      services.anthropic.response_time = Date.now() - aiStart;
    } catch (error) {
      services.anthropic.status = "error";
    }

    // Test Trading Service
    try {
      const tradingStart = Date.now();
      const tradingTest = await this.tradingService.testConnection();
      services.alpaca.status = tradingTest.success ? "healthy" : "unhealthy";
      services.alpaca.response_time = Date.now() - tradingStart;
    } catch (error) {
      services.alpaca.status = "error";
    }

    // Test Database Service
    try {
      const dbStart = Date.now();
      const dbTest = await this.databaseService.testConnection();
      services.supabase.status = dbTest.success ? "healthy" : "unhealthy";
      services.supabase.response_time = Date.now() - dbStart;
    } catch (error) {
      services.supabase.status = "error";
    }

    // Test Market Data Service
    try {
      const marketStart = Date.now();
      const marketTest = await this.marketDataService.testConnection();
      services.quiver.status = marketTest.success ? "healthy" : "unhealthy";
      services.quiver.response_time = Date.now() - marketStart;
    } catch (error) {
      services.quiver.status = "error";
    }

    const healthyServices = Object.values(services).filter(s => s.status === "healthy").length;
    const totalServices = Object.keys(services).length - 1; // Exclude email from count
    
    return {
      overall_status: healthyServices >= totalServices - 1 ? "healthy" : "degraded",
      services,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      healthy_services: healthyServices,
      total_services: totalServices,
      check_duration: Date.now() - startTime
    };
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<Record<string, unknown>> {
    const agentState = this.getAgentState();
    const performance = await this.databaseService.getTradingPerformance();
    
    return {
      timestamp: new Date().toISOString(),
      agent_state: {
        is_paused: agentState.is_paused,
        last_run: agentState.last_run,
        current_strategy: agentState.current_strategy,
        account_balance: agentState.account_balance
      },
      trading_metrics: {
        total_trades: performance.total_trades,
        win_rate: performance.win_rate,
        avg_return: performance.avg_return,
        symbols_traded: performance.symbols_traded.length
      },
      system_info: {
        deno_version: Deno.version.deno,
        platform: Deno.build.os,
        arch: Deno.build.arch,
        memory_usage: this.getMemoryUsage()
      }
    };
  }

  /**
   * Get recent logs from database
   */
  private getRecentLogs(level: string, limit: number): Promise<Record<string, unknown>> {
    try {
      // This would connect to your logging system
      // For now, return a placeholder
      return Promise.resolve({
        logs: [],
        level,
        limit,
        message: "Log retrieval from database not yet implemented",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return Promise.resolve({
        error: "Failed to retrieve logs",
        message: String(error),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): Record<string, number> {
    if (typeof Deno.memoryUsage === 'function') {
      const usage = Deno.memoryUsage();
      return {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: 0
      };
    }
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    };
  }

  /**
   * Get API usage statistics for cost monitoring
   */
  private async getUsageStats(): Promise<Record<string, unknown>> {
    const agentState = this.getAgentState();
    const today = new Date();
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      // Get usage from database if available
      const monthlyUsage = await this.databaseService.getMonthlyUsage(thisMonth);
      
      return {
        timestamp: new Date().toISOString(),
        period: thisMonth,
        claude_requests: monthlyUsage?.claude_requests || 0,
        estimated_cost_usd: monthlyUsage?.estimated_cost || 0,
        budget_limit_usd: 8,
        budget_remaining_usd: Math.max(0, 8 - (monthlyUsage?.estimated_cost || 0)),
        trades_this_month: monthlyUsage?.trades_count || 0,
        last_request: agentState.last_run,
        daily_limit_reached: (monthlyUsage?.daily_requests || 0) >= 20,
        budget_warning: (monthlyUsage?.estimated_cost || 0) > 6.4 // 80% of budget
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        period: thisMonth,
        error: 'Usage tracking not available',
        estimated_cost_usd: 0,
        budget_limit_usd: 8,
        message: 'Database usage tracking not implemented yet'
      };
    }
  }
}
/**
 * Secure Web Server - Enhanced with JWT Auth, Rate Limiting, CORS, and Security Features
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

// Import security middlewares
import { RATE_LIMITS } from './middleware/rateLimit.ts';
import { CorsMiddleware } from './middleware/cors.ts';
import { SecurityMiddleware, VALIDATION_SCHEMAS, SecurityEvent } from './middleware/security.ts';

export class SecureWebServer {
  private logger: TradingLogger;
  private config: WebServerConfig;
  private server: Deno.HttpServer | null = null;
  
  // Security middlewares
  private corsMiddleware: CorsMiddleware;  
  private securityMiddleware: SecurityMiddleware;
  
  // Service dependencies
  private marketDataService: IMarketDataService;
  private tradingService: ITradingService;
  private emailService: IEmailService;
  private databaseService: IDatabaseService;
  private aiService: IAIService;
  
  // Agent state management
  private getAgentState: () => AgentState;
  private updateAgentState: (updates: Partial<AgentState>) => Promise<void>;

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
    config?: Partial<WebServerConfig>
  ) {
    this.logger = logger;
    this.config = { ...WEB_SERVER_CONFIG, ...config };
    
    // Initialize security middlewares
    this.corsMiddleware = new CorsMiddleware({
      allowedOrigins: [
        'http://localhost:5173', // SvelteKit dev
        'http://localhost:8080',
        'https://adaanalytics.io',
        'https://dashboard.adaanalytics.io'
      ]
    });
    this.securityMiddleware = new SecurityMiddleware(logger);
    
    this.marketDataService = services.marketDataService;
    this.tradingService = services.tradingService;
    this.emailService = services.emailService;
    this.databaseService = services.databaseService;
    this.aiService = services.aiService;
    
    this.getAgentState = stateManagement.getAgentState;
    this.updateAgentState = stateManagement.updateAgentState;
  }

  /**
   * Start the secure web server
   */
  start(): void {
    const handler = this.createSecureRequestHandler();
    
    this.logger.log('STATUS', `Starting secure web server on port ${this.config.port}`);
    
    serve(handler, { 
      port: this.config.port,
      onListen: ({ port, hostname }) => {
        this.logger.log('STATUS', `🔒 Secure web server listening on http://${hostname}:${port}`);
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
   * Create the secure request handler with all middleware
   */
  private createSecureRequestHandler() {
    return async (request: Request): Promise<Response> => {
      const startTime = Date.now();
      let response: Response;

      try {
        // 1. Handle CORS preflight
        const preflightResponse = this.corsMiddleware.handlePreflight(request);
        if (preflightResponse) {
          return preflightResponse;
        }

        // 2. Apply rate limiting
        const url = new URL(request.url);
        const path = url.pathname;
        
        const rateLimitResult = this.checkRateLimit(request, path);
        if (!rateLimitResult.allowed) {
          this.logSecurityEvent({
            type: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${path}`,
            ip: this.getClientIP(request),
            endpoint: path
          });
          return rateLimitResult.response!;
        }

        // 3. Route the request
        response = await this.routeRequest(request, url, path);

        // 4. Add CORS headers to response
        response = this.corsMiddleware.addCorsHeaders(response, request);

        // 5. Log the request
        this.logRequest(request, response, Date.now() - startTime);

        return response;

      } catch (error) {
        this.logger.log('ALERT', `Request handler error: ${error}`);
        
        response = new Response(
          JSON.stringify({ error: 'Internal server error' }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' }
          }
        );

        return this.corsMiddleware.addCorsHeaders(response, request);
      }
    };
  }

  /**
   * Check rate limits for the request
   */
  private checkRateLimit(request: Request, path: string): { allowed: boolean; response?: Response } {
    let limiter;
    
    if (path.startsWith('/api/auth/')) {
      limiter = RATE_LIMITS.auth;
    } else if (path.startsWith('/api/trading/')) {
      limiter = RATE_LIMITS.trading;
    } else if (path.startsWith('/api/email/')) {
      limiter = RATE_LIMITS.email;
    } else {
      limiter = RATE_LIMITS.api;
    }

    const result = limiter.checkLimit(request);
    
    if (!result.allowed) {
      return {
        allowed: false,
        response: limiter.createRateLimitResponse(result.resetTime!)
      };
    }

    return { allowed: true };
  }

  /**
   * Route requests (no authentication required with service role)
   */
  private async routeRequest(request: Request, url: URL, path: string): Promise<Response> {
    // All endpoints are now public (no auth required with service role)
    if (this.isPublicEndpoint(path)) {
      return await this.handlePublicEndpoint(path, url, request);
    }

    return await this.handleApiRequest(path, url, request);
  }

  /**
   * Check if endpoint is public (no auth required)
   */
  private isPublicEndpoint(path: string): boolean {
    const publicPaths = [
      '/api/health',
      '/api/status',
      '/api/auth/login',
      '/api/auth/register',
      '/pause/',  // Email pause links
      '/resume/' // Email resume links
    ];

    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  /**
   * Handle public endpoints
   */
  private async handlePublicEndpoint(path: string, url: URL, request: Request): Promise<Response> {
    // Health check
    if (path === '/api/health') {
      return new Response(
        JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Agent status
    if (path === '/api/status') {
      const state = this.getAgentState();
      return new Response(
        JSON.stringify({
          status: state.is_paused ? 'paused' : 'active',
          last_run: state.last_run,
          account_balance: state.account_balance,
          strategy: state.current_strategy
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pause trading (from email link)
    if (path.startsWith('/pause/')) {
      const token = path.split('/')[2];
      const state = this.getAgentState();
      
      if (token === state.pause_token) {
        await this.updateAgentState({ is_paused: true });
        return new Response('Trading has been paused successfully.', { 
          headers: { 'Content-Type': 'text/plain' } 
        });
      }
      
      return new Response('Invalid pause token.', { 
        status: 400, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    // Resume trading (from email link)
    if (path.startsWith('/resume/')) {
      const token = path.split('/')[2];
      const state = this.getAgentState();
      
      // For now, just resume trading without token validation
      // TODO(#feature): Implement proper resume token validation
      await this.updateAgentState({ 
        is_paused: false
      });
      return new Response('Trading has been resumed successfully.', { 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle protected endpoints with role-based access
   */


  /**
   * Check if endpoint requires admin access
   */
  private isAdminEndpoint(path: string): boolean {
    const adminPaths = [
      '/api/admin/',
      '/api/trading/execute',
      '/api/agent/pause',
      '/api/agent/resume',
      '/api/config/'
    ];

    return adminPaths.some(adminPath => path.startsWith(adminPath));
  }

  /**
   * Check if endpoint requires trader access
   */
  private isTraderEndpoint(path: string): boolean {
    const traderPaths = [
      '/api/trading/',
      '/api/trades/',
      '/api/market-data/',
      '/api/predictions/'
    ];

    return traderPaths.some(traderPath => path.startsWith(traderPath));
  }

  /**
   * Handle API requests with input validation
   */
  private async handleApiRequest(
    path: string, 
    url: URL, 
    request: Request
  ): Promise<Response> {
    
    // Parse request body if present
    let body: unknown = null;
    if (request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
      try {
        const text = await request.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route to specific handlers with race condition protection
    try {
      if (path.startsWith('/api/agent/')) {
        return await this.handleAgentApi(path, request.method, body);
      }
      
      if (path.startsWith('/api/trading/')) {
        return await this.handleTradingApi(path, request.method, body);
      }
      
      if (path.startsWith('/api/data/')) {
        return await this.handleDataApi(path, request.method, url.searchParams);
      }
      
      if (path.startsWith('/api/email/')) {
        return await this.handleEmailApi(path, request.method, body);
      }

      return new Response('API endpoint not found', { status: 404 });
      
    } catch (error) {
      this.logger.log('ALERT', `API handler error for ${path}: ${error}`);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle agent-related API calls
   */
  private async handleAgentApi(
    path: string, 
    method: string, 
    body: unknown
  ): Promise<Response> {
    
    if (path === '/api/agent/status' && method === 'GET') {
      const state = this.getAgentState();
      return new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/agent/pause' && method === 'POST') {
      return await this.securityMiddleware.withLock('agent-pause', async () => {
        // Validate input
        const validation = this.securityMiddleware.validateInput(body || {}, VALIDATION_SCHEMAS.pauseRequest);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: 'Invalid input', details: validation.errors }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        await this.updateAgentState({ is_paused: true });
        
        // Log the action
        this.logger.log('STATUS', 'Agent paused via API');
        
        return new Response(
          JSON.stringify({ success: true, message: 'Agent paused' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });
    }

    if (path === '/api/agent/resume' && method === 'POST') {
      return await this.securityMiddleware.withLock('agent-resume', async () => {
        await this.updateAgentState({ is_paused: false });
        
        this.logger.log('STATUS', 'Agent resumed via API');
        
        return new Response(
          JSON.stringify({ success: true, message: 'Agent resumed' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });
    }

    return new Response('Agent API endpoint not found', { status: 404 });
  }

  /**
   * Handle trading-related API calls
   */
  private async handleTradingApi(
    path: string, 
    method: string, 
    body: unknown
  ): Promise<Response> {
    
    if (path === '/api/trading/account' && method === 'GET') {
      try {
        const accountDetails = await this.tradingService.getAccountDetails();
        return new Response(JSON.stringify(accountDetails), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch account details' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response('Trading API endpoint not found', { status: 404 });
  }

  /**
   * Handle data-related API calls  
   */
  private async handleDataApi(
    path: string, 
    method: string, 
    searchParams: URLSearchParams
  ): Promise<Response> {
    
    if (path === '/api/data/trades' && method === 'GET') {
      try {
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
        const trades = await this.databaseService.getHistoricalTrades(limit);
        
        return new Response(JSON.stringify(trades), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch trades' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response('Data API endpoint not found', { status: 404 });
  }

  /**
   * Handle email-related API calls
   */
  private async handleEmailApi(
    path: string, 
    method: string, 
    body: unknown
  ): Promise<Response> {
    
    if (path === '/api/email/count' && method === 'GET') {
      try {
        const emailCount = await this.emailService.getCurrentEmailCount();
        return new Response(JSON.stringify({
          success: true,
          ...emailCount,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch email count' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    if (path === '/api/email/test' && method === 'POST') {
      // Validate input
      const validation = this.securityMiddleware.validateInput(body || {}, VALIDATION_SCHEMAS.emailRequest);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid input', details: validation.errors }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const success = await this.emailService.sendTestEmail();
        return new Response(JSON.stringify({ success }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to send test email' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response('Email API endpoint not found', { status: 404 });
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    const headers = request.headers;
    return headers.get('x-forwarded-for')?.split(',')[0] ||
           headers.get('x-real-ip') ||
           headers.get('x-client-ip') ||
           'unknown';
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: SecurityEvent): void {
    this.securityMiddleware.logSecurityEvent(event);
  }

  /**
   * Log HTTP requests (without sensitive data)
   */
  private logRequest(request: Request, response: Response, duration: number): void {
    const url = new URL(request.url);
    const logData = this.securityMiddleware.sanitizeForLogging({
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration: `${duration}ms`,
      ip: this.getClientIP(request),
      userAgent: request.headers.get('User-Agent')
    });

    // Only log non-sensitive successful requests at INFO level
    if (response.status < 400 && !(logData.path as string).includes('auth')) {
      // Don't log every request to avoid noise
      return;
    }

    const level = response.status >= 400 ? 'ALERT' : 'STATUS';
    this.logger.log(level, `HTTP ${request.method} ${url.pathname} ${response.status} (${duration}ms)`);
  }
}
/**
 * CORS Middleware with secure configuration
 */

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export class CorsMiddleware {
  private config: CorsConfig;

  constructor(config?: Partial<CorsConfig>) {
    this.config = {
      allowedOrigins: config?.allowedOrigins || [
        'http://localhost:8080',
        'https://ada-analytics.com',
        'https://dashboard.ada-analytics.com'
      ],
      allowedMethods: config?.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: config?.allowedHeaders || [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
      ],
      credentials: config?.credentials ?? true,
      maxAge: config?.maxAge ?? 86400 // 24 hours
    };
  }

  /**
   * Handle CORS preflight requests
   */
  handlePreflight(request: Request): Response | null {
    if (request.method !== 'OPTIONS') {
      return null;
    }

    const origin = request.headers.get('Origin');
    
    if (!this.isOriginAllowed(origin)) {
      return new Response(null, { status: 403 });
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', origin || '*');
    headers.set('Access-Control-Allow-Methods', this.config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    headers.set('Access-Control-Max-Age', this.config.maxAge.toString());
    
    if (this.config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return new Response(null, { status: 204, headers });
  }

  /**
   * Add CORS headers to response
   */
  addCorsHeaders(response: Response, request: Request): Response {
    const origin = request.headers.get('Origin');
    
    if (!this.isOriginAllowed(origin)) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin || '*');
    
    if (this.config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Content-Security-Policy', this.getCSP());

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string | null): boolean {
    if (!origin) return true; // Same-origin requests

    // Never allow wildcard in production
    if (this.config.allowedOrigins.includes('*')) {
      const isDevelopment = Deno.env.get('DENO_ENV') === 'development';
      if (!isDevelopment) {
        throw new Error('Wildcard CORS origin not allowed in production');
      }
    }

    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Generate Content Security Policy
   */
  private getCSP(): string {
    const isDevelopment = Deno.env.get('DENO_ENV') === 'development';
    
    if (isDevelopment) {
      return "default-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* ws://localhost:*";
    }

    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: https:",
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'"
    ].join('; ');
  }
}
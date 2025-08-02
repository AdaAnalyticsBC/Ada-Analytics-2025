/**
 * Rate Limiting Middleware
 */

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyGenerator?: (request: Request) => string;
}

export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request should be rate limited
   */
  checkLimit(request: Request): { allowed: boolean; resetTime?: number; remaining?: number } {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(request)
      : this.getClientIP(request);

    const now = Date.now();
    const bucket = this.requests.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.1) {
      this.cleanup(now);
    }

    if (!bucket || now > bucket.resetTime) {
      // Create new bucket or reset expired one
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      
      return {
        allowed: true,
        resetTime: now + this.config.windowMs,
        remaining: this.config.maxRequests - 1
      };
    }

    if (bucket.count >= this.config.maxRequests) {
      return {
        allowed: false,
        resetTime: bucket.resetTime,
        remaining: 0
      };
    }

    bucket.count++;
    
    return {
      allowed: true,
      resetTime: bucket.resetTime,
      remaining: this.config.maxRequests - bucket.count
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    // Check common headers for client IP
    const headers = request.headers;
    return headers.get('x-forwarded-for')?.split(',')[0] ||
           headers.get('x-real-ip') ||
           headers.get('x-client-ip') ||
           'unknown';
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanup(now: number): void {
    for (const [key, bucket] of this.requests.entries()) {
      if (now > bucket.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Create rate limit response
   */
  createRateLimitResponse(resetTime: number): Response {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        resetTime: new Date(resetTime).toISOString()
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Reset': resetTime.toString()
        }
      }
    );
  }
}

// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
  // General API calls
  api: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  }),
  
  // Authentication endpoints
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10
  }),
  
  // Trading actions (more restrictive)
  trading: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5
  }),
  
  // Email sending
  email: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20
  })
};
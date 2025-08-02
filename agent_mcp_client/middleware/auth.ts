/**
 * Authentication Middleware - JWT with Supabase
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
}

export class AuthMiddleware {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Validate JWT token and return user info
   */
  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'user'
      };
    } catch (error) {
      // Token validation failed - log securely without exposing sensitive data
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(headers: Headers): string | null {
    const authHeader = headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Middleware function for protecting routes
   */
  async authenticate(request: Request): Promise<{ user: AuthenticatedUser | null; error?: string }> {
    const token = this.extractToken(request.headers);
    
    if (!token) {
      return { user: null, error: 'Missing authorization token' };
    }

    const user = await this.validateToken(token);
    
    if (!user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user };
  }

  /**
   * Check if user has required role
   */
  hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
    if (requiredRole === 'admin') {
      return user.role === 'admin';
    }
    if (requiredRole === 'trader') {
      return user.role === 'admin' || user.role === 'trader';
    }
    return true; // Default: any authenticated user
  }
}
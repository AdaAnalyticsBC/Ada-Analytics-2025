/**
 * Security Middleware - Handles race conditions, input validation, and logging
 */

import { TradingLogger } from '../types/interfaces.ts';

export class SecurityMiddleware {
  private logger: TradingLogger;
  private operationLocks: Map<string, Promise<unknown>> = new Map();

  constructor(logger: TradingLogger) {
    this.logger = logger;
  }

  /**
   * Prevent race conditions for critical operations
   */
  async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check if operation is already running
    const existingLock = this.operationLocks.get(key);
    if (existingLock) {
      this.logger.log('ALERT', `Operation ${key} blocked due to concurrent execution`);
      throw new Error(`Operation ${key} is already in progress`);
    }

    // Create and store the lock
    const lockPromise = operation()
      .finally(() => {
        // Remove lock when operation completes
        this.operationLocks.delete(key);
      });

    this.operationLocks.set(key, lockPromise);
    
    try {
      return await lockPromise;
    } catch (error) {
      this.logger.log('ALERT', `Operation ${key} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Validate and sanitize input data
   */
  validateInput(data: unknown, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    
    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const obj = data as Record<string, unknown>;

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      
      // Check required fields
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Field '${field}' is required`);
        continue;
      }

      // Skip validation if field is optional and not provided
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      if (rules.type && typeof value !== rules.type) {
        errors.push(`Field '${field}' must be of type ${rules.type}`);
        continue;
      }

      // String validations
      if (rules.type === 'string' && typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`Field '${field}' must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`Field '${field}' must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Field '${field}' format is invalid`);
        }
      }

      // Number validations
      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field '${field}' must be at most ${rules.max}`);
        }
      }

      // Array validations
      if (rules.type === 'object' && Array.isArray(value) && rules.arrayItems) {
        if (rules.minItems && value.length < rules.minItems) {
          errors.push(`Field '${field}' must have at least ${rules.minItems} items`);
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          errors.push(`Field '${field}' must have at most ${rules.maxItems} items`);
        }

        // Validate each array item
        value.forEach((item, index) => {
          const itemResult = this.validateInput(item, { item: rules.arrayItems! });
          if (!itemResult.valid) {
            errors.push(`Field '${field}[${index}]': ${itemResult.errors.join(', ')}`);
          }
        });
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value as string)) {
        errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize potentially dangerous characters from strings
   */
  sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"\\]/g, '') // Remove quotes and backslashes
      .replace(/\x00/g, '') // Remove null bytes
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: SecurityEvent): void {
    this.logger.log('ALERT', `SECURITY: ${event.type} - ${event.message}`, {
      ip: event.ip,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      userId: event.userId
    });
  }

  /**
   * Remove sensitive information from logs
   */
  sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization', 
      'api_key', 'apikey', 'auth', 'credential', 'pin'
    ];

    const sanitized = { ...obj };
    
    for (const field of Object.keys(sanitized)) {
      const lowerField = field.toLowerCase();
      if (sensitiveFields.some(sensitive => lowerField.includes(sensitive))) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Type definitions
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  arrayItems?: ValidationRule;
  minItems?: number;
  maxItems?: number;
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SecurityEvent {
  type: 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_INPUT' | 'SUSPICIOUS_ACTIVITY';
  message: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  userId?: string;
}

// Common validation schemas
export const VALIDATION_SCHEMAS = {
  tradePlan: {
    trades: { required: true, type: 'object' as const, arrayItems: { required: true, type: 'object' as const } },
    risk_assessment: { required: true, type: 'string' as const, maxLength: 1000 },
    total_risk_exposure: { required: true, type: 'number' as const, min: 0, max: 1 }
  },
  
  pauseRequest: {
    reason: { required: false, type: 'string' as const, maxLength: 500 }
  },
  
  emailRequest: {
    recipient: { required: true, type: 'string' as const, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    subject: { required: true, type: 'string' as const, maxLength: 200 },
    content: { required: true, type: 'string' as const, maxLength: 10000 }
  }
};
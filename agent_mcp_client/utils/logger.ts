/**
 * Trading Logger - Centralized logging utility for the trading agent
 */

import { TradingLogger, LogLevel } from '../types/interfaces.ts';
import { LOGGING_CONFIG } from '../config.ts';

export class Logger implements TradingLogger {
  /**
   * Clean trading-focused logging
   */
  log(type: LogLevel, message: string): void {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: LOGGING_CONFIG.TIMEZONE 
    });
    
    const icon = LOGGING_CONFIG.ICONS[type];
    const color = LOGGING_CONFIG.COLORS[type];
    const reset = LOGGING_CONFIG.RESET;
    
    console.log(`${color}${icon} [${timestamp}] ${type}: ${message}${reset}`);
  }

  /**
   * Log with different levels for different outputs
   */
  info(message: string): void {
    this.log('STATUS', message);
  }

  warn(message: string): void {
    this.log('ALERT', message);
  }

  error(message: string): void {
    this.log('ALERT', message);
  }

  analysis(message: string): void {
    this.log('ANALYSIS', message);
  }

  trade(message: string): void {
    this.log('TRADE', message);
  }

  plan(message: string): void {
    this.log('PLAN', message);
  }
}
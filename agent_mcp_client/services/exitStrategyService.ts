/**
 * Exit Strategy Service - Handles batch exits, stop-loss, and take-profit
 * Implements:
 * - Stop-Loss: -6% from purchase price
 * - Take-Profit: +10% from purchase price
 * - Batch Exit: 50%/30%/20%
 */

import { TradingLogger, TradeDecision, Position, Order } from '../types/interfaces.ts';

export interface ExitLevel {
  percentage: number;      // Percentage of position to exit (0.5 = 50%)
  trigger_price: number;   // Price at which to trigger exit
  order_type: 'stop' | 'limit' | 'market';
  reasoning: string;
}

export interface EnhancedExitStrategy {
  symbol: string;
  entry_price: number;
  total_quantity: number;
  action: 'BUY' | 'SELL';
  
  // Stop Loss (single exit at -6%)
  stop_loss: ExitLevel;
  
  // Take Profit (batch exits at +10%, +15%, +20%)
  take_profit_levels: ExitLevel[];
  
  // Metadata
  created_at: string;
  reasoning: string;
}

export interface ExitOrderResult {
  success: boolean;
  order_id?: string;
  executed_quantity: number;
  exit_price?: number;
  remaining_quantity: number;
  exit_reason: string;
  error?: string;
}

export class ExitStrategyService {
  private logger: TradingLogger;
  
  // Strategy constants
  private readonly STOP_LOSS_PERCENTAGE = -0.06;  // -6%
  private readonly TAKE_PROFIT_BASE = 0.10;       // +10% base
  
  // Batch exit percentages: 50%, 30%, 20%
  private readonly BATCH_EXIT_LEVELS = [
    { percentage: 0.50, price_increment: 0.10 }, // 50% at +10%
    { percentage: 0.30, price_increment: 0.15 }, // 30% at +15% 
    { percentage: 0.20, price_increment: 0.20 }  // 20% at +20%
  ];

  constructor(logger: TradingLogger) {
    this.logger = logger;
  }

  /**
   * Create enhanced exit strategy for a trade
   */
  createExitStrategy(trade: TradeDecision, entryPrice?: number): EnhancedExitStrategy {
    const entry = entryPrice || trade.price_target;
    const quantity = trade.quantity;
    
    // Create stop loss level
    const stopLoss = this.createStopLossLevel(trade, entry, quantity);
    
    // Create take profit levels (batch exits)
    const takeProfitLevels = this.createTakeProfitLevels(trade, entry, quantity);
    
    const strategy: EnhancedExitStrategy = {
      symbol: trade.symbol,
      entry_price: entry,
      total_quantity: quantity,
      action: trade.action,
      stop_loss: stopLoss,
      take_profit_levels: takeProfitLevels,
      created_at: new Date().toISOString(),
      reasoning: `Enhanced exit strategy: -6% stop loss, +10%/+15%/+20% batch take profits (50%/30%/20%)`
    };

    this.logger.log('PLAN', 
      `Created enhanced exit strategy for ${trade.symbol}: ` +
      `Stop: $${stopLoss.trigger_price.toFixed(2)} (-6%), ` +
      `Take Profits: $${takeProfitLevels.map(tp => tp.trigger_price.toFixed(2)).join('/$')} (+10%/+15%/+20%)`
    );

    return strategy;
  }

  /**
   * Create stop loss level at -6%
   */
  private createStopLossLevel(trade: TradeDecision, entryPrice: number, quantity: number): ExitLevel {
    const stopPrice = trade.action === 'BUY' 
      ? entryPrice * (1 + this.STOP_LOSS_PERCENTAGE)  // Buy: stop below entry
      : entryPrice * (1 - this.STOP_LOSS_PERCENTAGE); // Sell: stop above entry

    return {
      percentage: 1.0, // Exit entire position
      trigger_price: stopPrice,
      order_type: 'stop',
      reasoning: `Stop loss at -6% from entry price $${entryPrice.toFixed(2)}`
    };
  }

  /**
   * Create take profit levels with batch exits (50%/30%/20%)
   */
  private createTakeProfitLevels(trade: TradeDecision, entryPrice: number, quantity: number): ExitLevel[] {
    const levels: ExitLevel[] = [];
    
    for (const batchLevel of this.BATCH_EXIT_LEVELS) {
      const profitPrice = trade.action === 'BUY'
        ? entryPrice * (1 + batchLevel.price_increment)  // Buy: profit above entry
        : entryPrice * (1 - batchLevel.price_increment); // Sell: profit below entry
      
      const exitQuantity = Math.floor(quantity * batchLevel.percentage);
      
      if (exitQuantity > 0) {
        levels.push({
          percentage: batchLevel.percentage,
          trigger_price: profitPrice,
          order_type: 'limit',
          reasoning: `Take profit ${(batchLevel.percentage * 100).toFixed(0)}% of position ` +
                    `(${exitQuantity} shares) at +${(batchLevel.price_increment * 100).toFixed(0)}% ` +
                    `from entry price $${entryPrice.toFixed(2)}`
        });
      }
    }

    return levels;
  }

  /**
   * Calculate exit prices for existing positions
   */
  calculateExitPrices(position: Position): {
    stop_loss_price: number;
    take_profit_prices: number[];
  } {
    const entryPrice = position.cost_basis / Math.abs(position.qty);
    const isLong = position.side === 'long';
    
    // Stop loss at -6%
    const stopLossPrice = isLong 
      ? entryPrice * (1 + this.STOP_LOSS_PERCENTAGE)
      : entryPrice * (1 - this.STOP_LOSS_PERCENTAGE);
    
    // Take profit levels at +10%, +15%, +20%
    const takeProfitPrices = this.BATCH_EXIT_LEVELS.map(level => {
      return isLong
        ? entryPrice * (1 + level.price_increment)
        : entryPrice * (1 - level.price_increment);
    });

    return {
      stop_loss_price: stopLossPrice,
      take_profit_prices: takeProfitPrices
    };
  }

  /**
   * Check if current price triggers any exit levels
   */
  checkExitTriggers(
    strategy: EnhancedExitStrategy, 
    currentPrice: number,
    remainingQuantity: number
  ): {
    triggered_stops: ExitLevel[];
    triggered_profits: ExitLevel[];
    should_exit: boolean;
  } {
    const triggeredStops: ExitLevel[] = [];
    const triggeredProfits: ExitLevel[] = [];
    
    const isLong = strategy.action === 'BUY';
    
    // Check stop loss
    const stopTriggered = isLong 
      ? currentPrice <= strategy.stop_loss.trigger_price
      : currentPrice >= strategy.stop_loss.trigger_price;
      
    if (stopTriggered) {
      triggeredStops.push(strategy.stop_loss);
    }
    
    // Check take profit levels (only if no stop loss triggered)
    if (!stopTriggered) {
      for (const level of strategy.take_profit_levels) {
        const profitTriggered = isLong
          ? currentPrice >= level.trigger_price
          : currentPrice <= level.trigger_price;
          
        if (profitTriggered) {
          triggeredProfits.push(level);
        }
      }
    }

    return {
      triggered_stops: triggeredStops,
      triggered_profits: triggeredProfits,
      should_exit: triggeredStops.length > 0 || triggeredProfits.length > 0
    };
  }

  /**
   * Generate exit orders for triggered levels
   */
  generateExitOrders(
    strategy: EnhancedExitStrategy,
    triggeredLevels: ExitLevel[],
    currentPrice: number,
    remainingQuantity: number
  ): Array<{
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    order_type: 'market' | 'limit' | 'stop';
    price?: number;
    reasoning: string;
  }> {
    const orders = [];
    const oppositeSide = strategy.action === 'BUY' ? 'sell' : 'buy';
    
    for (const level of triggeredLevels) {
      const exitQuantity = level.percentage === 1.0 
        ? remainingQuantity  // Full exit for stop loss
        : Math.floor(strategy.total_quantity * level.percentage);
      
      if (exitQuantity > 0 && exitQuantity <= remainingQuantity) {
        orders.push({
          symbol: strategy.symbol,
          side: oppositeSide,
          quantity: exitQuantity,
          order_type: level.order_type === 'stop' ? 'market' : level.order_type,
          price: level.order_type === 'limit' ? level.trigger_price : undefined,
          reasoning: level.reasoning
        });
      }
    }

    return orders as Array<{
      symbol: string;
      side: 'buy' | 'sell';
      quantity: number;
      order_type: 'market' | 'limit' | 'stop';
      price?: number;
      reasoning: string;
    }>;
  }

  /**
   * Update trade decision with enhanced exit strategy
   */
  enhanceTradeWithExitStrategy(trade: TradeDecision): TradeDecision {
    // Update stop loss to -6% (from the previous -5%)
    const entryPrice = trade.price_target;
    
    const newStopLoss = trade.action === 'BUY'
      ? entryPrice * (1 + this.STOP_LOSS_PERCENTAGE)  // -6% for BUY
      : entryPrice * (1 - this.STOP_LOSS_PERCENTAGE); // +6% for SELL (opposite direction)
    
    // Take profit at +10% (this was already correct)
    const newTakeProfit = trade.action === 'BUY'
      ? entryPrice * 1.10  // +10% for BUY
      : entryPrice * 0.90; // -10% for SELL
    
    const enhancedTrade: TradeDecision = {
      ...trade,
      stop_loss: newStopLoss,
      take_profit: newTakeProfit,
      reasoning: trade.reasoning + 
        ` | Enhanced Exit: -6% stop loss, +10% take profit, 50%/30%/20% batch exits`
    };

    this.logger.log('PLAN', 
      `Enhanced ${trade.symbol} exit levels: ` +
      `Stop Loss: $${newStopLoss.toFixed(2)} (-6%), ` +
      `Take Profit: $${newTakeProfit.toFixed(2)} (+10%)`
    );

    return enhancedTrade;
  }

  /**
   * Get exit strategy summary for logging/reporting
   */
  getExitStrategySummary(strategy: EnhancedExitStrategy): string {
    const summary = [];
    summary.push(`Exit Strategy for ${strategy.symbol}:`);
    summary.push(`  Entry Price: $${strategy.entry_price.toFixed(2)}`);
    summary.push(`  Total Quantity: ${strategy.total_quantity} shares`);
    summary.push(`  Stop Loss: $${strategy.stop_loss.trigger_price.toFixed(2)} (-6% risk)`);
    
    strategy.take_profit_levels.forEach((level, index) => {
      const batch = this.BATCH_EXIT_LEVELS[index];
      const percentage = (batch.percentage * 100).toFixed(0);
      const increment = (batch.price_increment * 100).toFixed(0);
      summary.push(`  Take Profit ${index + 1}: $${level.trigger_price.toFixed(2)} (+${increment}%, exit ${percentage}%)`);
    });

    return summary.join('\n');
  }

  /**
   * Validate exit strategy parameters
   */
  validateExitStrategy(strategy: EnhancedExitStrategy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate basic parameters
    if (strategy.total_quantity <= 0) {
      errors.push('Total quantity must be positive');
    }

    if (strategy.entry_price <= 0) {
      errors.push('Entry price must be positive');
    }

    // Validate stop loss
    if (strategy.action === 'BUY' && strategy.stop_loss.trigger_price >= strategy.entry_price) {
      errors.push('Stop loss price should be below entry price for BUY orders');
    } else if (strategy.action === 'SELL' && strategy.stop_loss.trigger_price <= strategy.entry_price) {
      errors.push('Stop loss price should be above entry price for SELL orders');
    }

    // Validate take profit levels
    for (const level of strategy.take_profit_levels) {
      if (strategy.action === 'BUY' && level.trigger_price <= strategy.entry_price) {
        errors.push('Take profit prices should be above entry price for BUY orders');
      } else if (strategy.action === 'SELL' && level.trigger_price >= strategy.entry_price) {
        errors.push('Take profit prices should be below entry price for SELL orders');
      }
    }

    // Validate batch percentages sum to 100%
    const totalPercentage = strategy.take_profit_levels.reduce((sum, level) => sum + level.percentage, 0);
    if (Math.abs(totalPercentage - 1.0) > 0.01) {
      errors.push('Take profit batch percentages should sum to 100%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
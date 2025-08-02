/**
 * Direct Alpaca API Service - Replaces MCP server for Railway deployment
 */

import { ITradingService, TradingLogger, AccountDetails, Position, Order, ExecutedTrade, TradePlan, AgentState, TradeDecision } from '../types/interfaces.ts';

export class DirectAlpacaService implements ITradingService {
  private logger: TradingLogger;
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private paperTrading: boolean;

  constructor(logger: TradingLogger) {
    this.logger = logger;
    this.apiKey = Deno.env.get('ALPACA_API_KEY') || '';
    this.secretKey = Deno.env.get('ALPACA_SECRET_KEY') || '';
    this.paperTrading = Deno.env.get('ALPACA_PAPER_TRADE') === 'True';
    this.baseUrl = this.paperTrading 
      ? 'https://paper-api.alpaca.markets' 
      : 'https://api.alpaca.markets';
  }

  /**
   * Get account details
   */
  async getAccountDetails(): Promise<AccountDetails> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/account`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        balance: parseFloat(data.cash),
        buying_power: parseFloat(data.buying_power),
        portfolio_value: parseFloat(data.portfolio_value),
        day_pnl: parseFloat(data.daytrade_count || '0'),
        cash: parseFloat(data.cash),
        equity: parseFloat(data.equity)
      };
    } catch (error) {
      this.logger.log('ALERT', `Failed to get account details: ${error}`);
      throw error;
    }
  }

  /**
   * Get current positions
   */
  async getCurrentPositions(): Promise<Position[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/positions`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.map((pos: Record<string, unknown>) => ({
        symbol: pos.symbol as string,
        qty: parseFloat(pos.qty as string),
        side: (pos.side as string) === 'long' ? 'long' : 'short',
        market_value: parseFloat(pos.market_value as string),
        cost_basis: parseFloat(pos.cost_basis as string),
        unrealized_pl: parseFloat(pos.unrealized_pl as string),
        unrealized_plpc: parseFloat(pos.unrealized_plpc as string),
        current_price: parseFloat(pos.current_price as string)
      }));
    } catch (error) {
      this.logger.log('ALERT', `Failed to get positions: ${error}`);
      return [];
    }
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(): Promise<Order[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders?status=open`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.map((order: Record<string, unknown>) => ({
        id: order.id as string,
        symbol: order.symbol as string,
        side: (order.side as string) === 'buy' ? 'buy' : 'sell',
        order_type: (order.type as string) as 'market' | 'limit' | 'stop' | 'stop_limit',
        qty: parseFloat(order.qty as string),
        filled_qty: parseFloat(order.filled_qty as string),
        status: (order.status as string) as 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected',
        time_in_force: 'day' as const,
        created_at: order.created_at as string,
        updated_at: order.updated_at as string
      }));
    } catch (error) {
      this.logger.log('ALERT', `Failed to get orders: ${error}`);
      return [];
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<ExecutedTrade[]> {
    try {
      const orderData = {
        symbol: symbol,
        qty: quantity.toString(),
        side: side,
        type: 'market',
        time_in_force: 'day'
      };

      const response = await fetch(`${this.baseUrl}/v2/orders`, {
        method: 'POST',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const order = await response.json();
      
      this.logger.log('TRADE', `Placed ${side} order for ${quantity} shares of ${symbol}`);
      
      return [{
        symbol: order.symbol,
        action: order.side === 'buy' ? 'BUY' : 'SELL',
        quantity: parseFloat(order.qty),
        price_target: order.filled_avg_price ? parseFloat(order.filled_avg_price) : 0,
        stop_loss: 0,
        take_profit: 0,
        confidence: 0.8,
        reasoning: 'Direct API order',
        executed_quantity: parseFloat(order.filled_qty),
        execution_result: {
          success: order.status === 'filled',
          orderId: order.id,
          filledPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : 0
        },
        executed_at: order.filled_at || order.created_at,
        order_id: order.id,
        filled_avg_price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : 0,
        status: order.status === 'filled' ? 'executed' : 'pending'
      }];
    } catch (error) {
      this.logger.log('ALERT', `Failed to place market order: ${error}`);
      throw error;
    }
  }

  /**
   * Cancel all orders
   */
  async cancelAllOrders(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders`, {
        method: 'DELETE',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      this.logger.log('TRADE', 'Cancelled all orders');
    } catch (error) {
      this.logger.log('ALERT', `Failed to cancel orders: ${error}`);
      throw error;
    }
  }

  /**
   * Get stock quote
   */
  async getStockQuote(symbol: string): Promise<any> {
    try {
      const response = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.quotes[symbol];
    } catch (error) {
      this.logger.log('ALERT', `Failed to get quote for ${symbol}: ${error}`);
      return null;
    }
  }

  /**
   * Execute trades from trade plan
   */
  async executeTrades(tradePlan: TradePlan, agentState?: AgentState): Promise<ExecutedTrade[]> {
    const executedTrades: ExecutedTrade[] = [];
    
    for (const trade of tradePlan.trades) {
      try {
        const side = trade.action === 'BUY' ? 'buy' : 'sell';
        const trades = await this.placeMarketOrder(trade.symbol, side, trade.quantity);
        executedTrades.push(...trades);
      } catch (error) {
        this.logger.log('ALERT', `Failed to execute trade for ${trade.symbol}: ${error}`);
      }
    }
    
    return executedTrades;
  }

  /**
   * Set stop loss and take profit (not implemented for direct API)
   */
  setStopLossAndTakeProfit(trade: TradeDecision, orderId: string): Promise<void> {
    this.logger.log('STATUS', `Stop loss and take profit not implemented for direct API`);
    return Promise.resolve();
  }

  /**
   * Test connection to Alpaca API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const account = await this.getAccountDetails();
      return {
        success: true,
        message: `Connected to Alpaca API. Account balance: $${account.balance.toLocaleString()}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Alpaca API: ${error}`
      };
    }
  }

  // Additional methods for compatibility
  setAlpacaClient(client: Record<string, unknown>): void {
    // Not used in direct API mode
  }

  updateClient(client: Record<string, unknown>): void {
    // Not used in direct API mode
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      this.logger.log('TRADE', `Cancelled order ${orderId}`);
    } catch (error) {
      this.logger.log('ALERT', `Failed to cancel order ${orderId}: ${error}`);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.log('ALERT', `Failed to get order status for ${orderId}: ${error}`);
      throw error;
    }
  }

  async getMarketData(symbol: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.quotes[symbol] || {};
    } catch (error) {
      this.logger.log('ALERT', `Failed to get market data for ${symbol}: ${error}`);
      return {};
    }
  }

  async waitForMarketOpen(): Promise<void> {
    this.logger.log('STATUS', 'Market open check not implemented for direct API');
    return Promise.resolve();
  }

  // Note: cancelAllOrders is already implemented above
}
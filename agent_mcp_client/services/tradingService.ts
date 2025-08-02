/**
 * Trading Service - Handles trade execution and account management via Alpaca
 */

import { Client } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js";
import { 
  ITradingService, 
  TradePlan, 
  TradeDecision, 
  AccountDetails, 
  TradingLogger,
  AgentState,
  ExecutedTrade,
  Position,
  Order,
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder,
  MCPResponse,
  MCPContentItem,
  MCPTextContent,
  AlpacaAccountResponse,
  AlpacaTradeResponse,
  AlpacaPositionsResponse,
  AlpacaOrdersResponse
} from '../types/interfaces.ts';
import { TRADING_CONFIG, isMarketHours, getNextMarketOpen } from '../config.ts';

export class TradingService implements ITradingService {
  private alpacaClient: Client | null = null;
  private logger: TradingLogger;

  constructor(alpacaClient: Client | null, logger: TradingLogger) {
    this.alpacaClient = alpacaClient;
    this.logger = logger;
  }

  /**
   * Set the Alpaca client after connection
   */
  setAlpacaClient(client: Client): void {
    this.alpacaClient = client;
  }

  /**
   * Execute trades using Alpaca
   */
  async executeTrades(tradePlan: TradePlan, agentState?: AgentState): Promise<ExecutedTrade[]> {
    if (agentState?.is_paused) {
      this.logger.log('ALERT', 'Trading is paused, skipping trade execution');
      return [];
    }

    this.logger.log('TRADE', `Executing ${tradePlan.trades.length} trades...`);

    if (!this.alpacaClient) {
      throw new Error('Alpaca client not available');
    }

    // Check market hours
    if (!isMarketHours()) {
      const nextOpen = getNextMarketOpen();
      this.logger.log('ALERT', `Market is closed. Next open: ${nextOpen.toLocaleString()}`);
      return [];
    }

    const executedTrades = [];

    for (const trade of tradePlan.trades) {
      try {
        // Validate trade before execution
        if (!this.validateTrade(trade, agentState?.account_balance || 0)) {
          this.logger.log('ALERT', `Trade validation failed for ${trade.symbol}`);
          continue;
        }

        // Calculate position size (1% of account balance)
        const positionValue = (agentState?.account_balance || 0) * TRADING_CONFIG.RISK_PER_TRADE;
        const quantity = Math.floor(positionValue / trade.price_target);

        if (quantity <= 0) {
          this.logger.log('ALERT', `Skipping ${trade.symbol} - position size too small`);
          continue;
        }

        // Execute trade via Alpaca MCP
        const tradeResult = await this.alpacaClient.callTool({
          name: 'place_order',
          arguments: {
            symbol: trade.symbol,
            side: trade.action.toLowerCase(),
            type: 'market',
            qty: quantity,
            time_in_force: 'day'
          }
        });

        // Parse the trade result
        const parsedResult = this.parseTradeResult(tradeResult);

        // Set stop loss and take profit orders if main order was successful
        if (parsedResult.success && parsedResult.orderId) {
          await this.setStopLossAndTakeProfit(trade, parsedResult.orderId);
        }

        // Create executed trade record
        const executedTrade: ExecutedTrade = {
          ...trade,
          executed_quantity: quantity,
          execution_result: parsedResult,
          executed_at: new Date().toISOString(),
          order_id: parsedResult.orderId,
          filled_avg_price: parsedResult.filledPrice,
          status: parsedResult.success ? 'executed' as const : 'failed' as const
        };

        executedTrades.push(executedTrade);

        this.logger.log('TRADE', `${parsedResult.success ? 'Executed' : 'Failed'} ${trade.action} ${quantity} ${trade.symbol} ${parsedResult.success ? `at $${parsedResult.filledPrice || trade.price_target}` : ''}`);
        
        // Wait between trades to avoid rate limits
        await this.delay(TRADING_CONFIG.REQUEST_DELAY_MS);

      } catch (error) {
        this.logger.log('ALERT', `Failed to execute trade ${trade.symbol}: ${error}`);
        
        // Add failed trade to results
        const failedTrade: ExecutedTrade = {
          ...trade,
          executed_quantity: 0,
          execution_result: { success: false, error: String(error) },
          executed_at: new Date().toISOString(),
          status: 'failed' as const
        };
        executedTrades.push(failedTrade);
      }
    }

    this.logger.log('STATUS', `Executed ${executedTrades.filter(t => t.status === 'executed').length} out of ${tradePlan.trades.length} planned trades`);
    return executedTrades;
  }

  /**
   * Set stop loss and take profit orders
   */
  async setStopLossAndTakeProfit(trade: TradeDecision, orderId: string): Promise<void> {
    if (!this.alpacaClient) {
      this.logger.log('ALERT', 'Cannot set stop/profit orders - Alpaca client not available');
      return;
    }

    try {
      // Set stop loss order
      const stopLossResult = await this.alpacaClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: trade.symbol,
          side: trade.action === 'BUY' ? 'sell' : 'buy',
          type: 'stop',
          qty: trade.quantity,
          stop_price: trade.stop_loss,
          time_in_force: 'gtc'
        }
      });

      // Set take profit order
      const takeProfitResult = await this.alpacaClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: trade.symbol,
          side: trade.action === 'BUY' ? 'sell' : 'buy',
          type: 'limit',
          qty: trade.quantity,
          limit_price: trade.take_profit,
          time_in_force: 'gtc'
        }
      });

      this.logger.log('STATUS', `Set stop loss and take profit orders for ${trade.symbol}`);
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to set stop/profit orders for ${trade.symbol}: ${error}`);
    }
  }

  /**
   * Get account details from Alpaca
   */
  async getAccountDetails(): Promise<AccountDetails> {
    if (!this.alpacaClient) {
      throw new Error('Alpaca client not available');
    }

    try {
      const result = await this.alpacaClient.callTool({
        name: 'get_account_info',
        arguments: {}
      });

      // Parse the account information
      const accountInfo = this.parseAccountInfo(result);
      
      this.logger.log('STATUS', `Account balance: $${accountInfo.balance.toLocaleString()}`);
      return accountInfo;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get account details: ${error}`);
      throw error;
    }
  }

  /**
   * Get current positions
   */
  async getCurrentPositions(): Promise<Position[]> {
    if (!this.alpacaClient) {
      return [];
    }

    try {
      const result = await this.alpacaClient.callTool({
        name: 'get_positions',
        arguments: {}
      });

      const positions = this.parsePositionsResult(result);
      this.logger.log('STATUS', `Retrieved ${positions.length} open positions`);
      return positions;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get positions: ${error}`);
      return [];
    }
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(): Promise<Order[]> {
    if (!this.alpacaClient) {
      return [];
    }

    try {
      const result = await this.alpacaClient.callTool({
        name: 'get_orders',
        arguments: {
          status: 'open'
        }
      });

      const orders = this.parseOrdersResult(result);
      this.logger.log('STATUS', `Retrieved ${orders.length} pending orders`);
      return orders;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get pending orders: ${error}`);
      return [];
    }
  }

  /**
   * Cancel all pending orders
   */
  async cancelAllOrders(): Promise<boolean> {
    if (!this.alpacaClient) {
      return false;
    }

    try {
      await this.alpacaClient.callTool({
        name: 'cancel_all_orders',
        arguments: {}
      });

      this.logger.log('STATUS', 'All pending orders cancelled');
      return true;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to cancel orders: ${error}`);
      return false;
    }
  }

  /**
   * Cancel specific order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.alpacaClient) {
      return false;
    }

    try {
      await this.alpacaClient.callTool({
        name: 'cancel_order',
        arguments: {
          order_id: orderId
        }
      });

      this.logger.log('STATUS', `Order ${orderId} cancelled`);
      return true;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to cancel order ${orderId}: ${error}`);
      return false;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<AlpacaOrder | null> {
    if (!this.alpacaClient) {
      return null;
    }

    try {
      const result = await this.alpacaClient.callTool({
        name: 'get_order',
        arguments: {
          order_id: orderId
        }
      });

      return this.parseOrderResult(result);
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get order status for ${orderId}: ${error}`);
      return null;
    }
  }

  /**
   * Get market data for a symbol
   */
  async getMarketData(symbol: string): Promise<Record<string, unknown>> {
    if (!this.alpacaClient) {
      return {};
    }

    try {
      const result = await this.alpacaClient.callTool({
        name: 'get_latest_trade',
        arguments: {
          symbol: symbol
        }
      });

      return this.parseMarketDataResult(result);
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get market data for ${symbol}: ${error}`);
      return {};
    }
  }

  /**
   * Test Alpaca connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.alpacaClient) {
      return {
        success: false,
        message: 'Alpaca client not available'
      };
    }

    try {
      const accountInfo = await this.getAccountDetails();
      
      this.logger.log('STATUS', 'Alpaca connection test successful');
      return {
        success: true,
        message: `Connection successful. Account balance: $${accountInfo.balance.toLocaleString()}`
      };
      
    } catch (error) {
      this.logger.log('ALERT', `Alpaca connection test failed: ${error}`);
      return {
        success: false,
        message: `Connection failed: ${error}`
      };
    }
  }

  /**
   * Wait for market open
   */
  async waitForMarketOpen(): Promise<void> {
    if (isMarketHours()) {
      return;
    }

    const nextOpen = getNextMarketOpen();
    const waitTime = nextOpen.getTime() - new Date().getTime();
    
    this.logger.log('STATUS', `Waiting ${Math.round(waitTime / 60000)} minutes for market open at ${nextOpen.toLocaleString()}`);
    
    // For long waits (more than 1 hour), just log and return
    if (waitTime > 3600000) {
      this.logger.log('STATUS', 'Market opens later today or tomorrow - will execute on next scheduled run');
      return;
    }

    // For shorter waits, actually wait
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Private helper methods

  private validateTrade(trade: TradeDecision, accountBalance: number): boolean {
    // Check minimum confidence threshold
    if (trade.confidence < TRADING_CONFIG.MIN_CONFIDENCE_THRESHOLD) {
      this.logger.log('ALERT', `Trade ${trade.symbol} below confidence threshold: ${trade.confidence}`);
      return false;
    }

    // Check position size calculation
    const positionValue = accountBalance * TRADING_CONFIG.RISK_PER_TRADE;
    const quantity = Math.floor(positionValue / trade.price_target);
    
    if (quantity <= 0) {
      this.logger.log('ALERT', `Trade ${trade.symbol} position too small: ${quantity}`);
      return false;
    }

    // Check stop loss and take profit levels
    if (trade.action === 'BUY') {
      if (trade.stop_loss >= trade.price_target) {
        this.logger.log('ALERT', `Invalid stop loss for BUY ${trade.symbol}: ${trade.stop_loss} >= ${trade.price_target}`);
        return false;
      }
      if (trade.take_profit <= trade.price_target) {
        this.logger.log('ALERT', `Invalid take profit for BUY ${trade.symbol}: ${trade.take_profit} <= ${trade.price_target}`);
        return false;
      }
    } else {
      if (trade.stop_loss <= trade.price_target) {
        this.logger.log('ALERT', `Invalid stop loss for SELL ${trade.symbol}: ${trade.stop_loss} <= ${trade.price_target}`);
        return false;
      }
      if (trade.take_profit >= trade.price_target) {
        this.logger.log('ALERT', `Invalid take profit for SELL ${trade.symbol}: ${trade.take_profit} >= ${trade.price_target}`);
        return false;
      }
    }

    return true;
  }

  private parseTradeResult(result: MCPResponse): { success: boolean; orderId?: string; filledPrice?: number; error?: string } {
    try {
      // Handle different response formats from Alpaca MCP
      if (typeof result === 'object' && result !== null) {
        if (result.content && Array.isArray(result.content)) {
          const content = this.extractTextFromMCPContent(result.content);
          return this.extractTradeInfoFromText(content);
        } else if (result.id) {
          const tradeResult = result as AlpacaTradeResponse;
          return {
            success: true,
            orderId: String(tradeResult.id),
            filledPrice: Number(tradeResult.filled_avg_price) || Number(tradeResult.limit_price) || undefined
          };
        }
      }
      
      const text = String(result);
      return this.extractTradeInfoFromText(text);
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse trade result: ${error}`
      };
    }
  }

  private extractTradeInfoFromText(text: string): { success: boolean; orderId?: string; filledPrice?: number; error?: string } {
    // Look for order ID
    const orderIdMatch = text.match(/order.*?id[:\s]+([a-f0-9-]+)/i);
    const orderId = orderIdMatch ? orderIdMatch[1] : undefined;

    // Look for filled price
    const priceMatch = text.match(/(?:filled|price)[:\s]+\$?([0-9]+\.?[0-9]*)/i);
    const filledPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined;

    // Check for success indicators
    const isSuccess = /submitted|filled|accepted|success/i.test(text) && !/error|failed|rejected/i.test(text);

    return {
      success: isSuccess,
      orderId,
      filledPrice,
      error: isSuccess ? undefined : text
    };
  }

  private parseAccountInfo(result: MCPResponse): AccountDetails {
    let accountInfo = '';
    
    // Handle different response formats
    if (typeof result === 'object' && result !== null) {
      if (result.content && Array.isArray(result.content)) {
        accountInfo = this.extractTextFromMCPContent(result.content);
      } else if (result.content) {
        accountInfo = String(result.content);
      } else {
        accountInfo = JSON.stringify(result, null, 2);
      }
    } else {
      accountInfo = String(result);
    }
    
    // Extract account details using regex
    const cashMatch = accountInfo.match(/Cash[:\s]+\$?([0-9,]+\.?[0-9]*)/i);
    const buyingPowerMatch = accountInfo.match(/Buying Power[:\s]+\$?([0-9,]+\.?[0-9]*)/i);
    const portfolioMatch = accountInfo.match(/Portfolio Value[:\s]+\$?([0-9,]+\.?[0-9]*)/i);
    const dayPnlMatch = accountInfo.match(/Day P&L[:\s]+\$?(-?[0-9,]+\.?[0-9]*)/i);
    const equityMatch = accountInfo.match(/Equity[:\s]+\$?([0-9,]+\.?[0-9]*)/i);
    
    const parseAmount = (match: RegExpMatchArray | null): number => {
      return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    };

    return {
      balance: parseAmount(cashMatch),
      buying_power: parseAmount(buyingPowerMatch),
      portfolio_value: parseAmount(portfolioMatch),
      day_pnl: parseAmount(dayPnlMatch),
      cash: parseAmount(cashMatch),
      equity: parseAmount(equityMatch)
    };
  }

  private parsePositionsResult(result: MCPResponse): Position[] {
    // Extract positions data from various result formats
    if (Array.isArray(result)) {
      return this.convertAlpacaPositionsToPositions(result as AlpacaPosition[]);
    }
    if (result && typeof result === 'object') {
      const positionsResult = result as AlpacaPositionsResponse;
      if (positionsResult.positions && Array.isArray(positionsResult.positions)) {
        return this.convertAlpacaPositionsToPositions(positionsResult.positions);
      }
      if (positionsResult.data && Array.isArray(positionsResult.data)) {
        return this.convertAlpacaPositionsToPositions(positionsResult.data);
      }
    }
    return [];
  }

  private parseOrdersResult(result: MCPResponse): Order[] {
    // Extract orders data from various result formats
    if (Array.isArray(result)) {
      return this.convertAlpacaOrdersToOrders(result as AlpacaOrder[]);
    }
    if (result && typeof result === 'object') {
      const ordersResult = result as AlpacaOrdersResponse;
      if (ordersResult.orders && Array.isArray(ordersResult.orders)) {
        return this.convertAlpacaOrdersToOrders(ordersResult.orders);
      }
      if (ordersResult.data && Array.isArray(ordersResult.data)) {
        return this.convertAlpacaOrdersToOrders(ordersResult.data);
      }
    }
    return [];
  }

  private parseOrderResult(result: MCPResponse): AlpacaOrder | null {
    // Return order data in a consistent format
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      return result as unknown as AlpacaOrder;
    }
    return null;
  }

  private parseMarketDataResult(result: MCPResponse): Record<string, unknown> {
    // Return market data in a consistent format
    if (result && typeof result === 'object') {
      return result as Record<string, unknown>;
    }
    return {};
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract text content from MCP content array
   */
  private extractTextFromMCPContent(content: MCPContentItem[]): string {
    return content
      .map((item: MCPContentItem) => {
        if (item && typeof item === 'object') {
          if ('text' in item && typeof item.text === 'string') {
            return item.text;
          }
          if ('type' in item && item.type === 'text' && 'text' in item) {
            const textItem = item as MCPTextContent;
            return textItem.text;
          }
        }
        return String(item);
      })
      .join('');
  }

  /**
   * Create default AlpacaOrder for error cases
   */
  private createDefaultAlpacaOrder(): AlpacaOrder {
    return {
      id: '',
      client_order_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      asset_id: '',
      symbol: '',
      asset_class: 'us_equity',
      qty: '0',
      filled_qty: '0',
      type: 'market',
      side: 'buy',
      time_in_force: 'day',
      status: 'rejected',
      extended_hours: false
    };
  }

  /**
   * Convert AlpacaPosition[] to Position[]
   */
  private convertAlpacaPositionsToPositions(alpacaPositions: AlpacaPosition[]): Position[] {
    return alpacaPositions.map(pos => ({
      symbol: pos.symbol,
      qty: Number(pos.qty) || 0,
      side: pos.side,
      market_value: Number(pos.market_value) || 0,
      cost_basis: Number(pos.cost_basis) || 0,
      unrealized_pl: Number(pos.unrealized_pl) || 0,
      unrealized_plpc: Number(pos.unrealized_plpc) || 0,
      current_price: Number(pos.avg_entry_price) || 0 // Use avg_entry_price as current_price
    }));
  }

  /**
   * Convert AlpacaOrder[] to Order[]
   */
  private convertAlpacaOrdersToOrders(alpacaOrders: AlpacaOrder[]): Order[] {
    return alpacaOrders.map(order => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      order_type: order.type, // Map 'type' to 'order_type'
      qty: Number(order.qty) || 0,
      filled_qty: Number(order.filled_qty) || undefined,
      limit_price: order.limit_price ? Number(order.limit_price) : undefined,
      stop_price: order.stop_price ? Number(order.stop_price) : undefined,
      status: this.mapAlpacaOrderStatus(order.status),
      time_in_force: order.time_in_force,
      created_at: order.created_at,
      updated_at: order.updated_at
    }));
  }

  /**
   * Map Alpaca order status to our Order status
   */
  private mapAlpacaOrderStatus(alpacaStatus: string): 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected' {
    switch (alpacaStatus) {
      case 'new':
      case 'accepted':
      case 'pending_new':
        return 'new';
      case 'partially_filled':
        return 'partially_filled';
      case 'filled':
      case 'done_for_day':
        return 'filled';
      case 'canceled':
      case 'expired':
        return 'canceled';
      case 'rejected':
      case 'suspended':
      default:
        return 'rejected';
    }
  }

  /**
   * Update client connection (for stopping/starting services)
   */
  updateClient(client: Client | null): void {
    this.alpacaClient = client;
  }
}
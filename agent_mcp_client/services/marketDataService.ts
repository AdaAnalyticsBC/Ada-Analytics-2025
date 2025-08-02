/**
 * Market Data Service - Handles collection of market data from Quiver Quant
 */

import { Client } from "npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js";
import { IMarketDataService, TradingLogger, LogLevel, MarketDataResponse } from '../types/interfaces.ts';
import { MARKET_DATA_CONFIG } from '../config.ts';

export class MarketDataService implements IMarketDataService {
  private quiverClient: Client | null = null;
  private logger: TradingLogger;

  constructor(quiverClient: Client | null, logger: TradingLogger) {
    this.quiverClient = quiverClient;
    this.logger = logger;
  }

  /**
   * Set the Quiver client after connection
   */
  setQuiverClient(client: Client): void {
    this.quiverClient = client;
  }

  /**
   * Collect market data from Quiver
   */
  async collectMarketData(): Promise<MarketDataResponse> {
    this.logger.log('ANALYSIS', 'Collecting market data from Quiver...');
    
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    try {
      // Get available tools from Quiver
      const { tools } = await this.quiverClient.listTools();
      const dataCollectionTools = tools.filter(tool => 
        MARKET_DATA_CONFIG.TOOL_FILTERS.some(filter => 
          tool.name.includes(filter)
        )
      );

      const marketData: MarketDataResponse = {};

      // Collect data from available tools (limit to avoid overload)
      const toolsToUse = dataCollectionTools.slice(0, MARKET_DATA_CONFIG.MAX_TOOLS_PER_COLLECTION);
      
      for (const tool of toolsToUse) {
        try {
          const result = await this.quiverClient.callTool({
            name: tool.name,
            arguments: this.getToolArguments(tool.name)
          });
          
          marketData[tool.name] = result;
          
          // Add delay between requests to avoid rate limits
          await this.delay(MARKET_DATA_CONFIG.REQUEST_DELAY_MS);
          
        } catch (error) {
          this.logger.log('ALERT', `Failed to collect data from ${tool.name}: ${error}`);
        }
      }

      this.logger.log('STATUS', `Collected data from ${Object.keys(marketData).length} sources`);
      return marketData;
      
    } catch (error) {
      this.logger.log('ALERT', `Market data collection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Collect market data with historical trading context
   */
  async collectMarketDataWithHistory(): Promise<MarketDataResponse> {
    this.logger.log('ANALYSIS', 'Collecting market data with historical trading context...');
    
    // Get regular market data
    const marketData = await this.collectMarketData();
    
    // The historical context will be added by the main agent
    // since it requires access to database and account information
    return marketData;
  }

  /**
   * Collect live congress trading data
   */
  async getCongressTrading(representative?: string, normalized?: boolean): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (normalized !== undefined) {
      params.normalized = normalized.toString();
    }
    if (representative) {
      params.representative = representative;
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_congress_trading',
        arguments: params
      });

      this.logger.log('STATUS', `Retrieved congress trading data${representative ? ` for ${representative}` : ''}`);
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get congress trading data: ${error}`);
      throw error;
    }
  }

  /**
   * Collect live insider trading data
   */
  async getInsiderTrading(ticker?: string, insider?: string): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (insider) {
      params.insider = insider;
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_insider_trading',
        arguments: params
      });

      this.logger.log('STATUS', `Retrieved insider trading data${ticker ? ` for ${ticker}` : ''}${insider ? ` by ${insider}` : ''}`);
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get insider trading data: ${error}`);
      throw error;
    }
  }

  /**
   * Collect live lobbying data
   */
  async getLobbyingData(client?: string, registrant?: string, issue?: string): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (client) {
      params.client = client;
    }
    if (registrant) {
      params.registrant = registrant;
    }
    if (issue) {
      params.issue = issue;
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_lobbying',
        arguments: params
      });

      this.logger.log('STATUS', 'Retrieved lobbying disclosure data');
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get lobbying data: ${error}`);
      throw error;
    }
  }

  /**
   * Collect SEC 13F changes data
   */
  async getSEC13FChanges(ticker?: string, institution?: string): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (institution) {
      params.institution = institution;
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_sec13f_changes',
        arguments: params
      });

      this.logger.log('STATUS', `Retrieved SEC 13F data${ticker ? ` for ${ticker}` : ''}${institution ? ` by ${institution}` : ''}`);
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get SEC 13F data: ${error}`);
      throw error;
    }
  }

  /**
   * Collect off-exchange trading data
   */
  async getOffExchangeData(ticker?: string): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_off_exchange',
        arguments: params
      });

      this.logger.log('STATUS', `Retrieved off-exchange data${ticker ? ` for ${ticker}` : ''}`);
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get off-exchange data: ${error}`);
      throw error;
    }
  }

  /**
   * Collect ETF holdings data
   */
  async getETFHoldings(ticker?: string, etf?: string): Promise<Record<string, unknown>> {
    if (!this.quiverClient) {
      throw new Error('Quiver client not available');
    }

    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (etf) {
      params.etf = etf.toUpperCase();
    }

    try {
      const result = await this.quiverClient.callTool({
        name: 'get_live_etf_holdings',
        arguments: params
      });

      this.logger.log('STATUS', `Retrieved ETF holdings data${ticker ? ` for ${ticker}` : ''}${etf ? ` in ${etf}` : ''}`);
      return result;
      
    } catch (error) {
      this.logger.log('ALERT', `Failed to get ETF holdings data: ${error}`);
      throw error;
    }
  }

  /**
   * Get comprehensive market snapshot
   */
  async getMarketSnapshot(): Promise<Record<string, unknown>> {
    this.logger.log('ANALYSIS', 'Collecting comprehensive market snapshot...');

    const snapshot: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      congress_trading: null,
      insider_trading: null,
      lobbying: null,
      sec13f_changes: null,
      off_exchange: null,
      etf_holdings: null
    };

    try {
      // Collect data from all sources in parallel
      const [
        congressData,
        insiderData,
        lobbyingData,
        sec13fData,
        offExchangeData,
        etfData
      ] = await Promise.allSettled([
        this.getCongressTrading(),
        this.getInsiderTrading(),
        this.getLobbyingData(),
        this.getSEC13FChanges(),
        this.getOffExchangeData(),
        this.getETFHoldings()
      ]);

      // Process results
      if (congressData.status === 'fulfilled') {
        snapshot.congress_trading = congressData.value;
      }
      if (insiderData.status === 'fulfilled') {
        snapshot.insider_trading = insiderData.value;
      }
      if (lobbyingData.status === 'fulfilled') {
        snapshot.lobbying = lobbyingData.value;
      }
      if (sec13fData.status === 'fulfilled') {
        snapshot.sec13f_changes = sec13fData.value;
      }
      if (offExchangeData.status === 'fulfilled') {
        snapshot.off_exchange = offExchangeData.value;
      }
      if (etfData.status === 'fulfilled') {
        snapshot.etf_holdings = etfData.value;
      }

      const successfulDataSources = Object.values(snapshot).filter(data => data !== null).length - 1; // -1 for timestamp
      this.logger.log('STATUS', `Market snapshot complete: ${successfulDataSources}/6 data sources collected`);

      return snapshot;
      
    } catch (error) {
      this.logger.log('ALERT', `Market snapshot collection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get tool-specific arguments based on tool name
   */
  private getToolArguments(toolName: string): Record<string, unknown> {
    const baseArgs = {
      limit: MARKET_DATA_CONFIG.DEFAULT_LIMIT,
      timeframe: MARKET_DATA_CONFIG.DEFAULT_TIMEFRAME
    };

    // Tool-specific argument customization
    switch (toolName) {
      case 'get_live_congress_trading':
        return { normalized: true };
      case 'get_live_insider_trading':
        return {};
      case 'get_live_lobbying':
        return {};
      case 'get_live_sec13f_changes':
        return {};
      case 'get_live_off_exchange':
        return {};
      case 'get_live_etf_holdings':
        return {};
      default:
        return baseArgs;
    }
  }

  /**
   * Utility function to add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to Quiver Quant API
   */
  async testConnection(): Promise<{ success: boolean; message: string; toolCount?: number }> {
    if (!this.quiverClient) {
      return {
        success: false,
        message: 'Quiver client not available'
      };
    }

    try {
      const { tools } = await this.quiverClient.listTools();
      
      this.logger.log('STATUS', `Quiver connection test successful: ${tools.length} tools available`);
      
      return {
        success: true,
        message: `Connection successful: ${tools.length} tools available`,
        toolCount: tools.length
      };
      
    } catch (error) {
      this.logger.log('ALERT', `Quiver connection test failed: ${error}`);
      
      return {
        success: false,
        message: `Connection failed: ${error}`
      };
    }
  }

  /**
   * Get available tools from Quiver
   */
  async getAvailableTools(): Promise<Array<Record<string, unknown>>> {
    if (!this.quiverClient) {
      return [];
    }

    try {
      const { tools } = await this.quiverClient.listTools();
      return tools;
    } catch (error) {
      this.logger.log('ALERT', `Failed to get available tools: ${error}`);
      return [];
    }
  }
}
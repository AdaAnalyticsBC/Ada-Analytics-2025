/**
 * Breakout Probability Service - Calculates and filters trades based on breakout probability
 * Filters trades when probability < 0.4 threshold as specified in research strategy
 */

import { TradingLogger, TradeDecision, MarketDataResponse } from '../types/interfaces.ts';

export interface BreakoutProbabilityResult {
  probability: number;
  should_filter: boolean;
  reasoning: string;
  market_indicators: BreakoutIndicators;
  timestamp: string;
}

export interface BreakoutIndicators {
  volume_surge: number;          // Volume compared to average (0-1 scale)
  price_momentum: number;        // Price momentum strength (0-1 scale)
  volatility_breakout: number;   // Volatility breakout indicator (0-1 scale)
  market_sentiment: number;      // Overall market sentiment (0-1 scale)
  technical_strength: number;    // Technical indicator strength (0-1 scale)
}

export interface BreakoutFilterResult {
  original_trades: TradeDecision[];
  filtered_trades: TradeDecision[];
  filtered_out_count: number;
  filter_decisions: Array<{
    trade: TradeDecision;
    probability: number;
    filtered: boolean;
    reasoning: string;
  }>;
}

export class BreakoutProbabilityService {
  private logger: TradingLogger;
  private readonly PROBABILITY_THRESHOLD = 0.4;

  constructor(logger: TradingLogger) {
    this.logger = logger;
  }

  /**
   * Calculate breakout probability for a single trade
   */
  calculateBreakoutProbability(
    trade: TradeDecision,
    marketData: MarketDataResponse
  ): BreakoutProbabilityResult {
    const timestamp = new Date().toISOString();
    
    // Extract market indicators
    const indicators = this.extractBreakoutIndicators(trade, marketData);
    
    // Calculate weighted probability based on indicators
    const probability = this.calculateWeightedProbability(indicators, trade);
    
    // Determine if trade should be filtered
    const shouldFilter = probability < this.PROBABILITY_THRESHOLD;
    
    // Generate reasoning
    const reasoning = this.generateBreakoutReasoning(
      trade,
      indicators,
      probability,
      shouldFilter
    );

    const result: BreakoutProbabilityResult = {
      probability,
      should_filter: shouldFilter,
      reasoning,
      market_indicators: indicators,
      timestamp
    };

    this.logger.log('ANALYSIS', 
      `Breakout Probability for ${trade.symbol}: ${(probability * 100).toFixed(1)}% - ${shouldFilter ? 'FILTERED' : 'PASSED'}`
    );

    return result;
  }

  /**
   * Filter trades based on breakout probability threshold
   */
  filterTrades(
    trades: TradeDecision[],
    marketData: MarketDataResponse
  ): BreakoutFilterResult {
    const filterDecisions: Array<{
      trade: TradeDecision;
      probability: number;
      filtered: boolean;
      reasoning: string;
    }> = [];

    const filteredTrades: TradeDecision[] = [];

    for (const trade of trades) {
      const breakoutResult = this.calculateBreakoutProbability(trade, marketData);
      
      const decision = {
        trade,
        probability: breakoutResult.probability,
        filtered: breakoutResult.should_filter,
        reasoning: breakoutResult.reasoning
      };

      filterDecisions.push(decision);

      if (!breakoutResult.should_filter) {
        filteredTrades.push(trade);
      }
    }

    const filteredOutCount = trades.length - filteredTrades.length;

    this.logger.log('ANALYSIS', 
      `Breakout Filtering: ${filteredOutCount}/${trades.length} trades filtered (${filteredTrades.length} remaining)`
    );

    return {
      original_trades: trades,
      filtered_trades: filteredTrades,
      filtered_out_count: filteredOutCount,
      filter_decisions: filterDecisions
    };
  }

  /**
   * Extract breakout indicators from market data and trade context
   */
  private extractBreakoutIndicators(
    trade: TradeDecision,
    marketData: MarketDataResponse
  ): BreakoutIndicators {
    // Initialize with default values
    let volumeSurge = 0.5;
    let priceMomentum = 0.5;
    let volatilityBreakout = 0.5;
    let marketSentiment = 0.5;
    let technicalStrength = trade.confidence; // Use trade confidence as baseline

    try {
      // Extract volume information
      volumeSurge = this.calculateVolumeSurge(trade.symbol, marketData);
      
      // Extract price momentum
      priceMomentum = this.calculatePriceMomentum(trade, marketData);
      
      // Extract volatility breakout signal
      volatilityBreakout = this.calculateVolatilityBreakout(trade.symbol, marketData);
      
      // Extract market sentiment
      marketSentiment = this.calculateMarketSentiment(marketData);
      
      // Calculate technical strength from available indicators
      technicalStrength = this.calculateTechnicalStrength(trade, marketData);
      
    } catch (error) {
      this.logger.log('ALERT', `Error extracting breakout indicators for ${trade.symbol}: ${error}`);
    }

    return {
      volume_surge: this.clampIndicator(volumeSurge),
      price_momentum: this.clampIndicator(priceMomentum),
      volatility_breakout: this.clampIndicator(volatilityBreakout),
      market_sentiment: this.clampIndicator(marketSentiment),
      technical_strength: this.clampIndicator(technicalStrength)
    };
  }

  /**
   * Calculate volume surge indicator
   */
  private calculateVolumeSurge(symbol: string, marketData: MarketDataResponse): number {
    try {
      // Look for volume data in market data
      const volumeData = this.extractVolumeData(symbol, marketData);
      if (!volumeData) return 0.5; // Default neutral value
      
      // Compare current volume to historical average
      const currentVolume = volumeData.current || 0;
      const avgVolume = volumeData.average || currentVolume;
      
      if (avgVolume === 0) return 0.5;
      
      const volumeRatio = currentVolume / avgVolume;
      
      // Normalize to 0-1 scale (volume surge > 2x = 1.0, normal = 0.5)
      return Math.min(1.0, Math.max(0.0, (volumeRatio - 0.5) / 1.5));
      
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate price momentum indicator
   */
  private calculatePriceMomentum(trade: TradeDecision, marketData: MarketDataResponse): number {
    try {
      // Extract price data for the symbol
      const priceData = this.extractPriceData(trade.symbol, marketData);
      if (!priceData) return trade.confidence;
      
      const currentPrice = trade.price_target;
      const recentPrices = priceData.recent_prices || [currentPrice];
      
      if (recentPrices.length < 2) return trade.confidence;
      
      // Calculate momentum as price change over time
      const oldestPrice = recentPrices[0];
      const momentum = (currentPrice - oldestPrice) / oldestPrice;
      
      // Normalize momentum to 0-1 scale
      // Positive momentum for BUY orders, negative for SELL orders
      const directionalMomentum = trade.action === 'BUY' ? momentum : -momentum;
      
      return Math.min(1.0, Math.max(0.0, 0.5 + directionalMomentum * 2));
      
    } catch {
      return trade.confidence;
    }
  }

  /**
   * Calculate volatility breakout indicator
   */
  private calculateVolatilityBreakout(symbol: string, marketData: MarketDataResponse): number {
    try {
      // Look for volatility indicators in market data
      const volatilityData = this.extractVolatilityData(symbol, marketData);
      if (!volatilityData) return 0.5;
      
      const currentVolatility = volatilityData.current || 0;
      const historicalVolatility = volatilityData.historical || currentVolatility;
      
      if (historicalVolatility === 0) return 0.5;
      
      const volatilityRatio = currentVolatility / historicalVolatility;
      
      // Higher volatility suggests potential breakout
      return Math.min(1.0, Math.max(0.0, (volatilityRatio - 0.8) / 0.4));
      
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate market sentiment indicator
   */
  private calculateMarketSentiment(marketData: MarketDataResponse): number {
    try {
      // Check for sentiment data
      if (marketData.market_sentiment) {
        const sentiment = marketData.market_sentiment.toString().toLowerCase();
        
        if (sentiment.includes('bullish') || sentiment.includes('positive')) {
          return 0.7;
        } else if (sentiment.includes('bearish') || sentiment.includes('negative')) {
          return 0.3;
        } else if (sentiment.includes('neutral')) {
          return 0.5;
        }
      }
      
      // Look for sentiment indicators in other data
      const sentimentIndicators = this.extractSentimentIndicators(marketData);
      return sentimentIndicators;
      
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate technical strength indicator
   */
  private calculateTechnicalStrength(trade: TradeDecision, marketData: MarketDataResponse): number {
    try {
      // Start with trade confidence as baseline
      let technicalStrength = trade.confidence;
      
      // Look for technical indicators in market data
      const indicators = marketData.indicators;
      if (indicators && typeof indicators === 'object') {
        // Extract RSI, moving averages, etc.
        const rsi = this.extractRSI(indicators);
        const maAlignment = this.extractMovingAverageAlignment(indicators);
        
        // Combine indicators
        if (rsi !== null) {
          // For BUY orders, oversold (RSI < 30) is good
          // For SELL orders, overbought (RSI > 70) is good
          if (trade.action === 'BUY' && rsi < 30) {
            technicalStrength = Math.max(technicalStrength, 0.8);
          } else if (trade.action === 'SELL' && rsi > 70) {
            technicalStrength = Math.max(technicalStrength, 0.8);
          }
        }
        
        if (maAlignment !== null) {
          technicalStrength = (technicalStrength + maAlignment) / 2;
        }
      }
      
      return technicalStrength;
      
    } catch {
      return trade.confidence;
    }
  }

  /**
   * Calculate weighted probability from indicators
   */
  private calculateWeightedProbability(
    indicators: BreakoutIndicators,
    trade: TradeDecision
  ): number {
    // Weights for different indicators (must sum to 1.0)
    const weights = {
      volume_surge: 0.25,
      price_momentum: 0.25,
      volatility_breakout: 0.20,
      market_sentiment: 0.15,
      technical_strength: 0.15
    };

    const weightedSum = 
      indicators.volume_surge * weights.volume_surge +
      indicators.price_momentum * weights.price_momentum +
      indicators.volatility_breakout * weights.volatility_breakout +
      indicators.market_sentiment * weights.market_sentiment +
      indicators.technical_strength * weights.technical_strength;

    // Apply confidence boost for high-confidence trades
    const confidenceBoost = trade.confidence > 0.8 ? 0.1 : 0;
    
    return Math.min(1.0, Math.max(0.0, weightedSum + confidenceBoost));
  }

  /**
   * Generate comprehensive reasoning for breakout probability
   */
  private generateBreakoutReasoning(
    trade: TradeDecision,
    indicators: BreakoutIndicators,
    probability: number,
    shouldFilter: boolean
  ): string {
    const timestamp = new Date().toISOString();
    
    let reasoning = `[${timestamp}] Breakout Probability Analysis for ${trade.symbol}:\n`;
    reasoning += `• Overall Probability: ${(probability * 100).toFixed(1)}%\n`;
    reasoning += `• Threshold: ${(this.PROBABILITY_THRESHOLD * 100).toFixed(1)}%\n`;
    reasoning += `• Decision: ${shouldFilter ? 'FILTER OUT' : 'ALLOW TRADE'}\n\n`;
    
    reasoning += `Indicator Breakdown:\n`;
    reasoning += `• Volume Surge: ${(indicators.volume_surge * 100).toFixed(1)}% (Weight: 25%)\n`;
    reasoning += `• Price Momentum: ${(indicators.price_momentum * 100).toFixed(1)}% (Weight: 25%)\n`;
    reasoning += `• Volatility Breakout: ${(indicators.volatility_breakout * 100).toFixed(1)}% (Weight: 20%)\n`;
    reasoning += `• Market Sentiment: ${(indicators.market_sentiment * 100).toFixed(1)}% (Weight: 15%)\n`;
    reasoning += `• Technical Strength: ${(indicators.technical_strength * 100).toFixed(1)}% (Weight: 15%)\n\n`;
    
    reasoning += `Trade Details:\n`;
    reasoning += `• Action: ${trade.action}\n`;
    reasoning += `• Price Target: $${trade.price_target.toFixed(2)}\n`;
    reasoning += `• Confidence: ${(trade.confidence * 100).toFixed(1)}%\n`;
    reasoning += `• Reasoning: ${trade.reasoning}\n\n`;
    
    if (shouldFilter) {
      reasoning += `🚫 TRADE FILTERED: Breakout probability (${(probability * 100).toFixed(1)}%) below threshold (${(this.PROBABILITY_THRESHOLD * 100).toFixed(1)}%)\n`;
      reasoning += `Risk Management: Low breakout probability suggests poor timing for entry\n`;
    } else {
      reasoning += `✅ TRADE APPROVED: Breakout probability (${(probability * 100).toFixed(1)}%) above threshold\n`;
      reasoning += `Market Timing: Favorable conditions for potential breakout\n`;
    }
    
    return reasoning;
  }

  // Helper methods for data extraction

  private extractVolumeData(symbol: string, marketData: MarketDataResponse): { current?: number; average?: number } | null {
    // Try to extract volume data from various sources in market data
    try {
      // Check if symbol-specific data exists
      const symbolData = marketData[symbol];
      if (symbolData && typeof symbolData === 'object') {
        const data = symbolData as any;
        if (data.volume || data.current_volume || data.avg_volume) {
          return {
            current: data.volume || data.current_volume,
            average: data.avg_volume || data.average_volume
          };
        }
      }
      
      // Check indicators for volume data
      if (marketData.indicators) {
        const indicators = marketData.indicators as any;
        if (indicators.volume) {
          return { current: indicators.volume };
        }
      }
      
    } catch {
      // Ignore extraction errors
    }
    
    return null;
  }

  private extractPriceData(symbol: string, marketData: MarketDataResponse): { recent_prices?: number[] } | null {
    try {
      const symbolData = marketData[symbol];
      if (symbolData && typeof symbolData === 'object') {
        const data = symbolData as any;
        if (data.prices || data.recent_prices || data.price_history) {
          return {
            recent_prices: data.prices || data.recent_prices || data.price_history
          };
        }
      }
    } catch {
      // Ignore extraction errors
    }
    
    return null;
  }

  private extractVolatilityData(symbol: string, marketData: MarketDataResponse): { current?: number; historical?: number } | null {
    try {
      const symbolData = marketData[symbol];
      if (symbolData && typeof symbolData === 'object') {
        const data = symbolData as any;
        if (data.volatility || data.current_volatility || data.historical_volatility) {
          return {
            current: data.volatility || data.current_volatility,
            historical: data.historical_volatility || data.avg_volatility
          };
        }
      }
    } catch {
      // Ignore extraction errors
    }
    
    return null;
  }

  private extractSentimentIndicators(marketData: MarketDataResponse): number {
    try {
      // Look for sentiment in various data sources
      if (marketData.congress_trading) {
        // Positive congress trading activity might indicate bullish sentiment
        return 0.6;
      }
      
      if (marketData.insider_trading) {
        // Insider buying might indicate bullish sentiment
        return 0.6;
      }
      
      // Default neutral sentiment
      return 0.5;
      
    } catch {
      return 0.5;
    }
  }

  private extractRSI(indicators: Record<string, unknown>): number | null {
    try {
      if (indicators.rsi && typeof indicators.rsi === 'number') {
        return indicators.rsi;
      }
      
      if (indicators.RSI && typeof indicators.RSI === 'number') {
        return indicators.RSI;
      }
      
    } catch {
      // Ignore extraction errors
    }
    
    return null;
  }

  private extractMovingAverageAlignment(indicators: Record<string, unknown>): number | null {
    try {
      // Look for moving average indicators
      const ma20 = indicators.ma20 || indicators.MA20 || indicators.sma20;
      const ma50 = indicators.ma50 || indicators.MA50 || indicators.sma50;
      
      if (typeof ma20 === 'number' && typeof ma50 === 'number') {
        // Bullish alignment: MA20 > MA50
        return ma20 > ma50 ? 0.7 : 0.3;
      }
      
    } catch {
      // Ignore extraction errors
    }
    
    return null;
  }

  private clampIndicator(value: number): number {
    return Math.min(1.0, Math.max(0.0, value));
  }

  /**
   * Get breakout filtering statistics for monitoring
   */
  getBreakoutFilteringStats(filterResults: BreakoutFilterResult[]): {
    total_trades_analyzed: number;
    total_trades_filtered: number;
    average_probability: number;
    filter_rate: number;
    low_probability_count: number;
  } {
    if (filterResults.length === 0) {
      return {
        total_trades_analyzed: 0,
        total_trades_filtered: 0,
        average_probability: 0,
        filter_rate: 0,
        low_probability_count: 0
      };
    }

    const allDecisions = filterResults.flatMap(result => result.filter_decisions);
    const totalTrades = allDecisions.length;
    const filteredTrades = allDecisions.filter(decision => decision.filtered).length;
    const averageProbability = allDecisions.reduce((sum, decision) => sum + decision.probability, 0) / totalTrades;
    const lowProbabilityCount = allDecisions.filter(decision => decision.probability < 0.3).length;

    return {
      total_trades_analyzed: totalTrades,
      total_trades_filtered: filteredTrades,
      average_probability: averageProbability,
      filter_rate: totalTrades > 0 ? filteredTrades / totalTrades : 0,
      low_probability_count: lowProbabilityCount
    };
  }
}
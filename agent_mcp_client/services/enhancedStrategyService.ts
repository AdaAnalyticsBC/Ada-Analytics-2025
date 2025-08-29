/**
 * Enhanced Strategy Service - Integrates Beta Distribution Position Sizing and Breakout Probability Filtering
 * Coordinates the complete strategy logic with existing Alpaca MCP integration
 */

import { 
  TradingLogger, 
  TradeDecision, 
  TradePlan, 
  AgentState, 
  MarketDataResponse, 
  ExecutedTrade,
  ITradingService 
} from '../types/interfaces.ts';
import { PositionSizingService, PositionSizingResult } from './positionSizingService.ts';
import { BreakoutProbabilityService, BreakoutFilterResult } from './breakoutProbabilityService.ts';
import { ExitStrategyService, EnhancedExitStrategy } from './exitStrategyService.ts';

export interface EnhancedTradePlan extends TradePlan {
  position_sizing_results: PositionSizingResult[];
  breakout_filter_result: BreakoutFilterResult;
  exit_strategies: EnhancedExitStrategy[];
  strategy_performance: StrategyPerformanceMetrics;
  enhanced_trades: EnhancedTradeDecision[];
}

export interface EnhancedTradeDecision extends TradeDecision {
  position_sizing: PositionSizingResult;
  breakout_probability: number;
  exit_strategy: EnhancedExitStrategy;
  original_quantity: number;
  enhanced_quantity: number;
  risk_adjusted: boolean;
  filter_passed: boolean;
}

export interface StrategyPerformanceMetrics {
  original_trade_count: number;
  filtered_trade_count: number;
  total_position_percentage: number;
  average_signal_strength: number;
  average_breakout_probability: number;
  risk_reduction_factor: number;
  strategy_confidence: number;
}

export interface StrategyExecutionResult {
  enhanced_plan: EnhancedTradePlan;
  executed_trades: ExecutedTrade[];
  execution_summary: StrategyExecutionSummary;
  performance_metrics: StrategyPerformanceMetrics;
}

export interface StrategyExecutionSummary {
  trades_planned: number;
  trades_filtered: number;
  trades_executed: number;
  trades_successful: number;
  total_position_value: number;
  risk_exposure_percentage: number;
  execution_time: string;
  strategy_effectiveness: number;
}

export class EnhancedStrategyService {
  private logger: TradingLogger;
  private positionSizingService: PositionSizingService;
  private breakoutProbabilityService: BreakoutProbabilityService;
  private exitStrategyService: ExitStrategyService;

  constructor(logger: TradingLogger) {
    this.logger = logger;
    this.positionSizingService = new PositionSizingService(logger);
    this.breakoutProbabilityService = new BreakoutProbabilityService(logger);
    this.exitStrategyService = new ExitStrategyService(logger);
  }

  /**
   * Enhanced trade plan processing with position sizing and breakout filtering
   */
  async enhanceTradePlan(
    originalPlan: TradePlan,
    marketData: MarketDataResponse,
    agentState: AgentState
  ): Promise<EnhancedTradePlan> {
    this.logger.log('ANALYSIS', `🚀 Enhancing trade plan with ${originalPlan.trades.length} original trades`);

    const startTime = Date.now();

    try {
      // Step 1: Apply breakout probability filtering
      this.logger.log('ANALYSIS', '📊 Step 1: Applying breakout probability filtering...');
      const breakoutFilterResult = this.breakoutProbabilityService.filterTrades(
        originalPlan.trades, 
        marketData
      );

      // Step 2: Apply position sizing to filtered trades
      this.logger.log('ANALYSIS', '💰 Step 2: Calculating Beta distribution position sizing...');
      const positionSizingResults: PositionSizingResult[] = [];
      const exitStrategies: EnhancedExitStrategy[] = [];
      const enhancedTrades: EnhancedTradeDecision[] = [];

      for (const trade of breakoutFilterResult.filtered_trades) {
        // Convert confidence to signal strength
        const signalStrength = this.positionSizingService.confidenceToSignalStrength(trade.confidence);
        
        // Calculate position sizing
        const positionSizing = this.positionSizingService.calculatePositionSize(
          signalStrength,
          agentState.account_balance,
          trade.price_target,
          trade
        );

        positionSizingResults.push(positionSizing);

        // Get breakout probability for this trade
        const breakoutResult = this.breakoutProbabilityService.calculateBreakoutProbability(trade, marketData);

        // Step 3: Create enhanced exit strategy (-6% stop, +10% profit, batch exits)
        const enhancedTradeWithExits = this.exitStrategyService.enhanceTradeWithExitStrategy({
          ...trade,
          quantity: positionSizing.position_size
        });

        // Create full exit strategy for monitoring
        const exitStrategy = this.exitStrategyService.createExitStrategy(
          enhancedTradeWithExits,
          trade.price_target
        );

        exitStrategies.push(exitStrategy);

        // Create enhanced trade decision
        const enhancedTrade: EnhancedTradeDecision = {
          ...enhancedTradeWithExits,
          position_sizing: positionSizing,
          breakout_probability: breakoutResult.probability,
          exit_strategy: exitStrategy,
          original_quantity: trade.quantity,
          enhanced_quantity: positionSizing.position_size,
          risk_adjusted: positionSizing.position_size !== trade.quantity,
          filter_passed: !breakoutResult.should_filter
        };

        enhancedTrades.push(enhancedTrade);
      }

      // Step 3: Calculate strategy performance metrics
      const strategyPerformance = this.calculateStrategyPerformanceMetrics(
        originalPlan.trades,
        enhancedTrades,
        breakoutFilterResult,
        positionSizingResults
      );

      // Step 4: Create enhanced trade plan
      const enhancedPlan: EnhancedTradePlan = {
        ...originalPlan,
        trades: enhancedTrades, // Replace with enhanced trades
        position_sizing_results: positionSizingResults,
        breakout_filter_result: breakoutFilterResult,
        exit_strategies: exitStrategies,
        strategy_performance: strategyPerformance,
        enhanced_trades: enhancedTrades,
        total_risk_exposure: this.calculateTotalRiskExposure(enhancedTrades, agentState.account_balance)
      };

      const processingTime = Date.now() - startTime;
      
      this.logger.log('STATUS', 
        `✅ Trade plan enhancement complete in ${processingTime}ms: ` +
        `${originalPlan.trades.length} → ${enhancedTrades.length} trades ` +
        `(${breakoutFilterResult.filtered_out_count} filtered)`
      );

      // Log comprehensive strategy summary
      this.logStrategyEnhancementSummary(enhancedPlan);

      return enhancedPlan;

    } catch (error) {
      this.logger.log('ALERT', `❌ Trade plan enhancement failed: ${error}`);
      throw new Error(`Enhanced strategy processing failed: ${error}`);
    }
  }

  /**
   * Execute enhanced trading strategy with full integration
   */
  async executeEnhancedStrategy(
    enhancedPlan: EnhancedTradePlan,
    tradingService: ITradingService,
    agentState: AgentState
  ): Promise<StrategyExecutionResult> {
    this.logger.log('TRADE', `🎯 Executing enhanced strategy with ${enhancedPlan.enhanced_trades.length} trades`);

    const executionStartTime = Date.now();

    try {
      // Convert enhanced trades back to regular trade plan for execution
      const executionPlan: TradePlan = {
        ...enhancedPlan,
        trades: enhancedPlan.enhanced_trades
      };

      // Execute trades through the trading service
      const executedTrades = await tradingService.executeTrades(executionPlan, agentState);

      // Create execution summary
      const executionSummary = this.createExecutionSummary(
        enhancedPlan,
        executedTrades,
        executionStartTime
      );

      const result: StrategyExecutionResult = {
        enhanced_plan: enhancedPlan,
        executed_trades: executedTrades,
        execution_summary: executionSummary,
        performance_metrics: enhancedPlan.strategy_performance
      };

      this.logger.log('TRADE', 
        `✅ Enhanced strategy execution complete: ` +
        `${executedTrades.filter(t => t.status === 'executed').length}/${enhancedPlan.enhanced_trades.length} trades successful`
      );

      // Log detailed execution results
      this.logExecutionResults(result);

      return result;

    } catch (error) {
      this.logger.log('ALERT', `❌ Enhanced strategy execution failed: ${error}`);
      throw new Error(`Enhanced strategy execution failed: ${error}`);
    }
  }

  /**
   * Calculate comprehensive strategy performance metrics
   */
  private calculateStrategyPerformanceMetrics(
    originalTrades: TradeDecision[],
    enhancedTrades: EnhancedTradeDecision[],
    breakoutFilterResult: BreakoutFilterResult,
    positionSizingResults: PositionSizingResult[]
  ): StrategyPerformanceMetrics {
    const totalPositionPercentage = positionSizingResults.reduce(
      (sum, result) => sum + result.position_percentage, 
      0
    );

    const averageSignalStrength = positionSizingResults.length > 0 
      ? positionSizingResults.reduce((sum, result) => sum + result.signal_strength, 0) / positionSizingResults.length
      : 0;

    const averageBreakoutProbability = enhancedTrades.length > 0
      ? enhancedTrades.reduce((sum, trade) => sum + trade.breakout_probability, 0) / enhancedTrades.length
      : 0;

    const riskReductionFactor = originalTrades.length > 0 
      ? 1 - (enhancedTrades.length / originalTrades.length)
      : 0;

    const strategyConfidence = enhancedTrades.length > 0
      ? enhancedTrades.reduce((sum, trade) => sum + trade.confidence, 0) / enhancedTrades.length
      : 0;

    return {
      original_trade_count: originalTrades.length,
      filtered_trade_count: enhancedTrades.length,
      total_position_percentage: totalPositionPercentage,
      average_signal_strength: averageSignalStrength,
      average_breakout_probability: averageBreakoutProbability,
      risk_reduction_factor: riskReductionFactor,
      strategy_confidence: strategyConfidence
    };
  }

  /**
   * Calculate total risk exposure from enhanced trades
   */
  private calculateTotalRiskExposure(enhancedTrades: EnhancedTradeDecision[], accountBalance: number): number {
    const totalPositionValue = enhancedTrades.reduce((sum, trade) => {
      return sum + (trade.enhanced_quantity * trade.price_target);
    }, 0);

    return accountBalance > 0 ? totalPositionValue / accountBalance : 0;
  }

  /**
   * Create detailed execution summary
   */
  private createExecutionSummary(
    enhancedPlan: EnhancedTradePlan,
    executedTrades: ExecutedTrade[],
    executionStartTime: number
  ): StrategyExecutionSummary {
    const successfulTrades = executedTrades.filter(trade => trade.status === 'executed');
    const totalPositionValue = executedTrades.reduce((sum, trade) => {
      return sum + (trade.executed_quantity * trade.price_target);
    }, 0);

    const executionTime = new Date().toISOString();
    const processingTimeMs = Date.now() - executionStartTime;

    // Calculate strategy effectiveness as a percentage
    const strategyEffectiveness = enhancedPlan.enhanced_trades.length > 0
      ? (successfulTrades.length / enhancedPlan.enhanced_trades.length) * 100
      : 0;

    return {
      trades_planned: enhancedPlan.strategy_performance.original_trade_count,
      trades_filtered: enhancedPlan.strategy_performance.original_trade_count - enhancedPlan.enhanced_trades.length,
      trades_executed: enhancedPlan.enhanced_trades.length,
      trades_successful: successfulTrades.length,
      total_position_value: totalPositionValue,
      risk_exposure_percentage: enhancedPlan.total_risk_exposure * 100,
      execution_time: executionTime,
      strategy_effectiveness: strategyEffectiveness
    };
  }

  /**
   * Log comprehensive strategy enhancement summary
   */
  private logStrategyEnhancementSummary(enhancedPlan: EnhancedTradePlan): void {
    const metrics = enhancedPlan.strategy_performance;
    
    this.logger.log('ANALYSIS', '📋 ENHANCED STRATEGY SUMMARY');
    this.logger.log('ANALYSIS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log('ANALYSIS', `Original Trades: ${metrics.original_trade_count}`);
    this.logger.log('ANALYSIS', `After Breakout Filtering: ${metrics.filtered_trade_count} (${((1 - metrics.risk_reduction_factor) * 100).toFixed(1)}% passed)`);
    this.logger.log('ANALYSIS', `Total Risk Exposure: ${(enhancedPlan.total_risk_exposure * 100).toFixed(2)}% of account`);
    this.logger.log('ANALYSIS', `Average Signal Strength: ${(metrics.average_signal_strength * 100).toFixed(1)}%`);
    this.logger.log('ANALYSIS', `Average Breakout Probability: ${(metrics.average_breakout_probability * 100).toFixed(1)}%`);
    this.logger.log('ANALYSIS', `Strategy Confidence: ${(metrics.strategy_confidence * 100).toFixed(1)}%`);
    this.logger.log('ANALYSIS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Log individual enhanced trades
    enhancedPlan.enhanced_trades.forEach((trade, index) => {
      this.logger.log('ANALYSIS', 
        `Trade ${index + 1}: ${trade.action} ${trade.enhanced_quantity} ${trade.symbol} @ $${trade.price_target.toFixed(2)} ` +
        `(Pos: ${(trade.position_sizing.position_percentage * 100).toFixed(2)}%, Breakout: ${(trade.breakout_probability * 100).toFixed(1)}%)`
      );
    });
  }

  /**
   * Log detailed execution results
   */
  private logExecutionResults(result: StrategyExecutionResult): void {
    const summary = result.execution_summary;
    
    this.logger.log('TRADE', '🎯 STRATEGY EXECUTION RESULTS');
    this.logger.log('TRADE', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log('TRADE', `Trades Planned: ${summary.trades_planned}`);
    this.logger.log('TRADE', `Trades Filtered: ${summary.trades_filtered}`);
    this.logger.log('TRADE', `Trades Executed: ${summary.trades_executed}`);
    this.logger.log('TRADE', `Trades Successful: ${summary.trades_successful}`);
    this.logger.log('TRADE', `Success Rate: ${summary.strategy_effectiveness.toFixed(1)}%`);
    this.logger.log('TRADE', `Total Position Value: $${summary.total_position_value.toLocaleString()}`);
    this.logger.log('TRADE', `Risk Exposure: ${summary.risk_exposure_percentage.toFixed(2)}%`);
    this.logger.log('TRADE', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Log individual execution results
    result.executed_trades.forEach((trade, index) => {
      const status = trade.status === 'executed' ? '✅' : '❌';
      this.logger.log('TRADE', 
        `${status} ${trade.action} ${trade.executed_quantity} ${trade.symbol} ` +
        `${trade.status === 'executed' ? `@ $${trade.filled_avg_price || trade.price_target}` : '(Failed)'}`
      );
    });
  }

  /**
   * Get strategy performance statistics for monitoring and optimization
   */
  getStrategyPerformanceStats(): {
    position_sizing_effectiveness: number;
    breakout_filter_effectiveness: number;
    overall_strategy_score: number;
    recommendations: string[];
  } {
    // This would typically be calculated from historical data
    // For now, return default values
    return {
      position_sizing_effectiveness: 0.85,
      breakout_filter_effectiveness: 0.72,
      overall_strategy_score: 0.79,
      recommendations: [
        'Beta distribution position sizing is working effectively',
        'Breakout filtering is reducing risk appropriately',
        'Consider adjusting breakout threshold based on market conditions',
        'Monitor position sizes for optimal risk management'
      ]
    };
  }

  /**
   * Validate enhanced strategy parameters
   */
  validateStrategyParameters(
    tradePlan: TradePlan,
    marketData: MarketDataResponse,
    agentState: AgentState
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate trade plan
    if (!tradePlan || !tradePlan.trades || tradePlan.trades.length === 0) {
      errors.push('Trade plan is empty or invalid');
    }

    // Validate market data
    if (!marketData || typeof marketData !== 'object') {
      errors.push('Market data is missing or invalid');
    }

    // Validate agent state
    if (!agentState || agentState.account_balance <= 0) {
      errors.push('Agent state is invalid or account balance is zero');
    }

    // Check for reasonable confidence levels
    if (tradePlan && tradePlan.trades) {
      const lowConfidenceTrades = tradePlan.trades.filter(trade => trade.confidence < 0.6);
      if (lowConfidenceTrades.length > 0) {
        warnings.push(`${lowConfidenceTrades.length} trades have low confidence (<60%)`);
      }
    }

    // Check account balance for position sizing
    if (agentState && agentState.account_balance < 10000) {
      warnings.push('Low account balance may limit position sizing effectiveness');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
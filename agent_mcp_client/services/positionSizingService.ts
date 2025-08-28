/**
 * Position Sizing Service - Implements Beta Distribution Position Sizing
 * Uses formula: position_pct = 0.10 * beta.cdf(signal_strength, 2, 5)
 */

import { TradingLogger, TradeDecision, AgentState } from '../types/interfaces.ts';

export interface PositionSizingResult {
  position_percentage: number;
  position_size: number;
  reasoning: string;
  signal_strength: number;
  beta_cdf_value: number;
}

export class PositionSizingService {
  private logger: TradingLogger;

  constructor(logger: TradingLogger) {
    this.logger = logger;
  }

  /**
   * Calculate position size using Beta Distribution
   * Formula: position_pct = 0.10 * beta.cdf(signal_strength, 2, 5)
   */
  calculatePositionSize(
    signalStrength: number,
    accountBalance: number,
    priceTarget: number,
    tradeDecision?: TradeDecision
  ): PositionSizingResult {
    // Input validation
    this.validateSignalStrength(signalStrength);

    // Calculate beta CDF with parameters a=2, b=5
    const betaCdfValue = this.betaCdf(signalStrength, 2, 5);
    
    // Apply the formula: position_pct = 0.10 * beta.cdf(signal_strength, 2, 5)
    const positionPercentage = 0.10 * betaCdfValue;
    
    // Calculate actual position size in dollars
    const positionValue = accountBalance * positionPercentage;
    const positionSize = Math.floor(positionValue / priceTarget);

    const reasoning = this.generatePositionSizingReasoning(
      signalStrength,
      betaCdfValue,
      positionPercentage,
      positionValue,
      positionSize,
      tradeDecision
    );

    const result: PositionSizingResult = {
      position_percentage: positionPercentage,
      position_size: positionSize,
      reasoning,
      signal_strength: signalStrength,
      beta_cdf_value: betaCdfValue
    };

    this.logger.log('ANALYSIS', `Position Sizing: ${(positionPercentage * 100).toFixed(2)}% (${positionSize} shares) for signal strength ${signalStrength.toFixed(3)}`);
    
    return result;
  }

  /**
   * Convert confidence score to signal strength
   * Maps confidence [0.6, 1.0] to signal strength [0.0, 1.0]
   */
  confidenceToSignalStrength(confidence: number): number {
    // Clamp confidence to reasonable bounds
    const clampedConfidence = Math.max(0.0, Math.min(1.0, confidence));
    
    // Map from [0.6, 1.0] to [0.0, 1.0] for better distribution
    // This allows for better utilization of the beta distribution
    if (clampedConfidence < 0.6) {
      return 0.0; // Very low confidence maps to zero signal
    }
    
    return (clampedConfidence - 0.6) / 0.4;
  }

  /**
   * Validate signal strength input
   */
  private validateSignalStrength(signalStrength: number): void {
    if (typeof signalStrength !== 'number' || isNaN(signalStrength)) {
      throw new Error(`Invalid signal strength: must be a number, got ${typeof signalStrength}`);
    }
    
    if (signalStrength < 0 || signalStrength > 1) {
      throw new Error(`Signal strength must be between 0 and 1, got ${signalStrength}`);
    }
  }

  /**
   * Calculate Beta Distribution CDF using numerical approximation
   * Beta(a, b) CDF at point x
   */
  private betaCdf(x: number, a: number, b: number): number {
    // Clamp x to [0, 1] range for beta distribution
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Use incomplete beta function approximation
    // For Beta(2, 5), we can use a more direct approach
    return this.incompleteBeta(x, a, b);
  }

  /**
   * Incomplete Beta function approximation
   * This is a simplified implementation suitable for Beta(2, 5)
   */
  private incompleteBeta(x: number, a: number, b: number): number {
    // For Beta(2, 5), we can use the regularized incomplete beta function
    // I_x(a,b) = B(x; a, b) / B(a, b)
    
    // Using continued fraction approximation for better accuracy
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // For our specific case Beta(2, 5), we can use a direct formula
    // Since a=2, b=5, the CDF has a closed form
    if (a === 2 && b === 5) {
      // For Beta(2,5): CDF(x) = 1 - (1-x)^5 * (5*x + 1)
      const oneMinusX = 1 - x;
      const oneMinusXPow5 = Math.pow(oneMinusX, 5);
      return 1 - oneMinusXPow5 * (5 * x + 1);
    }
    
    // General case using series approximation
    return this.betaCdfSeries(x, a, b);
  }

  /**
   * Beta CDF using series approximation (fallback for general case)
   */
  private betaCdfSeries(x: number, a: number, b: number): number {
    const maxIterations = 100;
    const tolerance = 1e-10;
    
    let result = 0;
    let term = 1;
    
    // Use the relationship with hypergeometric function
    const logBetaFactor = this.logBeta(a, b);
    const xPowA = Math.pow(x, a);
    const oneMinusXPowB = Math.pow(1 - x, b);
    
    // Simplified series for computational efficiency
    for (let k = 0; k < maxIterations; k++) {
      const currentTerm = term * Math.pow(x, k) / (a + k);
      result += currentTerm;
      
      if (Math.abs(currentTerm) < tolerance) break;
      
      term *= (a + b + k) / (k + 1) * x;
    }
    
    return Math.min(1, Math.max(0, result * xPowA / Math.exp(logBetaFactor)));
  }

  /**
   * Log Beta function approximation
   */
  private logBeta(a: number, b: number): number {
    return this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b);
  }

  /**
   * Log Gamma function approximation using Stirling's approximation
   */
  private logGamma(z: number): number {
    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
    }
    
    z -= 1;
    const x = 0.9999999999998099 + 
              676.5203681218851 / (z + 1) - 
              1259.1392167224028 / (z + 2) + 
              771.3234287776531 / (z + 3) - 
              176.6150291621406 / (z + 4) + 
              12.507343278686905 / (z + 5) - 
              0.13857109526572012 / (z + 6) + 
              9.9843695780195716e-6 / (z + 7) + 
              1.5056327351493116e-7 / (z + 8);
    
    return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(z + 0.5) - (z + 0.5) + Math.log(x);
  }

  /**
   * Generate comprehensive reasoning for position sizing decision
   */
  private generatePositionSizingReasoning(
    signalStrength: number,
    betaCdfValue: number,
    positionPercentage: number,
    positionValue: number,
    positionSize: number,
    tradeDecision?: TradeDecision
  ): string {
    const timestamp = new Date().toISOString();
    
    let reasoning = `[${timestamp}] Beta Distribution Position Sizing Analysis:\n`;
    reasoning += `• Signal Strength: ${signalStrength.toFixed(4)} (normalized confidence)\n`;
    reasoning += `• Beta CDF Value: ${betaCdfValue.toFixed(4)} (Beta(2,5) distribution)\n`;
    reasoning += `• Position Percentage: ${(positionPercentage * 100).toFixed(2)}% of account\n`;
    reasoning += `• Position Value: $${positionValue.toFixed(2)}\n`;
    reasoning += `• Position Size: ${positionSize} shares\n`;
    
    if (tradeDecision) {
      reasoning += `• Symbol: ${tradeDecision.symbol}\n`;
      reasoning += `• Action: ${tradeDecision.action}\n`;
      reasoning += `• Original Confidence: ${tradeDecision.confidence.toFixed(3)}\n`;
      reasoning += `• Price Target: $${tradeDecision.price_target.toFixed(2)}\n`;
    }
    
    // Risk assessment
    if (positionPercentage < 0.02) {
      reasoning += `• Risk Level: LOW - Conservative position size due to moderate signal strength\n`;
    } else if (positionPercentage < 0.05) {
      reasoning += `• Risk Level: MODERATE - Balanced position size for good signal strength\n`;
    } else {
      reasoning += `• Risk Level: HIGH - Aggressive position size for strong signal strength\n`;
    }
    
    // Beta distribution interpretation
    reasoning += `• Beta(2,5) Distribution: Skewed toward lower values, conservative sizing\n`;
    reasoning += `• Formula Applied: position_pct = 0.10 * beta_cdf(${signalStrength.toFixed(3)}, 2, 5)\n`;
    
    return reasoning;
  }

  /**
   * Get position sizing statistics for monitoring
   */
  getPositionSizingStats(signalStrengths: number[]): {
    mean_position_pct: number;
    max_position_pct: number;
    min_position_pct: number;
    distribution_summary: string;
  } {
    if (signalStrengths.length === 0) {
      return {
        mean_position_pct: 0,
        max_position_pct: 0,
        min_position_pct: 0,
        distribution_summary: 'No signal strengths provided'
      };
    }

    const positionPercentages = signalStrengths.map(signal => {
      const betaCdf = this.betaCdf(signal, 2, 5);
      return 0.10 * betaCdf;
    });

    const mean = positionPercentages.reduce((sum, pct) => sum + pct, 0) / positionPercentages.length;
    const max = Math.max(...positionPercentages);
    const min = Math.min(...positionPercentages);

    return {
      mean_position_pct: mean,
      max_position_pct: max,
      min_position_pct: min,
      distribution_summary: `Beta(2,5) distribution produces conservative position sizes, mean: ${(mean * 100).toFixed(2)}%`
    };
  }
}
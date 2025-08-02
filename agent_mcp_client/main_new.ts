#!/usr/bin/env -S deno run --allow-all

/**
 * Ada Analytics Trading Agent - Main Entry Point
 * 
 * A modular, autonomous trading agent that:
 * - Collects market data from Quiver Quant
 * - Uses Claude AI for trade planning and analysis
 * - Executes trades via Alpaca
 * - Stores data in Supabase
 * - Provides web interface for monitoring and control
 * - Sends email notifications
 * 
 * Refactored for modularity and maintainability
 */

import { AutonomousTradingAgent } from './tradingAgent.ts';
import { Logger } from './utils/logger.ts';

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const logger = new Logger();
  const agent = new AutonomousTradingAgent();
  
  try {
    await agent.start();
    
    // Keep the process running
    logger.log('STATUS', '🚀 Agent is running. Press Ctrl+C to shutdown gracefully.');
    
    // Handle graceful shutdown on process termination
    Deno.addSignalListener("SIGINT", async () => {
      logger.log('ALERT', '🛑 Shutting down gracefully...');
      await agent.gracefulShutdown('Process termination');
      Deno.exit(0);
    });
    
    // Keep the process alive
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    }
    
  } catch (error) {
    logger.log('ALERT', `💥 Critical error in main(): ${error}`);
    
    try {
      await agent.gracefulShutdown('Critical error');
    } catch (shutdownError) {
      logger.log('ALERT', `Failed to shutdown gracefully: ${shutdownError}`);
    }
    
    Deno.exit(1);
  }
}

// Run the agent if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    const logger = new Logger();
    logger.log('ALERT', `Fatal error: ${error}`);
    Deno.exit(1);
  });
}

// Export for testing
export { AutonomousTradingAgent };
export default main;
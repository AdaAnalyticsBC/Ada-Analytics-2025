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

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const agent = new AutonomousTradingAgent();
  
  try {
    await agent.start();
    
    // Keep the process running
    console.log('🚀 Agent is running. Press Ctrl+C to shutdown gracefully.');
    
    // Handle graceful shutdown on process termination
    Deno.addSignalListener("SIGINT", async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await agent.gracefulShutdown('Process termination');
      Deno.exit(0);
    });
    
    // Keep the process alive
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    }
    
  } catch (error) {
    console.error('💥 Critical error in main():', error);
    
    try {
      await agent.gracefulShutdown('Critical error');
    } catch (shutdownError) {
      console.error('Failed to shutdown gracefully:', shutdownError);
    }
    
    Deno.exit(1);
  }
}

// Run the agent if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    Deno.exit(1);
  });
}

// Export for testing
export { AutonomousTradingAgent };
export default main;
#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Ada Analytics Trading Agent Control CLI
 * 
 * Safely manage your trading agent:
 * - Status check
 * - Pause/Resume
 * - Graceful shutdown
 * - Emergency stop
 * - Process monitoring
 */

interface AgentStatus {
  status: string;
  is_paused: boolean;
  last_run: string;
  connected_servers: string[];
}

class AgentController {
  private baseUrl: string;

  constructor() {
    const port = Deno.env.get("PORT") || "3000";
    this.baseUrl = `http://localhost:${port}`;
  }

  /**
   * Check if agent is running and get status
   */
  async status(): Promise<AgentStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get trading performance
   */
  async getPerformance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/performance`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get performance: ${error}`);
    }
  }

  /**
   * Get recent trades
   */
  async getTrades(days: number = 7): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/trades?days=${days}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get trades: ${error}`);
    }
  }

  /**
   * Pause the agent
   */
  async pause(): Promise<boolean> {
    try {
      // This would need the pause token, which we don't have access to
      // The web interface is the proper way to pause
      console.log("🌐 Please use the web interface to pause the agent:");
      console.log(`   ${this.baseUrl}`);
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<boolean> {
    try {
      console.log("🌐 Please use the web interface for safe shutdown:");
      console.log(`   ${this.baseUrl}/shutdown`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find agent process and kill it (emergency only)
   */
  async emergencyKill(): Promise<boolean> {
    try {
      console.log("🔍 Searching for Ada Analytics agent process...");
      
      // Try to find the process
      const cmd = ["pgrep", "-f", "main.ts"];
      const proc = new Deno.Command("pgrep", {
        args: ["-f", "main.ts"],
        stdout: "piped",
        stderr: "piped"
      });
      
      const result = await proc.output();
      
      if (result.code === 0) {
        const pids = new TextDecoder().decode(result.stdout).trim().split('\n').filter(Boolean);
        
        if (pids.length > 0) {
          console.log(`Found ${pids.length} process(es): ${pids.join(', ')}`);
          
          // Ask for confirmation
          const confirm = prompt("⚠️  EMERGENCY KILL - Are you sure? (yes/no): ");
          if (confirm?.toLowerCase() === 'yes') {
            for (const pid of pids) {
              try {
                const killCmd = new Deno.Command("kill", {
                  args: ["-TERM", pid],
                  stdout: "piped",
                  stderr: "piped"
                });
                await killCmd.output();
                console.log(`✅ Sent SIGTERM to process ${pid}`);
                
                // Wait a bit, then force kill if needed
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const forceKillCmd = new Deno.Command("kill", {
                  args: ["-KILL", pid],
                  stdout: "piped",
                  stderr: "piped"
                });
                await forceKillCmd.output();
                console.log(`🔥 Force killed process ${pid}`);
              } catch (error) {
                console.log(`⚠️  Could not kill process ${pid}: ${error}`);
              }
            }
            return true;
          } else {
            console.log("🚫 Emergency kill cancelled");
            return false;
          }
        }
      }
      
      console.log("ℹ️  No Ada Analytics agent processes found");
      return false;
    } catch (error) {
      console.error(`❌ Emergency kill failed: ${error}`);
      return false;
    }
  }

  /**
   * Display formatted status
   */
  async displayStatus(): Promise<void> {
    console.log("🔍 Checking Ada Analytics Trading Agent...\n");
    
    const status = await this.status();
    
    if (!status) {
      console.log("❌ Agent is not running or not responding");
      console.log("   Try starting with: ./dev.sh or ./start.sh\n");
      return;
    }
    
    console.log("✅ Agent is running and healthy");
    console.log("─".repeat(50));
    console.log(`📊 Status: ${status.is_paused ? '⏸️  PAUSED' : '▶️  ACTIVE'}`);
    console.log(`🕐 Last Run: ${status.last_run || 'Never'}`);
    console.log(`🔗 Connected Servers: ${status.connected_servers.length}`);
    console.log(`   ${status.connected_servers.join(', ')}`);
    console.log(`🌐 Web Interface: ${this.baseUrl}`);
    
    try {
      const performance = await this.getPerformance();
      console.log("\n📈 Trading Performance (90 days):");
      console.log(`   Total Trades: ${performance.total_trades}`);
      console.log(`   Win Rate: ${(performance.win_rate * 100).toFixed(1)}%`);
      console.log(`   Avg Return: ${(performance.avg_return * 100).toFixed(2)}%`);
      
      const trades = await this.getTrades(7);
      console.log(`\n📋 Recent Trades (7 days): ${trades.length}`);
      if (trades.length > 0) {
        const latest = trades[0];
        console.log(`   Latest: ${latest.symbol} ${latest.action} at ${new Date(latest.executed_at).toLocaleDateString()}`);
      }
    } catch (error) {
      console.log(`\n⚠️  Could not get performance data: ${error}`);
    }
    
    console.log("\n🔧 Control Options:");
    console.log(`   Web Interface: ${this.baseUrl}`);
    console.log(`   Pause/Resume:  ${this.baseUrl}`);
    console.log(`   Shutdown:      ${this.baseUrl}/shutdown`);
    console.log(`   Emergency:     ada-control kill`);
    console.log("");
  }

  /**
   * Monitor agent continuously
   */
  async monitor(): Promise<void> {
    console.log("🔄 Monitoring Ada Analytics Agent (Ctrl+C to stop)...\n");
    
    while (true) {
      const status = await this.status();
      const timestamp = new Date().toLocaleTimeString();
      
      if (status) {
        console.log(`[${timestamp}] ✅ HEALTHY - ${status.is_paused ? 'PAUSED' : 'ACTIVE'} - Servers: ${status.connected_servers.length}`);
      } else {
        console.log(`[${timestamp}] ❌ NOT RESPONDING`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
    }
  }
}

/**
 * CLI Command Handler
 */
async function main() {
  const controller = new AgentController();
  const args = Deno.args;
  
  if (args.length === 0) {
    await controller.displayStatus();
    return;
  }
  
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'status':
    case 'check':
      await controller.displayStatus();
      break;
      
    case 'pause':
      console.log("🌐 Use web interface to pause:");
      console.log(`   ${controller['baseUrl']}`);
      break;
      
    case 'shutdown':
    case 'stop':
      await controller.shutdown();
      break;
      
    case 'kill':
    case 'emergency':
      console.log("🚨 EMERGENCY KILL - This will forcefully terminate the agent!");
      console.log("⚠️  Use this ONLY if the agent is unresponsive to normal shutdown.");
      console.log("⚠️  Pending trades may not be cancelled properly!\n");
      await controller.emergencyKill();
      break;
      
    case 'monitor':
    case 'watch':
      await controller.monitor();
      break;
      
    case 'performance':
    case 'perf':
      try {
        const perf = await controller.getPerformance();
        console.log("📊 Trading Performance (90 days):");
        console.log(`   Total Trades: ${perf.total_trades}`);
        console.log(`   Win Rate: ${(perf.win_rate * 100).toFixed(1)}%`);
        console.log(`   Average Return: ${(perf.avg_return * 100).toFixed(2)}%`);
        console.log(`   Total Return: ${(perf.total_return * 100).toFixed(2)}%`);
        console.log(`   Symbols Traded: ${perf.symbols_traded.join(', ')}`);
      } catch (error) {
        console.error(`❌ ${error}`);
      }
      break;
      
    case 'trades':
      try {
        const days = parseInt(args[1]) || 7;
        const trades = await controller.getTrades(days);
        console.log(`📋 Recent Trades (${days} days): ${trades.length}`);
        
        if (trades.length > 0) {
          console.log("\nSymbol | Action | Quantity | Price | Date");
          console.log("─".repeat(50));
          trades.slice(0, 10).forEach(trade => {
            const date = new Date(trade.executed_at).toLocaleDateString();
            console.log(`${trade.symbol.padEnd(6)} | ${trade.action.padEnd(6)} | ${trade.quantity.toString().padEnd(8)} | $${trade.price_target.toFixed(2).padEnd(6)} | ${date}`);
          });
          
          if (trades.length > 10) {
            console.log(`\n... and ${trades.length - 10} more`);
          }
        }
      } catch (error) {
        console.error(`❌ ${error}`);
      }
      break;
      
          case 'test':
        const testType = args[1] || 'workflow';
        console.log(`🧪 Running test: ${testType}`);
        try {
          const response = await fetch(`${controller['baseUrl']}/test/${testType}`);
          if (response.ok) {
            const html = await response.text();
            // Extract the main result from HTML (simple parsing)
            const match = html.match(/<h3>(.*?)<\/h3>/);
            if (match) {
              console.log(match[1].replace(/[^\w\s]/gi, '')); // Remove HTML entities
            } else {
              console.log("✅ Test completed - check web interface for details");
            }
            console.log(`🌐 Full results: ${controller['baseUrl']}/test/${testType}`);
          } else {
            console.error(`❌ Test failed with status ${response.status}`);
          }
        } catch (error) {
          console.error(`❌ Test error: ${error}`);
        }
        break;
        
      case 'help':
      case '--help':
      case '-h':
      console.log("🤖 Ada Analytics Trading Agent Control CLI\n");
      console.log("Usage: ada-control [command] [options]\n");
      console.log("Commands:");
      console.log("  status          Show agent status and performance");
      console.log("  pause           Show pause instructions");
      console.log("  shutdown        Initiate graceful shutdown");
      console.log("  kill            Emergency force kill (dangerous!)");
      console.log("  monitor         Monitor agent continuously");
      console.log("  performance     Show trading performance");
      console.log("  trades [days]   Show recent trades (default: 7 days)");
      console.log("  test [type]     Run agent tests (workflow, alpaca, supabase, etc.)");
      console.log("  help            Show this help\n");
      console.log("Examples:");
      console.log("  ada-control                    # Show status");
      console.log("  ada-control monitor            # Monitor continuously");
      console.log("  ada-control trades 30          # Show 30 days of trades");
      console.log("  ada-control test workflow      # Test complete trading workflow");
      console.log("  ada-control test alpaca        # Test Alpaca connection");
      console.log("  ada-control shutdown           # Safe shutdown");
      console.log("  ada-control kill               # Emergency kill\n");
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log("Run 'ada-control help' for available commands");
      Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
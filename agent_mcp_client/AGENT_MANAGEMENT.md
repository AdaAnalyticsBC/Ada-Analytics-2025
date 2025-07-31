# 🤖 Ada Analytics Trading Agent Management

Complete guide for safely managing your autonomous trading agent.

## 🚀 Starting the Agent

### Quick Start
```bash
# Development mode (with auto-restart)
./dev.sh

# Production mode
./start.sh

# Using Deno directly
deno task start
```

### Environment Setup
Ensure your `.env` file is configured:
```bash
cp env.template .env
# Edit .env with your API keys
```

## 📊 Monitoring & Status

### Check Agent Status
```bash
# Quick status check
./ada-control
# or
deno task status

# Detailed status with performance
./ada-control status

# Continuous monitoring
./ada-control monitor
# or
deno task monitor
```

### Web Interface
Visit `http://localhost:3000` for:
- 📊 Real-time dashboard
- 📈 Trading performance
- 📋 Trade history
- 🎛️ Controls

## ⏸️ Pausing & Resuming

### Pause Trading
```bash
# Via web interface (recommended)
open http://localhost:3000

# CLI status and web link
./ada-control pause
```

The agent will:
- ✅ Complete current trades
- ✅ Save state
- ✅ Send pause email
- ✅ Continue monitoring (no new trades)

### Resume Trading
Use the resume link from the pause email or visit the web interface.

## 🛑 Stopping the Agent

### 1. Graceful Shutdown (Recommended)
```bash
# Via web interface
open http://localhost:3000/shutdown

# CLI guidance
./ada-control shutdown
# or
deno task shutdown
```

**What happens:**
- ⏸️ Trading paused immediately
- 🚫 Pending orders cancelled
- 💾 State saved to disk
- 📊 Shutdown logged to Supabase
- 🔌 MCP connections closed
- 📧 Notification email sent
- 🌐 Web server stopped

### 2. Emergency Kill (If Unresponsive)
```bash
# Force kill (dangerous!)
./ada-control kill
# or
deno task kill
```

**⚠️ Warning:** Use only if agent is unresponsive. May not cancel pending orders!

### 3. Signal Handling
The agent responds to system signals:
```bash
# Graceful shutdown
kill -TERM <pid>

# Force interrupt (Ctrl+C)
kill -INT <pid>
```

## 🔄 Restarting the Agent

### Complete Restart
```bash
# Interactive restart script
./restart.sh
```

**Process:**
1. 🛑 Requests graceful shutdown via web
2. ⏳ Waits for confirmation
3. 🔍 Verifies agent stopped
4. ⏱️ Waits 5 seconds
5. 🚀 Starts agent fresh

### Manual Restart
```bash
# 1. Shutdown
open http://localhost:3000/shutdown

# 2. Wait for completion
./ada-control status

# 3. Start fresh
./start.sh
```

## 🔧 Advanced Management

### Process Management
```bash
# Find agent processes
pgrep -f "main.ts"

# Kill specific process
kill -TERM <pid>

# Monitor system resources
top -p <pid>
```

### Log Analysis
```bash
# Follow live logs
tail -f logs/agent.log

# Search for errors
grep "ERROR" logs/agent.log

# View startup logs
grep "Starting" logs/agent.log
```

### Performance Monitoring
```bash
# Get performance stats
./ada-control performance

# Recent trades
./ada-control trades 30

# Health check
curl http://localhost:3000/health
```

## 🆘 Troubleshooting

### Agent Won't Start
```bash
# Check environment
./ada-control status

# Verify .env file
cat .env

# Check port availability
lsof -i :3000

# View startup errors
./start.sh 2>&1 | tee startup.log
```

### Agent Won't Stop
```bash
# Try graceful shutdown first
open http://localhost:3000/shutdown

# Wait and check
sleep 10
./ada-control status

# Emergency kill as last resort
./ada-control kill
```

### Connection Issues
```bash
# Check MCP servers
./ada-control status

# Test API connections
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models

# Verify Alpaca connection
python3 -c "import alpaca_trade_api; print('OK')"
```

### Performance Issues
```bash
# Monitor resource usage
top -p $(pgrep -f main.ts)

# Check memory usage
ps aux | grep main.ts

# View trade performance
./ada-control performance
```

## 📋 Quick Reference

| Action | Command | Web Interface |
|--------|---------|---------------|
| Status | `./ada-control` | `http://localhost:3000` |
| Start | `./start.sh` | - |
| Pause | Web only | `http://localhost:3000` |
| Resume | Web only | Email link |
| Shutdown | `./ada-control shutdown` | `http://localhost:3000/shutdown` |
| Emergency | `./ada-control kill` | - |
| Restart | `./restart.sh` | - |
| Monitor | `./ada-control monitor` | `http://localhost:3000` |
| Performance | `./ada-control performance` | `http://localhost:3000/performance` |
| Trades | `./ada-control trades` | `http://localhost:3000/trades` |

## 🔒 Security Notes

- 🌐 Web interface is unprotected (localhost only)
- 🔑 Shutdown requires confirmation tokens
- 📧 Email notifications for state changes
- 💾 All actions logged to Supabase
- 🕐 Automatic state persistence

## 🚨 Emergency Procedures

### Complete System Failure
1. `./ada-control kill` - Force stop
2. Check account manually
3. Cancel orders in Alpaca dashboard
4. Review logs for errors
5. Restart with `./restart.sh`

### Market Hours Emergency
1. `open http://localhost:3000/shutdown` - Immediate stop
2. Monitor Alpaca dashboard
3. Manual order management if needed
4. Review positions and P&L

### Data Corruption
1. Stop agent gracefully
2. Backup current state: `cp agent_state.json agent_state.backup`
3. Review trade history in Supabase
4. Restart with verified state

## 📞 Support

- 📖 Documentation: This file
- 🌐 Web Interface: `http://localhost:3000`
- 📊 Logs: Check console output
- 💾 State: `agent_state.json`
- 🗃️ Database: Supabase trades table

Remember: **Always use graceful shutdown when possible!** ✅
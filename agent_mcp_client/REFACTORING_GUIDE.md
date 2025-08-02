# Ada Analytics Trading Agent - Refactoring Guide

## Overview

The trading agent has been successfully refactored from a single monolithic file (2500+ lines) into a modular, maintainable architecture. This guide explains the new structure and how to use it.

## 🏗️ New Architecture

### File Structure

```
Ada-Analytics/agent_mcp_client/
├── main_new.ts              # Clean entry point (use this instead of main.ts)
├── tradingAgent.ts          # Main orchestrator class
├── webServer.ts             # Web interface and API endpoints
├── config.ts                # All configuration and constants
├── types/
│   └── interfaces.ts        # Type definitions and interfaces
├── services/
│   ├── marketDataService.ts # Quiver Quant data collection
│   ├── tradingService.ts    # Alpaca trading operations
│   ├── emailService.ts      # Email notifications via Resend
│   ├── databaseService.ts   # Supabase database operations
│   └── aiService.ts         # Claude AI integration
├── utils/
│   └── logger.ts            # Centralized logging utility
└── REFACTORING_GUIDE.md     # This guide
```

### Services Overview

#### 🧠 AIService (`services/aiService.ts`)
- **Purpose**: Claude AI integration for trade planning and analysis
- **Key Methods**:
  - `craftTradePlan()` - Generate initial trading strategy
  - `makePredictions()` - Create specific trade recommendations
  - `analyzeTradePerformance()` - Evaluate historical performance
  - `adjustTradePlan()` - Modify strategy based on analysis

#### 📊 MarketDataService (`services/marketDataService.ts`)
- **Purpose**: Collect market data from Quiver Quant
- **Key Methods**:
  - `collectMarketData()` - Get general market data
  - `getCongressTrading()` - Congressional trading activity
  - `getInsiderTrading()` - Insider trading data
  - `getSEC13FChanges()` - Institutional holdings data

#### 🔄 TradingService (`services/tradingService.ts`)
- **Purpose**: Execute trades and manage account via Alpaca
- **Key Methods**:
  - `executeTrades()` - Execute planned trades
  - `getAccountDetails()` - Get account information
  - `setStopLossAndTakeProfit()` - Set protective orders
  - `cancelAllOrders()` - Emergency order cancellation

#### 💾 DatabaseService (`services/databaseService.ts`)
- **Purpose**: Supabase database operations
- **Key Methods**:
  - `storeTrades()` - Store executed trades with context
  - `getTradingPerformance()` - Calculate performance metrics
  - `getHistoricalTrades()` - Retrieve trade history
  - `getSymbolAnalysis()` - Analyze specific symbols

#### 📧 EmailService (`services/emailService.ts`)
- **Purpose**: Email notifications via Resend
- **Key Methods**:
  - `sendTradePlanEmail()` - Daily trade plan notifications
  - `sendDailySummary()` - End-of-day summaries
  - `sendErrorAlert()` - Critical error notifications
  - `sendResumeEmail()` - Pause/resume controls

#### 🌐 WebServer (`webServer.ts`)
- **Purpose**: Web interface and API endpoints
- **Features**:
  - Dashboard with real-time status
  - Performance analytics
  - Trade history
  - Test functions
  - Emergency controls

## 🚀 Getting Started

### 1. Using the New Architecture

Replace your current startup command:

```bash
# Old way
deno run --allow-all main.ts

# New way  
deno run --allow-all main_new.ts
```

### 2. Environment Variables

The same environment variables are required:

```bash
ANTHROPIC_API_KEY=your_claude_api_key
RESEND_API_KEY=your_resend_api_key
BASE_URL=https://your-domain.com
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret
SUPABASE_ACCESS_TOKEN=your_supabase_token
QUIVER_API_TOKEN=your_quiver_token
```

### 3. Configuration

All configuration is now centralized in `config.ts`:

```typescript
// Trading parameters
export const TRADING_CONFIG = {
  MAX_TRADES_PER_DAY: 2,
  RISK_PER_TRADE: 0.01, // 1%
  STOP_LOSS_PERCENTAGE: 0.05, // 5%
  // ...
};

// Cron schedules
export const CRON_SCHEDULES = {
  DAILY_TRADING: "0 6 * * 1-5",      // 6 AM EST
  END_OF_DAY_SUMMARY: "0 17 * * 1-5", // 5 PM EST
  // ...
};
```

## 🔧 Customization

### Adding New Market Data Sources

1. Extend `IMarketDataService` interface in `types/interfaces.ts`
2. Add new methods to `MarketDataService` class
3. Update `MCP_SERVERS` configuration if needed

### Adding New Trading Strategies

1. Add strategy configuration to `STRATEGY_CONFIG` in `config.ts`
2. Update AI prompts in `AIService` to include new strategy logic
3. Modify trade validation in `TradingService` if needed

### Adding New Notification Types

1. Add new method to `EmailService`
2. Create email template in the service
3. Add trigger points in `TradingAgent` workflow

## 📈 Benefits of New Architecture

### ✅ Maintainability
- **Single Responsibility**: Each service has a clear, focused purpose
- **Dependency Injection**: Services can be easily tested and mocked
- **Configuration Management**: All settings centralized and typed

### ✅ Testability
- **Service Isolation**: Each service can be unit tested independently
- **Mock-friendly**: Interfaces allow easy mocking for tests
- **Test Coverage**: Easier to achieve comprehensive test coverage

### ✅ Scalability
- **Modular Growth**: New features can be added as new services
- **Performance**: Services can be optimized independently
- **Monitoring**: Each service can have specific monitoring

### ✅ Reliability
- **Error Isolation**: Failures in one service don't crash others
- **Graceful Degradation**: Agent can operate with some services offline
- **State Management**: Centralized state with atomic updates

## 🧪 Testing

### Running Individual Service Tests

```bash
# Test market data collection
deno run --allow-all main_new.ts
# Navigate to http://localhost:3000/test
# Click "Test Market Data"

# Test AI integration
# Click "Test Claude API"

# Test trading connection
# Click "Test Alpaca"
```

### Web Interface Testing

The web interface provides comprehensive testing capabilities:

1. **Dashboard**: Monitor real-time agent status
2. **Performance**: View trading analytics and metrics
3. **Trade History**: Browse historical trades
4. **Test Functions**: Validate all service connections

## 🔄 Migration from Old Version

### For Production Environments

1. **Backup Current State**: Save `agent_state.json`
2. **Test New Version**: Run `main_new.ts` in development first
3. **Verify Services**: Use web interface to test all connections
4. **Switch Entry Point**: Update deployment to use `main_new.ts`
5. **Monitor**: Watch logs for any issues

### Rollback Plan

If issues occur, you can quickly rollback:

1. Stop the new version: `Ctrl+C`
2. Restart with old version: `deno run --allow-all main.ts`
3. The state file and database remain compatible

## 📝 Development Guidelines

### Adding New Features

1. **Design First**: Define interfaces in `types/interfaces.ts`
2. **Service Layer**: Implement in appropriate service
3. **Configuration**: Add settings to `config.ts`
4. **Integration**: Wire up in `TradingAgent`
5. **Testing**: Add test endpoint in `WebServer`

### Code Style

- **TypeScript**: Use strict typing throughout
- **Error Handling**: Comprehensive try/catch with logging
- **Documentation**: JSDoc comments for all public methods
- **Logging**: Use the centralized logger for all output

## 🆘 Troubleshooting

### Common Issues

#### Services Not Connecting
- Check environment variables are set
- Verify MCP server paths in `config.ts`
- Check network connectivity

#### Web Interface Not Loading
- Verify PORT environment variable
- Check firewall settings
- Ensure no port conflicts

#### Trades Not Executing
- Verify market hours
- Check account balance
- Validate trade parameters
- Review Alpaca connection

### Getting Help

1. **Logs**: Check console output for error messages
2. **Web Interface**: Use `/test` endpoints to diagnose issues
3. **State File**: Review `agent_state.json` for current status
4. **Database**: Check Supabase logs table for historical issues

## 🎯 Future Enhancements

The new architecture makes it easy to add:

- **Multiple Brokers**: Add more trading service implementations
- **Advanced Strategies**: Extend AI service with new algorithms
- **Real-time Monitoring**: WebSocket updates in web interface
- **Mobile Alerts**: SMS/push notification service
- **Portfolio Analytics**: Enhanced performance tracking
- **Risk Management**: Advanced position sizing algorithms

---

**Note**: Keep both `main.ts` and `main_new.ts` during the transition period. Once you've verified the new version works correctly, you can remove or archive the old version.
# 🤖 Ada Analytics Trading Agent v2.0

**Autonomous AI-powered trading agent with modular architecture and Railway deployment**

## 🚀 Quick Start

### One-Command Setup & Deployment
```bash
# 1. Initial setup
./setup.sh

# 2. Fill in your API keys
nano .env

# 3. Setup Supabase (choose one)
./scripts/setup-supabase-rls.sh      # Production (recommended)
./scripts/disable-supabase-rls.sh    # Development only

# 4. Test locally  
./scripts/dev.sh

# 5. Deploy to Railway
./scripts/deploy.sh

# 6. Monitor live
./scripts/monitor.sh
```

## 📁 Simplified Structure

```
Ada-Analytics/agent_mcp_client/
├── 🚀 Quick Start
│   ├── setup.sh                 # One-command setup
│   └── main_new.ts             # New modular entry point
│
├── 📜 Scripts (Simplified)
│   ├── scripts/dev.sh          # Development mode
│   ├── scripts/start.sh        # Production start
│   ├── scripts/test.sh         # Run tests
│   ├── scripts/deploy.sh       # Deploy to Railway
│   ├── scripts/monitor.sh      # Live monitoring
│   ├── scripts/logs.sh         # Log viewer
│   ├── scripts/setup-supabase-rls.sh     # RLS setup
│   └── scripts/disable-supabase-rls.sh   # RLS disable
│
├── 🏗️ Core Architecture  
│   ├── tradingAgent.ts         # Main orchestrator
│   ├── webServer.ts           # Dashboard & API
│   ├── config.ts              # All configuration
│   └── types/interfaces.ts    # Type definitions
│
├── 🔧 Services (Modular)
│   ├── services/aiService.ts        # Claude AI integration
│   ├── services/tradingService.ts   # Alpaca trading
│   ├── services/marketDataService.ts # Quiver data
│   ├── services/databaseService.ts  # Supabase storage
│   └── services/emailService.ts     # Email notifications
│
├── 🚄 Railway Deployment
│   ├── railway.toml            # Railway configuration
│   ├── nixpacks.toml          # Build configuration
│   ├── Dockerfile             # Container definition
│   └── .env                   # Environment variables
│
└── 📖 Documentation
    ├── README.md              # This file
    ├── RAILWAY_DEPLOYMENT.md  # Deployment guide
    ├── SUPABASE_RLS_GUIDE.md  # Database security setup
    └── REFACTORING_GUIDE.md   # Architecture details
```

## 🎯 Key Features

### ✅ **Simplified Operations**
- **One-command setup**: `./setup.sh`
- **Easy development**: `./scripts/dev.sh` 
- **Simple deployment**: `./scripts/deploy.sh`
- **Live monitoring**: `./scripts/monitor.sh`

### 🏗️ **Modular Architecture**  
- **Service-based design**: Each component isolated
- **Clean interfaces**: Easy testing and mocking
- **Centralized config**: All settings in one place
- **Type safety**: Full TypeScript coverage

### 🚄 **Railway Integration**
- **Auto-deployment**: Push to deploy
- **Health monitoring**: Built-in health checks
- **Auto-scaling**: Scales based on load
- **Log aggregation**: Centralized logging

### 📊 **Comprehensive Monitoring**
- **Web dashboard**: Real-time status at `/`
- **API endpoints**: Health, metrics, logs
- **CLI monitoring**: Interactive terminal dashboard
- **Alert system**: Email notifications

## 🎮 Command Reference

### Development
```bash
./scripts/dev.sh              # Start with hot reload
./scripts/test.sh             # Run test suite
```

### Deployment  
```bash
./scripts/deploy.sh           # Deploy to Railway
railway logs                  # View deployment logs
railway status               # Check service status
```

### Monitoring
```bash
./scripts/monitor.sh          # Interactive dashboard
./scripts/logs.sh live        # Live logs
./scripts/logs.sh errors      # Error logs only
./scripts/logs.sh trading     # Trading activity
```

### Quick Checks
```bash
curl https://your-app.railway.app/api/health    # Health status
curl https://your-app.railway.app/api/metrics   # System metrics  
curl https://your-app.railway.app/api/trades    # Recent trades
```

## 🌐 Web Interface

Once deployed, access these URLs:

- **🏠 Dashboard**: `https://your-app.railway.app/`
- **📊 Performance**: `https://your-app.railway.app/performance`  
- **📈 Trade History**: `https://your-app.railway.app/trades`
- **🧪 Test Suite**: `https://your-app.railway.app/test`
- **🏥 Health API**: `https://your-app.railway.app/api/health`

## 🔧 Configuration

### Environment Variables
```bash
# Core AI & Communication
ANTHROPIC_API_KEY=your_key
RESEND_API_KEY=your_key

# Trading & Data
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
SUPABASE_ACCESS_TOKEN=your_token
SUPABASE_SERVICE_ROLE_KEY=your_service_key  # For RLS
QUIVER_API_TOKEN=your_token

# Application
BASE_URL=https://your-app.railway.app
PORT=3000
NODE_ENV=production
```

### Trading Parameters
Edit `config.ts` to adjust:
- Risk per trade (default: 1%)
- Max trades per day (default: 2)
- Stop loss/take profit levels
- Trading schedule (default: 6 AM EST)

## 🚨 Emergency Controls

### Web Interface
- **Pause Trading**: Dashboard → Pause button
- **Emergency Stop**: `/shutdown` endpoint
- **Resume Trading**: Email link after pause

### CLI Commands
```bash
# Restart service
railway restart

# View live status
./scripts/monitor.sh

# Emergency deployment rollback
railway rollback
```

## 📈 Monitoring Dashboard

The interactive monitoring dashboard (`./scripts/monitor.sh`) provides:

- ✅ **Real-time health status** of all services
- 💰 **Trading status** (active/paused, balance, trades)
- 🔧 **Service monitoring** (Claude, Alpaca, Supabase, Quiver)
- 📊 **Quick actions** (logs, metrics, dashboard access)
- 🔄 **Auto-refresh** every 10 seconds

## 🛠️ Troubleshooting

### Common Issues

#### Deployment fails
```bash
railway logs --deployment    # Check build logs
railway variables            # Verify environment vars
```

#### Services not responding  
```bash
curl https://your-app.railway.app/test/anthropic  # Test Claude
curl https://your-app.railway.app/test/alpaca     # Test Alpaca  
curl https://your-app.railway.app/test/supabase   # Test database
```

### Supabase RLS issues
```bash
# Check RLS documentation
cat SUPABASE_RLS_GUIDE.md

# Quick fix for development
./scripts/disable-supabase-rls.sh

# Production setup
./scripts/setup-supabase-rls.sh
```

#### Trading not working
```bash
./scripts/logs.sh trading    # Check trading logs
curl https://your-app.railway.app/api/metrics | jq '.agent_state'
```

## 🔄 Migration from v1.0

If upgrading from the monolithic version:

1. **Backup current state**: Copy `agent_state.json`
2. **Run setup**: `./setup.sh`
3. **Copy environment**: Transfer API keys to new `.env`
4. **Test locally**: `./scripts/dev.sh`
5. **Deploy**: `./scripts/deploy.sh`

The new version is **100% backward compatible** with existing data.

## 📚 Documentation

- **🚄 [Railway Deployment Guide](RAILWAY_DEPLOYMENT.md)**: Complete deployment instructions
- **🔒 [Supabase RLS Guide](SUPABASE_RLS_GUIDE.md)**: Database security setup
- **🏗️ [Architecture Guide](REFACTORING_GUIDE.md)**: Technical architecture details
- **📖 [API Documentation](webServer.ts)**: Available endpoints and responses

## 🎯 What's New in v2.0

### ✨ **Simplified Operations**
- Reduced from 7 complex scripts to 6 simple ones
- One-command setup and deployment
- Interactive monitoring dashboard

### 🏗️ **Modular Architecture**  
- Split 2500-line monolith into focused services
- Clean interfaces and dependency injection
- Comprehensive test coverage

### 🚄 **Railway Integration**
- Native Railway deployment configuration
- Auto-scaling and health monitoring
- Integrated logging and metrics

### 📊 **Enhanced Monitoring**
- Real-time service health monitoring
- Performance metrics and analytics
- Live log streaming and filtering

---

## 🎉 Ready to Deploy!

Your Ada Analytics Trading Agent is now production-ready with:

✅ **Simplified bash scripts**  
✅ **Railway deployment configuration**  
✅ **Comprehensive monitoring**  
✅ **Real-time health checks**  
✅ **Complete documentation**

**Start with**: `./setup.sh` and follow the prompts! 🚀
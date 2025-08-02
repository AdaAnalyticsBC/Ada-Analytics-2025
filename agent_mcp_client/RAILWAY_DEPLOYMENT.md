# 🚄 Railway Deployment Guide - Ada Analytics Trading Agent

## Quick Start Deployment

### 1. Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. One-Command Deployment
```bash
# Navigate to agent directory
cd Ada-Analytics/agent_mcp_client

# Deploy to Railway
./scripts/deploy.sh
```

## 📋 Environment Variables Setup

Create a `.env` file with your API keys:

```bash
# 🤖 Ada Analytics Trading Agent - Environment Variables

# Core AI & Communication
ANTHROPIC_API_KEY=your_anthropic_key_here
RESEND_API_KEY=your_resend_key_here

# Trading & Data  
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_here
SUPABASE_ACCESS_TOKEN=your_supabase_token_here
QUIVER_API_TOKEN=your_quiver_token_here

# Application (Railway will set PORT automatically)
BASE_URL=https://your-app.railway.app
NODE_ENV=production
TZ=America/New_York
```

## 🚀 Deployment Commands

### Development
```bash
./scripts/dev.sh          # Start development mode with hot reload
```

### Testing
```bash
./scripts/test.sh          # Run automated tests
```

### Production Deployment
```bash
./scripts/deploy.sh        # Deploy to Railway
```

### Monitoring
```bash
./scripts/monitor.sh       # Live monitoring dashboard
./scripts/logs.sh          # View logs (live, errors, trading, etc.)
```

## 📊 Monitoring & Logging

### Built-in Monitoring Endpoints

#### Health Check
```bash
curl https://your-app.railway.app/api/health
```
Response includes:
- Overall service status
- Individual service health
- Response times
- System uptime

#### System Metrics
```bash
curl https://your-app.railway.app/api/metrics
```
Response includes:
- Agent state (paused/active)
- Trading performance
- System information
- Memory usage

#### Live Logs
```bash
curl https://your-app.railway.app/api/logs?level=error&limit=50
```

### Web Dashboard
- **Main Dashboard**: `https://your-app.railway.app/`
- **Performance**: `https://your-app.railway.app/performance`
- **Trade History**: `https://your-app.railway.app/trades`
- **Test Suite**: `https://your-app.railway.app/test`

### Railway CLI Monitoring
```bash
# Live logs
railway logs --follow

# Recent logs
railway logs --tail 100

# Service status
railway status

# Environment variables
railway variables
```

### Interactive Monitor
```bash
./scripts/monitor.sh
```
Features:
- Real-time health status
- Service monitoring
- Quick actions (logs, metrics, dashboard)
- Auto-refresh every 10 seconds

## 🔧 Configuration

### Railway Configuration (`railway.toml`)
```toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "always"

[services.healthcheck]
path = "/api/health"
interval = 30
timeout = 10
retries = 3

[services.resources]
memory = 1024
cpu = 1000
```

### Auto-scaling
```toml
[services.autoscaling]
enabled = true
minReplicas = 1
maxReplicas = 2
targetCPU = 80
targetMemory = 80
```

## 🚨 Emergency Controls

### Pause Trading
```bash
# Via web interface
open https://your-app.railway.app/

# Via API
curl -X POST https://your-app.railway.app/pause/emergency-token
```

### Restart Service
```bash
railway restart
```

### Emergency Shutdown
```bash
# Graceful shutdown
curl -X POST https://your-app.railway.app/shutdown/graceful/token

# Force restart via Railway
railway restart
```

## 📈 Scaling & Performance

### Resource Configuration
- **Memory**: 1GB (recommended)
- **CPU**: 1000m (1 CPU core)
- **Auto-scaling**: Enabled with CPU/Memory targets

### Performance Monitoring
- Health checks every 30 seconds
- Automatic restart on failure
- Service degradation alerts
- Response time monitoring

### Optimization Tips
1. **Memory**: Monitor via `/api/metrics` endpoint
2. **CPU**: Check CPU usage in Railway dashboard
3. **Network**: Monitor API response times
4. **Database**: Watch Supabase connection health

## 🔍 Troubleshooting

### Common Issues

#### 1. Deployment Fails
```bash
# Check build logs
railway logs --deployment

# Verify environment variables
railway variables

# Check service status
railway status
```

#### 2. Health Check Failures
```bash
# Test health endpoint
curl https://your-app.railway.app/api/health

# Check individual services
curl https://your-app.railway.app/test/anthropic
curl https://your-app.railway.app/test/alpaca
curl https://your-app.railway.app/test/supabase
```

#### 3. Trading Not Working
```bash
# Check agent status
curl https://your-app.railway.app/api/metrics | jq '.agent_state'

# View trading logs
./scripts/logs.sh trading

# Test trading service
curl https://your-app.railway.app/test/alpaca
```

#### 4. API Timeouts
```bash
# Check service response times
curl https://your-app.railway.app/api/health | jq '.services'

# Restart if needed
railway restart
```

### Log Analysis

#### Error Patterns
```bash
# View errors only
./scripts/logs.sh errors

# Search for specific errors
railway logs --tail 200 | grep "CRITICAL\|FAILED\|ERROR"
```

#### Trading Activity
```bash
# Trading-specific logs
./scripts/logs.sh trading

# Recent trades
curl https://your-app.railway.app/api/trades?days=1
```

#### Performance Issues
```bash
# Memory usage
curl https://your-app.railway.app/api/metrics | jq '.system_info.memory_usage'

# Service response times
curl https://your-app.railway.app/api/health | jq '.services'
```

## 🛡️ Security & Best Practices

### Environment Variables
- ✅ Store all secrets in Railway environment variables
- ✅ Never commit API keys to git
- ✅ Use strong, unique tokens
- ✅ Rotate keys regularly

### Access Control
- 🔒 Railway project access controls
- 🔒 Web dashboard authentication (implement if needed)
- 🔒 API endpoint rate limiting
- 🔒 HTTPS-only communication

### Monitoring Alerts
```bash
# Set up custom domains for alerts
railway domains

# Configure notification webhooks
railway webhooks
```

## 📱 Mobile Monitoring

Access your trading agent from anywhere:

### Mobile-Friendly URLs
- Dashboard: `https://your-app.railway.app/`
- Health: `https://your-app.railway.app/api/health`
- Quick Status: `https://your-app.railway.app/api/metrics`

### Bookmark These
- 🏠 Dashboard
- 📊 Performance
- 🚨 Pause Trading
- 📜 Recent Logs API

## 🔄 Continuous Deployment

### Automatic Deployment
Railway automatically deploys when you push to your connected Git repository.

### Manual Deployment
```bash
# Deploy current directory
railway up

# Deploy specific branch
railway up --branch main

# Deploy with build logs
railway up --verbose
```

### Rollback
```bash
# View deployments
railway history

# Rollback to previous
railway rollback
```

## 📞 Support

### Getting Help
1. **Check Health Dashboard**: `https://your-app.railway.app/api/health`
2. **Review Logs**: `./scripts/logs.sh errors`
3. **Test Services**: `https://your-app.railway.app/test`
4. **Railway Support**: https://railway.app/help

### Emergency Contacts
- **Railway Status**: https://railway.instatus.com/
- **Service Monitoring**: Your web dashboard
- **Critical Issues**: Use emergency pause controls

---

## 🎯 Quick Reference

### Essential Commands
```bash
# Deploy
./scripts/deploy.sh

# Monitor
./scripts/monitor.sh

# View logs
./scripts/logs.sh

# Test locally
./scripts/dev.sh

# Emergency restart
railway restart
```

### Key URLs
- **Dashboard**: `https://your-app.railway.app/`
- **Health**: `https://your-app.railway.app/api/health`
- **Metrics**: `https://your-app.railway.app/api/metrics`
- **Tests**: `https://your-app.railway.app/test`

Your Ada Analytics Trading Agent is now production-ready on Railway! 🚀
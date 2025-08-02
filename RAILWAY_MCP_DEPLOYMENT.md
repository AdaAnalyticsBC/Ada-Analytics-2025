# 🚂 Railway MCP Deployment Guide

## **Overview**
Deploy Ada Analytics Trading Agent with separate MCP servers on Railway for optimal performance and cost control.

## **🏗️ Architecture**

```
Ada-Analytics/
├── agent_mcp_client/          # Main Trading Agent (Railway Service 1)
├── alpaca-mcp-server/         # Alpaca MCP Server (Railway Service 2)
├── quiver-mcp-server/         # Quiver MCP Server (Railway Service 3)
└── dashboard/                 # Frontend Dashboard (Optional)
```

## **📋 Prerequisites**

### **Required Accounts**
- [ ] Railway account (free tier available)
- [ ] Supabase project with RLS enabled
- [ ] Alpaca paper trading account
- [ ] Anthropic API key
- [ ] Quiver Quant API key (optional)

### **Required Environment Variables**
```bash
# Core Configuration
PORT=8080
RAILWAY_ENVIRONMENT=true

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Alpaca Trading
ALPACA_API_KEY=PK...
ALPACA_SECRET_KEY=...

# Supabase Database
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Market Data (Optional)
QUIVER_API_TOKEN=...

# Email Notifications (Optional)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_RECIPIENTS=your-email@domain.com
RESEND_API_KEY=re_...
```

## **🚀 Step-by-Step Deployment**

### **Step 1: Create Railway Project**

1. **Login to Railway Console**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project"

2. **Create New Project**
   - Select "Deploy from GitHub repo"
   - Choose your Ada-Analytics repository
   - Name: `ada-analytics-trading-system`

### **Step 2: Deploy Alpaca MCP Server**

1. **Navigate to alpaca-mcp-server directory**
   ```bash
   cd Ada-Analytics/alpaca-mcp-server
   ```

2. **Create Railway Service**
   - In Railway project dashboard
   - Click "New Service" → "GitHub Repo"
   - Select your repository
   - Set root directory: `Ada-Analytics/alpaca-mcp-server`

3. **Configure Environment Variables**
   ```bash
   ALPACA_API_KEY=your-alpaca-key
   ALPACA_SECRET_KEY=your-alpaca-secret
   ALPACA_PAPER_TRADE=True
   ```

4. **Deploy**
   - Railway will automatically deploy using the Dockerfile
   - Service will be available at: `alpaca-mcp-service.railway.internal:8000`

### **Step 3: Deploy Quiver MCP Server**

1. **Navigate to quiver-mcp-server directory**
   ```bash
   cd Ada-Analytics/quiver-mcp-server
   ```

2. **Create Railway Service**
   - In Railway project dashboard
   - Click "New Service" → "GitHub Repo"
   - Select your repository
   - Set root directory: `Ada-Analytics/quiver-mcp-server`

3. **Configure Environment Variables**
   ```bash
   QUIVER_API_TOKEN=your-quiver-token
   ```

4. **Deploy**
   - Railway will automatically deploy using the Dockerfile
   - Service will be available at: `quiver-mcp-service.railway.internal:8000`

### **Step 4: Deploy Main Trading Agent**

1. **Navigate to agent_mcp_client directory**
   ```bash
   cd Ada-Analytics/agent_mcp_client
   ```

2. **Create Railway Service**
   - In Railway project dashboard
   - Click "New Service" → "GitHub Repo"
   - Select your repository
   - Set root directory: `Ada-Analytics/agent_mcp_client`

3. **Configure Environment Variables**
   ```bash
   # Core Configuration
   PORT=8080
   RAILWAY_ENVIRONMENT=true
   
   # Anthropic AI
   ANTHROPIC_API_KEY=sk-ant-api03-your-key
   
   # Alpaca Trading
   ALPACA_API_KEY=PK-your-alpaca-key
   ALPACA_SECRET_KEY=your-alpaca-secret
   
   # Supabase Database
   SUPABASE_PROJECT_REF=your-project-ref
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Market Data (Optional)
   QUIVER_API_TOKEN=your-quiver-token
   
   # Email Notifications (Optional)
   EMAIL_FROM=noreply@yourdomain.com
   EMAIL_RECIPIENTS=your-email@domain.com
   RESEND_API_KEY=re_your-resend-key
   ```

4. **Deploy**
   - Railway will automatically deploy using the Dockerfile
   - Service will be available at: `your-app.railway.app`

## **🔧 Railway Console Configuration**

### **Service Discovery**
Railway automatically provides internal networking between services:
- `alpaca-mcp-service.railway.internal:8000`
- `quiver-mcp-service.railway.internal:8000`
- `supabase-mcp-service.railway.internal:8000` (via npm package)

### **Health Monitoring**
Each service has health checks:
- Main Agent: `/api/health`
- Alpaca MCP: `/health`
- Quiver MCP: `/health`

### **Logging**
- View logs in Railway console for each service
- Structured logging with cost tracking
- Error monitoring and alerts

## **💰 Cost Management**

### **Railway Costs**
- **Free Tier**: $5/month credit
- **Main Agent**: ~$2/month
- **Alpaca MCP**: ~$1/month
- **Quiver MCP**: ~$1/month
- **Total**: ~$4/month (within free tier)

### **AI API Costs**
- **Model**: Claude 3.5 Haiku ($0.25/1M tokens)
- **Daily Limit**: 15 requests
- **Monthly Budget**: $8 maximum
- **Protection**: Automatic cost controls

### **Cost Monitoring**
1. **Railway Usage**
   - Check Railway dashboard monthly
   - Monitor resource usage per service

2. **AI API Usage**
   - Check logs for token usage
   - Monitor daily cost tracking

## **🔒 Security Configuration**

### **Environment Variables**
- ✅ All secrets in Railway environment
- ✅ No hardcoded credentials
- ✅ Secure variable storage per service

### **HTTPS & SSL**
- ✅ Automatic HTTPS provided
- ✅ SSL certificate included
- ✅ Secure connections enforced

### **Access Control**
- ✅ Railway access via GitHub
- ✅ Environment variable protection
- ✅ No public access to secrets

## **📊 Monitoring & Maintenance**

### **Health Monitoring**
```bash
# Check main application health
curl https://your-app.railway.app/api/health

# Check detailed status
curl https://your-app.railway.app/api/status

# View recent logs
curl https://your-app.railway.app/api/logs
```

### **Service Monitoring**
1. **Railway Console**
   - Real-time log viewing per service
   - Error tracking
   - Performance monitoring

2. **Application Logs**
   - Structured logging
   - Cost tracking
   - Trade execution logs

### **Maintenance Tasks**
1. **Weekly**
   - Check Railway usage per service
   - Review application logs
   - Monitor cost tracking

2. **Monthly**
   - Update dependencies
   - Review security settings
   - Backup critical data

## **🚨 Troubleshooting**

### **Common Issues**

1. **MCP Connection Issues**
   ```bash
   # Check if MCP servers are running
   curl http://alpaca-mcp-service.railway.internal:8000/health
   curl http://quiver-mcp-service.railway.internal:8000/health
   ```

2. **Environment Variable Issues**
   ```bash
   # Check if variables are loaded
   curl https://your-app.railway.app/api/env-check
   ```

3. **Build Failures**
   ```bash
   # Check Deno version
   deno --version
   
   # Verify dependencies
   deno cache main_new.ts
   ```

4. **Cost Overruns**
   - Check daily request limits
   - Monitor token usage
   - Review AI configuration

### **Emergency Procedures**

1. **Immediate Shutdown**
   ```bash
   # Stop deployment in Railway console
   # Or redeploy with cost limits
   ```

2. **Rollback**
   - Use Railway rollback feature
   - Revert to previous deployment
   - Check for configuration issues

## **✅ Deployment Checklist**

### **Alpaca MCP Server**
- [ ] Railway service created
- [ ] Environment variables configured
- [ ] Dockerfile deployed successfully
- [ ] Health endpoint responding
- [ ] HTTP transport enabled

### **Quiver MCP Server**
- [ ] Railway service created
- [ ] Environment variables configured
- [ ] Dockerfile deployed successfully
- [ ] Health endpoint responding
- [ ] HTTP transport enabled

### **Main Trading Agent**
- [ ] Railway service created
- [ ] Environment variables configured
- [ ] Build settings configured
- [ ] Initial deployment successful
- [ ] Health endpoint responding
- [ ] Web interface accessible
- [ ] Cost controls active
- [ ] Security measures in place
- [ ] Monitoring configured
- [ ] Documentation updated

## **🎉 Success!**

Your Ada Analytics Trading Agent is now deployed on Railway with:
- ✅ Separate MCP services for optimal performance
- ✅ Cost controls ($8/month limit)
- ✅ Security measures
- ✅ Comprehensive monitoring
- ✅ Automatic HTTPS
- ✅ Health checks for all services

**Next Steps:**
1. Monitor all services for 24 hours
2. Test trading functionality
3. Set up alerts for critical issues
4. Review logs for optimization opportunities

## **🔧 Advanced Configuration**

### **Custom Domains**
1. **Main Agent**
   - Go to "Settings" → "Domains"
   - Add custom domain
   - Railway provides SSL certificate

2. **MCP Services**
   - Internal networking only
   - No public domain needed

### **Scaling**
1. **Auto-scaling**
   - Railway provides automatic scaling
   - Monitor resource usage
   - Adjust as needed

2. **Load Balancing**
   - Railway handles load balancing
   - Health checks ensure availability

### **Backup Strategy**
1. **Database**
   - Supabase provides automatic backups
   - Export data regularly

2. **Configuration**
   - Version control all configs
   - Document all environment variables

3. **State**
   - Agent state persisted in Supabase
   - Regular state backups 
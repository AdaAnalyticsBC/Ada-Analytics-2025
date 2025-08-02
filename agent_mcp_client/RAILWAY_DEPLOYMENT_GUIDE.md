# 🚂 Railway Deployment Guide

## **Overview**
Complete guide to deploy Ada Analytics Trading Agent to Railway with cost controls and security.

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
ANTHROPIC_API_KEY

# Alpaca Trading
ALPACA_API_KEY
ALPACA_SECRET_KEY

# Supabase Database
SUPABASE_PROJECT_REF
SUPABASE_SERVICE_ROLE_KEY

# Market Data (Optional)
QUIVER_API_TOKEN

# Email Notifications (Optional)
EMAIL_FROM
EMAIL_RECIPIENTS
RESEND_API_KEY=
```

## **🚀 Step-by-Step Deployment**

### **Step 1: Prepare Railway Project**

1. **Login to Railway Console**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project"

2. **Create New Project**
   - Select "Deploy from GitHub repo"
   - Choose your Ada-Analytics repository
   - Name: `ada-analytics-trading-agent`

### **Step 2: Configure Environment Variables**

1. **Navigate to Variables Tab**
   - In your Railway project dashboard
   - Click "Variables" tab
   - Add each environment variable:

2. **Add Core Variables**
   ```bash
   PORT=8080
   RAILWAY_ENVIRONMENT=true
   ```

3. **Add AI Configuration**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

4. **Add Trading Configuration**
   ```bash
   ALPACA_API_KEY=PK-your-alpaca-key
   ALPACA_SECRET_KEY=your-alpaca-secret
   ```

5. **Add Database Configuration**
   ```bash
   SUPABASE_PROJECT_REF=your-project-ref
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

6. **Add Optional Variables**
   ```bash
   QUIVER_API_TOKEN=your-quiver-token
   EMAIL_FROM=noreply@yourdomain.com
   EMAIL_RECIPIENTS=your-email@domain.com
   RESEND_API_KEY=re_your-resend-key
   ```

### **Step 3: Configure Build Settings**

1. **Set Build Command**
   - In Railway project settings
   - Build Command: `deno cache main_new.ts`
   - Start Command: `deno run --allow-all main_new.ts`

2. **Set Node Version**
   - Environment: `deno`
   - Version: `1.40.0` (or latest)

### **Step 4: Deploy**

1. **Trigger Deployment**
   - Railway will automatically deploy on git push
   - Or click "Deploy" button manually

2. **Monitor Deployment**
   - Watch logs in Railway console
   - Check for any build errors
   - Verify environment variables are loaded

### **Step 5: Verify Deployment**

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Check Logs**
   - In Railway console, go to "Deployments"
   - Click on latest deployment
   - Check logs for any errors

3. **Test Web Interface**
   - Visit: `https://your-app.railway.app`
   - Should show trading agent dashboard

## **🔧 Railway Console Configuration**

### **Domain Configuration**
1. **Custom Domain (Optional)**
   - Go to "Settings" → "Domains"
   - Add custom domain
   - Railway provides SSL certificate

### **Environment Management**
1. **Production Environment**
   - All variables set in main environment
   - Automatic deployments from main branch

2. **Preview Environments**
   - Create for testing branches
   - Separate environment variables

### **Monitoring Setup**
1. **Health Checks**
   - Railway automatically monitors `/api/health`
   - Restarts on failure

2. **Log Monitoring**
   - View real-time logs in console
   - Set up alerts for errors

## **💰 Cost Management**

### **Railway Costs**
- **Free Tier**: $5/month credit
- **Usage**: ~$2-3/month for our app
- **Monitoring**: Check usage in Railway dashboard

### **AI API Costs**
- **Model**: Claude 3.5 Haiku ($0.25/1M tokens)
- **Daily Limit**: 15 requests
- **Monthly Budget**: $8 maximum
- **Protection**: Automatic cost controls

### **Cost Monitoring**
1. **Railway Usage**
   - Check Railway dashboard monthly
   - Monitor resource usage

2. **AI API Usage**
   - Check logs for token usage
   - Monitor daily cost tracking

## **🔒 Security Configuration**

### **Environment Variables**
- ✅ All secrets in Railway environment
- ✅ No hardcoded credentials
- ✅ Secure variable storage

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
# Check application health
curl https://your-app.railway.app/api/health

# Check detailed status
curl https://your-app.railway.app/api/status

# View recent logs
curl https://your-app.railway.app/api/logs
```

### **Log Monitoring**
1. **Railway Console**
   - Real-time log viewing
   - Error tracking
   - Performance monitoring

2. **Application Logs**
   - Structured logging
   - Cost tracking
   - Trade execution logs

### **Maintenance Tasks**
1. **Weekly**
   - Check Railway usage
   - Review application logs
   - Monitor cost tracking

2. **Monthly**
   - Update dependencies
   - Review security settings
   - Backup critical data

## **🚨 Troubleshooting**

### **Common Issues**

1. **Build Failures**
   ```bash
   # Check Deno version
   deno --version
   
   # Verify dependencies
   deno cache main_new.ts
   ```

2. **Environment Variable Issues**
   ```bash
   # Check if variables are loaded
   curl https://your-app.railway.app/api/env-check
   ```

3. **MCP Connection Issues**
   - Railway uses external MCP servers
   - Check API key configurations
   - Verify service permissions

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

- [ ] Railway project created
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
- ✅ Cost controls ($8/month limit)
- ✅ Security measures
- ✅ External MCP servers
- ✅ Comprehensive monitoring
- ✅ Automatic HTTPS
- ✅ Health checks

**Next Steps:**
1. Monitor the application for 24 hours
2. Test trading functionality
3. Set up alerts for critical issues
4. Review logs for optimization opportunities 
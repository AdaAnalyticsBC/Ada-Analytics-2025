# Railway Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. 401 Unauthorized Errors (Alpaca API)

**Problem**: `Failed to get account details: Error: Alpaca API error: 401 Unauthorized`

**Causes**:
- Missing or invalid Alpaca API credentials
- Incorrect API key/secret combination
- Account not activated or suspended

**Solutions**:

1. **Check Environment Variables in Railway**:
   ```bash
   # In Railway dashboard, ensure these are set:
   ALPACA_API_KEY=your_paper_api_key_here
   ALPACA_SECRET_KEY=your_paper_secret_key_here
   # ALPACA_PAPER_TRADE defaults to True (paper trading) for safety
   # Only set ALPACA_PAPER_TRADE=False if you want live trading (NOT RECOMMENDED)
   ```

2. **Verify Alpaca Account**:
   - Log into your Alpaca account at https://app.alpaca.markets/
   - Ensure your account is active and not suspended
   - Check that you're using the correct API keys (paper vs live)

3. **Test API Keys**:
   ```bash
   # Run the validation script
   deno run --allow-env --allow-read validate-config.ts
   ```

### 2. State Loading Errors

**Problem**: `Cannot read properties of undefined (reading 'getAgentState')`

**Cause**: Services are initialized after state loading attempt

**Solution**: ✅ **FIXED** - The initialization order has been corrected in `tradingAgent.ts`

### 3. Resend API 405 Errors

**Problem**: `Failed to fetch Resend email count: 405`

**Cause**: The Resend API endpoint might not support the requested method or the API key is invalid

**Solutions**:

1. **Check Resend API Key**:
   ```bash
   # Ensure this is set in Railway:
   RESEND_API_KEY=your_resend_api_key_here
   ```

2. **Verify Email Configuration**:
   ```bash
   # Also set these:
   EMAIL_FROM=your_verified_email@domain.com
   EMAIL_RECIPIENTS=jcoawett@asu.edu
   ```

3. **Test Email Service**:
   ```bash
   deno run --allow-env --allow-net test-email-count.ts
   ```

### 4. Missing Environment Variables

**Problem**: Various configuration errors due to missing environment variables

**Solution**: Use the validation script to check all required variables:

```bash
deno run --allow-env --allow-read validate-config.ts
```

## Required Environment Variables for Railway

### Essential Variables:
```bash
# Alpaca Trading API (Paper Trading - RECOMMENDED)
ALPACA_API_KEY=your_paper_api_key
ALPACA_SECRET_KEY=your_paper_secret_key
# ALPACA_PAPER_TRADE defaults to True (paper trading) for safety
# Only set ALPACA_PAPER_TRADE=False for live trading (NOT RECOMMENDED)

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_verified_email@domain.com
EMAIL_RECIPIENTS=jcoawett@asu.edu

# AI Service (Anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase Database
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_ACCESS_TOKEN=your_access_token

# Quiver Quant API
QUIVER_API_TOKEN=your_quiver_token

# Application Settings
BASE_URL=https://your-railway-app.railway.app
PORT=8080
```

### Optional Variables:
```bash
# For enhanced features
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Deployment Steps

1. **Set Environment Variables in Railway Dashboard**:
   - Go to your Railway project
   - Navigate to Variables tab
   - Add all required environment variables

2. **Deploy the Application**:
   ```bash
   # Railway will automatically deploy when you push to GitHub
   git add .
   git commit -m "Fix Railway deployment issues"
   git push origin main
   ```

3. **Monitor Logs**:
   - Check Railway logs for any remaining errors
   - Use the validation script to verify configuration

4. **Test the Application**:
   - Visit your Railway app URL
   - Check that the web interface loads
   - Verify that startup notifications are sent

## Testing Commands

```bash
# Validate configuration
deno run --allow-env --allow-read validate-config.ts

# Test email service
deno run --allow-env --allow-net test-email-count.ts

# Test Alpaca connection
deno run --allow-env --allow-net test-alpaca-connection.ts
```

## Monitoring and Debugging

1. **Check Railway Logs**:
   - Monitor real-time logs in Railway dashboard
   - Look for specific error messages

2. **Use the Web Interface**:
   - Access your app at `https://your-app.railway.app`
   - Check the dashboard for status information

3. **Email Notifications**:
   - Verify that startup/shutdown emails are being sent
   - Check your email for notifications

## Common Railway-Specific Issues

1. **Port Configuration**:
   - Railway automatically sets the `PORT` environment variable
   - The app listens on `0.0.0.0:PORT`

2. **Environment Detection**:
   - The app detects Railway environment via `RAILWAY_ENVIRONMENT` or `PORT`
   - Uses DirectAlpacaService instead of MCP servers

3. **File System**:
   - Railway has an ephemeral file system
   - State is saved to Supabase database instead of local files

## Support

If you continue to experience issues:

1. Check the Railway logs for detailed error messages
2. Run the validation script to identify missing configuration
3. Verify all API keys are correct and accounts are active
4. Test individual services using the provided test scripts 
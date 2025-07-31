# 🚀 Ada Analytics Trading Agent - Deployment Guide

This guide covers deploying the Ada Analytics Trading Agent with Resend email integration to various platforms.

## 📋 Prerequisites

1. **Environment Variables**: Copy and fill out your `.env` file:
   ```bash
   cp .env.template .env
   # Edit .env with your actual API keys
   ```

2. **Required API Keys**:
   - `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com)
   - `RESEND_API_KEY` - Get from [Resend Dashboard](https://resend.com/api-keys)
   - `ALPACA_API_KEY` & `ALPACA_SECRET_KEY` - Get from [Alpaca Markets](https://alpaca.markets)
   - `SUPABASE_ACCESS_TOKEN` - Get from [Supabase Dashboard](https://supabase.com/dashboard)
   - `QUIVER_API_TOKEN` - Get from [Quiver Quantitative](https://www.quiverquant.com)

## 🏃‍♂️ Local Development

### Quick Start
```bash
./dev.sh
```

This will:
- Check for required dependencies
- Create .env template if missing
- Cache Deno dependencies
- Start the app with file watching
- Available at `http://localhost:3000`

### Manual Development
```bash
# Install dependencies
deno cache --allow-all main.ts

# Run with file watching
deno run --allow-all --watch main.ts
```

## 🚂 Railway Deployment

### Option 1: Automated Script
```bash
./deploy-railway.sh
```

### Option 2: Manual Railway Deployment
1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and initialize:
   ```bash
   railway login
   railway init
   ```

3. Set environment variables:
   ```bash
   railway variables set ANTHROPIC_API_KEY=your_key_here
   railway variables set RESEND_API_KEY=your_key_here
   # ... set all other variables
   ```

4. Deploy:
   ```bash
   railway up
   ```

### Option 3: GitHub Integration
1. Connect your GitHub repo to Railway
2. Use the `deploy-railway.json` configuration
3. Set environment variables in Railway dashboard
4. Deploy automatically on git push

## 🦕 Deno Deploy

### Automated Deployment
```bash
./deploy-deno.sh
```

### Manual Deno Deploy
1. Install deployctl:
   ```bash
   deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

2. Deploy with environment variables:
   ```bash
   deployctl deploy \
     --project=ada-analytics-trading-agent \
     --prod \
     --env=ANTHROPIC_API_KEY=your_key \
     --env=RESEND_API_KEY=your_key \
     main.ts
   ```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker
```bash
# Build image
docker build -t ada-analytics-trading-agent .

# Run container
docker run -d \
  --name trading-agent \
  --env-file .env \
  -p 3000:3000 \
  ada-analytics-trading-agent
```

## ☁️ Other Cloud Platforms

### Heroku
1. Create `Procfile`:
   ```
   web: deno run --allow-all main.ts
   ```

2. Deploy:
   ```bash
   heroku create ada-analytics-trading-agent
   heroku config:set ANTHROPIC_API_KEY=your_key
   # ... set all environment variables
   git push heroku main
   ```

### AWS/GCP/Azure
Use the Docker deployment method with your cloud provider's container service:
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances

## 🔧 Environment Configuration

### Production Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | ✅ |
| `RESEND_API_KEY` | Resend email API key | ✅ |
| `ALPACA_API_KEY` | Alpaca trading API key | ✅ |
| `ALPACA_SECRET_KEY` | Alpaca trading secret | ✅ |
| `SUPABASE_ACCESS_TOKEN` | Supabase database token | ✅ |
| `QUIVER_API_TOKEN` | Quiver data API token | ✅ |
| `BASE_URL` | Your app's public URL | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `TZ` | Timezone (default: America/New_York) | ❌ |

### Email Configuration
The app uses **Resend** for email delivery. Make sure to:

1. **Verify your domain** in Resend dashboard
2. **Update the from address** in `main.ts`:
   ```typescript
   from: 'trading-agent@yourdomain.com'
   ```
3. **Set RESEND_API_KEY** in your environment

## 📊 Monitoring & Health Checks

### Health Check Endpoint
- `GET /health` - Returns app status
- `GET /` - Web interface for manual controls

### Logs
- Railway: `railway logs`
- Deno Deploy: View in dashboard
- Docker: `docker logs container_name`

## 🔄 Updates & Maintenance

### Updating Dependencies
```bash
# Update Deno dependencies
deno cache --reload main.ts

# Update deployment
./deploy-railway.sh  # or your chosen platform
```

### Backup Important Data
- `agent_state.json` - Trading state and history
- Environment variables - Keep them secure!

## 🛠️ Troubleshooting

### Common Issues

1. **"No RESEND_API_KEY found"**
   - Check your .env file or cloud environment variables
   - Ensure the key starts with `re_`

2. **"Failed to connect to MCP servers"**
   - Check your API keys are correct
   - Verify network connectivity

3. **"Email sending failed"**
   - Verify your domain in Resend
   - Check the from address matches your verified domain

4. **"Module not found" errors**
   - Run `deno cache --reload main.ts`
   - Check your internet connection

### Support
- Check the logs first: detailed error messages are provided
- Verify all environment variables are set correctly
- Ensure all API services are accessible

---

🎉 **That's it!** Your Ada Analytics Trading Agent should now be running with Resend email integration!
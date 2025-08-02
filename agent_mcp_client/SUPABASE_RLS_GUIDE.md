# 🔒 Supabase RLS Setup Guide - Ada Analytics Trading Agent

## 🎯 **Quick Solution**

Choose one option based on your needs:

### **🔒 Option 1: Work with RLS (Recommended for Production)**
```bash
# Run the automated setup
./scripts/setup-supabase-rls.sh

# Add your service role key to .env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### **🔓 Option 2: Disable RLS (Development Only)**
```bash
# Quick disable for development
./scripts/disable-supabase-rls.sh
```

---

## 📋 **Understanding the Issue**

When RLS (Row Level Security) is enabled in Supabase:
- **Personal Access Tokens** (like `sbp_...`) have limited permissions
- **Database queries fail** with permission errors
- **Your trading agent can't store/retrieve data**

## 🔒 **Option 1: Work with RLS (Recommended)**

### **Why Use RLS?**
✅ **Security**: Protects your data from unauthorized access  
✅ **Production-Ready**: Industry standard for multi-tenant apps  
✅ **Audit Trail**: Know exactly who accessed what data  
✅ **Future-Proof**: Easy to add user authentication later  

### **How It Works**
1. **Service Role Key**: Bypasses RLS policies for your agent
2. **RLS Policies**: Allow service role full access to trading tables
3. **Public Safety**: Blocks anonymous access to sensitive data

### **Setup Steps**

#### **Step 1: Get Your Service Role Key**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/your_project_ref/settings/api)
2. Copy the **service_role** key (starts with `eyJ...`)
3. **Keep it secret!** This key has admin privileges

#### **Step 2: Run RLS Setup**
```bash
cd Ada-Analytics/agent_mcp_client
./scripts/setup-supabase-rls.sh
```

This script:
- ✅ Installs Supabase CLI if needed
- ✅ Creates RLS policies for all trading tables
- ✅ Allows service role full access
- ✅ Keeps data secure from public access

#### **Step 3: Update Environment Variables**
Add to your `.env` file:
```bash
# Supabase Configuration
SUPABASE_ACCESS_TOKEN=your_personal_access_token_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### **Step 4: Deploy to Railway**
```bash
# Set environment variables in Railway
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Deploy
./scripts/deploy.sh
```

### **RLS Policies Created**
The setup script creates these policies:

```sql
-- Allow service role full access to all trading tables
CREATE POLICY "Allow service role full access" ON trades
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON trade_plans
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON predictions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON agent_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON agent_events
    FOR ALL USING (auth.role() = 'service_role');
```

---

## 🔓 **Option 2: Disable RLS (Development Only)**

### **When to Use This**
⚠️ **Development/Testing Only**  
⚠️ **Non-sensitive data**  
⚠️ **Quick prototyping**  
⚠️ **Troubleshooting**  

### **Setup Steps**

#### **Step 1: Disable RLS**
```bash
cd Ada-Analytics/agent_mcp_client
./scripts/disable-supabase-rls.sh
```

#### **Step 2: Keep Current Configuration**
Your current `.env` setup will work:
```bash
SUPABASE_ACCESS_TOKEN=your_personal_access_token_here
# No service role key needed
```

### **⚠️ Security Implications**
- 🔓 **Database tables are publicly accessible**
- 🔓 **Anyone with your anon key can read/write data**
- 🔓 **Not suitable for production**
- 🔓 **Risk of data exposure**

---

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **1. "Permission denied" errors**
```bash
# Check if RLS is enabled
# Run in Supabase SQL editor:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('trades', 'trade_plans', 'predictions', 'agent_logs', 'agent_events');

# If rowsecurity = true, you need RLS policies or service role key
```

#### **2. "Service role key not working"**
- ✅ Check the key starts with `eyJ...`
- ✅ Verify it's the **service_role** not **anon** key
- ✅ Ensure environment variable is set correctly
- ✅ Restart your application after setting

#### **3. "RLS policies not applying"**
```bash
# Check existing policies in Supabase SQL editor:
SELECT * FROM pg_policies WHERE tablename = 'trades';

# If empty, re-run the setup script
./scripts/setup-supabase-rls.sh
```

#### **4. "MCP server connection issues"**
The MCP server might need specific configuration for service role:
```bash
# Check your config.ts has the service role key
SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
```

### **Testing Your Setup**

#### **Test RLS Policies**
```bash
# Start your agent
./scripts/dev.sh

# Check logs for successful database operations
# Should see: "✅ Storing trades in Supabase..."
# Should NOT see: "Permission denied" or "RLS policy violation"
```

#### **Test Health Endpoint**
```bash
curl http://localhost:3000/api/health

# Should show:
# "supabase": {"status": "healthy", "response_time": "..."}
```

---

## 🚀 **Production Deployment**

### **Railway Environment Variables**
```bash
# Required for RLS
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
railway variables set SUPABASE_ACCESS_TOKEN=your_personal_access_token_here

# Other variables
railway variables set ANTHROPIC_API_KEY=your_anthropic_key
railway variables set ALPACA_API_KEY=your_alpaca_key
railway variables set ALPACA_SECRET_KEY=your_alpaca_secret
```

### **Security Best Practices**
✅ **Always use RLS in production**  
✅ **Rotate service role keys regularly**  
✅ **Monitor database access logs**  
✅ **Use least-privilege access patterns**  
✅ **Enable audit logging in Supabase**  

---

## 📚 **Additional Resources**

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Service Role Keys](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [MCP Supabase Server](https://github.com/supabase/mcp-server-supabase)

---

## 🎯 **Quick Reference**

### **Check Current RLS Status**
```sql
-- Run in Supabase SQL editor
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('trades', 'trade_plans', 'predictions', 'agent_logs', 'agent_events');
```

### **Enable RLS (if disabled)**
```bash
./scripts/setup-supabase-rls.sh
```

### **Disable RLS (development only)**
```bash
./scripts/disable-supabase-rls.sh
```

### **Environment Variables**
```bash
# With RLS (recommended)
SUPABASE_ACCESS_TOKEN=sbp_your_personal_token
SUPABASE_SERVICE_ROLE_KEY=eyJ_your_service_role_key

# Without RLS (development)
SUPABASE_ACCESS_TOKEN=sbp_your_personal_token
```

Your Ada Analytics Trading Agent is now ready to work with Supabase RLS! 🎉
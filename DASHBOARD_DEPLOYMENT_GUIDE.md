# 📊 Dashboard Deployment Guide - Ada Analytics

## 🎯 **Overview**

This guide covers deploying the SvelteKit dashboard to Railway with Supabase authentication and domain configuration.

---

## 🚀 **Step 1: Dashboard Deployment**

### **1.1 Railway Dashboard Service**

1. **Create New Railway Service**
   ```bash
   # Navigate to dashboard directory
   cd Ada-Analytics/dashboard
   
   # Initialize Railway project
   railway init
   ```

2. **Configure Environment Variables**
   ```bash
   # Set Supabase environment variables
   railway variables set SUPABASE_URL=your_supabase_url
   railway variables set SUPABASE_ANON_KEY=your_supabase_anon_key
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Set domain
   railway variables set PUBLIC_SITE_URL=https://dashboard.adaanalytics.io
   ```

3. **Deploy to Railway**
   ```bash
   # Deploy the dashboard
   railway up
   ```

### **1.2 Domain Configuration**

1. **Railway Console Actions:**
   - Go to Railway Dashboard
   - Select your dashboard service
   - Click "Settings" → "Domains"
   - Add custom domain: `dashboard.adaanalytics.io`
   - Configure SSL certificate

2. **DNS Configuration:**
   ```bash
   # Add CNAME record
   dashboard.adaanalytics.io CNAME your-railway-app.railway.app
   ```

---

## 🔐 **Step 2: Supabase Authentication Setup**

### **2.1 Supabase Configuration**

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down URL and API keys

2. **Configure Authentication**
   ```sql
   -- Enable email authentication
   INSERT INTO auth.users (email, encrypted_password)
   VALUES ('admin@adaanalytics.io', 'hashed_password');
   
   -- Create admin role
   CREATE ROLE admin;
   GRANT admin TO auth.users;
   ```

3. **Row Level Security (RLS)**
   ```sql
   -- Enable RLS on trades table
   ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
   
   -- Create policies
   CREATE POLICY "Users can view own trades" ON trades
   FOR SELECT USING (auth.uid() = user_id);
   
   CREATE POLICY "Admin can view all trades" ON trades
   FOR ALL USING (auth.role() = 'admin');
   ```

### **2.2 Dashboard Authentication**

1. **Create Auth Components**
   ```svelte
   <!-- src/lib/components/Auth.svelte -->
   <script>
     import { Auth } from '@supabase/auth-ui-svelte';
     import { supabase } from '$lib/supabase';
   </script>
   
   <Auth
     supabaseClient={supabase}
     appearance={{ theme: 'dark' }}
     providers={['google']}
   />
   ```

2. **Protected Routes**
   ```typescript
   // src/routes/dashboard/+layout.server.ts
   import { redirect } from '@sveltejs/kit';
   import { supabase } from '$lib/supabase';
   
   export async function load({ locals }) {
     const { data: { session } } = await supabase.auth.getSession();
     
     if (!session) {
       throw redirect(303, '/login');
     }
     
     return { session };
   }
   ```

---

## 🏠 **Step 3: Landing Page Creation**

### **3.1 Create Landing Page Service**

1. **Create New SvelteKit Project**
   ```bash
   # Create landing page
   npm create svelte@latest landing-page
   cd landing-page
   npm install
   ```

2. **Railway Configuration**
   ```toml
   # railway.toml
   [build]
   builder = "nixpacks"
   
   [deploy]
   startCommand = "npm run preview"
   healthcheckPath = "/"
   ```

3. **Domain Configuration**
   ```bash
   # Add domain
   railway variables set PUBLIC_SITE_URL=https://adaanalytics.io
   ```

### **3.2 Landing Page Features**

1. **Hero Section**
   ```svelte
   <!-- src/routes/+page.svelte -->
   <section class="hero">
     <h1>Ada Analytics</h1>
     <p>AI-Powered Trading Intelligence</p>
     <a href="/dashboard" class="cta-button">
       Access Dashboard
     </a>
   </section>
   ```

2. **Authentication Flow**
   ```svelte
   <!-- Login redirect -->
   <script>
     import { goto } from '$app/navigation';
     
     function login() {
       goto('https://dashboard.adaanalytics.io/login');
     }
   </script>
   ```

---

## 🌐 **Step 4: Domain Architecture**

### **4.1 Domain Structure**
```
adaanalytics.io (Landing Page)
├── / → Landing page
├── /about → About page
├── /contact → Contact page
└── /login → Redirect to dashboard

dashboard.adaanalytics.io (Dashboard)
├── / → Dashboard home
├── /login → Supabase auth
├── /trades → Trading history
├── /analytics → Performance charts
└── /settings → User settings
```

### **4.2 DNS Configuration**
```bash
# Main domain
adaanalytics.io A [Railway IP]

# Dashboard subdomain
dashboard.adaanalytics.io CNAME [Railway App]

# Email (optional)
mail.adaanalytics.io MX [Email Provider]
```

---

## 🔧 **Step 5: Railway Console Actions (Same Project)**

### **5.1 Add Dashboard Service to Existing Project**
1. **Go to Railway Dashboard**
2. **Select your existing Ada Analytics project**
3. **Click "New Service"** → "Deploy from GitHub repo"
4. **Select Repository** → `Ada-Analytics/dashboard`
5. **Configure Environment Variables:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PUBLIC_SITE_URL=https://dashboard.adaanalytics.io
   NODE_ENV=production
   ```
6. **Add Custom Domain:**
   - Settings → Domains
   - Add: `dashboard.adaanalytics.io`
   - Configure SSL

### **5.2 Add Landing Page Service to Same Project**
1. **In the same Railway project**
2. **Click "New Service"** → "Deploy from GitHub repo"
3. **Select Repository** → `Ada-Analytics/landing-page`
4. **Configure Environment Variables:**
   ```
   PUBLIC_SITE_URL=https://adaanalytics.io
   DASHBOARD_URL=https://dashboard.adaanalytics.io
   NODE_ENV=production
   ```
5. **Add Custom Domain:**
   - Settings → Domains
   - Add: `adaanalytics.io`
   - Configure SSL

### **5.3 Project Structure**
```
Ada Analytics Railway Project
├── agent_mcp_client (Main Trading Agent)
├── quiver-mcp-server (Market Data)
├── dashboard (SvelteKit Dashboard)
└── landing-page (SvelteKit Landing)
```

---

## 📊 **Step 6: Dashboard Features**

### **6.1 Core Features**
- **Real-time Trading Data**
- **Performance Analytics**
- **Portfolio Management**
- **Risk Assessment**
- **Email Notifications**

### **6.2 Authentication Flow**
1. **Landing Page** → User visits adaanalytics.io
2. **Login Button** → Redirects to dashboard.adaanalytics.io/login
3. **Supabase Auth** → Email/password or Google OAuth
4. **Dashboard Access** → Protected routes with session validation

---

## ✅ **Deployment Checklist**

### **Dashboard Service** ✅
- [ ] Railway service created
- [ ] Environment variables configured
- [ ] Custom domain added
- [ ] SSL certificate active
- [ ] Supabase auth integrated
- [ ] Protected routes implemented

### **Landing Page Service** ✅
- [ ] Railway service created
- [ ] Environment variables configured
- [ ] Custom domain added
- [ ] SSL certificate active
- [ ] Authentication flow implemented
- [ ] Responsive design completed

### **Domain Configuration** ✅
- [ ] DNS records configured
- [ ] SSL certificates active
- [ ] Redirects working
- [ ] Analytics tracking setup

---

## 🚀 **Final Steps**

1. **Test Authentication Flow**
2. **Verify Domain Access**
3. **Monitor Performance**
4. **Set Up Analytics**
5. **Configure Monitoring**

**Status:** ✅ READY FOR DEPLOYMENT 
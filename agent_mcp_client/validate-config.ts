/**
 * Configuration Validation Script
 * Helps identify missing or invalid environment variables
 */

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { validateEnvironment, ENV_KEYS } from './config.ts';

async function validateConfiguration() {
  console.log('🔍 Validating Ada Analytics Configuration...\n');

  // Load environment variables
  try {
    await load({ export: true });
    console.log('✅ Environment variables loaded');
  } catch (error) {
    console.log('⚠️ Could not load .env file, using system environment variables');
  }

  // Validate required environment variables
  const validation = validateEnvironment();
  
  if (validation.valid) {
    console.log('✅ All required environment variables are present');
  } else {
    console.log('❌ Missing required environment variables:');
    validation.missing.forEach(key => {
      console.log(`   - ${key}`);
    });
  }

  // Check Alpaca API configuration
  console.log('\n📊 Alpaca API Configuration:');
  const alpacaApiKey = Deno.env.get(ENV_KEYS.ALPACA_API_KEY);
  const alpacaSecretKey = Deno.env.get(ENV_KEYS.ALPACA_SECRET_KEY);
  const alpacaPaperTrade = Deno.env.get('ALPACA_PAPER_TRADE');

  if (alpacaApiKey) {
    console.log('✅ ALPACA_API_KEY: Set');
  } else {
    console.log('❌ ALPACA_API_KEY: Missing');
  }

  if (alpacaSecretKey) {
    console.log('✅ ALPACA_SECRET_KEY: Set');
  } else {
    console.log('❌ ALPACA_SECRET_KEY: Missing');
  }

  if (alpacaPaperTrade === 'False') {
    console.log('⚠️ ALPACA_PAPER_TRADE: False (LIVE TRADING - USE WITH CAUTION!)');
  } else {
    console.log('✅ ALPACA_PAPER_TRADE: Paper trading enabled (safe default)');
  }

  // Check Resend API configuration
  console.log('\n📧 Resend API Configuration:');
  const resendApiKey = Deno.env.get(ENV_KEYS.RESEND_API_KEY);
  const resendFromEmail = Deno.env.get(ENV_KEYS.EMAIL_FROM);

  if (resendApiKey) {
    console.log('✅ RESEND_API_KEY: Set');
  } else {
    console.log('❌ RESEND_API_KEY: Missing');
  }

  if (resendFromEmail) {
    console.log('✅ EMAIL_FROM: Set');
  } else {
    console.log('❌ EMAIL_FROM: Missing');
  }

  // Check Supabase configuration
  console.log('\n🗄️ Supabase Configuration:');
  const supabaseProjectRef = Deno.env.get(ENV_KEYS.SUPABASE_PROJECT_REF);
  const supabaseAccessToken = Deno.env.get(ENV_KEYS.SUPABASE_ACCESS_TOKEN);

  if (supabaseProjectRef) {
    console.log('✅ SUPABASE_PROJECT_REF: Set');
  } else {
    console.log('❌ SUPABASE_PROJECT_REF: Missing');
  }

  if (supabaseAccessToken) {
    console.log('✅ SUPABASE_ACCESS_TOKEN: Set');
  } else {
    console.log('❌ SUPABASE_ACCESS_TOKEN: Missing');
  }

  // Check Railway environment
  console.log('\n🚂 Railway Configuration:');
  const railwayEnv = Deno.env.get('RAILWAY_ENVIRONMENT');
  const port = Deno.env.get('PORT');

  if (railwayEnv) {
    console.log('✅ RAILWAY_ENVIRONMENT: Set');
  } else {
    console.log('ℹ️ RAILWAY_ENVIRONMENT: Not set (not running on Railway)');
  }

  if (port) {
    console.log(`✅ PORT: ${port}`);
  } else {
    console.log('ℹ️ PORT: Not set (will use default 8080)');
  }

  // Summary
  console.log('\n📋 Summary:');
  if (validation.valid) {
    console.log('✅ Configuration is valid and ready to run');
  } else {
    console.log('❌ Configuration has issues that need to be fixed');
    console.log('\n💡 To fix 401 errors:');
    console.log('   1. Set ALPACA_API_KEY and ALPACA_SECRET_KEY');
    console.log('   2. Ensure ALPACA_PAPER_TRADE is set to "True" for testing');
    console.log('   3. Verify your Alpaca account is active');
  }
}

// Run validation if this script is executed directly
if (import.meta.main) {
  await validateConfiguration();
} 
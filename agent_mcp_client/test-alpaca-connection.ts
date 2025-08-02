/**
 * Test Alpaca API Connection
 * Verifies that Alpaca API credentials are working correctly
 */

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

async function testAlpacaConnection() {
  console.log('🔍 Testing Alpaca API Connection...\n');

  // Load environment variables
  try {
    await load({ export: true });
    console.log('✅ Environment variables loaded');
  } catch (error) {
    console.log('⚠️ Could not load .env file, using system environment variables');
  }

  // Get Alpaca credentials
  const apiKey = Deno.env.get('ALPACA_API_KEY');
  const secretKey = Deno.env.get('ALPACA_SECRET_KEY');
  const paperTrade = Deno.env.get('ALPACA_PAPER_TRADE') !== 'False';

  console.log('\n📊 Alpaca Configuration:');
  console.log(`- API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Secret Key: ${secretKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Paper Trading: ${paperTrade ? '✅ Enabled (Safe)' : '⚠️ Disabled (LIVE TRADING - USE WITH CAUTION!)'}`);

  if (!apiKey || !secretKey) {
    console.log('\n❌ Cannot test connection - missing API credentials');
    console.log('Please set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables');
    return;
  }

  // Determine base URL
  const baseUrl = paperTrade 
    ? 'https://paper-api.alpaca.markets' 
    : 'https://api.alpaca.markets';

  console.log(`\n🌐 Using ${paperTrade ? 'PAPER' : 'LIVE'} trading API: ${baseUrl}`);

  let accountResponse: Response | null = null;
  let positionsResponse: Response | null = null;
  let ordersResponse: Response | null = null;

  try {
    // Test account endpoint
    console.log('\n🔗 Testing account endpoint...');
    accountResponse = await fetch(`${baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey,
      }
    });

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('✅ Account connection successful!');
      console.log(`- Account ID: ${accountData.id}`);
      console.log(`- Status: ${accountData.status}`);
      console.log(`- Cash: $${parseFloat(accountData.cash).toFixed(2)}`);
      console.log(`- Portfolio Value: $${parseFloat(accountData.portfolio_value).toFixed(2)}`);
      console.log(`- Buying Power: $${parseFloat(accountData.buying_power).toFixed(2)}`);
    } else {
      console.log(`❌ Account connection failed: ${accountResponse.status} ${accountResponse.statusText}`);
      
      if (accountResponse.status === 401) {
        console.log('\n💡 401 Unauthorized - Possible causes:');
        console.log('1. Invalid API key or secret');
        console.log('2. Account not activated');
        console.log('3. Using wrong environment (paper vs live)');
        console.log('4. API key permissions insufficient');
      }
    }

    // Test positions endpoint
    console.log('\n📈 Testing positions endpoint...');
    positionsResponse = await fetch(`${baseUrl}/v2/positions`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey,
      }
    });

    if (positionsResponse.ok) {
      const positionsData = await positionsResponse.json();
      console.log('✅ Positions endpoint working!');
      console.log(`- Open positions: ${positionsData.length}`);
    } else {
      console.log(`❌ Positions endpoint failed: ${positionsResponse.status} ${positionsResponse.statusText}`);
    }

    // Test orders endpoint
    console.log('\n📋 Testing orders endpoint...');
    ordersResponse = await fetch(`${baseUrl}/v2/orders?status=open`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey,
      }
    });

    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      console.log('✅ Orders endpoint working!');
      console.log(`- Open orders: ${ordersData.length}`);
    } else {
      console.log(`❌ Orders endpoint failed: ${ordersResponse.status} ${ordersResponse.statusText}`);
    }

  } catch (error) {
    console.log(`❌ Connection test failed: ${error}`);
  }

  console.log('\n📋 Summary:');
  if (accountResponse?.ok && positionsResponse?.ok && ordersResponse?.ok) {
    console.log('✅ All Alpaca API endpoints are working correctly!');
    console.log('🚀 Your trading agent should be able to connect successfully.');
  } else {
    console.log('❌ Some API endpoints are not working.');
    console.log('🔧 Please check your Alpaca account and API credentials.');
  }
}

// Run test if this script is executed directly
if (import.meta.main) {
  await testAlpacaConnection();
} 
#!/usr/bin/env -S deno run --allow-env

// Test script to verify Railway environment detection
import { getMCPServers, MCP_SERVERS } from './config.ts';

console.log("🧪 Testing Railway Environment Detection");
console.log("======================================");

// Test environment variables
const railwayEnv = Deno.env.get('RAILWAY_ENVIRONMENT');
const port = Deno.env.get('PORT');

console.log(`RAILWAY_ENVIRONMENT: ${railwayEnv || 'not set'}`);
console.log(`PORT: ${port || 'not set'}`);

// Test MCP server configuration
console.log("\n📋 MCP Server Configuration:");
console.log("============================");

try {
  const servers = await getMCPServers();
  console.log(`Dynamic servers count: ${Object.keys(servers).length}`);
  
  if (Object.keys(servers).length === 0) {
    console.log("✅ MCP servers disabled (Railway environment detected)");
  } else {
    console.log("⚠️  MCP servers enabled (local environment)");
  }
  
  console.log(`Legacy servers count: ${Object.keys(MCP_SERVERS).length}`);
  
  if (Object.keys(MCP_SERVERS).length === 0) {
    console.log("✅ Legacy MCP servers disabled (Railway environment detected)");
  } else {
    console.log("⚠️  Legacy MCP servers enabled (local environment)");
  }
  
} catch (error) {
  console.error("❌ Error testing MCP configuration:", error);
}

console.log("\n✅ Railway configuration test complete!"); 
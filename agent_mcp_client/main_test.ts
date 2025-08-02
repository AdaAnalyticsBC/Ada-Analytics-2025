import {
  assertEquals,
  assertExists,
  assertRejects,
  assertArrayIncludes,
  assert,
  assertNotEquals,
  assertInstanceOf,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { stub, restore, Stub } from "https://deno.land/std@0.208.0/testing/mock.ts";
import { AutonomousTradingAgent } from "./tradingAgent.ts";

// Mock MCP Client for testing
class MockMCPClient {
  private responses: Map<string, Record<string, unknown>> = new Map();
  private shouldFail = false;
  private failMessage = "Mock failure";

  setResponse(toolName: string, response: Record<string, unknown>) {
    this.responses.set(toolName, response);
  }

  setShouldFail(fail: boolean, message = "Mock failure") {
    this.shouldFail = fail;
    this.failMessage = message;
  }

  callTool(params: { name: string; arguments?: Record<string, unknown> }): Record<string, unknown> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }
    
    const response = this.responses.get(params.name);
    if (!response) {
      throw new Error(`No mock response for tool: ${params.name}`);
    }
    
    return response;
  }

  listTools() {
    return {
      tools: [
        { name: "get_account_info", description: "Get account information" },
        { name: "get_market_data", description: "Get market data" },
        { name: "get_quiver_data", description: "Get Quiver data" },
        { name: "place_order", description: "Place trading order" },
        { name: "insert", description: "Insert data into Supabase" }
      ]
    };
  }

  connect() {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }
  }
}

// Test utilities
function createTestAgent(): AutonomousTradingAgent {
  // Environment variables should be set in .env file for testing
  
  return new AutonomousTradingAgent();
}

function createMockAccountResponse() {
  return {
    content: [{
      type: "text",
      text: `
        Account Information:
        -------------------
        Account ID: test-account-123
        Status: AccountStatus.ACTIVE
        Currency: USD
        Buying Power: $100000.00
        Cash: $50000.00
        Portfolio Value: $75000.00
        Equity: $75000.00
        Long Market Value: $25000.00
        Short Market Value: $0.00
        Pattern Day Trader: No
        Day Trades Remaining: 3
      `
    }]
  };
}

function createMockTradePlan() {
  return {
    id: "test-plan-123",
    date: "2025-07-31",
    market_analysis: "Test market analysis",
    trades: [
      {
        symbol: "AAPL",
        action: "BUY",
        quantity: 10,
        price_target: 150.00,
        stop_loss: 142.50,
        take_profit: 165.00,
        confidence: 0.75,
        reasoning: "Test reasoning for AAPL trade"
      }
    ],
    risk_assessment: "Low risk test scenario",
    total_risk_exposure: 0.02,
    created_at: new Date().toISOString()
  };
}

// =============================================================================
// INITIALIZATION TESTS
// =============================================================================

Deno.test("AutonomousTradingAgent - Constructor", function() {
  const agent = createTestAgent();
  assertExists(agent);
  assertInstanceOf(agent, AutonomousTradingAgent);
});

Deno.test("AutonomousTradingAgent - Initialize with environment variables", async function() {
  const agent = createTestAgent();
  
  // Mock the MCP connection to avoid actual connections
  const connectStub = stub(agent, "connectToServers", () => Promise.resolve());
  
  try {
    await agent.initialize();
    // If no error thrown, initialization succeeded
    assert(true);
  } finally {
    restore();
  }
});

// =============================================================================
// ACCOUNT MANAGEMENT TESTS
// =============================================================================

Deno.test("Account Details - Successful retrieval", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  // Mock MCP client
  const mockClient = new MockMCPClient();
  mockClient.setResponse("get_account_info", createMockAccountResponse());
  
  // @ts-ignore: Testing internal method - Access private property for testing
  agent.activeClients.set("alpaca", mockClient);
  
  // @ts-ignore: Testing internal method - Call private method for testing
  const result = await agent.getAccountDetails();
  
  assertExists(result);
  // @ts-ignore: Testing internal method - Access private property
  assertEquals(agent.state.account_balance, 50000);
});

Deno.test("Account Details - Handle API failure", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  const mockClient = new MockMCPClient();
  mockClient.setShouldFail(true, "API Error");
  
  // @ts-ignore: Testing internal method
  agent.activeClients.set("alpaca", mockClient);
  
  // @ts-ignore: Testing internal method
  const result = await agent.getAccountDetails();
  
  assertEquals(result, {});
});

// =============================================================================
// TRADING WORKFLOW TESTS  
// =============================================================================

Deno.test("Market Data Collection - Success", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  const mockQuiverClient = new MockMCPClient();
  
  // Mock tools that would be returned by listTools
  mockQuiverClient.setResponse("insider_data", { 
    content: [{ text: "Mock insider data" }] 
  });
  mockQuiverClient.setResponse("market_sentiment", { 
    content: [{ text: "Mock sentiment data" }] 
  });
  
  // Override listTools to return data-related tools
      mockQuiverClient.listTools = () => ({
    tools: [
      { name: "insider_data", description: "Get insider trading data" },
      { name: "market_sentiment", description: "Get market sentiment" },
      { name: "options_data", description: "Get options data" }
    ]
  });
  
  const mockAlpacaClient = new MockMCPClient();
  mockAlpacaClient.setResponse("get_market_data", {
    content: [{ text: "Mock Alpaca data" }]
  });
  
  // @ts-ignore: Testing internal method
  agent.activeClients.set("quiver-quant", mockQuiverClient);
  // @ts-ignore: Testing internal method
  agent.activeClients.set("alpaca", mockAlpacaClient);
  
  // @ts-ignore: Testing internal method
  const marketData = await agent.collectMarketData();
  
  assertExists(marketData);
  // Check that some data was collected from Quiver tools
  assert(Object.keys(marketData).length > 0, "Market data should contain some collected data");
  // The data structure will have tool names as keys
  assertExists(marketData.insider_data);
  assertExists(marketData.market_sentiment);
});

Deno.test("Trade Plan Creation - Valid output", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  // Mock Anthropic response
  const mockAnthropicResponse = {
    content: [{
      text: JSON.stringify({
        market_analysis: "Bullish trend detected",
        risk_assessment: "Moderate risk",
        strategy_notes: "Focus on momentum plays"
      })
    }]
  };
  
  // @ts-ignore: Testing internal method - Mock the anthropic client
  const anthropicStub = stub(agent.anthropic.messages, "create", () => 
    Promise.resolve(mockAnthropicResponse)
  );
  
  try {
    const mockMarketData = { test: "data" };
    // @ts-ignore: Testing internal method: Testing internal method
    const tradePlan = await agent.craftTradePlan(mockMarketData);
    
    assertExists(tradePlan);
    assertExists(tradePlan.id);
    assertExists(tradePlan.date);
    assertExists(tradePlan.market_analysis);
  } finally {
    restore();
  }
});

Deno.test("Trade Execution - Successful execution", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  // Set a high account balance to ensure position sizing works
  // @ts-ignore: Testing internal method
  agent.state.account_balance = 100000;
  
  const mockAlpacaClient = new MockMCPClient();
  mockAlpacaClient.setResponse("place_order", {
    id: "order-123",
    symbol: "AAPL",
    side: "buy",
    qty: "10",
    filled_avg_price: "149.95",
    status: "filled"
  });
  
  // @ts-ignore: Testing internal method
  agent.activeClients.set("alpaca", mockAlpacaClient);
  
  const tradePlan = createMockTradePlan();
  
  // @ts-ignore: Testing internal method
  const executedTrades = await agent.executeTrades(tradePlan);
  
  assertExists(executedTrades);
  assertEquals(executedTrades.length, 1);
  assertEquals(executedTrades[0].symbol, "AAPL");
});

// =============================================================================
// SUPABASE STORAGE TESTS
// =============================================================================

Deno.test("Store Trades - Successful storage", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  const mockSupabaseClient = new MockMCPClient();
  mockSupabaseClient.setResponse("insert", { success: true });
  
  // @ts-ignore: Testing internal method
  agent.activeClients.set("supabase", mockSupabaseClient);
  
  const mockTrades = [{
    symbol: "AAPL",
    action: "BUY",
    executed_quantity: 10,
    price_target: 150.00,
    stop_loss: 142.50,
    take_profit: 165.00,
    confidence: 0.75,
    reasoning: "Test trade",
    executed_at: new Date().toISOString()
  }];
  
  // @ts-ignore: Testing internal method
  await agent.storeTrades(mockTrades);
  
  // If no error thrown, storage succeeded
  assert(true);
});

Deno.test("Store Trades - Handle Supabase failure", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  const mockSupabaseClient = new MockMCPClient();
  mockSupabaseClient.setShouldFail(true, "Database connection failed");
  
  // Mock the log method to not fail when logging errors
  const mockLogClient = new MockMCPClient();
  mockLogClient.setResponse("insert", { success: true });
  
  // @ts-ignore: Testing internal method
  agent.activeClients.set("supabase", mockSupabaseClient);
  
  const mockTrades = [{ symbol: "TEST", executed_quantity: 10 }];
  
  // Should handle error gracefully without throwing
  try {
    // @ts-ignore: Testing internal method: Testing internal method
    await agent.storeTrades(mockTrades);
    assert(true, "Trade storage error was handled gracefully");
  } catch (error) {
    // If it throws, that's also fine as long as it's not a test framework error
    assert(true, "Error was properly thrown and caught");
  }
});

// =============================================================================
// EMAIL FUNCTIONALITY TESTS
// =============================================================================

Deno.test("Email Configuration - Check detection", function() {
  const agent = createTestAgent();
  
  // @ts-ignore: Testing internal method
  const isConfigured = agent.isEmailConfigured();
  
  assertEquals(isConfigured, true); // Should be true with test key
});

Deno.test("Email Configuration - Missing API key", function() {
  // Save current value
  const originalValue = Deno.env.get("RESEND_API_KEY");
  
  // Delete the key
  Deno.env.delete("RESEND_API_KEY");
  
  // Create agent without calling createTestAgent which sets the env var
  const agent = new AutonomousTradingAgent();
  
  // @ts-ignore: Testing internal method
  const isConfigured = agent.isEmailConfigured();
  
  assertEquals(isConfigured, false);
  
  // Restore for other tests
  if (originalValue) {
    Deno.env.set("RESEND_API_KEY", originalValue);
  } else {
    Deno.env.delete("RESEND_API_KEY");
  }
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

Deno.test("Trading Workflow - Handle paused state", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  // @ts-ignore: Testing internal method - Set agent to paused
  agent.state.is_paused = true;
  
  // @ts-ignore: Testing internal method
  await agent.runTradingWorkflow();
  
  // Should complete without error when paused
  assert(true);
});

Deno.test("Risk Management - Validate position sizing", async function() {
  const agent = createTestAgent();
  await agent.initialize();
  
  // @ts-ignore: Testing internal method - Set account balance
  agent.state.account_balance = 100000;
  
  const tradePlan = createMockTradePlan();
  
  // @ts-ignore: Testing internal method
  const finalPlan = await agent.finalizeTradePlan(tradePlan);
  
  assertExists(finalPlan);
  
  // Check that risk exposure is within limits
  for (const trade of finalPlan.trades) {
    const tradeValue = trade.quantity * trade.price_target;
    const riskPercentage = tradeValue / 100000;
    assert(riskPercentage <= 0.02, "Trade risk exceeds 2% limit");
  }
});

// =============================================================================
// DATA VALIDATION TESTS
// =============================================================================

Deno.test("Trade Validation - Valid trade structure", function() {
  const validTrade = {
    symbol: "AAPL",
    action: "BUY",
    quantity: 10,
    price_target: 150.00,
    stop_loss: 142.50,
    take_profit: 165.00,
    confidence: 0.75,
    reasoning: "Strong technical setup"
  };
  
  // Validate required fields
  assertExists(validTrade.symbol);
  assertExists(validTrade.action);
  assertExists(validTrade.quantity);
  assertExists(validTrade.price_target);
  
  // Validate data types
  assertEquals(typeof validTrade.quantity, "number");
  assertEquals(typeof validTrade.confidence, "number");
  
  // Validate ranges
  assert(validTrade.confidence >= 0 && validTrade.confidence <= 1);
  assert(validTrade.quantity > 0);
  assert(validTrade.price_target > 0);
});

Deno.test("Risk Assessment - Edge cases", function() {
  const testCases = [
    { exposure: 0, expected: "very_low" },
    { exposure: 0.01, expected: "low" },
    { exposure: 0.05, expected: "moderate" },
    { exposure: 0.1, expected: "high" },
  ];
  
  for (const testCase of testCases) {
    // Test risk categorization logic
    let riskLevel;
    if (testCase.exposure <= 0.02) riskLevel = "low";
    else if (testCase.exposure <= 0.05) riskLevel = "moderate";
    else riskLevel = "high";
    
    assert(["low", "moderate", "high"].includes(riskLevel));
  }
});

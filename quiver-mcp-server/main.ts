import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const QUIVER_API_BASE = "https://api.quiverquant.com/beta";
const API_TOKEN = Deno.env.get('QUIVER_API_TOKEN');
const PORT = parseInt(Deno.env.get('PORT') || "8081");

// Sleep state management
let isSleeping = false;
let sleepTimeout: number | null = null;
let lastActivityTime = Date.now();
const SLEEP_DELAY = 30 * 60 * 1000; // 30 minutes of inactivity

function resetSleepTimer() {
  lastActivityTime = Date.now();
  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
  
  if (!isSleeping) {
    sleepTimeout = setTimeout(() => {
      console.log("🛌 QuiverQuant MCP Server going to sleep due to inactivity");
      isSleeping = true;
    }, SLEEP_DELAY);
  }
}

function wakeUp() {
  if (isSleeping) {
    console.log("🌅 QuiverQuant MCP Server waking up");
    isSleeping = false;
  }
  resetSleepTimer();
}

const server = new McpServer({
  name: "quiver-quant",
  version: "1.0.0",
  capabilities: { 
    resources: {},
    tools: {},
  },
});

// Simple HTTP health check for Railway
const httpServer = Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'quiver-mcp-server',
      isSleeping,
      lastActivity: new Date(lastActivityTime).toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (url.pathname === '/wake') {
    wakeUp();
    return new Response(JSON.stringify({ 
      status: 'waking up',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response('Not found', { status: 404 });
  }
});

console.log(`🚀 Quiver MCP Server health check listening on port ${PORT}`);

// H E L P E R    F U N C T I O N S

async function makeQuiverRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
  const url = new URL(`${QUIVER_API_BASE}${endpoint}`);
  
  // Add query parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, value);
      }
    });
  }

  const headers = {
    "Accept": "application/json",
    "Authorization": `Bearer ${API_TOKEN}`,
  };

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Quiver API request:", error);
    return null;
  }
}

// T Y P E S

interface CongressTrade {
  Representative: string;
  ReportDate: string;
  TransactionDate: string;
  Ticker: string;
  Transaction: string;
  Range: string;
  District: string;
  House: string;
  Amount: number;
  Party: string;
  TickerType: string;
  Description: string;
  ExcessReturn: number;
  PriceChange: number;
  SPYChange: number;
  last_modified: any;
}

// Format congress trade data
function formatCongressTrade(trade: CongressTrade): string {
  return [
    `Representative: ${trade.Representative} (${trade.Party}, ${trade.House})`,
    `District: ${trade.District}`,
    `Ticker: ${trade.Ticker} (${trade.TickerType})`,
    `Transaction: ${trade.Transaction}`,
    `Amount Range: ${trade.Range}`,
    `Transaction Date: ${new Date(trade.TransactionDate).toLocaleDateString()}`,
    `Report Date: ${new Date(trade.ReportDate).toLocaleDateString()}`,
    `Price Change: ${trade.PriceChange?.toFixed(2)}%`,
    `S&P 500 Change: ${trade.SPYChange?.toFixed(2)}%`,
    `Excess Return: ${trade.ExcessReturn?.toFixed(2)}%`,
    `Description: ${trade.Description || "No description"}`,
    "---",
  ].join("\n");
}

// ------------------------------------------------------ //
// Q U I V E R   Q U A N T    T O O L S
// ------------------------------------------------------ //

// Sleep Management Tools
server.tool(
  "get_sleep_status",
  "Get the current sleep status of the QuiverQuant MCP server",
  {},
  async () => {
    wakeUp(); // Wake up when status is requested
    
    const status = {
      isSleeping,
      lastActivity: new Date(lastActivityTime).toISOString(),
      timeUntilSleep: SLEEP_DELAY - (Date.now() - lastActivityTime),
      sleepDelay: SLEEP_DELAY
    };

    return {
      content: [
        {
          type: "text",
          text: `QuiverQuant MCP Server Status:\n\n` +
                `Sleep Status: ${isSleeping ? '🛌 Sleeping' : '🌅 Awake'}\n` +
                `Last Activity: ${new Date(lastActivityTime).toLocaleString()}\n` +
                `Time Until Sleep: ${Math.max(0, Math.floor((SLEEP_DELAY - (Date.now() - lastActivityTime)) / 1000 / 60))} minutes\n` +
                `Sleep Delay: ${SLEEP_DELAY / 1000 / 60} minutes of inactivity`
        },
      ],
    };
  },
)

server.tool(
  "wake_up_server",
  "Wake up the QuiverQuant MCP server if it's sleeping",
  {},
  async () => {
    const wasSleeping = isSleeping;
    wakeUp();

    return {
      content: [
        {
          type: "text",
          text: wasSleeping 
            ? "🌅 QuiverQuant MCP Server has been woken up and is now active"
            : "✅ QuiverQuant MCP Server was already awake and sleep timer has been reset"
        },
      ],
    };
  },
)

// Live Congress Trading
server.tool(
  "get_live_congress_trading",
  "Get the most recent transactions by members of U.S. Congress",
  {
    normalized: z.boolean().optional().describe("Normalize representative/senator names"),
    representative: z.string().optional().describe("Congressperson's name to filter by"),
  },
  async ({ normalized, representative }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (normalized !== undefined) {
      params.normalized = normalized.toString();
    }
    if (representative) {
      params.representative = representative;
    }

    const congressData = await makeQuiverRequest<CongressTrade[]>("/live/congresstrading", params);

    if (!congressData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve Congress trading data",
          },
        ],
      };
    }

    if (congressData.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: representative 
              ? `No recent trades found for ${representative}` 
              : "No recent Congress trades found",
          },
        ],
      };
    }

    const formattedTrades = congressData.map(formatCongressTrade);
    const tradesText = representative 
      ? `Recent trades by ${representative}:\n\n${formattedTrades.join("\n")}`
      : `Recent Congress trading activity:\n\n${formattedTrades.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: tradesText,
        },
      ],
    };
  },
)

// Live Insider Trading
interface InsiderTrade {
  Ticker: string;
  CompanyName: string;
  InsiderName: string;
  InsiderTitle: string;
  TradeDate: string;
  Transaction: string;
  Shares: number;
  Price: number;
  Value: number;
  SharesAfter: number;
  OwnershipType: string;
  FormType: string;
  SecurityType: string;
  last_modified: any;
}

function formatInsiderTrade(trade: InsiderTrade): string {
  return [
    `Company: ${trade.CompanyName} (${trade.Ticker})`,
    `Insider: ${trade.InsiderName} - ${trade.InsiderTitle}`,
    `Transaction: ${trade.Transaction}`,
    `Shares: ${trade.Shares?.toLocaleString()}`,
    `Price: $${trade.Price?.toFixed(2)}`,
    `Total Value: $${trade.Value?.toLocaleString()}`,
    `Shares After: ${trade.SharesAfter?.toLocaleString()}`,
    `Trade Date: ${new Date(trade.TradeDate).toLocaleDateString()}`,
    `Form Type: ${trade.FormType}`,
    `Ownership Type: ${trade.OwnershipType}`,
    `Security Type: ${trade.SecurityType}`,
    "---",
  ].join("\n");
}

server.tool(
  "get_live_insider_trading",
  "Get the most recent insider trading transactions",
  {
    ticker: z.string().optional().describe("Stock ticker symbol to filter by"),
    insider: z.string().optional().describe("Insider name to filter by"),
  },
  async ({ ticker, insider }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (insider) {
      params.insider = insider;
    }

    const insiderData = await makeQuiverRequest<InsiderTrade[]>("/live/insiders", params);

    if (!insiderData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve insider trading data",
          },
        ],
      };
    }

    if (insiderData.length === 0) {
      const filterText = ticker ? ` for ${ticker}` : insider ? ` by ${insider}` : "";
      return {
        content: [
          {
            type: "text",
            text: `No recent insider trades found${filterText}`,
          },
        ],
      };
    }

    const formattedTrades = insiderData.map(formatInsiderTrade);
    const filterText = ticker ? ` for ${ticker}` : insider ? ` by ${insider}` : "";
    const tradesText = `Recent insider trading activity${filterText}:\n\n${formattedTrades.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: tradesText,
        },
      ],
    };
  },
)

// Live Lobbying
interface LobbyingRecord {
  Client: string;
  ClientID: number;
  Registrant: string;
  RegistrantID: number;
  Amount: number;
  IssueAreaCode: string;
  IssueAreaGeneral: string;
  IssueText: string;
  Year: number;
  Quarter: number;
  Date: string;
  last_modified: any;
}

function formatLobbyingRecord(record: LobbyingRecord): string {
  return [
    `Client: ${record.Client}`,
    `Registrant: ${record.Registrant}`,
    `Amount: $${record.Amount?.toLocaleString()}`,
    `Issue Area: ${record.IssueAreaGeneral} (${record.IssueAreaCode})`,
    `Issue: ${record.IssueText}`,
    `Period: Q${record.Quarter} ${record.Year}`,
    `Date: ${new Date(record.Date).toLocaleDateString()}`,
    "---",
  ].join("\n");
}

server.tool(
  "get_live_lobbying",
  "Get the most recent lobbying disclosure records",
  {
    client: z.string().optional().describe("Client name to filter by"),
    registrant: z.string().optional().describe("Registrant/lobbyist name to filter by"),
    issue: z.string().optional().describe("Issue area to filter by"),
  },
  async ({ client, registrant, issue }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (client) {
      params.client = client;
    }
    if (registrant) {
      params.registrant = registrant;
    }
    if (issue) {
      params.issue = issue;
    }

    const lobbyingData = await makeQuiverRequest<LobbyingRecord[]>("/live/lobbying", params);

    if (!lobbyingData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve lobbying data",
          },
        ],
      };
    }

    if (lobbyingData.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No recent lobbying records found",
          },
        ],
      };
    }

    const formattedRecords = lobbyingData.map(formatLobbyingRecord);
    const recordsText = `Recent lobbying disclosure records:\n\n${formattedRecords.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: recordsText,
        },
      ],
    };
  },
)

// Live SEC13F Changes
interface SEC13FChange {
  Ticker: string;
  CompanyName: string;
  InstitutionName: string;
  FilingDate: string;
  Quarter: string;
  SharesChange: number;
  SharesChangePercent: number;
  SharesTotal: number;
  MarketValue: number;
  MarketValueChange: number;
  ReportDate: string;
  FormType: string;
  last_modified: any;
}

function formatSEC13FChange(change: SEC13FChange): string {
  return [
    `Institution: ${change.InstitutionName}`,
    `Company: ${change.CompanyName} (${change.Ticker})`,
    `Shares Change: ${change.SharesChange?.toLocaleString()} (${change.SharesChangePercent?.toFixed(2)}%)`,
    `Total Shares: ${change.SharesTotal?.toLocaleString()}`,
    `Market Value: $${change.MarketValue?.toLocaleString()}`,
    `Market Value Change: $${change.MarketValueChange?.toLocaleString()}`,
    `Quarter: ${change.Quarter}`,
    `Filing Date: ${new Date(change.FilingDate).toLocaleDateString()}`,
    `Report Date: ${new Date(change.ReportDate).toLocaleDateString()}`,
    `Form Type: ${change.FormType}`,
    "---",
  ].join("\n");
}

server.tool(
  "get_live_sec13f_changes",
  "Get the most recent SEC 13F institutional holding changes",
  {
    ticker: z.string().optional().describe("Stock ticker symbol to filter by"),
    institution: z.string().optional().describe("Institution name to filter by"),
  },
  async ({ ticker, institution }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (institution) {
      params.institution = institution;
    }

    const sec13fData = await makeQuiverRequest<SEC13FChange[]>("/live/thirteenf", params);

    if (!sec13fData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve SEC 13F data",
          },
        ],
      };
    }

    if (sec13fData.length === 0) {
      const filterText = ticker ? ` for ${ticker}` : institution ? ` by ${institution}` : "";
      return {
        content: [
          {
            type: "text",
            text: `No recent SEC 13F changes found${filterText}`,
          },
        ],
      };
    }

    const formattedChanges = sec13fData.map(formatSEC13FChange);
    const filterText = ticker ? ` for ${ticker}` : institution ? ` by ${institution}` : "";
    const changesText = `Recent SEC 13F institutional holding changes${filterText}:\n\n${formattedChanges.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: changesText,
        },
      ],
    };
  },
)

// Live Off-Exchange
interface OffExchangeData {
  Ticker: string;
  Date: string;
  TotalVolume: number;
  TotalShares: number;
  ATS_Volume: number;
  ATS_Shares: number;
  NonATS_Volume: number;
  NonATS_Shares: number;
  OffExchangePercent: number;
  ATS_Percent: number;
  NonATS_Percent: number;
  Price: number;
  last_modified: any;
}

function formatOffExchangeData(data: OffExchangeData): string {
  return [
    `Ticker: ${data.Ticker}`,
    `Date: ${new Date(data.Date).toLocaleDateString()}`,
    `Price: $${data.Price?.toFixed(2)}`,
    `Total Volume: ${data.TotalVolume?.toLocaleString()}`,
    `Total Shares: ${data.TotalShares?.toLocaleString()}`,
    `Off-Exchange %: ${data.OffExchangePercent?.toFixed(2)}%`,
    `ATS Volume: ${data.ATS_Volume?.toLocaleString()} (${data.ATS_Percent?.toFixed(2)}%)`,
    `Non-ATS Volume: ${data.NonATS_Volume?.toLocaleString()} (${data.NonATS_Percent?.toFixed(2)}%)`,
    "---",
  ].join("\n");
}

server.tool(
  "get_live_off_exchange",
  "Get the most recent off-exchange trading data",
  {
    ticker: z.string().optional().describe("Stock ticker symbol to filter by"),
  },
  async ({ ticker }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }

    const offExchangeData = await makeQuiverRequest<OffExchangeData[]>("/live/offexchange", params);

    if (!offExchangeData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve off-exchange data",
          },
        ],
      };
    }

    if (offExchangeData.length === 0) {
      const filterText = ticker ? ` for ${ticker}` : "";
      return {
        content: [
          {
            type: "text",
            text: `No recent off-exchange data found${filterText}`,
          },
        ],
      };
    }

    const formattedData = offExchangeData.map(formatOffExchangeData);
    const filterText = ticker ? ` for ${ticker}` : "";
    const dataText = `Recent off-exchange trading data${filterText}:\n\n${formattedData.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: dataText,
        },
      ],
    };
  },
)

// Live ETF Holdings
interface ETFHolding {
  Ticker: string;
  CompanyName: string;
  ETF: string;
  ETFName: string;
  Shares: number;
  MarketValue: number;
  Weight: number;
  Date: string;
  last_modified: any;
}

function formatETFHolding(holding: ETFHolding): string {
  return [
    `ETF: ${holding.ETFName} (${holding.ETF})`,
    `Holding: ${holding.CompanyName} (${holding.Ticker})`,
    `Shares: ${holding.Shares?.toLocaleString()}`,
    `Market Value: $${holding.MarketValue?.toLocaleString()}`,
    `Weight: ${holding.Weight?.toFixed(2)}%`,
    `Date: ${new Date(holding.Date).toLocaleDateString()}`,
    "---",
  ].join("\n");
}

server.tool(
  "get_live_etf_holdings",
  "Get the most recent ETF holdings data",
  {
    ticker: z.string().optional().describe("Stock ticker symbol to filter by"),
    etf: z.string().optional().describe("ETF ticker symbol to filter by"),
  },
  async ({ ticker, etf }) => {
    wakeUp(); // Wake up when any tool is used
    
    const params: Record<string, string> = {};
    
    if (ticker) {
      params.ticker = ticker.toUpperCase();
    }
    if (etf) {
      params.etf = etf.toUpperCase();
    }

    const etfData = await makeQuiverRequest<ETFHolding[]>("/live/etfholdings", params);

    if (!etfData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve ETF holdings data",
          },
        ],
      };
    }

    if (etfData.length === 0) {
      const filterText = ticker ? ` for ${ticker}` : etf ? ` in ${etf}` : "";
      return {
        content: [
          {
            type: "text",
            text: `No recent ETF holdings found${filterText}`,
          },
        ],
      };
    }

    const formattedHoldings = etfData.map(formatETFHolding);
    const filterText = ticker ? ` for ${ticker}` : etf ? ` in ${etf}` : "";
    const holdingsText = `Recent ETF holdings data${filterText}:\n\n${formattedHoldings.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: holdingsText,
        },
      ],
    };
  },
)


// R U N N I N G

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quiver Quant MCP Server running on stdio");
  
  // Initialize sleep timer
  resetSleepTimer();
  console.error("🛌 Sleep functionality enabled - server will sleep after 30 minutes of inactivity");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  Deno.exit(1);
});
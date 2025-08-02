/**
 * Email Service - Handles all email notifications for the trading agent
 */

import { Resend } from "resend";
import { IEmailService, TradePlan, AccountDetails, TradingLogger, TradeRecord } from '../types/interfaces.ts';
import { EMAIL_CONFIG, ENV_KEYS, isEmailConfigured } from '../config.ts';
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

export class EmailService implements IEmailService {
  private resend: Resend | null = null;
  private logger: TradingLogger;
  private baseUrl: string;
  private dailyEmailCount: number = 0;
  private lastEmailResetDate: string = '';
  private resendApiKey: string | null = null;

  constructor(logger: TradingLogger, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    
    // Initialize Resend if API key is available
    this.resendApiKey = Deno.env.get(ENV_KEYS.RESEND_API_KEY) || null;
    if (this.resendApiKey) {
      this.resend = new Resend(this.resendApiKey);
    }
  }

  /**
   * Check if email is properly configured
   */
  isConfigured(): boolean {
    return isEmailConfigured() && this.resend !== null;
  }

  /**
   * Check and reset daily email count
   */
  private checkDailyEmailLimit(): boolean {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset counter if it's a new day
    if (this.lastEmailResetDate !== today) {
      this.dailyEmailCount = 0;
      this.lastEmailResetDate = today;
    }
    
    // Check if we've reached the daily limit (100 emails)
    if (this.dailyEmailCount >= 100) {
      this.logger.log('ALERT', `Daily email limit reached (100). Skipping email send.`);
      return false;
    }
    
    return true;
  }

  /**
   * Fetch email count from Resend API for today
   */
  private async fetchResendEmailCount(): Promise<number> {
    if (!this.resendApiKey) {
      this.logger.log('ALERT', 'No Resend API key available to fetch email count');
      return 0;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(today + 'T00:00:00Z').toISOString();
      const endOfDay = new Date(today + 'T23:59:59Z').toISOString();

      const response = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        this.logger.log('ALERT', `Failed to fetch Resend email count: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      
      // Filter emails sent today
      const todayEmails = data.data?.filter((email: any) => {
        const emailDate = new Date(email.created_at).toISOString().split('T')[0];
        return emailDate === today;
      }) || [];

      const emailCount = todayEmails.length;
      this.logger.log('STATUS', `📊 Resend API: ${emailCount} emails sent today`);
      
      return emailCount;
      
    } catch (error) {
      this.logger.log('ALERT', `Error fetching Resend email count: ${error}`);
      return 0;
    }
  }

  /**
   * Check daily email limit using Resend API
   */
  private async checkResendDailyLimit(): Promise<boolean> {
    const emailCount = await this.fetchResendEmailCount();
    
    if (emailCount >= 100) {
      this.logger.log('ALERT', `🚫 Daily email limit reached (${emailCount}/100). Skipping email send to prevent account shutdown.`);
      return false;
    }
    
    return true;
  }

  /**
   * Send email with error handling
   */
  async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    // Skip if email not configured
    if (!this.isConfigured()) {
      this.logger.log('ALERT', `EMAIL:TODO: send (not configured) - ${subject}`);
      return false;
    }

    // Check daily email limit using Resend API
    const canSend = await this.checkResendDailyLimit();
    if (!canSend) {
      return false;
    }

    try {
      const { data, error } = await this.resend!.emails.send({
        from: EMAIL_CONFIG.from,
        to: [to],
        subject: subject,
        html: content,
      });

      if (error) {
        this.logger.log('ALERT', `EMAIL:TODO: send (resend error) - ${subject}: ${JSON.stringify(error)}`);
        return false;
      }

      // Increment local counter for logging
      this.dailyEmailCount++;
      this.logger.log('STATUS', `📧 Email sent: ${subject} to ${to} (${this.dailyEmailCount}/100 today)`);
      return true;
      
    } catch (error) {
      this.logger.log('ALERT', `EMAIL:TODO: send (network error) - ${subject}: ${error}`);
      return false;
    }
  }

  /**
   * Send trade plan email to stakeholders
   */
  async sendTradePlanEmail(tradePlan: TradePlan): Promise<string> {
    this.logger.log('STATUS', 'Sending trade plan email...');

    const pauseToken = crypto.randomUUID();
    
    const emailContent = this.buildTradePlanEmailContent(tradePlan, pauseToken);
    
    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.tradePlanRecipients) {
      if (await this.sendEmail(recipient, `📊 Daily Trade Plan - ${tradePlan.date}`, emailContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Trade plan emailed to ${emailsSent}/${EMAIL_CONFIG.tradePlanRecipients.length} recipients`);
    
    // Return the pause token for the caller to store
    return pauseToken;
  }

    /**
   * Send daily summary email
   */
  async sendDailySummary(accountDetails: AccountDetails, todayTrades: TradeRecord[]): Promise<void> {
    this.logger.log('STATUS', 'Generating daily summary email...');

    const summaryContent = this.buildDailySummaryContent(accountDetails, todayTrades);

    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.dailySummaryRecipients) {
      if (await this.sendEmail(recipient, `📊 Trading Agent - Daily Summary ${new Date().toISOString().split('T')[0]}`, summaryContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Daily summary emailed to ${emailsSent}/${EMAIL_CONFIG.dailySummaryRecipients.length} recipients`);
  }

  /**
   * Send error alert email
   */
  async sendErrorAlert(error: Error): Promise<void> {
    this.logger.log('ALERT', 'Sending error alert email...');

    const errorContent = this.buildErrorAlertContent(error);

    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.errorAlertRecipients) {
      if (await this.sendEmail(recipient, '🚨 Trading Agent - Error Alert', errorContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Error alert sent to ${emailsSent}/${EMAIL_CONFIG.errorAlertRecipients.length} recipients`);
  }

  /**
   * Send resume email with resume link
   */
  async sendResumeEmail(resumeToken: string): Promise<void> {
    const resumeContent = this.buildResumeEmailContent(resumeToken);

    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.recipients) {
      if (await this.sendEmail(recipient, '⏸️ Trading Agent Paused - Resume Link', resumeContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Resume email sent to ${emailsSent}/${EMAIL_CONFIG.recipients.length} recipients`);
  }

  /**
   * Send startup notification
   */
  async sendStartupNotification(accountBalance: number, connectedServers: string[]): Promise<void> {
    this.logger.log('STATUS', 'Sending startup notification...');

    const startupContent = this.buildStartupNotificationContent(accountBalance, connectedServers);

    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.startupShutdownRecipients) {
      if (await this.sendEmail(recipient, '🚀 Trading Agent - Startup Notification', startupContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Startup notification sent to ${emailsSent}/${EMAIL_CONFIG.startupShutdownRecipients.length} recipients`);
  }

  /**
   * Send shutdown notification
   */
  async sendShutdownNotification(reason: string, accountBalance: number, openPositions: number): Promise<void> {
    this.logger.log('STATUS', 'Sending shutdown notification...');

    const shutdownContent = this.buildShutdownNotificationContent(reason, accountBalance, openPositions);

    let emailsSent = 0;
    for (const recipient of EMAIL_CONFIG.startupShutdownRecipients) {
      if (await this.sendEmail(recipient, '🛑 Trading Agent - Shutdown Notification', shutdownContent)) {
        emailsSent++;
      }
    }
    
    this.logger.log('STATUS', `Shutdown notification sent to ${emailsSent}/${EMAIL_CONFIG.startupShutdownRecipients.length} recipients`);
  }

  /**
   * Get current email count from Resend API
   */
  async getCurrentEmailCount(): Promise<{ count: number; limit: number; canSend: boolean }> {
    const count = await this.fetchResendEmailCount();
    const limit = 100;
    const canSend = count < limit;
    
    return {
      count,
      limit,
      canSend
    };
  }

  /**
   * Send test email
   */
  async sendTestEmail(recipient?: string): Promise<boolean> {
    const testRecipient = recipient || EMAIL_CONFIG.recipients[0];
    const testContent = this.buildTestEmailContent();
    
    return await this.sendEmail(testRecipient, '🧪 Trading Agent - Test Email', testContent);
  }

  // Private methods for building email content

  private buildTradePlanEmailContent(tradePlan: TradePlan, pauseToken: string): string {
    return `
    <h2>🤖 Daily Trade Plan - ${tradePlan.date}</h2>
    
    <h3>Market Analysis</h3>
    <p>${tradePlan.market_analysis}</p>
    
    <h3>Planned Trades (${tradePlan.trades.length})</h3>
    ${tradePlan.trades.map(trade => `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <h4>${trade.action} ${trade.symbol}</h4>
        <p><strong>Quantity:</strong> ${trade.quantity}</p>
        <p><strong>Target Price:</strong> $${trade.price_target}</p>
        <p><strong>Stop Loss:</strong> $${trade.stop_loss}</p>
        <p><strong>Take Profit:</strong> $${trade.take_profit}</p>
        <p><strong>Confidence:</strong> ${(trade.confidence * 100).toFixed(1)}%</p>
        <p><strong>Reasoning:</strong> ${trade.reasoning}</p>
      </div>
    `).join('')}
    
    <h3>Risk Assessment</h3>
    <p>${tradePlan.risk_assessment}</p>
    <p><strong>Total Risk Exposure:</strong> ${(tradePlan.total_risk_exposure * 100).toFixed(2)}%</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0;">
      <h3>🛑 Emergency Controls</h3>
      <a href="${this.baseUrl}/pause/${pauseToken}" 
         style="background-color: #ff4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        PAUSE TRADING
      </a>
    </div>
    
    <p><small>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }

  private buildDailySummaryContent(accountDetails: AccountDetails, todayTrades: TradeRecord[]): string {
    return `
    <h2>📊 Daily Trading Summary - ${new Date().toISOString().split('T')[0]}</h2>
    
    <h3>Account Status</h3>
    <p><strong>Account Balance:</strong> $${accountDetails.balance?.toLocaleString()}</p>
    <p><strong>Buying Power:</strong> $${accountDetails.buying_power?.toLocaleString()}</p>
    <p><strong>Portfolio Value:</strong> $${accountDetails.portfolio_value?.toLocaleString()}</p>
    <p><strong>Day P&L:</strong> <span style="color: ${(accountDetails.day_pnl || 0) >= 0 ? 'green' : 'red'}">$${accountDetails.day_pnl?.toLocaleString()}</span></p>
    
    <h3>Today's Trades (${todayTrades.length})</h3>
    ${todayTrades.length > 0 ? todayTrades.map(trade => `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <p><strong>${trade.action} ${trade.quantity} ${trade.symbol}</strong></p>
        <p>Status: ${trade.status}</p>
        <p>Target Price: $${trade.price_target?.toFixed(2)}</p>
        <p>Executed Price: $${trade.executed_price?.toFixed(2) || 'Pending'}</p>
        <p>Executed at: ${new Date(trade.executed_at).toLocaleString()}</p>
      </div>
    `).join('') : '<p>No trades executed today.</p>'}
    
    <h3>Performance Metrics</h3>
    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <h4>Today's P&L</h4>
        <p style="font-size: 24px; font-weight: bold; color: ${(accountDetails.day_pnl || 0) >= 0 ? 'green' : 'red'}">
          ${(accountDetails.day_pnl || 0) >= 0 ? '+' : ''}$${accountDetails.day_pnl?.toLocaleString()}
        </p>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <h4>Trades</h4>
        <p style="font-size: 24px; font-weight: bold;">${todayTrades.length}</p>
      </div>
    </div>
    
    <p><small>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }

  private buildErrorAlertContent(error: Error): string {
    return `
    <h2>🚨 Trading Agent Critical Error</h2>
    <p><strong>The trading agent has encountered a critical error and has been automatically paused.</strong></p>
    
    <h3>Error Details</h3>
    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Error Message:</strong> ${error.message}</p>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">
${error.stack || 'No stack trace available'}
      </pre>
    </div>
    
    <h3>Next Steps</h3>
    <ul>
      <li>The agent has been automatically paused</li>
      <li>All pending orders have been cancelled</li>
      <li>Current positions remain open</li>
      <li>Manual intervention required to resume trading</li>
    </ul>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
      <h4>🔧 Resolution Steps:</h4>
      <ol>
        <li>Check the agent logs for more details</li>
        <li>Resolve the underlying issue</li>
        <li>Use the web interface to resume trading when ready</li>
      </ol>
    </div>
    
    <p><small>Error occurred at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }

  private buildResumeEmailContent(resumeToken: string): string {
    return `
    <h2>⏸️ Trading Agent Paused</h2>
    <p>The autonomous trading agent has been paused as requested.</p>
    <p>Click the button below to resume trading when you're ready:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${this.baseUrl}/resume/${resumeToken}" 
         style="background-color: #4CAF50; color: white; padding: 15px 32px; text-decoration: none; border-radius: 5px; font-size: 18px;">
        ▶️ RESUME TRADING
      </a>
    </div>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px;">
      <h4>ℹ️ Important Notes:</h4>
      <ul>
        <li>This link is secure and will expire after use</li>
        <li>Trading will resume on the next scheduled run</li>
        <li>All current positions remain unchanged</li>
      </ul>
    </div>
    
    <p><small>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }

  private buildStartupNotificationContent(accountBalance: number, connectedServers: string[]): string {
    return `
    <h2>🚀 Trading Agent Started Successfully</h2>
    <p>The Ada Analytics Trading Agent has been started and is ready for operation.</p>
    
    <h3>System Status</h3>
    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Status:</strong> ✅ ACTIVE</p>
      <p><strong>Account Balance:</strong> $${accountBalance.toLocaleString()}</p>
      <p><strong>Connected Services:</strong> ${connectedServers.join(', ')}</p>
      <p><strong>Next Trading Session:</strong> Tomorrow at 6:00 AM EST</p>
    </div>
    
    <h3>Configuration</h3>
    <ul>
      <li>Daily trading workflow: 6:00 AM EST</li>
      <li>End-of-day summary: 5:00 PM EST</li>
      <li>Risk per trade: 1% of account balance</li>
      <li>Maximum trades per day: 2</li>
    </ul>
    
    <h3>Controls</h3>
    <p>You can monitor and control the agent using the web interface:</p>
    <p><a href="${this.baseUrl.replace('/api', '')}" style="color: #007bff;">Agent Dashboard</a></p>
    
    <p><small>Started at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }

  private buildShutdownNotificationContent(reason: string, accountBalance: number, openPositions: number): string {
    return `
    <h2>🛑 Trading Agent Shutdown</h2>
    <p>The Ada Analytics Trading Agent has been shut down.</p>
    
    <h3>Shutdown Details</h3>
    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</p>
      <p><strong>Final Account Balance:</strong> $${accountBalance.toLocaleString()}</p>
      <p><strong>Open Positions:</strong> ${openPositions}</p>
    </div>
    
    <h3>Status</h3>
    <ul>
      <li>✅ All pending orders cancelled</li>
      <li>✅ Agent state saved</li>
      <li>✅ Connections closed gracefully</li>
      <li>${openPositions > 0 ? '⚠️' : '✅'} ${openPositions} open positions ${openPositions > 0 ? 'remain active' : ''}</li>
    </ul>
    
    ${openPositions > 0 ? `
    <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
      <h4>⚠️ Open Positions Notice:</h4>
      <p>You have ${openPositions} open position${openPositions > 1 ? 's' : ''} that require manual monitoring. 
         Please check your brokerage account to manage these positions.</p>
    </div>
    ` : ''}
    
    <p>To restart the agent, please manually restart the application.</p>
    `;
  }

  private buildTestEmailContent(): string {
    return `
    <h2>🧪 Ada Analytics Test Email</h2>
    <p>This is a test email from your Ada Analytics Trading Agent.</p>
    <p>If you receive this message, the email functionality is working correctly.</p>
    
    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <h3>✅ Email System Status: OPERATIONAL</h3>
      <ul>
        <li>Resend API: Connected</li>
        <li>Email delivery: Successful</li>
        <li>Configuration: Valid</li>
      </ul>
    </div>
    
    <h3>Test Results</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Test Item</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Status</strong></td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">HTML Formatting</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: green;">✅ PASS</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">Email Delivery</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: green;">✅ PASS</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">Template Rendering</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: green;">✅ PASS</td>
      </tr>
    </table>
    
    <p><small>Test email generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
    `;
  }
}
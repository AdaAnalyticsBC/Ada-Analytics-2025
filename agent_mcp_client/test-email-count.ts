#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test script to verify email count functionality
 */

import { EmailService } from './services/emailService.ts';
import { Logger } from './utils/logger.ts';
import { ENV_KEYS } from './config.ts';

// Create a simple logger for testing
const logger = new Logger();

// Create email service
const emailService = new EmailService(logger, 'http://localhost:8080');

async function testEmailCount() {
  console.log('🧪 Testing Email Count Functionality...\n');

  // Check if email service is configured
  console.log('📧 Email Service Configuration:');
  console.log(`- Configured: ${emailService.isConfigured()}`);
  console.log(`- Resend API Key: ${Deno.env.get(ENV_KEYS.RESEND_API_KEY) ? '✅ Set' : '❌ Not set'}\n`);

  if (!emailService.isConfigured()) {
    console.log('❌ Email service not configured. Please set RESEND_API_KEY environment variable.');
    return;
  }

  try {
    // Get current email count
    console.log('📊 Fetching current email count from Resend API...');
    const emailCount = await emailService.getCurrentEmailCount();
    
    console.log('📈 Email Count Results:');
    console.log(`- Count: ${emailCount.count}`);
    console.log(`- Limit: ${emailCount.limit}`);
    console.log(`- Can Send: ${emailCount.canSend ? '✅ Yes' : '❌ No'}`);
    console.log(`- Remaining: ${emailCount.limit - emailCount.count}`);
    
    if (emailCount.count >= emailCount.limit) {
      console.log('\n🚫 WARNING: Daily email limit reached! No more emails will be sent today.');
    } else {
      console.log(`\n✅ Email service is ready. ${emailCount.limit - emailCount.count} emails remaining today.`);
    }
    
  } catch (error) {
    console.error('❌ Error testing email count:', error);
  }
}

// Run the test
if (import.meta.main) {
  testEmailCount();
} 
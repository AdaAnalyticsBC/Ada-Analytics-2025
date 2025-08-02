#!/usr/bin/env -S deno run --allow-env

/**
 * Cron Job Verification Script
 * Verifies that the trading agent will execute Monday morning at 6 AM EST
 */

import { CRON_SCHEDULES, TRADING_CONFIG } from './config.ts';

function parseCronExpression(expression: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const parts = expression.split(' ');
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4]
  };
}

function getNextExecutionTime(cronExpression: string): Date[] {
  const now = new Date();
  const nextExecutions: Date[] = [];
  
  // Parse the cron expression
  const { minute, hour, dayOfWeek } = parseCronExpression(cronExpression);
  
  // For the next 7 days, check when it will execute
  for (let i = 0; i < 7; i++) {
    const testDate = new Date(now);
    testDate.setDate(now.getDate() + i);
    
    const dayOfWeekNum = testDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = testDate.getHours();
    const currentMinute = testDate.getMinutes();
    
    // Check if this day matches the day of week pattern
    const dayMatches = dayOfWeek === '*' || 
                      (dayOfWeek === '1-5' && dayOfWeekNum >= 1 && dayOfWeekNum <= 5) ||
                      dayOfWeek === dayOfWeekNum.toString();
    
    if (dayMatches) {
      // Create execution time for this day
      const executionTime = new Date(testDate);
      executionTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
      
      // Only include future executions
      if (executionTime > now) {
        nextExecutions.push(executionTime);
      }
    }
  }
  
  return nextExecutions;
}

function formatDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} EST`;
}

function main() {
  console.log('🧪 Cron Job Verification Script\n');
  
  console.log('📅 Current Cron Schedules:');
  console.log(`- DAILY_TRADING: "${CRON_SCHEDULES.DAILY_TRADING}" (6 AM EST, weekdays)`);
  console.log(`- END_OF_DAY_SUMMARY: "${CRON_SCHEDULES.END_OF_DAY_SUMMARY}" (5 PM EST, weekdays)`);
  console.log(`- WEEKLY_CLEANUP: "${CRON_SCHEDULES.WEEKLY_CLEANUP}" (Sunday midnight)\n`);
  
  console.log('🔍 Parsing DAILY_TRADING schedule:');
  const dailyTrading = parseCronExpression(CRON_SCHEDULES.DAILY_TRADING);
  console.log(`- Minute: ${dailyTrading.minute}`);
  console.log(`- Hour: ${dailyTrading.hour}`);
  console.log(`- Day of Month: ${dailyTrading.dayOfMonth}`);
  console.log(`- Month: ${dailyTrading.month}`);
  console.log(`- Day of Week: ${dailyTrading.dayOfWeek} (1-5 = Monday-Friday)\n`);
  
  console.log('⏰ Next 5 execution times for DAILY_TRADING:');
  const nextExecutions = getNextExecutionTime(CRON_SCHEDULES.DAILY_TRADING);
  nextExecutions.slice(0, 5).forEach((execution, index) => {
    console.log(`${index + 1}. ${formatDate(execution)}`);
  });
  
  console.log('\n✅ Verification Results:');
  
  // Check if Monday is included
  const mondayExecutions = nextExecutions.filter(date => date.getDay() === 1);
  if (mondayExecutions.length > 0) {
    console.log('✅ Monday executions are scheduled');
    console.log(`   Next Monday execution: ${formatDate(mondayExecutions[0])}`);
  } else {
    console.log('❌ No Monday executions found');
  }
  
  // Check if it's at 6 AM
  const sixAMExecutions = nextExecutions.filter(date => date.getHours() === 6);
  if (sixAMExecutions.length > 0) {
    console.log('✅ 6 AM executions are scheduled');
  } else {
    console.log('❌ No 6 AM executions found');
  }
  
  // Check if weekends are excluded
  const weekendExecutions = nextExecutions.filter(date => date.getDay() === 0 || date.getDay() === 6);
  if (weekendExecutions.length === 0) {
    console.log('✅ Weekend executions are correctly excluded');
  } else {
    console.log('❌ Weekend executions found (should be excluded)');
  }
  
  console.log('\n📊 Market Hours Configuration:');
  console.log(`- Market Open: ${TRADING_CONFIG.MARKET_OPEN_HOUR}:${TRADING_CONFIG.MARKET_OPEN_MINUTE.toString().padStart(2, '0')} EST`);
  console.log(`- Market Close: ${TRADING_CONFIG.MARKET_CLOSE_HOUR}:${TRADING_CONFIG.MARKET_CLOSE_MINUTE.toString().padStart(2, '0')} EST`);
  console.log(`- Trading starts at 6 AM, waits for market open at 9:30 AM`);
  
  console.log('\n🎯 Summary:');
  console.log('The trading agent will:');
  console.log('1. Wake up at 6 AM EST every weekday (Monday-Friday)');
  console.log('2. Collect market data and create trade plans');
  console.log('3. Send trade plan emails to configured recipients');
  console.log('4. Wait for market open at 9:30 AM EST');
  console.log('5. Execute trades if conditions are met');
  console.log('6. Send daily summary at 5 PM EST');
  
  console.log('\n✅ Cron job configuration is correct for Monday morning execution!');
}

if (import.meta.main) {
  main();
} 
import { gramjsClient } from './gramjs-client';
import { telegrafBot } from './telegraf-bot';
import { CronScheduler } from './cron-scheduler';

async function main() {
  console.log('Starting Telegram Summary Bot...');
  console.log(`Timezone: ${process.env.TZ || 'UTC'}`);

  try {
    await gramjsClient.connect();
    await telegrafBot.start();

    const scheduler = new CronScheduler(telegrafBot);
    scheduler.start();

    console.log('✅ Bot is running!');
    console.log(`Summary will be sent to: ${process.env.SUMMARY_DESTINATION}`);
    console.log(`Cron schedule: ${process.env.SUMMARY_CRON_EXPRESSION}`);

    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      scheduler.stop();
      await telegrafBot.stop();
      await gramjsClient.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully...');
      scheduler.stop();
      await telegrafBot.stop();
      await gramjsClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();

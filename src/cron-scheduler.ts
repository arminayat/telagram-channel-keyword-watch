import cron from 'node-cron';
import { TelegrafBot } from './telegraf-bot';
import { appConfig } from './config';

export class CronScheduler {
  private task?: cron.ScheduledTask;
  private telegrafBot: TelegrafBot;

  constructor(telegrafBot: TelegrafBot) {
    this.telegrafBot = telegrafBot;
  }

  start(): void {
    const cronExpression = appConfig.summary.cronExpression;
    
    console.log(`Setting up cron job with expression: ${cronExpression}`);

    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    this.task = cron.schedule(cronExpression, async () => {
      console.log(`[${new Date().toISOString()}] Running scheduled summary...`);
      
      try {
        await this.telegrafBot.generateAndSendSummary();
        console.log('Scheduled summary completed successfully');
      } catch (error) {
        console.error('Error in scheduled summary:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC',
    });

    console.log('Cron scheduler started');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('Cron scheduler stopped');
    }
  }
}

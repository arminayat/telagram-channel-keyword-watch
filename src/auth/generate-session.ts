import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function generateSession() {
  console.log('=== Telegram Session Generator ===\n');
  console.log('This utility will help you generate a string session for the Telegram Summary Bot.');
  console.log('You will need your API ID and API Hash from https://my.telegram.org\n');

  const apiId = parseInt(await askQuestion('Enter your API ID: '));
  const apiHash = await askQuestion('Enter your API Hash: ');
  const phoneNumber = await askQuestion('Enter your phone number (with country code, e.g., +1234567890): ');

  console.log('\nConnecting to Telegram...');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  const sessionInstance = stringSession;

  await client.start({
    phoneNumber: () => Promise.resolve(phoneNumber),
    password: async () => {
      const password = await askQuestion('Enter your 2FA password (if enabled): ');
      return password;
    },
    phoneCode: async () => {
      const code = await askQuestion('Enter the code you received: ');
      return code;
    },
    onError: (err) => console.log(err),
  });

  console.log('\n✅ Authentication successful!');

  const sessionString = sessionInstance.save() as unknown as string;
  console.log('\n=== Your String Session ===');
  console.log(sessionString);
  console.log('===========================\n');

  const saveToEnv = await askQuestion('Would you like to save this to your .env file? (y/n): ');

  if (saveToEnv.toLowerCase() === 'y') {
    const envPath = path.resolve(process.cwd(), '.env');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    const lines = envContent.split('\n');
    let found = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('TELEGRAM_STRING_SESSION=')) {
        lines[i] = `TELEGRAM_STRING_SESSION=${sessionString}`;
        found = true;
        break;
      }
    }

    if (!found) {
      lines.push(`TELEGRAM_STRING_SESSION=${sessionString}`);
    }

    fs.writeFileSync(envPath, lines.join('\n'));
    console.log(`✅ Session saved to ${envPath}`);
  } else {
    console.log('\n⚠️  Please copy the session string above and add it to your .env file as:');
    console.log(`TELEGRAM_STRING_SESSION=${sessionString}`);
  }

  await client.disconnect();
  rl.close();

  console.log('\nDone! You can now use the bot.');
}

generateSession().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});

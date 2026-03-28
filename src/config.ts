import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function getEnvArray(key: string): string[] {
  const value = process.env[key];
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function normalizeKeywordText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u064A/g, '\u06CC')
    .replace(/\u0649/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .toLocaleLowerCase();
}

const filterKeywords = getEnvArray('FILTER_KEYWORDS');
const normalizedFilterKeywords = filterKeywords.map(normalizeKeywordText);

export interface Config {
  telegram: {
    apiId: number;
    apiHash: string;
    stringSession: string;
    botToken: string;
  };
  openrouter: {
    apiKey: string;
    model: string;
    customPrompt?: string;
  };
  monitored: {
    channels: string[];
    users: string[];
  };
  filters: {
    keywords: string[];
  };
  summary: {
    cronExpression: string;
    destination: string;
  };
  authorizedUsers: number[];
}

export const appConfig: Config = {
  telegram: {
    apiId: parseInt(getEnvVar('TELEGRAM_API_ID')),
    apiHash: getEnvVar('TELEGRAM_API_HASH'),
    stringSession: getEnvVar('TELEGRAM_STRING_SESSION'),
    botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
  },
  openrouter: {
    apiKey: getEnvVar('OPENROUTER_API_KEY'),
    model: getEnvVar('OPENROUTER_MODEL'),
    customPrompt: getEnvVar('OPENROUTER_CUSTOM_PROMPT', false) || undefined,
  },
  monitored: {
    channels: getEnvArray('MONITORED_CHANNELS'),
    users: getEnvArray('MONITORED_USERS'),
  },
  filters: {
    keywords: filterKeywords,
  },
  summary: {
    cronExpression: getEnvVar('SUMMARY_CRON_EXPRESSION'),
    destination: getEnvVar('SUMMARY_DESTINATION'),
  },
  authorizedUsers: getEnvArray('AUTHORIZED_USERS').map(id => parseInt(id)),
};

console.log('[DEBUG] Configuration loaded:');
console.log('[DEBUG] Monitored channels:', appConfig.monitored.channels);
console.log('[DEBUG] Monitored users:', appConfig.monitored.users);
console.log('[DEBUG] Keyword filter:', appConfig.filters.keywords.length > 0 ? appConfig.filters.keywords : 'disabled');
console.log('[DEBUG] Summary destination:', appConfig.summary.destination);

export function isAuthorizedUser(userId: number): boolean {
  return appConfig.authorizedUsers.includes(userId);
}

export function hasKeywordFilter(): boolean {
  return normalizedFilterKeywords.length > 0;
}

export function messageMatchesKeywordFilter(messageText: string): boolean {
  if (!hasKeywordFilter()) {
    return true;
  }

  const normalizedMessageText = normalizeKeywordText(messageText);
  return normalizedFilterKeywords.some(keyword => normalizedMessageText.includes(keyword));
}

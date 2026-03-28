# Telegram Summary Bot

> 🤖 **Vibe Coded** - This entire project was created using AI assistance. All code, documentation, and architecture decisions were generated with AI tools.

A TypeScript-based Telegram bot that monitors channels and users, summarizes messages using OpenRouter AI, and sends summaries to a designated destination.

## Features

- **Dual Telegram Connection**: Uses GramJS (MTProto) for listening to channels and Telegraf for sending summaries
- **OpenRouter Integration**: Summarizes messages using AI models (configurable)
- **Cron-based Scheduling**: Automatic summaries at configurable intervals
- **Manual Trigger**: `/summarize` command for authorized users
- **In-Memory Storage**: No database required, messages cleared after each summary
- **Docker Support**: Fully containerized with timezone support

## Prerequisites

- Node.js 20+
- Docker (optional)
- Telegram API credentials (from https://my.telegram.org)
- Telegram Bot Token (from @BotFather)
- OpenRouter API key

## Setup

### 1. Clone and Install

```bash
git clone <repository>
cd telegram-summary-bot
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Telegram MTProto (from https://my.telegram.org)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_STRING_SESSION=will_be_generated_once_with_npm_run_auth

# Telegram Bot (from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token

# OpenRouter (from https://openrouter.ai/keys)
OPENROUTER_API_KEY=your_api_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# What to monitor
MONITORED_CHANNELS=@channel1,@channel2,-1001234567890
MONITORED_USERS=@user1,123456789

# Optional: only store/process/summarize messages containing one of these keywords
# Supports multiple languages, including Persian
FILTER_KEYWORDS=bitcoin,btc,بیت کوین

# Summary settings
SUMMARY_CRON_EXPRESSION=0 */6 * * *
SUMMARY_DESTINATION=@summary_channel
AUTHORIZED_USERS=123456789,987654321

# Timezone
TZ=UTC
```

### 3. Generate String Session

`TELEGRAM_STRING_SESSION` is the saved login session for the Telegram MTProto client used by GramJS. It allows the app to connect to your Telegram account without asking for the login code every time it starts.

Run the authentication utility to generate your string session:

```bash
npm run auth
```

Follow the prompts to:
1. Enter your API ID and API Hash
2. Enter your phone number
3. Enter the verification code
4. Enter 2FA password (if enabled)

The generated session can be reused in production. A common workflow is:

1. Run `npm run auth` on your local machine
2. Copy the generated `TELEGRAM_STRING_SESSION` into the server `.env`
3. Deploy and start the app on the server

Notes:

- You usually only need to generate it once
- It should work on another machine or server as long as you use the same `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and Telegram account
- Treat it like a password or API secret
- If you revoke Telegram sessions or Telegram invalidates it, generate a new one
- The auth script will automatically save the generated value into your local `.env`

### 4. Run with Docker (Recommended)

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f telegram-summary-bot

# Stop
docker-compose down
```

### 5. Run Without Docker

```bash
# Build
npm run build

# Start
npm start

# Development mode
npm run dev
```

## Usage

### Bot Commands

- `/start` - Show welcome message and available commands
- `/status` - Check bot status and message count
- `/summarize` - Generate summary immediately (authorized users only)

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_API_ID` | Yes | Telegram API ID from my.telegram.org |
| `TELEGRAM_API_HASH` | Yes | Telegram API Hash from my.telegram.org |
| `TELEGRAM_STRING_SESSION` | Yes | Saved Telegram login session for GramJS; generate once with `npm run auth` and reuse in production |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | Model name for summarization |
| `MONITORED_CHANNELS` | No | Comma-separated list of channel IDs/usernames |
| `MONITORED_USERS` | No | Comma-separated list of user IDs/usernames |
| `FILTER_KEYWORDS` | No | Comma-separated keywords; when set, only messages containing at least one keyword are stored, processed, and summarized |
| `SUMMARY_CRON_EXPRESSION` | Yes | Cron expression for automatic summaries |
| `SUMMARY_DESTINATION` | Yes | Where to send summaries (channel/user ID) |
| `AUTHORIZED_USERS` | Yes | User IDs allowed to use /summarize |
| `TZ` | No | Timezone (default: UTC) |

### Cron Expression Examples

- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours
- `0 0 * * *` - Daily at midnight
- `0 9,18 * * 1-5` - At 9 AM and 6 PM on weekdays

## Architecture

- **GramJS Client**: MTProto client that listens to messages from monitored channels/users
- **Message Store**: In-memory storage for messages between summaries
- **Telegraf Bot**: Handles commands and sends summaries
- **OpenRouter Summarizer**: Sends messages to OpenRouter for AI-powered summarization
- **Cron Scheduler**: Triggers automatic summaries based on cron expression

## License

MIT

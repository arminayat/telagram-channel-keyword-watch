import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { Api } from 'telegram/tl';
import { appConfig, hasKeywordFilter, messageMatchesKeywordFilter } from './config';
import { messageStore, StoredMessage } from './message-store';

export class GramJSClient {
  private client: TelegramClient;
  private isConnected: boolean = false;

  constructor() {
    const session = new StringSession(appConfig.telegram.stringSession);
    this.client = new TelegramClient(
      session,
      appConfig.telegram.apiId,
      appConfig.telegram.apiHash,
      {
        connectionRetries: 5,
      }
    );
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    await this.client.connect();
    this.isConnected = true;
    console.log('GramJS client connected');

    // IMPORTANT: Initialize updates properly
    console.log('[DEBUG] Initializing updates...');
    try {
      // Get initial state to start receiving updates
      const state = await this.client.invoke(new Api.updates.GetState());
      console.log('[DEBUG] Updates state:', {
        pts: (state as any).pts,
        qts: (state as any).qts,
        date: new Date((state as any).date * 1000).toISOString(),
      });
    } catch (err) {
      console.log('[DEBUG] Could not get updates state:', err);
    }

    await this.setupMessageHandler();
    await this.subscribeToMonitored();
    
    // Test channel access after a short delay
    setTimeout(() => {
      this.testFetchMessages();
    }, 5000);
  }

  private updateCount = 0;
  
  private async setupMessageHandler(): Promise<void> {
    console.log('[DEBUG] Setting up message event handler...');
    
    // Catch-all raw updates handler - log EVERYTHING
    this.client.addEventHandler(async (update: any) => {
      this.updateCount++;
      const updateType = update?.className || 'Unknown';
      
      // Log all update types with counter
      if (this.updateCount % 10 === 0) {
        console.log(`[DEBUG] Total updates received: ${this.updateCount}`);
      }
      
      // Always log UpdateNewChannelMessage and UpdateNewMessage
      if (updateType.includes('Message') || updateType.includes('Channel')) {
        console.log(`[DEBUG] UPDATE #${this.updateCount}: ${updateType}`);
        if (update.message) {
          console.log(`[DEBUG]   -> Has message: true, ID: ${update.message.id}`);
          console.log(`[DEBUG]   -> Message peerId: ${update.message.peerId?.className}`);
        }
      }
      
      // Handle channel messages specifically
      if (updateType === 'UpdateNewChannelMessage' && update.message) {
        console.log('[DEBUG] ✓✓✓ CHANNEL MESSAGE DETECTED ✓✓✓');
        await this.processMessage(update.message);
      }
      // Handle regular messages
      else if (updateType === 'UpdateNewMessage' && update.message) {
        console.log('[DEBUG] ✓✓✓ REGULAR MESSAGE DETECTED ✓✓✓');
        await this.processMessage(update.message);
      }
    });
    
    console.log('[DEBUG] Message handlers registered');
    console.log('[DEBUG] Waiting for updates... (send a message to a monitored channel to test)');
  }
  
  private async processMessage(message: any): Promise<void> {
    console.log('\n[DEBUG] ========== PROCESSING MESSAGE ==========');
    
    // Check for text or caption
    const messageContent = message.text || message.caption || message.message;
    const hasMedia = !!message.photo || !!message.video || !!message.document;
    
    console.log('[DEBUG] Message ID:', message.id);
    console.log('[DEBUG] Date:', new Date(message.date * 1000).toISOString());
    console.log('[DEBUG] Class:', message.className);
    
    if (!messageContent) {
      console.log('[DEBUG] ⚠ No text/caption, skipping');
      return;
    }
    
    console.log('[DEBUG] Content preview:', messageContent.substring(0, 80));
    console.log('[DEBUG] Has media:', hasMedia);

    if (hasKeywordFilter() && !messageMatchesKeywordFilter(messageContent)) {
      console.log('[DEBUG] ✗ Message did not match FILTER_KEYWORDS, skipping');
      console.log('[DEBUG] ========== END MESSAGE ==========\n');
      return;
    }

    // Get chat identification
    let chatId: string | undefined;
    let peerType: string = 'unknown';
    
    if (message.peerId) {
      peerType = message.peerId.className;
      console.log('[DEBUG] Peer type:', peerType);
      
      if (message.peerId.className === 'PeerUser') {
        chatId = message.peerId.userId.toString();
      } else if (message.peerId.className === 'PeerChannel') {
        chatId = message.peerId.channelId.toString();
        // Channels need -100 prefix
        chatId = `-100${chatId}`;
      } else if (message.peerId.className === 'PeerChat') {
        chatId = message.peerId.chatId.toString();
        chatId = `-${chatId}`;
      }
    }
    
    console.log('[DEBUG] Resolved chatId:', chatId);
    
    if (!chatId) {
      console.log('[DEBUG] ✗ No chatId, skipping');
      return;
    }

    // Fetch entity
    let chatUsername: string | undefined;
    let chatTitle: string | undefined;
    
    try {
      const entity = await this.client.getEntity(chatId);
      console.log('[DEBUG] Entity fetched:', entity.className);
      
      if (entity.className === 'Channel') {
        chatUsername = (entity as any).username;
        chatTitle = (entity as any).title;
      } else if (entity.className === 'User') {
        chatUsername = (entity as any).username;
        chatTitle = (entity as any).firstName;
      }
      
      console.log('[DEBUG] Username:', chatUsername, '| Title:', chatTitle);
    } catch (err) {
      console.log('[DEBUG] ✗ Failed to fetch entity:', err);
    }

    // Match against monitored
    const allMonitored = [...appConfig.monitored.channels, ...appConfig.monitored.users];
    console.log('[DEBUG] Monitoring:', allMonitored.length, 'items');
    
    // Create variations to match
    const variations = [
      chatId,
      chatId?.replace(/^-100/, ''),
      chatId?.replace(/^-/, ''),
      chatUsername,
      chatTitle,
      chatUsername ? `@${chatUsername}` : undefined,
    ].filter((v): v is string => !!v);
    
    console.log('[DEBUG] Checking variations:', variations);
    
    let matched = false;
    let matchedConfig: string | undefined;
    
    for (const c of allMonitored) {
      for (const v of variations) {
        if (c.toLowerCase() === v.toLowerCase()) {
          matched = true;
          matchedConfig = c;
          console.log(`[DEBUG] ✓ MATCHED: "${c}" === "${v}"`);
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      console.log('[DEBUG] ✗ No match found, skipping');
      console.log('[DEBUG] ========== END MESSAGE ==========\n');
      return;
    }

    console.log('[DEBUG] ✓✓✓ STORING MESSAGE ✓✓✓');

    const storedMessage: StoredMessage = {
      id: message.id,
      channelId: chatId,
      channelName: chatTitle || chatUsername || chatId,
      text: messageContent,
      hasMedia: hasMedia,
      timestamp: new Date(message.date * 1000),
      author: message.sender?.firstName || message.sender?.username || undefined,
    };

    messageStore.addMessage(chatId, storedMessage);
    const mediaNote = hasMedia ? '[📷] ' : '';
    console.log(`✅ STORED: ${mediaNote}${storedMessage.channelName}: ${storedMessage.text.substring(0, 50)}...`);
    console.log('[DEBUG] ========== MESSAGE STORED ==========\n');
  }

  private channelLastMessageIds: Map<string, number> = new Map();
  private pollingInterval?: NodeJS.Timeout;

  private async subscribeToMonitored(): Promise<void> {
    console.log('\n[DEBUG] ========== SUBSCRIBING TO CHANNELS ==========');
    
    for (const channel of appConfig.monitored.channels) {
      try {
        console.log(`\n[DEBUG] Processing channel: ${channel}`);
        
        const entity = await this.client.getEntity(channel);
        console.log(`[DEBUG] Entity type: ${entity.className}`);
        
        if (entity.className === 'Channel') {
          // Get latest message ID for polling
          const messages = await this.client.getMessages(entity, { limit: 1 });
          if (messages.length > 0) {
            this.channelLastMessageIds.set(channel, messages[0].id);
            console.log(`[DEBUG] Latest message ID: ${messages[0].id}`);
          }
          
          console.log(`[DEBUG] ✓ Channel ready: ${channel}`);
        }
      } catch (error) {
        console.error(`[DEBUG] ✗ Failed to process ${channel}:`, error);
      }
    }

    console.log('\n[DEBUG] ========== SUBSCRIBING TO USERS ==========');
    for (const user of appConfig.monitored.users) {
      try {
        console.log(`[DEBUG] Processing user: ${user}`);
        const entity = await this.client.getEntity(user);
        console.log(`[DEBUG] ✓ ${user} - Type: ${entity.className}`);
      } catch (error) {
        console.error(`[DEBUG] ✗ Failed to get ${user}:`, error);
      }
    }
    
    console.log('[DEBUG] ========== SUBSCRIPTION COMPLETE ==========\n');
    
    // Start polling for channels (fallback for real-time updates)
    this.startChannelPolling();
  }

  private startChannelPolling(): void {
    console.log('[DEBUG] Starting channel polling (every 30 seconds)...');
    
    this.pollingInterval = setInterval(async () => {
      for (const channel of appConfig.monitored.channels) {
        try {
          const entity = await this.client.getEntity(channel);
          const lastId = this.channelLastMessageIds.get(channel) || 0;
          
          // Get new messages since last check
          const messages = await this.client.getMessages(entity, { 
            limit: 20,
            minId: lastId,
          });
          
          if (messages.length > 0) {
            console.log(`[DEBUG] POLL: Found ${messages.length} new messages in ${channel}`);
            
            // Process new messages (reverse to get chronological order)
            for (const msg of messages.reverse()) {
              if (msg.id > lastId) {
                await this.processMessage(msg);
                this.channelLastMessageIds.set(channel, msg.id);
              }
            }
          }
        } catch (err) {
          console.log(`[DEBUG] POLL: Error checking ${channel}:`, err);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      console.log('[DEBUG] Channel polling stopped');
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    this.stopPolling();
    await this.client.disconnect();
    this.isConnected = false;
    console.log('GramJS client disconnected');
  }

  getClient(): TelegramClient {
    return this.client;
  }

  // Test function to manually fetch messages from channels
  async testFetchMessages(): Promise<void> {
    console.log('\n[DEBUG] ========== TESTING CHANNEL ACCESS ==========');
    
    for (const channel of appConfig.monitored.channels) {
      try {
        console.log(`\n[DEBUG] Testing: ${channel}`);
        const entity = await this.client.getEntity(channel);
        
        if (entity.className === 'Channel') {
          console.log(`[DEBUG] Channel entity found: ${(entity as any).title}`);
          
          // Try to get recent messages
          const messages = await this.client.getMessages(entity, { limit: 5 });
          console.log(`[DEBUG] ✓ Successfully fetched ${messages.length} messages`);
          
          messages.forEach((msg: any, i: number) => {
            const preview = msg.text || msg.caption || '[no text]';
            console.log(`[DEBUG]   ${i + 1}. ${preview.substring(0, 50)}...`);
          });
        }
      } catch (error) {
        console.error(`[DEBUG] ✗ Failed to fetch from ${channel}:`, error);
      }
    }
    
    console.log('[DEBUG] ========== TEST COMPLETE ==========\n');
  }
}

export const gramjsClient = new GramJSClient();

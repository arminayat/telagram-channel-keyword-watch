export interface StoredMessage {
  id: number;
  channelId: string;
  channelName?: string;
  text: string;
  hasMedia?: boolean;
  timestamp: Date;
  author?: string;
}

class MessageStore {
  private messages: Map<string, StoredMessage[]> = new Map();
  private lastSummaryTime: Date = new Date();

  addMessage(channelId: string, message: StoredMessage): void {
    console.log(`[DEBUG] MessageStore.addMessage() called for channelId: ${channelId}`);
    
    if (!this.messages.has(channelId)) {
      console.log(`[DEBUG] Creating new message array for channel: ${channelId}`);
      this.messages.set(channelId, []);
    }
    
    this.messages.get(channelId)!.push(message);
    const totalCount = this.getMessageCount();
    const channelCount = this.messages.get(channelId)!.length;
    
    console.log(`[DEBUG] Message added. Channel count: ${channelCount}, Total count: ${totalCount}`);
  }

  getMessagesSince(channelId: string, since: Date): StoredMessage[] {
    const messages = this.messages.get(channelId) || [];
    return messages.filter(m => m.timestamp >= since);
  }

  getAllMessagesSince(since: Date): StoredMessage[] {
    const allMessages: StoredMessage[] = [];
    for (const messages of this.messages.values()) {
      allMessages.push(...messages.filter(m => m.timestamp >= since));
    }
    return allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getAllMessages(): StoredMessage[] {
    const allMessages: StoredMessage[] = [];
    for (const messages of this.messages.values()) {
      allMessages.push(...messages);
    }
    return allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getChannels(): string[] {
    return Array.from(this.messages.keys());
  }

  clear(): void {
    this.messages.clear();
    this.lastSummaryTime = new Date();
  }

  getLastSummaryTime(): Date {
    return this.lastSummaryTime;
  }

  getMessageCount(): number {
    let count = 0;
    for (const messages of this.messages.values()) {
      count += messages.length;
    }
    return count;
  }
}

export const messageStore = new MessageStore();

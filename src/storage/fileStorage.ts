import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';
import { MqttMessage, SubscriptionInfo } from '../types';

// Configure logger for storage (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

/**
 * File-based storage for MQTT messages and subscriptions
 */
export class FileStorage {
  private readonly dataDir: string;
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB

  constructor(dataDir: string = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
  }

  /**
   * Save messages to JSON file
   */
  public async saveMessages(connectionId: string, messages: MqttMessage[]): Promise<void> {
    try {
      await this.ensureDataDirectory();

      const fileName = `messages_${connectionId}.json`;
      const filePath = path.join(this.dataDir, fileName);

      // Check if file needs rotation
      await this.rotateFileIfNeeded(filePath);

      // Serialize messages, handling Buffer payloads
      const serializedMessages = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
        payload: Buffer.isBuffer(msg.payload) ? msg.payload : msg.payload
      }));

      const jsonData = JSON.stringify(serializedMessages, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf8');

      logger.info('Messages saved to file', { 
        connectionId, 
        messageCount: messages.length,
        filePath 
      });

    } catch (error) {
      logger.error('Failed to save messages', { 
        connectionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Load messages from JSON file
   */
  public async loadMessages(connectionId: string): Promise<MqttMessage[]> {
    try {
      const fileName = `messages_${connectionId}.json`;
      const filePath = path.join(this.dataDir, fileName);

      const jsonData = await fs.readFile(filePath, 'utf8');
      const rawMessages = JSON.parse(jsonData);

      // Deserialize messages, restoring Buffer payloads and Date objects
      const messages: MqttMessage[] = rawMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        payload: this.deserializePayload(msg.payload)
      }));

      logger.info('Messages loaded from file', { 
        connectionId, 
        messageCount: messages.length,
        filePath 
      });

      return messages;

    } catch (error) {
      if (error instanceof Error && error.message.includes('no such file')) {
        logger.info('No existing messages file found', { connectionId });
        return [];
      }

      logger.warn('Failed to load messages, returning empty array', { 
        connectionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Save subscription information
   */
  public async saveSubscriptions(subscriptions: SubscriptionInfo[]): Promise<void> {
    try {
      await this.ensureDataDirectory();

      const filePath = path.join(this.dataDir, 'subscriptions.json');

      // Serialize subscriptions
      const serializedSubscriptions = subscriptions.map(sub => ({
        ...sub,
        subscribedAt: sub.subscribedAt.toISOString()
      }));

      const jsonData = JSON.stringify(serializedSubscriptions, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf8');

      logger.info('Subscriptions saved to file', { 
        subscriptionCount: subscriptions.length,
        filePath 
      });

    } catch (error) {
      logger.error('Failed to save subscriptions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Load subscription information
   */
  public async loadSubscriptions(): Promise<SubscriptionInfo[]> {
    try {
      const filePath = path.join(this.dataDir, 'subscriptions.json');

      const jsonData = await fs.readFile(filePath, 'utf8');
      const rawSubscriptions = JSON.parse(jsonData);

      // Deserialize subscriptions, restoring Date objects
      const subscriptions: SubscriptionInfo[] = rawSubscriptions.map((sub: any) => ({
        ...sub,
        subscribedAt: new Date(sub.subscribedAt)
      }));

      logger.info('Subscriptions loaded from file', { 
        subscriptionCount: subscriptions.length,
        filePath 
      });

      return subscriptions;

    } catch (error) {
      if (error instanceof Error && error.message.includes('no such file')) {
        logger.info('No existing subscriptions file found');
        return [];
      }

      logger.warn('Failed to load subscriptions, returning empty array', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Clear old message files
   */
  public async clearOldMessages(daysToKeep: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const files = await fs.readdir(this.dataDir);
      const messageFiles = files.filter(file => file.startsWith('messages_') && file.endsWith('.json'));

      let deletedCount = 0;

      for (const file of messageFiles) {
        const filePath = path.join(this.dataDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
            logger.info('Deleted old message file', { file, lastModified: stats.mtime });
          }
        } catch (error) {
          logger.warn('Failed to process file during cleanup', { 
            file, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      logger.info('Message cleanup completed', { 
        daysToKeep, 
        filesDeleted: deletedCount,
        totalFiles: messageFiles.length 
      });

    } catch (error) {
      logger.error('Failed to clear old messages', { 
        daysToKeep,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { 
        dataDir: this.dataDir,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Rotate file if it exceeds size limit
   */
  private async rotateFileIfNeeded(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.maxFileSize) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copyFile(filePath, backupPath);
        
        logger.info('File rotated due to size limit', { 
          originalFile: filePath,
          backupFile: backupPath,
          size: stats.size,
          maxSize: this.maxFileSize 
        });
      }
    } catch (error) {
      // File doesn't exist, no need to rotate
      if (error instanceof Error && error.message.includes('no such file')) {
        return;
      }
      
      logger.warn('Failed to check file size for rotation', { 
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Deserialize payload, handling Buffer objects
   */
  private deserializePayload(payload: any): string | Buffer {
    if (payload && typeof payload === 'object' && payload.type === 'Buffer' && Array.isArray(payload.data)) {
      return Buffer.from(payload.data);
    }
    return payload;
  }
}
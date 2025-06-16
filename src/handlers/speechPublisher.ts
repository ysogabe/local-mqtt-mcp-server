import winston from 'winston';
import { MqttManager } from '../mqttManager';
import { SpeechPayload, generateMessageId } from '../types';
import { ConfigManager } from '../config/ConfigManager';

// Configure logger for speech publisher (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

/**
 * Speech Publisher for AITuber integration
 * Handles publishing speech messages to MQTT topics for AITuber to consume
 */
export class SpeechPublisher {
  private readonly mqttManager: MqttManager;

  constructor() {
    this.mqttManager = MqttManager.getInstance();
  }

  /**
   * Publish speech payload to AITuber topic
   */
  public async publishSpeech(connectionId: string, payload: SpeechPayload): Promise<void> {
    try {
      logger.info('Publishing speech message', { 
        connectionId, 
        priority: payload.priority,
        hasText: !!payload.text 
      });

      // Enhance payload with defaults first
      const enhancedPayload = this.enhancePayload(payload);

      // Then validate the enhanced payload
      this.validateSpeechPayload(enhancedPayload);

      // Determine topic based on priority
      const topic = this.getTopicForPriority(enhancedPayload.priority);

      // Publish to MQTT
      await this.mqttManager.publish(
        connectionId,
        topic,
        JSON.stringify(enhancedPayload)
      );

      logger.info('Speech message published successfully', { 
        connectionId, 
        topic,
        messageId: enhancedPayload.id 
      });

    } catch (error) {
      logger.error('Failed to publish speech message', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error(`Failed to publish speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publish alert message with high priority
   */
  public async publishAlert(connectionId: string, text: string, priority: 'high' | 'medium' | 'low' = 'high'): Promise<void> {
    const alertPayload: SpeechPayload = {
      id: generateMessageId(),
      text,
      type: 'alert',
      priority,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'mqtt-mcp-server',
        createdAt: new Date().toISOString()
      }
    };

    await this.publishSpeech(connectionId, alertPayload);
  }

  /**
   * Publish notification message with medium priority
   */
  public async publishNotification(connectionId: string, text: string, category: string): Promise<void> {
    const notificationPayload: SpeechPayload = {
      id: generateMessageId(),
      text,
      type: 'notification',
      priority: 'medium',
      timestamp: new Date().toISOString(),
      metadata: {
        category,
        source: 'mqtt-mcp-server',
        createdAt: new Date().toISOString()
      }
    };

    await this.publishSpeech(connectionId, notificationPayload);
  }

  /**
   * Validate speech payload
   */
  private validateSpeechPayload(payload: SpeechPayload): void {
    // Check required fields
    if (!payload.id) {
      throw new Error('Invalid speech payload: missing required field "id"');
    }

    if (!payload.text) {
      throw new Error('Invalid speech payload: missing required field "text"');
    }

    if (!payload.text.trim()) {
      throw new Error('Invalid speech payload: text cannot be empty');
    }

    if (!payload.type) {
      throw new Error('Invalid speech payload: missing required field "type"');
    }

    if (!payload.priority) {
      throw new Error('Invalid speech payload: missing required field "priority"');
    }

    if (!payload.timestamp) {
      throw new Error('Invalid speech payload: missing required field "timestamp"');
    }

    // Validate type values
    const validTypes = ['speech', 'alert', 'notification'];
    if (!validTypes.includes(payload.type)) {
      throw new Error(`Invalid type: ${payload.type}`);
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(payload.priority)) {
      throw new Error(`Invalid priority level: ${payload.priority}`);
    }

    // Validate emotion if present
    if (payload.emotion) {
      const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'relaxed', 'surprised'];
      if (!validEmotions.includes(payload.emotion)) {
        throw new Error(`Invalid emotion: ${payload.emotion}`);
      }
    }

    // Validate numeric fields if present
    if (payload.speed !== undefined && (typeof payload.speed !== 'number' || payload.speed <= 0)) {
      throw new Error('Invalid speech payload: speed must be a positive number');
    }

    if (payload.pitch !== undefined && typeof payload.pitch !== 'number') {
      throw new Error('Invalid speech payload: pitch must be a number');
    }

    // Validate timestamp format
    try {
      new Date(payload.timestamp);
    } catch (error) {
      throw new Error(`Invalid timestamp format: ${payload.timestamp}`);
    }
  }

  /**
   * Enhance payload with default values and generated fields
   */
  private enhancePayload(payload: SpeechPayload): SpeechPayload {
    const enhanced: SpeechPayload = { ...payload };

    // Add message ID if not present
    if (!enhanced.id) {
      enhanced.id = generateMessageId();
    }

    // Add type if not present
    if (!enhanced.type) {
      enhanced.type = 'speech';
    }

    // Add timestamp if not present
    if (!enhanced.timestamp) {
      enhanced.timestamp = new Date().toISOString();
    }

    // Ensure metadata exists
    if (!enhanced.metadata) {
      enhanced.metadata = {};
    }

    // Add source information
    enhanced.metadata.source = 'mqtt-mcp-server';
    enhanced.metadata.publishedAt = new Date().toISOString();

    logger.debug('Enhanced speech payload', { 
      messageId: enhanced.id,
      type: enhanced.type,
      priority: enhanced.priority,
      hasMetadata: !!enhanced.metadata 
    });

    return enhanced;
  }

  /**
   * Get MQTT topic based on type and priority
   */
  private getTopicForPriority(priority: string): string {
    const configManager = ConfigManager.getInstance();
    const topics = configManager.getAituberTopics();

    switch (priority) {
      case 'low':
      case 'medium':
        return topics.speech;
      case 'high':
        return topics.alert;
      default:
        logger.warn('Unknown priority, using normal topic', { priority });
        return topics.speech;
    }
  }
}
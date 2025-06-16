import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import winston from 'winston';
import {
  MqttConnection,
  MqttMessage,
  SubscriptionInfo,
  MessageCallback,
  generateMessageId,
  MqttConnectionOptions
} from './types';

// Configure logger (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

interface ConnectionInfo extends MqttConnection {
  client: MqttClient;
}

interface ConnectionOptions extends MqttConnectionOptions {
  brokerUrl: string;
}

/**
 * MQTT Manager - Singleton class for managing MQTT connections
 */
export class MqttManager {
  private static instance: MqttManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private messages: Map<string, MqttMessage[]> = new Map();
  private subscriptions: Map<string, SubscriptionInfo[]> = new Map();
  private readonly MAX_MESSAGES = 1000;

  private constructor() {
    logger.info('MQTT Manager initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MqttManager {
    if (!MqttManager.instance) {
      MqttManager.instance = new MqttManager();
    }
    return MqttManager.instance;
  }

  /**
   * Connect to MQTT broker
   */
  public async connect(id: string, options: ConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to MQTT broker: ${options.brokerUrl}`, { connectionId: id });

        // Extract broker URL and connection options
        const { brokerUrl, ...mqttOptions } = options;
        
        const client = mqtt.connect(brokerUrl, mqttOptions);

        // Create connection info
        const connectionInfo: ConnectionInfo = {
          id,
          brokerUrl,
          status: 'connecting',
          options: mqttOptions,
          client
        };

        this.connections.set(id, connectionInfo);
        this.messages.set(id, []);
        this.subscriptions.set(id, []);

        // Handle connection events
        client.on('connect', () => {
          logger.info(`MQTT client connected`, { connectionId: id });
          connectionInfo.status = 'connected';
          connectionInfo.connectedAt = new Date();
          resolve();
        });

        client.on('error', (error) => {
          logger.error(`MQTT connection error`, { connectionId: id, error: error.message });
          connectionInfo.status = 'error';
          connectionInfo.error = error.message;
          reject(error);
        });

        client.on('close', () => {
          logger.info(`MQTT client disconnected`, { connectionId: id });
          connectionInfo.status = 'disconnected';
          connectionInfo.disconnectedAt = new Date();
        });

        client.on('message', (topic, payload, packet) => {
          this.handleInboundMessage(id, topic, payload, packet);
        });

        // Set connection timeout
        const timeout = setTimeout(() => {
          if (connectionInfo.status === 'connecting') {
            client.end();
            reject(new Error('Connection timeout'));
          }
        }, (mqttOptions.connectTimeout || 30) * 1000);

        client.on('connect', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        logger.error(`Failed to connect to MQTT broker`, { connectionId: id, error });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  public async disconnect(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionInfo = this.connections.get(id);
      if (!connectionInfo) {
        reject(new Error(`Connection ${id} not found`));
        return;
      }

      logger.info(`Disconnecting MQTT client`, { connectionId: id });

      connectionInfo.client.end(false, (error) => {
        if (error) {
          logger.error(`Error disconnecting MQTT client`, { connectionId: id, error: error.message });
          reject(error);
        } else {
          connectionInfo.status = 'disconnected';
          connectionInfo.disconnectedAt = new Date();
          logger.info(`MQTT client disconnected successfully`, { connectionId: id });
          resolve();
        }
      });
    });
  }

  /**
   * Publish message to MQTT topic
   */
  public async publish(connectionId: string, topic: string, message: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo) {
        reject(new Error(`Connection ${connectionId} not found`));
        return;
      }

      if (connectionInfo.status !== 'connected') {
        reject(new Error(`Connection ${connectionId} is not connected`));
        return;
      }

      const payload = typeof message === 'string' ? message : message;
      
      connectionInfo.client.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          logger.error(`Failed to publish message`, { connectionId, topic, error: error.message });
          reject(error);
        } else {
          logger.info(`Message published`, { connectionId, topic });
          
          // Store outbound message
          this.storeMessage({
            id: generateMessageId(),
            connectionId,
            topic,
            payload: message,
            timestamp: new Date(),
            qos: 1,
            retain: false,
            direction: 'outbound'
          });

          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to MQTT topic
   */
  public async subscribe(connectionId: string, topic: string, callback: MessageCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo) {
        reject(new Error(`Connection ${connectionId} not found`));
        return;
      }

      if (connectionInfo.status !== 'connected') {
        reject(new Error(`Connection ${connectionId} is not connected`));
        return;
      }

      connectionInfo.client.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          logger.error(`Failed to subscribe to topic`, { connectionId, topic, error: error.message });
          reject(error);
        } else {
          logger.info(`Subscribed to topic`, { connectionId, topic, granted });
          
          // Store subscription info
          const subscriptions = this.subscriptions.get(connectionId) || [];
          subscriptions.push({
            connectionId,
            topic,
            qos: 1,
            subscribedAt: new Date()
          });
          this.subscriptions.set(connectionId, subscriptions);

          // Store callback for this subscription
          (connectionInfo as any)[`callback_${topic}`] = callback;

          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from MQTT topic
   */
  public async unsubscribe(connectionId: string, topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo) {
        reject(new Error(`Connection ${connectionId} not found`));
        return;
      }

      connectionInfo.client.unsubscribe(topic, (error) => {
        if (error) {
          logger.error(`Failed to unsubscribe from topic`, { connectionId, topic, error: error.message });
          reject(error);
        } else {
          logger.info(`Unsubscribed from topic`, { connectionId, topic });
          
          // Remove subscription info
          const subscriptions = this.subscriptions.get(connectionId) || [];
          const filteredSubscriptions = subscriptions.filter(sub => sub.topic !== topic);
          this.subscriptions.set(connectionId, filteredSubscriptions);

          // Remove callback
          delete (connectionInfo as any)[`callback_${topic}`];

          resolve();
        }
      });
    });
  }

  /**
   * Get all connections
   */
  public getConnections(): MqttConnection[] {
    return Array.from(this.connections.values()).map(({ client, ...connection }) => connection);
  }

  /**
   * Get messages for a connection, optionally filtered by topic
   */
  public getMessages(connectionId: string, topic?: string): MqttMessage[] {
    const messages = this.messages.get(connectionId) || [];
    
    if (topic) {
      return messages.filter(msg => msg.topic === topic);
    }
    
    return [...messages]; // Return a copy
  }

  /**
   * Handle inbound message
   */
  private handleInboundMessage(connectionId: string, topic: string, payload: Buffer, packet: any): void {
    logger.info(`Received message`, { connectionId, topic, size: payload.length });

    // Store inbound message
    this.storeMessage({
      id: generateMessageId(),
      connectionId,
      topic,
      payload,
      timestamp: new Date(),
      qos: packet.qos || 0,
      retain: packet.retain || false,
      direction: 'inbound'
    });

    // Call subscription callbacks
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo) {
      const callback = (connectionInfo as any)[`callback_${topic}`];
      if (callback) {
        try {
          callback(topic, payload, packet);
        } catch (error) {
          logger.error(`Error in message callback`, { connectionId, topic, error });
        }
      }
    }
  }

  /**
   * Store message and enforce buffer limits
   */
  private storeMessage(message: MqttMessage): void {
    const messages = this.messages.get(message.connectionId) || [];
    messages.push(message);
    
    // Enforce message limit
    if (messages.length > this.MAX_MESSAGES) {
      messages.splice(0, messages.length - this.MAX_MESSAGES);
    }
    
    this.messages.set(message.connectionId, messages);
  }

  /**
   * Limit message buffer for a connection (for testing)
   */
  public limitMessageBuffer(connectionId: string): void {
    const messages = this.messages.get(connectionId) || [];
    if (messages.length > this.MAX_MESSAGES) {
      messages.splice(0, messages.length - this.MAX_MESSAGES);
      this.messages.set(connectionId, messages);
    }
  }
}
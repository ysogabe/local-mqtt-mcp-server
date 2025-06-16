import winston from 'winston';
import { MqttManager } from '../mqttManager';
import { ToolResult, MessageCallback, SpeechPayload } from '../types';
import { SpeechPublisher } from './speechPublisher';

// Configure logger for handlers (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

/**
 * Helper function to validate required parameters
 */
function validateParams(params: any, requiredFields: string[]): string | null {
  const missing = requiredFields.filter(field => {
    const value = params[field];
    return value === undefined || value === null || value === '';
  });
  
  if (missing.length > 0) {
    return `Missing required parameters: ${missing.join(', ')}`;
  }
  
  return null;
}

/**
 * Handle MQTT connect tool
 */
export async function handleConnect(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling MQTT connect request', { params });

    // Validate required parameters
    const validation = validateParams(params, ['connectionId', 'brokerUrl']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const { connectionId, brokerUrl, ...options } = params;
    const mqttManager = MqttManager.getInstance();

    // Connect to MQTT broker
    await mqttManager.connect(connectionId, {
      brokerUrl,
      ...options
    });

    logger.info('MQTT connect successful', { connectionId, brokerUrl });

    return {
      success: true,
      data: {
        message: `Connected to MQTT broker: ${brokerUrl}`,
        connectionId
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MQTT connect failed', { error: errorMessage, params });

    return {
      success: false,
      error: `Failed to connect to MQTT broker: ${errorMessage}`
    };
  }
}

/**
 * Handle MQTT disconnect tool
 */
export async function handleDisconnect(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling MQTT disconnect request', { params });

    // Validate required parameters
    const validation = validateParams(params, ['connectionId']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const { connectionId } = params;
    const mqttManager = MqttManager.getInstance();

    // Disconnect from MQTT broker
    await mqttManager.disconnect(connectionId);

    logger.info('MQTT disconnect successful', { connectionId });

    return {
      success: true,
      data: {
        message: 'Disconnected from MQTT broker',
        connectionId
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MQTT disconnect failed', { error: errorMessage, params });

    return {
      success: false,
      error: `Failed to disconnect from MQTT broker: ${errorMessage}`
    };
  }
}

/**
 * Handle MQTT publish tool
 */
export async function handlePublish(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling MQTT publish request', { params: { ...params, message: '[REDACTED]' } });

    // Validate required parameters
    const validation = validateParams(params, ['connectionId', 'topic', 'message']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const { connectionId, topic, message } = params;
    const mqttManager = MqttManager.getInstance();

    // Publish message
    await mqttManager.publish(connectionId, topic, message);

    logger.info('MQTT publish successful', { connectionId, topic });

    return {
      success: true,
      data: {
        message: `Published message to topic: ${topic}`,
        connectionId,
        topic
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MQTT publish failed', { error: errorMessage, params: { ...params, message: '[REDACTED]' } });

    return {
      success: false,
      error: `Failed to publish message: ${errorMessage}`
    };
  }
}

/**
 * Handle MQTT subscribe tool
 */
export async function handleSubscribe(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling MQTT subscribe request', { params });

    // Validate required parameters
    const validation = validateParams(params, ['connectionId', 'topic']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const { connectionId, topic } = params;
    const mqttManager = MqttManager.getInstance();

    // Create message callback
    const messageCallback: MessageCallback = (receivedTopic: string, payload: Buffer, packet: any) => {
      logger.info('Received MQTT message', {
        connectionId,
        topic: receivedTopic,
        payloadSize: payload.length,
        qos: packet.qos,
        retain: packet.retain
      });
    };

    // Subscribe to topic
    await mqttManager.subscribe(connectionId, topic, messageCallback);

    logger.info('MQTT subscribe successful', { connectionId, topic });

    return {
      success: true,
      data: {
        message: `Subscribed to topic: ${topic}`,
        connectionId,
        topic
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MQTT subscribe failed', { error: errorMessage, params });

    return {
      success: false,
      error: `Failed to subscribe to topic: ${errorMessage}`
    };
  }
}

/**
 * Handle MQTT unsubscribe tool
 */
export async function handleUnsubscribe(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling MQTT unsubscribe request', { params });

    // Validate required parameters
    const validation = validateParams(params, ['connectionId', 'topic']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const { connectionId, topic } = params;
    const mqttManager = MqttManager.getInstance();

    // Unsubscribe from topic
    await mqttManager.unsubscribe(connectionId, topic);

    logger.info('MQTT unsubscribe successful', { connectionId, topic });

    return {
      success: true,
      data: {
        message: `Unsubscribed from topic: ${topic}`,
        connectionId,
        topic
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MQTT unsubscribe failed', { error: errorMessage, params });

    return {
      success: false,
      error: `Failed to unsubscribe from topic: ${errorMessage}`
    };
  }
}

/**
 * Handle AITuber speech publish tool
 */
export async function handleSpeechPublish(params: any): Promise<ToolResult> {
  try {
    logger.info('Handling AITuber speech publish request', { params: { ...params, text: '[REDACTED]' } });

    // Validate required parameters (connectionId is optional, will use default)
    const validation = validateParams(params, ['text', 'priority']);
    if (validation) {
      return {
        success: false,
        error: validation
      };
    }

    const speechData = { ...params };
    const mqttManager = MqttManager.getInstance();
    let connectionId = params.connectionId;

    // Handle connection logic
    const connections = mqttManager.getConnections();
    if (connectionId) {
      // If a connectionId is provided, ensure it exists
      const existingConnection = connections.find(conn => conn.id === connectionId);
      if (!existingConnection) {
        return {
          success: false,
          error: `Connection with ID "${connectionId}" not found. Please establish the connection first.`
        };
      }
    } else {
      // If no connectionId is provided, use the first available one
      if (connections.length > 0) {
        connectionId = connections[0].id;
        logger.info(`No connectionId specified, using the first available connection: ${connectionId}`);
      } else {
        // If no connections are available, auto-establish a default one
        connectionId = 'aituber-default';
        logger.info(`No active connections. Auto-establishing default connection: ${connectionId}`);
        try {
          await mqttManager.connect(connectionId, {
            brokerUrl: 'mqtt://192.168.0.131:1883',
            clientId: `aituber-mcp-${Date.now()}`,
            clean: true,
            keepalive: 60
          });
        } catch (connectError) {
          const errorMessage = connectError instanceof Error ? connectError.message : 'Unknown connection error';
          logger.error('Failed to auto-establish MQTT connection', { error: errorMessage });
          return {
            success: false,
            error: `Failed to auto-connect to AITuber MQTT broker: ${errorMessage}`
          };
        }
      }
    }
    
    // Normalize and validate priority
    let normalizedPriority: 'high' | 'medium' | 'low';
    const priority = (speechData.priority || '').toLowerCase();

    switch (priority) {
      case 'high':
      case 'urgent':
        normalizedPriority = 'high';
        break;
      case 'medium':
      case 'normal':
      case '': // Default to medium if not provided or empty
        normalizedPriority = 'medium';
        break;
      case 'low':
        normalizedPriority = 'low';
        break;
      default:
        return {
          success: false,
          error: `Invalid priority value: "${speechData.priority}". Accepted values are high, urgent, medium, normal, low.`
        };
    }
    
    // Validate speech payload format
    const speechPayload: SpeechPayload = {
      id: speechData.messageId || speechData.id || `aituber-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: speechData.text,
      type: speechData.type || 'speech',
      priority: normalizedPriority,
      timestamp: speechData.timestamp || new Date().toISOString(),
      speaker: speechData.speaker,
      emotion: speechData.emotion,
      voice: speechData.voice,
      speed: speechData.speed,
      pitch: speechData.pitch,
      metadata: speechData.metadata
    };

    const speechPublisher = new SpeechPublisher();
    await speechPublisher.publishSpeech(connectionId, speechPayload);

    logger.info('AITuber speech publish successful', { connectionId, priority: speechPayload.priority });

    return {
      success: true,
      data: {
        message: `Published speech message to AITuber with priority: ${speechPayload.priority}`,
        connectionId,
        priority: speechPayload.priority,
        type: speechPayload.type,
        messageId: speechPayload.id
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('AITuber speech publish failed', { error: errorMessage, params: { ...params, text: '[REDACTED]' } });

    return {
      success: false,
      error: `Failed to publish speech to AITuber: ${errorMessage}`
    };
  }
}
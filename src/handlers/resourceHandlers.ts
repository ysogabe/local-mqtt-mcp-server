import winston from 'winston';
import { MqttManager } from '../mqttManager';

// Configure logger for resource handlers (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

/**
 * Resource content interface
 */
interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Get connections resource showing all active MQTT connections
 */
export function getConnectionsResource(): ResourceContent {
  try {
    logger.info('Fetching connections resource');

    const mqttManager = MqttManager.getInstance();
    const connections = mqttManager.getConnections();

    logger.info('Retrieved connections', { count: connections.length });

    return {
      uri: 'mqtt://connections',
      mimeType: 'application/json',
      text: JSON.stringify(connections, null, 2)
    };

  } catch (error) {
    logger.error('Failed to get connections resource', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get subscriptions resource showing subscription information for a connection
 * This returns the messages for the connection as a way to show subscription activity
 */
export function getSubscriptionsResource(connectionId: string): ResourceContent {
  try {
    logger.info('Fetching subscriptions resource', { connectionId });

    const mqttManager = MqttManager.getInstance();
    const messages = mqttManager.getMessages(connectionId);

    logger.info('Retrieved subscription messages', { 
      connectionId, 
      messageCount: messages.length 
    });

    return {
      uri: `mqtt://subscriptions/${connectionId}`,
      mimeType: 'application/json',
      text: JSON.stringify(messages, null, 2)
    };

  } catch (error) {
    logger.error('Failed to get subscriptions resource', {
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get messages resource showing message history for a connection
 * Optionally filtered by topic
 */
export function getMessagesResource(connectionId: string, topic?: string): ResourceContent {
  try {
    logger.info('Fetching messages resource', { connectionId, topic });

    const mqttManager = MqttManager.getInstance();
    const messages = mqttManager.getMessages(connectionId, topic);

    logger.info('Retrieved messages', { 
      connectionId, 
      topic,
      messageCount: messages.length 
    });

    // Build URI with optional topic filter
    let uri = `mqtt://messages/${connectionId}`;
    if (topic) {
      uri += `?topic=${encodeURIComponent(topic)}`;
    }

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(messages, null, 2)
    };

  } catch (error) {
    logger.error('Failed to get messages resource', {
      connectionId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get connection status summary resource
 */
export function getConnectionStatusResource(): ResourceContent {
  try {
    logger.info('Fetching connection status resource');

    const mqttManager = MqttManager.getInstance();
    const connections = mqttManager.getConnections();

    // Create status summary
    const statusSummary = {
      totalConnections: connections.length,
      connectedCount: connections.filter(c => c.status === 'connected').length,
      disconnectedCount: connections.filter(c => c.status === 'disconnected').length,
      errorCount: connections.filter(c => c.status === 'error').length,
      connections: connections.map(conn => ({
        id: conn.id,
        brokerUrl: conn.brokerUrl,
        status: conn.status,
        connectedAt: conn.connectedAt,
        disconnectedAt: conn.disconnectedAt,
        error: conn.error
      }))
    };

    logger.info('Generated connection status summary', {
      total: statusSummary.totalConnections,
      connected: statusSummary.connectedCount,
      disconnected: statusSummary.disconnectedCount,
      errors: statusSummary.errorCount
    });

    return {
      uri: 'mqtt://status',
      mimeType: 'application/json',
      text: JSON.stringify(statusSummary, null, 2)
    };

  } catch (error) {
    logger.error('Failed to get connection status resource', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get topic statistics resource for a connection
 */
export function getTopicStatsResource(connectionId: string): ResourceContent {
  try {
    logger.info('Fetching topic statistics resource', { connectionId });

    const mqttManager = MqttManager.getInstance();
    const messages = mqttManager.getMessages(connectionId);

    // Calculate topic statistics
    const topicStats: Record<string, {
      topic: string;
      messageCount: number;
      lastMessage: Date | null;
      inboundCount: number;
      outboundCount: number;
    }> = {};

    messages.forEach(message => {
      const { topic, timestamp, direction } = message;
      
      if (!topicStats[topic]) {
        topicStats[topic] = {
          topic,
          messageCount: 0,
          lastMessage: null,
          inboundCount: 0,
          outboundCount: 0
        };
      }

      const stats = topicStats[topic];
      stats.messageCount++;
      
      if (!stats.lastMessage || timestamp > stats.lastMessage) {
        stats.lastMessage = timestamp;
      }

      if (direction === 'inbound') {
        stats.inboundCount++;
      } else {
        stats.outboundCount++;
      }
    });

    const statsArray = Object.values(topicStats)
      .sort((a, b) => b.messageCount - a.messageCount); // Sort by message count descending

    const summary = {
      connectionId,
      totalTopics: statsArray.length,
      totalMessages: messages.length,
      topicStatistics: statsArray
    };

    logger.info('Generated topic statistics', {
      connectionId,
      totalTopics: summary.totalTopics,
      totalMessages: summary.totalMessages
    });

    return {
      uri: `mqtt://topics/${connectionId}`,
      mimeType: 'application/json',
      text: JSON.stringify(summary, null, 2)
    };

  } catch (error) {
    logger.error('Failed to get topic statistics resource', {
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}
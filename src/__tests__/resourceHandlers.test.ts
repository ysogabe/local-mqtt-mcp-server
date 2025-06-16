import {
  getConnectionsResource,
  getSubscriptionsResource,
  getMessagesResource
} from '../handlers/resourceHandlers';
import { MqttManager } from '../mqttManager';

// Mock MqttManager
jest.mock('../mqttManager');

describe('Resource Handlers', () => {
  let mockMqttManager: jest.Mocked<MqttManager>;

  beforeEach(() => {
    mockMqttManager = {
      getConnections: jest.fn(),
      getMessages: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      limitMessageBuffer: jest.fn()
    } as any;

    (MqttManager.getInstance as jest.Mock).mockReturnValue(mockMqttManager);
    jest.clearAllMocks();
  });

  describe('getConnectionsResource', () => {
    it('should list active connections', () => {
      const mockConnections = [
        {
          id: 'conn-1',
          brokerUrl: 'mqtt://localhost:1883',
          status: 'connected' as const,
          connectedAt: new Date('2024-01-01T10:00:00Z'),
          options: {
            clientId: 'test-client-1'
          }
        },
        {
          id: 'conn-2',
          brokerUrl: 'mqtt://broker2:1883',
          status: 'disconnected' as const,
          disconnectedAt: new Date('2024-01-01T10:30:00Z'),
          options: {
            clientId: 'test-client-2'
          }
        }
      ];

      mockMqttManager.getConnections.mockReturnValue(mockConnections);

      const resource = getConnectionsResource();

      expect(resource).toEqual({
        uri: 'mqtt://connections',
        mimeType: 'application/json',
        text: JSON.stringify(mockConnections, null, 2)
      });

      expect(mockMqttManager.getConnections).toHaveBeenCalled();
    });

    it('should return empty array when no connections', () => {
      mockMqttManager.getConnections.mockReturnValue([]);

      const resource = getConnectionsResource();

      expect(resource).toEqual({
        uri: 'mqtt://connections',
        mimeType: 'application/json',
        text: JSON.stringify([], null, 2)
      });
    });

    it('should return connection status information', () => {
      const mockConnections = [
        {
          id: 'status-test',
          brokerUrl: 'mqtt://status-test:1883',
          status: 'error' as const,
          error: 'Connection timeout',
          options: {}
        }
      ];

      mockMqttManager.getConnections.mockReturnValue(mockConnections);

      const resource = getConnectionsResource();
      const parsedContent = JSON.parse(resource.text);

      expect(parsedContent[0].status).toBe('error');
      expect(parsedContent[0].error).toBe('Connection timeout');
    });
  });

  describe('getSubscriptionsResource', () => {
    it('should list subscriptions for a connection', () => {
      const connectionId = 'sub-conn';
      const mockMessages = [
        {
          id: 'msg-1',
          connectionId,
          topic: 'sensor/temperature',
          payload: '25.5',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 1 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getSubscriptionsResource(connectionId);

      expect(resource).toEqual({
        uri: `mqtt://subscriptions/${connectionId}`,
        mimeType: 'application/json',
        text: JSON.stringify(mockMessages, null, 2)
      });

      expect(mockMqttManager.getMessages).toHaveBeenCalledWith(connectionId);
    });

    it('should handle connection with no messages', () => {
      const connectionId = 'empty-conn';
      mockMqttManager.getMessages.mockReturnValue([]);

      const resource = getSubscriptionsResource(connectionId);

      expect(resource).toEqual({
        uri: `mqtt://subscriptions/${connectionId}`,
        mimeType: 'application/json',
        text: JSON.stringify([], null, 2)
      });
    });

    it('should include message metadata', () => {
      const connectionId = 'meta-conn';
      const mockMessages = [
        {
          id: 'msg-with-meta',
          connectionId,
          topic: 'sensor/+/data',
          payload: Buffer.from('Binary data'),
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 2 as const,
          retain: true,
          direction: 'outbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getSubscriptionsResource(connectionId);
      const parsedContent = JSON.parse(resource.text);

      expect(parsedContent[0].qos).toBe(2);
      expect(parsedContent[0].retain).toBe(true);
      expect(parsedContent[0].direction).toBe('outbound');
    });
  });

  describe('getMessagesResource', () => {
    it('should provide message history for connection', () => {
      const connectionId = 'msg-conn';
      const mockMessages = [
        {
          id: 'msg-1',
          connectionId,
          topic: 'test/topic',
          payload: 'Hello MQTT',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 1 as const,
          retain: false,
          direction: 'outbound' as const
        },
        {
          id: 'msg-2',
          connectionId,
          topic: 'test/response',
          payload: 'Response message',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          qos: 0 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId);

      expect(resource).toEqual({
        uri: `mqtt://messages/${connectionId}`,
        mimeType: 'application/json',
        text: JSON.stringify(mockMessages, null, 2)
      });

      expect(mockMqttManager.getMessages).toHaveBeenCalledWith(connectionId, undefined);
    });

    it('should filter messages by topic when provided', () => {
      const connectionId = 'filter-conn';
      const topic = 'sensor/temperature';
      const mockMessages = [
        {
          id: 'temp-msg',
          connectionId,
          topic,
          payload: '22.5',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 1 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId, topic);

      expect(resource).toEqual({
        uri: `mqtt://messages/${connectionId}?topic=${encodeURIComponent(topic)}`,
        mimeType: 'application/json',
        text: JSON.stringify(mockMessages, null, 2)
      });

      expect(mockMqttManager.getMessages).toHaveBeenCalledWith(connectionId, topic);
    });

    it('should handle wildcard topics in filter', () => {
      const connectionId = 'wildcard-conn';
      const topic = 'sensor/+/temperature';
      const mockMessages: any[] = [];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId, topic);

      expect(resource.uri).toBe(`mqtt://messages/${connectionId}?topic=${encodeURIComponent(topic)}`);
      expect(mockMqttManager.getMessages).toHaveBeenCalledWith(connectionId, topic);
    });

    it('should handle buffer payloads correctly', () => {
      const connectionId = 'buffer-conn';
      const mockMessages = [
        {
          id: 'binary-msg',
          connectionId,
          topic: 'binary/data',
          payload: Buffer.from('Binary content'),
          timestamp: new Date(),
          qos: 0 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId);
      
      // Verify the resource is created without throwing errors
      expect(resource.mimeType).toBe('application/json');
      expect(typeof resource.text).toBe('string');
      
      // Verify the JSON can be parsed
      const parsedContent = JSON.parse(resource.text);
      expect(parsedContent).toHaveLength(1);
      expect(parsedContent[0].topic).toBe('binary/data');
    });

    it('should return empty array for non-existent connection', () => {
      const connectionId = 'non-existent';
      mockMqttManager.getMessages.mockReturnValue([]);

      const resource = getMessagesResource(connectionId);

      expect(resource).toEqual({
        uri: `mqtt://messages/${connectionId}`,
        mimeType: 'application/json',
        text: JSON.stringify([], null, 2)
      });
    });
  });

  describe('Resource URI formatting', () => {
    it('should handle special characters in connection IDs', () => {
      const connectionId = 'conn-with-spaces and/special#chars';
      mockMqttManager.getMessages.mockReturnValue([]);
      
      const resource = getMessagesResource(connectionId);

      expect(resource.uri).toBe(`mqtt://messages/${connectionId}`);
    });

    it('should properly encode topic parameters', () => {
      const connectionId = 'test-conn';
      const topic = 'topic/with spaces/and#special';
      mockMqttManager.getMessages.mockReturnValue([]);
      
      const resource = getMessagesResource(connectionId, topic);

      expect(resource.uri).toBe(`mqtt://messages/${connectionId}?topic=${encodeURIComponent(topic)}`);
    });
  });

  describe('Error handling', () => {
    it('should handle MQTT manager errors gracefully', () => {
      mockMqttManager.getConnections.mockImplementation(() => {
        throw new Error('MQTT Manager error');
      });

      expect(() => getConnectionsResource()).toThrow('MQTT Manager error');
    });

    it('should handle message retrieval errors', () => {
      const connectionId = 'error-conn';
      mockMqttManager.getMessages.mockImplementation(() => {
        throw new Error('Message retrieval failed');
      });

      expect(() => getMessagesResource(connectionId)).toThrow('Message retrieval failed');
    });
  });

  describe('Data consistency', () => {
    it('should maintain message order in resources', () => {
      const connectionId = 'order-test';
      const mockMessages = [
        {
          id: 'msg-1',
          connectionId,
          topic: 'test/1',
          payload: 'First',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 0 as const,
          retain: false,
          direction: 'outbound' as const
        },
        {
          id: 'msg-2',
          connectionId,
          topic: 'test/2',
          payload: 'Second',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          qos: 0 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId);
      const parsedContent = JSON.parse(resource.text);

      expect(parsedContent[0].payload).toBe('First');
      expect(parsedContent[1].payload).toBe('Second');
    });

    it('should preserve message timestamps', () => {
      const connectionId = 'timestamp-test';
      const testDate = new Date('2024-01-01T10:00:00Z');
      const mockMessages = [
        {
          id: 'time-msg',
          connectionId,
          topic: 'test/time',
          payload: 'Timestamped message',
          timestamp: testDate,
          qos: 0 as const,
          retain: false,
          direction: 'inbound' as const
        }
      ];

      mockMqttManager.getMessages.mockReturnValue(mockMessages);

      const resource = getMessagesResource(connectionId);
      const parsedContent = JSON.parse(resource.text);

      expect(new Date(parsedContent[0].timestamp)).toEqual(testDate);
    });
  });
});
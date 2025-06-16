import {
  handleConnect,
  handleDisconnect,
  handlePublish,
  handleSubscribe,
  handleUnsubscribe
} from '../handlers/toolHandlers';
import { MqttManager } from '../mqttManager';

// Mock MqttManager
jest.mock('../mqttManager');

describe('Tool Handlers', () => {
  let mockMqttManager: jest.Mocked<MqttManager>;

  beforeEach(() => {
    mockMqttManager = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getConnections: jest.fn(),
      getMessages: jest.fn(),
      limitMessageBuffer: jest.fn()
    } as any;

    (MqttManager.getInstance as jest.Mock).mockReturnValue(mockMqttManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnect', () => {
    it('should handle mqtt_connect tool successfully', async () => {
      mockMqttManager.connect.mockResolvedValue(undefined);

      const params = {
        connectionId: 'test-conn',
        brokerUrl: 'mqtt://localhost:1883',
        clientId: 'test-client',
        username: 'user',
        password: 'pass'
      };

      const result = await handleConnect(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: `Connected to MQTT broker: ${params.brokerUrl}`,
        connectionId: params.connectionId
      });
      expect(mockMqttManager.connect).toHaveBeenCalledWith(params.connectionId, {
        brokerUrl: params.brokerUrl,
        clientId: params.clientId,
        username: params.username,
        password: params.password
      });
    });

    it('should validate required parameters', async () => {
      const params = {
        brokerUrl: 'mqtt://localhost:1883'
        // missing connectionId
      };

      const result = await handleConnect(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: connectionId');
      expect(mockMqttManager.connect).not.toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockMqttManager.connect.mockRejectedValue(new Error('Connection failed'));

      const params = {
        connectionId: 'error-conn',
        brokerUrl: 'mqtt://invalid:1883'
      };

      const result = await handleConnect(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to connect to MQTT broker: Connection failed');
    });
  });

  describe('handleDisconnect', () => {
    it('should handle mqtt_disconnect tool successfully', async () => {
      mockMqttManager.disconnect.mockResolvedValue(undefined);

      const params = {
        connectionId: 'test-disconnect'
      };

      const result = await handleDisconnect(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: `Disconnected from MQTT broker`,
        connectionId: params.connectionId
      });
      expect(mockMqttManager.disconnect).toHaveBeenCalledWith(params.connectionId);
    });

    it('should validate required parameters', async () => {
      const params = {}; // missing connectionId

      const result = await handleDisconnect(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: connectionId');
    });

    it('should handle disconnect errors', async () => {
      mockMqttManager.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      const params = {
        connectionId: 'error-conn'
      };

      const result = await handleDisconnect(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to disconnect from MQTT broker: Disconnect failed');
    });
  });

  describe('handlePublish', () => {
    it('should handle mqtt_publish tool successfully', async () => {
      mockMqttManager.publish.mockResolvedValue(undefined);

      const params = {
        connectionId: 'pub-conn',
        topic: 'test/topic',
        message: 'Hello MQTT'
      };

      const result = await handlePublish(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: `Published message to topic: ${params.topic}`,
        connectionId: params.connectionId,
        topic: params.topic
      });
      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        params.connectionId,
        params.topic,
        params.message
      );
    });

    it('should validate required parameters', async () => {
      const params = {
        connectionId: 'pub-conn'
        // missing topic and message
      };

      const result = await handlePublish(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: topic, message');
    });

    it('should handle publish errors', async () => {
      mockMqttManager.publish.mockRejectedValue(new Error('Publish failed'));

      const params = {
        connectionId: 'pub-conn',
        topic: 'test/error',
        message: 'Error message'
      };

      const result = await handlePublish(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to publish message: Publish failed');
    });

    it('should handle binary message data', async () => {
      mockMqttManager.publish.mockResolvedValue(undefined);

      const params = {
        connectionId: 'pub-conn',
        topic: 'test/binary',
        message: 'SGVsbG8gV29ybGQ=' // Base64 encoded "Hello World"
      };

      const result = await handlePublish(params);

      expect(result.success).toBe(true);
      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        params.connectionId,
        params.topic,
        params.message
      );
    });
  });

  describe('handleSubscribe', () => {
    it('should handle mqtt_subscribe tool successfully', async () => {
      mockMqttManager.subscribe.mockResolvedValue(undefined);

      const params = {
        connectionId: 'sub-conn',
        topic: 'sensor/temperature'
      };

      const result = await handleSubscribe(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: `Subscribed to topic: ${params.topic}`,
        connectionId: params.connectionId,
        topic: params.topic
      });
      expect(mockMqttManager.subscribe).toHaveBeenCalledWith(
        params.connectionId,
        params.topic,
        expect.any(Function)
      );
    });

    it('should validate required parameters', async () => {
      const params = {
        topic: 'sensor/data'
        // missing connectionId
      };

      const result = await handleSubscribe(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: connectionId');
    });

    it('should handle subscribe errors', async () => {
      mockMqttManager.subscribe.mockRejectedValue(new Error('Subscribe failed'));

      const params = {
        connectionId: 'sub-conn',
        topic: 'sensor/error'
      };

      const result = await handleSubscribe(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to subscribe to topic: Subscribe failed');
    });

    it('should handle wildcard topics', async () => {
      mockMqttManager.subscribe.mockResolvedValue(undefined);

      const params = {
        connectionId: 'sub-conn',
        topic: 'sensor/+/temperature'
      };

      const result = await handleSubscribe(params);

      expect(result.success).toBe(true);
      expect(mockMqttManager.subscribe).toHaveBeenCalledWith(
        params.connectionId,
        params.topic,
        expect.any(Function)
      );
    });
  });

  describe('handleUnsubscribe', () => {
    it('should handle mqtt_unsubscribe tool successfully', async () => {
      mockMqttManager.unsubscribe.mockResolvedValue(undefined);

      const params = {
        connectionId: 'unsub-conn',
        topic: 'sensor/humidity'
      };

      const result = await handleUnsubscribe(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: `Unsubscribed from topic: ${params.topic}`,
        connectionId: params.connectionId,
        topic: params.topic
      });
      expect(mockMqttManager.unsubscribe).toHaveBeenCalledWith(
        params.connectionId,
        params.topic
      );
    });

    it('should validate required parameters', async () => {
      const params = {
        connectionId: 'unsub-conn'
        // missing topic
      };

      const result = await handleUnsubscribe(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: topic');
    });

    it('should handle unsubscribe errors', async () => {
      mockMqttManager.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      const params = {
        connectionId: 'unsub-conn',
        topic: 'sensor/error'
      };

      const result = await handleUnsubscribe(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to unsubscribe from topic: Unsubscribe failed');
    });
  });

  describe('Parameter validation edge cases', () => {
    it('should handle empty strings as invalid parameters', async () => {
      const params = {
        connectionId: '',
        brokerUrl: 'mqtt://localhost:1883'
      };

      const result = await handleConnect(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: connectionId');
    });

    it('should handle null values as invalid parameters', async () => {
      const params = {
        connectionId: null,
        topic: 'test/topic',
        message: 'test message'
      };

      const result = await handlePublish(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: connectionId');
    });

    it('should handle undefined values as invalid parameters', async () => {
      const params = {
        connectionId: 'test-conn',
        topic: undefined
      };

      const result = await handleSubscribe(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required parameters: topic');
    });
  });
});
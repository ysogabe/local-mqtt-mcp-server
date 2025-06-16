import { MqttManager } from '../mqttManager';
import { MessageCallback } from '../types';

// Mock MQTT client
jest.mock('mqtt', () => ({
  connect: jest.fn(() => {
    const mockClient = {
      on: jest.fn((event: string, callback: Function) => {
        // Simulate connect event immediately
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      }),
      publish: jest.fn((_topic: string, _message: string | Buffer, _options: any, callback: Function) => {
        if (callback) setTimeout(() => callback(null), 10);
      }),
      subscribe: jest.fn((topic: string, options: any, callback: Function) => {
        if (callback) setTimeout(() => callback(null, [{ topic, qos: options?.qos || 0 }]), 10);
      }),
      unsubscribe: jest.fn((_topic: string, callback: Function) => {
        if (callback) setTimeout(() => callback(null), 10);
      }),
      end: jest.fn((_force: boolean, callback: Function) => {
        if (callback) setTimeout(() => callback(), 10);
      }),
      connected: true
    };
    return mockClient;
  })
}));

describe('MqttManager', () => {
  let mqttManager: MqttManager;

  beforeEach(() => {
    mqttManager = MqttManager.getInstance();
    // Clear any existing connections
    (mqttManager as any).connections.clear();
    (mqttManager as any).messages.clear();
    (mqttManager as any).subscriptions.clear();
    jest.clearAllMocks();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MqttManager.getInstance();
      const instance2 = MqttManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection management', () => {
    it('should create new MQTT connection', async () => {
      const connectionId = 'test-conn-1';
      const brokerUrl = 'mqtt://localhost:1883';
      const options = {
        clientId: 'test-client',
        username: 'testuser',
        password: 'testpass'
      };

      await mqttManager.connect(connectionId, { brokerUrl, ...options });

      const connections = mqttManager.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBe(connectionId);
      expect(connections[0].brokerUrl).toBe(brokerUrl);
      expect(connections[0].status).toBe('connected');
    });

    it('should handle multiple connections', async () => {
      await mqttManager.connect('conn-1', { brokerUrl: 'mqtt://broker1:1883' });
      await mqttManager.connect('conn-2', { brokerUrl: 'mqtt://broker2:1883' });

      const connections = mqttManager.getConnections();
      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.id)).toContain('conn-1');
      expect(connections.map(c => c.id)).toContain('conn-2');
    });

    it('should disconnect existing connection', async () => {
      const connectionId = 'test-disconnect';
      await mqttManager.connect(connectionId, { brokerUrl: 'mqtt://localhost:1883' });
      
      await mqttManager.disconnect(connectionId);
      
      const connections = mqttManager.getConnections();
      const connection = connections.find(c => c.id === connectionId);
      expect(connection?.status).toBe('disconnected');
    });

    it('should handle connection errors', async () => {
      const mqtt = require('mqtt');
      const mockClient = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Connection failed')), 10);
          }
        }),
        connected: false
      };
      mqtt.connect.mockReturnValueOnce(mockClient);

      const connectionId = 'error-conn';
      await expect(
        mqttManager.connect(connectionId, { brokerUrl: 'mqtt://invalid:1883' })
      ).rejects.toThrow('Connection failed');
    });
  });

  describe('Message publishing', () => {
    beforeEach(async () => {
      await mqttManager.connect('pub-conn', { brokerUrl: 'mqtt://localhost:1883' });
    });

    afterEach(async () => {
      await mqttManager.disconnect('pub-conn');
    });

    it('should publish messages', async () => {
      const topic = 'test/publish';
      const message = 'Hello MQTT';

      await mqttManager.publish('pub-conn', topic, message);

      const messages = mqttManager.getMessages('pub-conn');
      expect(messages).toHaveLength(1);
      expect(messages[0].topic).toBe(topic);
      expect(messages[0].payload).toBe(message);
      expect(messages[0].direction).toBe('outbound');
    });

    it('should publish binary messages', async () => {
      const topic = 'test/binary';
      const message = Buffer.from('Binary data');

      await mqttManager.publish('pub-conn', topic, message);

      const messages = mqttManager.getMessages('pub-conn');
      expect(messages).toHaveLength(1);
      expect(messages[0].payload).toEqual(message);
    });
  });

  describe('Message subscription', () => {
    beforeEach(async () => {
      await mqttManager.connect('sub-conn', { brokerUrl: 'mqtt://localhost:1883' });
    });

    afterEach(async () => {
      await mqttManager.disconnect('sub-conn');
    });

    it('should subscribe to topics', async () => {
      const topic = 'sensor/temperature';
      const callback: MessageCallback = jest.fn();

      await mqttManager.subscribe('sub-conn', topic, callback);

      // Verify subscription was created
      const subscriptions = (mqttManager as any).subscriptions.get('sub-conn') || [];
      expect(subscriptions.some((sub: any) => sub.topic === topic)).toBe(true);
    });

    it('should unsubscribe from topics', async () => {
      const topic = 'sensor/humidity';
      const callback: MessageCallback = jest.fn();

      await mqttManager.subscribe('sub-conn', topic, callback);
      await mqttManager.unsubscribe('sub-conn', topic);

      const subscriptions = (mqttManager as any).subscriptions.get('sub-conn') || [];
      expect(subscriptions.some((sub: any) => sub.topic === topic)).toBe(false);
    });

    it('should handle incoming messages', async () => {
      const topic = 'sensor/data';
      const callback: MessageCallback = jest.fn();
      
      await mqttManager.subscribe('sub-conn', topic, callback);

      // Simulate incoming message
      const mockClient = (mqttManager as any).connections.get('sub-conn')?.client;
      const messageHandler = mockClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        const testPayload = Buffer.from('sensor data');
        messageHandler(topic, testPayload, { qos: 1, retain: false });

        expect(callback).toHaveBeenCalledWith(topic, testPayload, expect.any(Object));
        
        const messages = mqttManager.getMessages('sub-conn');
        expect(messages).toHaveLength(1);
        expect(messages[0].topic).toBe(topic);
        expect(messages[0].direction).toBe('inbound');
      }
    });
  });

  describe('Message storage and limits', () => {
    beforeEach(async () => {
      await mqttManager.connect('storage-conn', { brokerUrl: 'mqtt://localhost:1883' });
    });

    afterEach(async () => {
      await mqttManager.disconnect('storage-conn');
    });

    it('should store message history', async () => {
      await mqttManager.publish('storage-conn', 'test/1', 'Message 1');
      await mqttManager.publish('storage-conn', 'test/2', 'Message 2');
      await mqttManager.publish('storage-conn', 'test/3', 'Message 3');

      const messages = mqttManager.getMessages('storage-conn');
      expect(messages).toHaveLength(3);
    });

    it('should limit message buffer to 1000', async () => {
      // Simulate adding 1001 messages
      const messageBuffer = (mqttManager as any).messages.get('storage-conn') || [];
      
      for (let i = 0; i < 1001; i++) {
        messageBuffer.push({
          id: `msg-${i}`,
          connectionId: 'storage-conn',
          topic: `test/${i}`,
          payload: `Message ${i}`,
          timestamp: new Date(),
          qos: 0,
          retain: false,
          direction: 'outbound'
        });
      }

      // Manually trigger buffer limit
      mqttManager.limitMessageBuffer('storage-conn');

      const messages = mqttManager.getMessages('storage-conn');
      expect(messages).toHaveLength(1000);
      // Should keep the most recent messages
      expect(messages[messages.length - 1].payload).toBe('Message 1000');
    });

    it('should filter messages by topic', async () => {
      await mqttManager.publish('storage-conn', 'sensor/temp', 'Temperature data');
      await mqttManager.publish('storage-conn', 'sensor/humidity', 'Humidity data');
      await mqttManager.publish('storage-conn', 'control/lights', 'Light control');

      const sensorMessages = mqttManager.getMessages('storage-conn', 'sensor/temp');
      expect(sensorMessages).toHaveLength(1);
      expect(sensorMessages[0].topic).toBe('sensor/temp');

      const allMessages = mqttManager.getMessages('storage-conn');
      expect(allMessages).toHaveLength(3);
    });
  });

  describe('Error handling and cleanup', () => {
    it('should handle disconnect errors gracefully', async () => {
      const connectionId = 'cleanup-test';
      await mqttManager.connect(connectionId, { brokerUrl: 'mqtt://localhost:1883' });

      // Mock client end to throw error
      const mockClient = (mqttManager as any).connections.get(connectionId)?.client;
      mockClient.end.mockImplementationOnce((_force: boolean, callback: Function) => {
        callback(new Error('Disconnect failed'));
      });

      await expect(mqttManager.disconnect(connectionId)).rejects.toThrow('Disconnect failed');
    });

    it('should clean up on disconnect', async () => {
      const connectionId = 'cleanup-conn';
      await mqttManager.connect(connectionId, { brokerUrl: 'mqtt://localhost:1883' });
      
      await mqttManager.publish(connectionId, 'test/cleanup', 'Test message');
      
      await mqttManager.disconnect(connectionId);
      
      const connections = mqttManager.getConnections();
      const connection = connections.find(c => c.id === connectionId);
      expect(connection?.status).toBe('disconnected');
      expect(connection?.disconnectedAt).toBeInstanceOf(Date);
    });
  });
});
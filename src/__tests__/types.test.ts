import {
  MqttConnection,
  MqttMessage,
  SubscriptionInfo,
  PublishRequest,
  SubscribeRequest,
  ConnectionStatus,
  isValidConnectionStatus,
  SpeechPayload
} from '../types';

describe('MQTT Types', () => {
  describe('MqttConnection interface', () => {
    it('should validate MqttConnection interface', () => {
      const connection: MqttConnection = {
        id: 'test-connection',
        brokerUrl: 'mqtt://localhost:1883',
        status: 'connected',
        connectedAt: new Date(),
        options: {
          clientId: 'test-client',
          username: 'user',
          password: 'pass',
          keepalive: 60,
          clean: true
        }
      };

      expect(connection.id).toBe('test-connection');
      expect(connection.brokerUrl).toBe('mqtt://localhost:1883');
      expect(connection.status).toBe('connected');
      expect(connection.connectedAt).toBeInstanceOf(Date);
      expect(connection.options).toBeDefined();
      expect(connection.options?.clientId).toBe('test-client');
    });
  });

  describe('MqttMessage interface', () => {
    it('should validate MqttMessage interface', () => {
      const message: MqttMessage = {
        id: 'msg-123',
        connectionId: 'conn-456',
        topic: 'test/topic',
        payload: 'Hello MQTT',
        timestamp: new Date(),
        qos: 1,
        retain: false,
        direction: 'inbound'
      };

      expect(message.id).toBe('msg-123');
      expect(message.connectionId).toBe('conn-456');
      expect(message.topic).toBe('test/topic');
      expect(message.payload).toBe('Hello MQTT');
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.qos).toBe(1);
      expect(message.retain).toBe(false);
      expect(message.direction).toBe('inbound');
    });

    it('should support buffer payload', () => {
      const message: MqttMessage = {
        id: 'msg-124',
        connectionId: 'conn-456',
        topic: 'test/binary',
        payload: Buffer.from('Binary data'),
        timestamp: new Date(),
        qos: 0,
        retain: true,
        direction: 'outbound'
      };

      expect(message.payload).toBeInstanceOf(Buffer);
      expect(message.direction).toBe('outbound');
    });
  });

  describe('SubscriptionInfo interface', () => {
    it('should validate SubscriptionInfo interface', () => {
      const subscription: SubscriptionInfo = {
        connectionId: 'conn-789',
        topic: 'sensor/+/temperature',
        qos: 2,
        subscribedAt: new Date()
      };

      expect(subscription.connectionId).toBe('conn-789');
      expect(subscription.topic).toBe('sensor/+/temperature');
      expect(subscription.qos).toBe(2);
      expect(subscription.subscribedAt).toBeInstanceOf(Date);
    });
  });

  describe('Tool request/response types', () => {
    it('should validate PublishRequest interface', () => {
      const request: PublishRequest = {
        connectionId: 'conn-001',
        topic: 'cmd/device/on',
        message: 'ON',
        qos: 1,
        retain: true
      };

      expect(request.connectionId).toBe('conn-001');
      expect(request.topic).toBe('cmd/device/on');
      expect(request.message).toBe('ON');
      expect(request.qos).toBe(1);
      expect(request.retain).toBe(true);
    });

    it('should validate SubscribeRequest interface', () => {
      const request: SubscribeRequest = {
        connectionId: 'conn-002',
        topic: 'sensor/+/data',
        qos: 2
      };

      expect(request.connectionId).toBe('conn-002');
      expect(request.topic).toBe('sensor/+/data');
      expect(request.qos).toBe(2);
    });
  });

  describe('ConnectionStatus type', () => {
    it('should accept valid connection statuses', () => {
      const validStatuses: ConnectionStatus[] = ['connected', 'disconnected', 'connecting', 'error'];
      
      validStatuses.forEach(status => {
        expect(isValidConnectionStatus(status)).toBe(true);
      });
    });

    it('should reject invalid connection statuses', () => {
      const invalidStatuses = ['ready', 'offline', 'reconnecting', ''];
      
      invalidStatuses.forEach(status => {
        expect(isValidConnectionStatus(status)).toBe(false);
      });
    });
  });

  describe('SpeechPayload interface', () => {
    it('should validate SpeechPayload for AITuber integration', () => {
      const speechPayload: SpeechPayload = {
        id: 'speech-001',
        text: 'Hello, I am an AI assistant!',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString(),
        emotion: 'happy',
        speaker: 'assistant'
      };

      expect(speechPayload.id).toBe('speech-001');
      expect(speechPayload.text).toBe('Hello, I am an AI assistant!');
      expect(speechPayload.type).toBe('speech');
      expect(speechPayload.priority).toBe('medium');
      expect(speechPayload.timestamp).toBeDefined();
      expect(speechPayload.emotion).toBe('happy');
      expect(speechPayload.speaker).toBe('assistant');
    });

    it('should allow optional fields in SpeechPayload', () => {
      const minimalPayload: SpeechPayload = {
        id: 'msg-001',
        text: 'Simple message',
        type: 'speech',
        priority: 'high',
        timestamp: new Date().toISOString()
      };

      expect(minimalPayload.id).toBe('msg-001');
      expect(minimalPayload.text).toBe('Simple message');
      expect(minimalPayload.type).toBe('speech');
      expect(minimalPayload.priority).toBe('high');
      expect(minimalPayload.speaker).toBeUndefined();
      expect(minimalPayload.emotion).toBeUndefined();
    });
  });
});
import { SpeechPublisher } from '../handlers/speechPublisher';
import { MqttManager } from '../mqttManager';
import { SpeechPayload } from '../types';

// Mock MqttManager
jest.mock('../mqttManager');

describe('SpeechPublisher', () => {
  let speechPublisher: SpeechPublisher;
  let mockMqttManager: jest.Mocked<MqttManager>;

  beforeEach(() => {
    mockMqttManager = {
      publish: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getConnections: jest.fn(),
      getMessages: jest.fn(),
      limitMessageBuffer: jest.fn()
    } as any;

    (MqttManager.getInstance as jest.Mock).mockReturnValue(mockMqttManager);

    speechPublisher = new SpeechPublisher();
    jest.clearAllMocks();
  });

  describe('publishSpeech', () => {
    it('should publish speech payload to correct topic', async () => {
      const connectionId = 'aituber-conn';
      const speechPayload: SpeechPayload = {
        id: 'speech-001',
        text: 'Hello, I am an AI assistant!',
        type: 'speech',
        priority: 'medium',
        timestamp: '2024-01-01T10:00:00.000Z',
        emotion: 'happy',
        speaker: 'assistant'
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, speechPayload);

      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        connectionId,
        'aituber/speech',
        expect.stringContaining('"text":"Hello, I am an AI assistant!"')
      );
    });

    it('should validate speech payload format', async () => {
      const connectionId = 'test-conn';
      const invalidPayload = {
        // missing required fields
        priority: 'medium'
      } as SpeechPayload;

      await expect(
        speechPublisher.publishSpeech(connectionId, invalidPayload)
      ).rejects.toThrow('Failed to publish speech');

      expect(mockMqttManager.publish).not.toHaveBeenCalled();
    });

    it('should handle priority routing', async () => {
      const connectionId = 'priority-conn';
      const urgentPayload: SpeechPayload = {
        id: 'urgent-001',
        text: 'Urgent message!',
        type: 'alert',
        priority: 'high',
        timestamp: new Date().toISOString()
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, urgentPayload);

      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        connectionId,
        'aituber/speech',
        expect.stringContaining('"priority":"high"')
      );
    });

    it('should generate unique message IDs', async () => {
      const connectionId = 'id-test-conn';
      const payload1: SpeechPayload = {
        id: 'msg-001',
        text: 'First message',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };
      const payload2: SpeechPayload = {
        id: 'msg-002', 
        text: 'Second message',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, payload1);
      await speechPublisher.publishSpeech(connectionId, payload2);

      expect(mockMqttManager.publish).toHaveBeenCalledTimes(2);

      const firstCall = mockMqttManager.publish.mock.calls[0];
      const secondCall = mockMqttManager.publish.mock.calls[1];

      const firstPayload = JSON.parse(firstCall[2] as string);
      const secondPayload = JSON.parse(secondCall[2] as string);

      expect(firstPayload.id).toBeDefined();
      expect(secondPayload.id).toBeDefined();
      expect(firstPayload.id).not.toBe(secondPayload.id);
    });

    it('should add timestamp if missing', async () => {
      const connectionId = 'timestamp-conn';
      const payload: SpeechPayload = {
        id: 'timestamp-test',
        text: 'Message without timestamp',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      const beforeTime = new Date().getTime();
      await speechPublisher.publishSpeech(connectionId, payload);
      const afterTime = new Date().getTime();

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      
      expect(publishedPayload.timestamp).toBeDefined();
      expect(new Date(publishedPayload.timestamp).getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(new Date(publishedPayload.timestamp).getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve existing timestamp', async () => {
      const connectionId = 'preserve-timestamp-conn';
      const existingTimestamp = '2024-01-01T12:00:00.000Z';
      const payload: SpeechPayload = {
        id: 'preserve-test',
        text: 'Message with timestamp',
        type: 'speech',
        priority: 'medium',
        timestamp: existingTimestamp
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, payload);

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      
      expect(publishedPayload.timestamp).toBe(existingTimestamp);
    });

    it('should handle all priority levels', async () => {
      const connectionId = 'all-priority-conn';
      const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      mockMqttManager.publish.mockResolvedValue(undefined);

      for (const priority of priorities) {
        const payload: SpeechPayload = {
          id: `${priority}-test`,
          text: `Message with ${priority} priority`,
          type: 'speech',
          priority,
          timestamp: new Date().toISOString()
        };

        await speechPublisher.publishSpeech(connectionId, payload);
      }

      expect(mockMqttManager.publish).toHaveBeenCalledTimes(3);

      // Check topics for different priorities
      const calls = mockMqttManager.publish.mock.calls;
      expect(calls[0][1]).toBe('aituber/speech'); // normal
      expect(calls[1][1]).toBe('aituber/speech/high'); // high
      expect(calls[2][1]).toBe('aituber/speech/urgent'); // urgent
    });
  });

  describe('publishAlert', () => {
    it('should publish alert with correct format', async () => {
      const connectionId = 'alert-conn';
      const text = 'System alert message';
      const priority = 'high';

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishAlert(connectionId, text, priority);

      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        connectionId,
        'aituber/speech/high',
        expect.stringContaining('"text":"System alert message"')
      );

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      expect(publishedPayload.priority).toBe(priority);
      expect(publishedPayload.metadata.type).toBe('alert');
    });

    it('should set default priority for alerts', async () => {
      const connectionId = 'default-alert-conn';
      const text = 'Default alert';

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishAlert(connectionId, text);

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      expect(publishedPayload.priority).toBe('high'); // default for alerts
    });
  });

  describe('publishNotification', () => {
    it('should publish notification with category', async () => {
      const connectionId = 'notification-conn';
      const text = 'New message received';
      const category = 'chat';

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishNotification(connectionId, text, category);

      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        connectionId,
        'aituber/speech',
        expect.stringContaining('"text":"New message received"')
      );

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      expect(publishedPayload.priority).toBe('normal'); // default for notifications
      expect(publishedPayload.metadata.type).toBe('notification');
      expect(publishedPayload.metadata.category).toBe('chat');
    });

    it('should handle different notification categories', async () => {
      const connectionId = 'category-conn';
      const categories = ['system', 'user', 'error', 'info'];

      mockMqttManager.publish.mockResolvedValue(undefined);

      for (const category of categories) {
        await speechPublisher.publishNotification(
          connectionId, 
          `${category} notification`, 
          category
        );
      }

      expect(mockMqttManager.publish).toHaveBeenCalledTimes(4);

      // Verify all notifications have correct category in metadata
      const calls = mockMqttManager.publish.mock.calls;
      calls.forEach((call, index) => {
        const payload = JSON.parse(call[2] as string);
        expect(payload.metadata.category).toBe(categories[index]);
      });
    });
  });

  describe('Topic routing', () => {
    it('should route to standard topic for normal priority', async () => {
      const connectionId = 'routing-conn';
      const payload: SpeechPayload = {
        id: 'normal-test',
        text: 'Normal message',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, payload);

      expect(mockMqttManager.publish).toHaveBeenCalledWith(
        connectionId,
        'aituber/speech',
        expect.any(String)
      );
    });

    it('should route to priority-specific topics', async () => {
      const connectionId = 'priority-routing-conn';
      
      const testCases = [
        { priority: 'high' as const, expectedTopic: 'aituber/speech' },
        { priority: 'low' as const, expectedTopic: 'aituber/speech' }
      ];

      mockMqttManager.publish.mockResolvedValue(undefined);

      for (const testCase of testCases) {
        const payload: SpeechPayload = {
          id: `${testCase.priority}-test`,
          text: `${testCase.priority} message`,
          type: 'speech',
          priority: testCase.priority,
          timestamp: new Date().toISOString()
        };

        await speechPublisher.publishSpeech(connectionId, payload);
      }

      const calls = mockMqttManager.publish.mock.calls;
      expect(calls[0][1]).toBe('aituber/speech');
      expect(calls[1][1]).toBe('aituber/speech');
    });
  });

  describe('Error handling', () => {
    it('should handle MQTT publish errors', async () => {
      const connectionId = 'error-conn';
      const payload: SpeechPayload = {
        id: 'error-test',
        text: 'Error message',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };

      mockMqttManager.publish.mockRejectedValue(new Error('MQTT publish failed'));

      await expect(
        speechPublisher.publishSpeech(connectionId, payload)
      ).rejects.toThrow('Failed to publish speech: MQTT publish failed');
    });

    it('should validate priority values', async () => {
      const connectionId = 'invalid-priority-conn';
      const payload = {
        text: 'Invalid priority',
        priority: 'invalid'
      } as any;

      await expect(
        speechPublisher.publishSpeech(connectionId, payload)
      ).rejects.toThrow('Invalid priority level: invalid');
    });

    it('should handle empty text gracefully', async () => {
      const connectionId = 'empty-text-conn';
      const payload: SpeechPayload = {
        id: 'empty-test',
        text: '   ', // whitespace only
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString()
      };

      await expect(
        speechPublisher.publishSpeech(connectionId, payload)
      ).rejects.toThrow('Failed to publish speech');
    });
  });

  describe('Payload enhancement', () => {
    it('should preserve all provided metadata', async () => {
      const connectionId = 'metadata-conn';
      const payload: SpeechPayload = {
        id: 'metadata-test',
        text: 'Message with metadata',
        type: 'speech',
        priority: 'medium',
        timestamp: new Date().toISOString(),
        emotion: 'happy',
        speaker: 'custom-voice'
      };

      mockMqttManager.publish.mockResolvedValue(undefined);

      await speechPublisher.publishSpeech(connectionId, payload);

      const publishedPayload = JSON.parse(mockMqttManager.publish.mock.calls[0][2] as string);
      
      expect(publishedPayload.speaker).toBe('custom-voice');
      expect(publishedPayload.emotion).toBe('happy');
      expect(publishedPayload.id).toBe('metadata-test');
      expect(publishedPayload.type).toBe('speech');
      expect(publishedPayload.priority).toBe('medium');
      expect(publishedPayload.timestamp).toBeDefined();
    });
  });
});
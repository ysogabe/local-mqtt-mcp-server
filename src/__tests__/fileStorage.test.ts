import { FileStorage } from '../storage/fileStorage';
import { MqttMessage, SubscriptionInfo } from '../types';
import * as fs from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');

describe('FileStorage', () => {
  let fileStorage: FileStorage;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    fileStorage = new FileStorage();
    jest.clearAllMocks();
    
    // Mock fs.stat to return file doesn't exist by default
    mockFs.stat.mockRejectedValue(new Error('File not found'));
    
    // Mock fs.mkdir to succeed
    mockFs.mkdir.mockResolvedValue(undefined);
    
    // Mock fs.writeFile to succeed
    mockFs.writeFile.mockResolvedValue();
  });

  describe('saveMessages', () => {
    it('should save messages to JSON file', async () => {
      const connectionId = 'test-conn';
      const messages: MqttMessage[] = [
        {
          id: 'msg-1',
          connectionId,
          topic: 'test/topic',
          payload: 'Hello MQTT',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qos: 1,
          retain: false,
          direction: 'outbound'
        },
        {
          id: 'msg-2',
          connectionId,
          topic: 'sensor/data',
          payload: Buffer.from('Binary data'),
          timestamp: new Date('2024-01-01T10:01:00Z'),
          qos: 0,
          retain: true,
          direction: 'inbound'
        }
      ];

      await fileStorage.saveMessages(connectionId, messages);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`messages_${connectionId}.json`),
        expect.stringContaining('"id": "msg-1"'),
        'utf8'
      );
    });

    it('should handle buffer payloads correctly', async () => {
      const connectionId = 'binary-conn';
      const messages: MqttMessage[] = [
        {
          id: 'msg-binary',
          connectionId,
          topic: 'binary/topic',
          payload: Buffer.from('Binary data'),
          timestamp: new Date(),
          qos: 1,
          retain: false,
          direction: 'inbound'
        }
      ];

      await fileStorage.saveMessages(connectionId, messages);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`messages_${connectionId}.json`),
        expect.stringMatching(/"payload": {\s*"type": "Buffer"/),
        'utf8'
      );
    });

    it('should create data directory if it does not exist', async () => {
      const connectionId = 'new-conn';
      const messages: MqttMessage[] = [];

      await fileStorage.saveMessages(connectionId, messages);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });
  });

  describe('loadMessages', () => {
    it('should load messages from file', async () => {
      const connectionId = 'load-test';
      const savedMessages = [
        {
          id: 'msg-1',
          connectionId,
          topic: 'test/load',
          payload: 'Loaded message',
          timestamp: '2024-01-01T10:00:00.000Z',
          qos: 1,
          retain: false,
          direction: 'outbound'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(savedMessages));

      const messages = await fileStorage.loadMessages(connectionId);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(`messages_${connectionId}.json`),
        'utf8'
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].topic).toBe('test/load');
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle file not found', async () => {
      const connectionId = 'not-found';
      
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const messages = await fileStorage.loadMessages(connectionId);

      expect(messages).toEqual([]);
    });

    it('should handle corrupted JSON file', async () => {
      const connectionId = 'corrupt-json';
      
      mockFs.readFile.mockResolvedValue('invalid json content');

      const messages = await fileStorage.loadMessages(connectionId);

      expect(messages).toEqual([]);
    });

    it('should restore buffer payloads correctly', async () => {
      const connectionId = 'buffer-test';
      const savedData = [
        {
          id: 'msg-buffer',
          connectionId,
          topic: 'binary/test',
          payload: { type: 'Buffer', data: [72, 101, 108, 108, 111] }, // "Hello"
          timestamp: '2024-01-01T10:00:00.000Z',
          qos: 0,
          retain: false,
          direction: 'inbound'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(savedData));

      const messages = await fileStorage.loadMessages(connectionId);

      expect(messages).toHaveLength(1);
      expect(Buffer.isBuffer(messages[0].payload)).toBe(true);
      expect(messages[0].payload.toString()).toBe('Hello');
    });
  });

  describe('saveSubscriptions', () => {
    it('should save subscription info', async () => {
      const subscriptions: SubscriptionInfo[] = [
        {
          connectionId: 'sub-conn-1',
          topic: 'sensor/temperature',
          qos: 1,
          subscribedAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          connectionId: 'sub-conn-2',
          topic: 'sensor/+/data',
          qos: 2,
          subscribedAt: new Date('2024-01-01T10:01:00Z')
        }
      ];

      await fileStorage.saveSubscriptions(subscriptions);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('subscriptions.json'),
        expect.stringContaining('"connectionId": "sub-conn-1"'),
        'utf8'
      );
    });
  });

  describe('loadSubscriptions', () => {
    it('should restore subscriptions on startup', async () => {
      const savedSubscriptions = [
        {
          connectionId: 'restored-conn',
          topic: 'restored/topic',
          qos: 1,
          subscribedAt: '2024-01-01T10:00:00.000Z'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(savedSubscriptions));

      const subscriptions = await fileStorage.loadSubscriptions();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('subscriptions.json'),
        'utf8'
      );
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].connectionId).toBe('restored-conn');
      expect(subscriptions[0].topic).toBe('restored/topic');
      expect(subscriptions[0].subscribedAt).toBeInstanceOf(Date);
    });

    it('should handle missing subscriptions file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const subscriptions = await fileStorage.loadSubscriptions();

      expect(subscriptions).toEqual([]);
    });
  });

  describe('file rotation and cleanup', () => {
    it('should rotate files when size exceeds limit', async () => {
      const connectionId = 'large-file';
      const largeContent = 'a'.repeat(10 * 1024 * 1024); // 10MB

      // Mock file stat to return large size
      mockFs.stat.mockResolvedValue({
        size: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
        isFile: () => true
      } as any);

      mockFs.readFile.mockResolvedValue(largeContent);

      const messages: MqttMessage[] = [
        {
          id: 'new-msg',
          connectionId,
          topic: 'test/new',
          payload: 'New message',
          timestamp: new Date(),
          qos: 0,
          retain: false,
          direction: 'outbound'
        }
      ];

      await fileStorage.saveMessages(connectionId, messages);

      // Should create backup and write new file
      expect(mockFs.copyFile).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`messages_${connectionId}.json`),
        expect.any(String),
        'utf8'
      );
    });

    it('should clear old messages', async () => {
      const daysToKeep = 7;
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const testFiles = [
        'messages_conn1.json',
        'messages_conn2.json',
        'subscriptions.json'
      ];

      mockFs.readdir.mockResolvedValue(testFiles as any);
      
      // Mock some files as old
      mockFs.stat.mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && filePath.includes('conn1')) {
          return Promise.resolve({
            mtime: oldDate,
            isFile: () => true
          } as any);
        }
        return Promise.resolve({
          mtime: new Date(),
          isFile: () => true
        } as any);
      });

      mockFs.unlink.mockResolvedValue();

      await fileStorage.clearOldMessages(daysToKeep);

      expect(mockFs.readdir).toHaveBeenCalledWith(expect.stringContaining('data'));
      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('messages_conn1.json')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      // Should not throw
      await expect(fileStorage.clearOldMessages(7)).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle write errors gracefully', async () => {
      const connectionId = 'write-error';
      const messages: MqttMessage[] = [];

      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(fileStorage.saveMessages(connectionId, messages)).rejects.toThrow('Write failed');
    });

    it('should handle directory creation errors', async () => {
      const connectionId = 'mkdir-error';
      const messages: MqttMessage[] = [];

      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(fileStorage.saveMessages(connectionId, messages)).rejects.toThrow('Permission denied');
    });
  });
});
# 単体テストテンプレート集

## 🎯 概要
MQTT MCP Server プロジェクトの単体テスト作成時に使用するテンプレート集です。TDD アプローチに基づいて設計されています。

## 📋 基本テンプレート

### 1. 基本クラステスト

```typescript
// tests/unit/services/example-service.test.ts
import { ExampleService } from '../../../src/services/example-service';
import { MockDependency } from '../../utils/mocks';

describe('ExampleService', () => {
  let service: ExampleService;
  let mockDependency: jest.Mocked<MockDependency>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    service = new ExampleService(mockDependency);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(service).toBeInstanceOf(ExampleService);
      expect(service.isInitialized()).toBe(true);
    });

    it('should throw error with invalid dependencies', () => {
      expect(() => new ExampleService(null as any)).toThrow(ValidationError);
    });
  });

  describe('methodName', () => {
    describe('success cases', () => {
      it('should handle normal input correctly', async () => {
        // Arrange
        const input = { value: 'test' };
        const expectedOutput = { result: 'processed' };
        mockDependency.process.mockResolvedValue(expectedOutput);

        // Act
        const result = await service.methodName(input);

        // Assert
        expect(result).toEqual(expectedOutput);
        expect(mockDependency.process).toHaveBeenCalledWith(input);
        expect(mockDependency.process).toHaveBeenCalledTimes(1);
      });

      it('should handle edge case with empty input', async () => {
        // Arrange
        const input = {};
        const expectedOutput = { result: 'default' };
        mockDependency.process.mockResolvedValue(expectedOutput);

        // Act
        const result = await service.methodName(input);

        // Assert
        expect(result).toEqual(expectedOutput);
      });
    });

    describe('error cases', () => {
      it('should handle dependency errors gracefully', async () => {
        // Arrange
        const input = { value: 'test' };
        const error = new Error('Dependency failed');
        mockDependency.process.mockRejectedValue(error);

        // Act & Assert
        await expect(service.methodName(input)).rejects.toThrow('Dependency failed');
      });

      it('should validate input parameters', async () => {
        // Arrange
        const invalidInput = null;

        // Act & Assert
        await expect(service.methodName(invalidInput)).rejects.toThrow(ValidationError);
      });
    });

    describe('edge cases', () => {
      it('should handle concurrent calls correctly', async () => {
        // Arrange
        const input1 = { value: 'test1' };
        const input2 = { value: 'test2' };
        mockDependency.process
          .mockResolvedValueOnce({ result: 'result1' })
          .mockResolvedValueOnce({ result: 'result2' });

        // Act
        const [result1, result2] = await Promise.all([
          service.methodName(input1),
          service.methodName(input2)
        ]);

        // Assert
        expect(result1).toEqual({ result: 'result1' });
        expect(result2).toEqual({ result: 'result2' });
        expect(mockDependency.process).toHaveBeenCalledTimes(2);
      });
    });
  });
});
```

### 2. 設定管理テスト

```typescript
// tests/unit/core/config/config-manager.test.ts
import { ConfigManager } from '../../../../src/core/config/config-manager';
import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load valid configuration from file', async () => {
      // Arrange
      const mockConfig = {
        mcp: { name: 'test-server', version: '1.0.0' },
        mqtt: { brokers: [] },
        logging: { level: 'info' }
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockFs.existsSync.mockReturnValue(true);

      // Act
      const config = await configManager.loadConfig('test-config.json');

      // Assert
      expect(config).toMatchObject(mockConfig);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-config.json'),
        'utf-8'
      );
    });

    it('should throw error for invalid JSON', async () => {
      // Arrange
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockFs.existsSync.mockReturnValue(true);

      // Act & Assert
      await expect(configManager.loadConfig('invalid.json')).rejects.toThrow();
    });

    it('should apply default values for missing properties', async () => {
      // Arrange
      const partialConfig = { mcp: { name: 'test' } };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));
      mockFs.existsSync.mockReturnValue(true);

      // Act
      const config = await configManager.loadConfig('partial.json');

      // Assert
      expect(config.logging.level).toBe('info'); // Default value
      expect(config.mqtt.brokers).toEqual([]); // Default value
    });
  });

  describe('environment variable handling', () => {
    beforeEach(() => {
      // 環境変数をクリア
      delete process.env.MQTT_MCP_LOG_LEVEL;
      delete process.env.MQTT_MCP_BROKER_URL;
    });

    it('should load configuration from environment variables', () => {
      // Arrange
      process.env.MQTT_MCP_LOG_LEVEL = 'debug';
      process.env.MQTT_MCP_BROKER_URL = 'mqtt://test:1883';

      // Act
      const config = configManager.loadFromEnvironment();

      // Assert
      expect(config.logging?.level).toBe('debug');
      expect(config.mqtt?.brokers?.[0]?.url).toBe('mqtt://test:1883');
    });

    it('should handle missing environment variables gracefully', () => {
      // Act
      const config = configManager.loadFromEnvironment();

      // Assert
      expect(config).toEqual({});
    });
  });

  describe('validation', () => {
    it('should validate required fields', () => {
      // Arrange
      const invalidConfig = { mcp: { name: '' } }; // Empty name

      // Act & Assert
      expect(() => configManager.validateConfig(invalidConfig)).toThrow('MCP name is required');
    });

    it('should validate MQTT broker URLs', () => {
      // Arrange
      const invalidConfig = {
        mqtt: { brokers: [{ id: 'test', url: 'invalid-url' }] }
      };

      // Act & Assert
      expect(() => configManager.validateConfig(invalidConfig)).toThrow('Invalid broker URL');
    });
  });
});
```

### 3. MQTT接続テスト

```typescript
// tests/unit/services/connection/mqtt-connection.test.ts
import { MQTTConnection } from '../../../../src/services/connection/mqtt-connection';
import { IBrokerConfig, ConnectionStatus } from '../../../../src/core/interfaces/mqtt-types';
import * as mqtt from 'mqtt';

jest.mock('mqtt');
const mockMqtt = mqtt as jest.Mocked<typeof mqtt>;

describe('MQTTConnection', () => {
  let connection: MQTTConnection;
  let mockClient: jest.Mocked<mqtt.MqttClient>;
  let brokerConfig: IBrokerConfig;

  beforeEach(() => {
    mockClient = {
      connect: jest.fn(),
      end: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      connected: false
    } as any;

    mockMqtt.connect.mockReturnValue(mockClient);

    brokerConfig = {
      id: 'test-broker',
      url: 'mqtt://localhost:1883',
      clientId: 'test-client',
      connection: {
        keepalive: 60,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 5000
      }
    };

    connection = new MQTTConnection(brokerConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should establish connection successfully', async () => {
      // Arrange
      mockClient.connected = true;
      
      // Simulate successful connection
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setImmediate(callback);
        }
        return mockClient;
      });

      // Act
      const result = await connection.connect();

      // Assert
      expect(result.success).toBe(true);
      expect(result.brokerId).toBe('test-broker');
      expect(connection.isConnected()).toBe(true);
      expect(connection.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    it('should handle connection timeout', async () => {
      // Arrange
      mockClient.on.mockImplementation((event, callback) => {
        // Don't call the connect callback to simulate timeout
        return mockClient;
      });

      // Act & Assert
      await expect(connection.connect()).rejects.toThrow(ConnectionError);
    });

    it('should handle connection errors', async () => {
      // Arrange
      const connectionError = new Error('Connection refused');
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setImmediate(() => callback(connectionError));
        }
        return mockClient;
      });

      // Act & Assert
      await expect(connection.connect()).rejects.toThrow(ConnectionError);
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      // Setup connected state
      mockClient.connected = true;
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setImmediate(callback);
        }
        return mockClient;
      });
      await connection.connect();
    });

    it('should publish message successfully', async () => {
      // Arrange
      const topic = 'test/topic';
      const message = 'test message';
      const options = { qos: 1, retain: true };
      
      mockClient.publish.mockImplementation((topic, message, options, callback) => {
        setImmediate(() => callback?.(null));
        return mockClient;
      });

      // Act
      await connection.publish(topic, message, options);

      // Assert
      expect(mockClient.publish).toHaveBeenCalledWith(
        topic,
        message,
        expect.objectContaining(options),
        expect.any(Function)
      );
    });

    it('should handle publish errors', async () => {
      // Arrange
      const publishError = new Error('Publish failed');
      mockClient.publish.mockImplementation((topic, message, options, callback) => {
        setImmediate(() => callback?.(publishError));
        return mockClient;
      });

      // Act & Assert
      await expect(connection.publish('test/topic', 'message')).rejects.toThrow('Publish failed');
    });

    it('should throw error when not connected', async () => {
      // Arrange
      mockClient.connected = false;

      // Act & Assert
      await expect(connection.publish('test/topic', 'message')).rejects.toThrow(ConnectionError);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      // Setup connected state
      mockClient.connected = true;
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setImmediate(callback);
        }
        return mockClient;
      });
      await connection.connect();
    });

    it('should subscribe to topic successfully', async () => {
      // Arrange
      const topic = 'test/topic';
      const options = { qos: 1 };
      const grantedSubscriptions = [{ topic, qos: 1 }];
      
      mockClient.subscribe.mockImplementation((topic, options, callback) => {
        setImmediate(() => callback?.(null, grantedSubscriptions));
        return mockClient;
      });

      // Act
      const result = await connection.subscribe(topic, options);

      // Assert
      expect(result).toEqual(grantedSubscriptions);
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        topic,
        expect.objectContaining(options),
        expect.any(Function)
      );
    });

    it('should handle subscribe errors', async () => {
      // Arrange
      const subscribeError = new Error('Subscribe failed');
      mockClient.subscribe.mockImplementation((topic, options, callback) => {
        setImmediate(() => callback?.(subscribeError));
        return mockClient;
      });

      // Act & Assert
      await expect(connection.subscribe('test/topic')).rejects.toThrow('Subscribe failed');
    });
  });

  describe('metrics', () => {
    it('should track connection metrics', async () => {
      // Arrange
      mockClient.connected = true;
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setImmediate(callback);
        }
        return mockClient;
      });

      // Act
      await connection.connect();
      const metrics = connection.getMetrics();

      // Assert
      expect(metrics).toMatchObject({
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: expect.any(Number),
        errorCount: 0,
        reconnectCount: 0,
        averageLatency: 0,
        uptime: expect.any(Number)
      });
    });
  });
});
```

### 4. エラーハンドリングテスト

```typescript
// tests/unit/core/errors/mqtt-errors.test.ts
import { 
  ConnectionError, 
  ProtocolError, 
  ValidationError,
  ErrorCategory 
} from '../../../../src/core/errors/mqtt-errors';

describe('MQTT Errors', () => {
  describe('ConnectionError', () => {
    it('should create error with correct properties', () => {
      // Arrange
      const code = 'CONNECTION_FAILED';
      const message = 'Failed to connect to broker';
      const details = { brokerId: 'test', url: 'mqtt://localhost:1883' };

      // Act
      const error = new ConnectionError(code, message, details);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.name).toBe('ConnectionError');
      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.category).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(error.statusCode).toBe(503);
      expect(error.details).toBe(details);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create broker unreachable error using factory method', () => {
      // Arrange
      const brokerId = 'test-broker';
      const url = 'mqtt://localhost:1883';

      // Act
      const error = ConnectionError.brokerUnreachable(brokerId, url);

      // Assert
      expect(error.code).toBe('BROKER_UNREACHABLE');
      expect(error.message).toContain(brokerId);
      expect(error.details).toMatchObject({ brokerId, url });
    });

    it('should create authentication failed error using factory method', () => {
      // Arrange
      const brokerId = 'test-broker';

      // Act
      const error = ConnectionError.authenticationFailed(brokerId);

      // Assert
      expect(error.code).toBe('AUTHENTICATION_FAILED');
      expect(error.message).toContain(brokerId);
      expect(error.details).toMatchObject({ brokerId });
    });
  });

  describe('ProtocolError', () => {
    it('should create invalid topic error using factory method', () => {
      // Arrange
      const topic = 'invalid/topic/+/#/more';

      // Act
      const error = ProtocolError.invalidTopic(topic);

      // Assert
      expect(error.code).toBe('INVALID_TOPIC');
      expect(error.message).toContain(topic);
      expect(error.category).toBe(ErrorCategory.PROTOCOL_ERROR);
      expect(error.statusCode).toBe(400);
    });

    it('should create invalid QoS error using factory method', () => {
      // Arrange
      const invalidQos = 5;

      // Act
      const error = ProtocolError.invalidQoS(invalidQos);

      // Assert
      expect(error.code).toBe('INVALID_QOS');
      expect(error.message).toContain('5');
      expect(error.details).toMatchObject({ qos: invalidQos });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field information', () => {
      // Arrange
      const field = 'brokerUrl';
      const value = 'invalid-url';
      const reason = 'Invalid URL format';

      // Act
      const error = ValidationError.invalidConfig(field, value, reason);

      // Assert
      expect(error.code).toBe('INVALID_CONFIG');
      expect(error.message).toContain(field);
      expect(error.message).toContain(reason);
      expect(error.details).toMatchObject({ field, value, reason });
    });
  });
});
```

### 5. 非同期処理テスト

```typescript
// tests/unit/services/messaging/message-handler.test.ts
import { MessageHandler } from '../../../../src/services/messaging/message-handler';
import { IPublishParams } from '../../../../src/core/interfaces/mqtt-types';

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    messageHandler = new MessageHandler(mockConnectionManager, {
      timeout: 5000,
      retryAttempts: 3,
      batchSize: 100
    });
  });

  describe('publishBatch', () => {
    it('should handle batch publishing successfully', async () => {
      // Arrange
      const messages: IPublishParams[] = [
        { topic: 'topic1', message: 'message1' },
        { topic: 'topic2', message: 'message2' },
        { topic: 'topic3', message: 'message3' }
      ];

      mockConnectionManager.getConnection.mockReturnValue(createMockConnection());

      // Act
      const result = await messageHandler.publishBatch(messages);

      // Assert
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r?.success)).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      // Arrange
      const messages: IPublishParams[] = [
        { topic: 'topic1', message: 'message1' },
        { topic: 'topic2', message: 'message2' },
        { topic: 'topic3', message: 'message3' }
      ];

      const mockConnection = createMockConnection();
      mockConnection.publish
        .mockResolvedValueOnce(undefined) // Success
        .mockRejectedValueOnce(new Error('Network error')) // Failure
        .mockResolvedValueOnce(undefined); // Success

      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Act
      const result = await messageHandler.publishBatch(messages);

      // Assert
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].error.message).toBe('Network error');
    });

    it('should process large batches in chunks', async () => {
      // Arrange
      const messageCount = 250; // Larger than batch size (100)
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        topic: `topic${i}`,
        message: `message${i}`
      }));

      const mockConnection = createMockConnection();
      mockConnection.publish.mockResolvedValue(undefined);
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Act
      const result = await messageHandler.publishBatch(messages);

      // Assert
      expect(result.successCount).toBe(messageCount);
      expect(result.errorCount).toBe(0);
      expect(mockConnection.publish).toHaveBeenCalledTimes(messageCount);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      // Arrange
      const mockConnection = createMockConnection();
      const slowPromise = new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      mockConnection.publish.mockReturnValue(slowPromise as any);
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Act & Assert
      await expect(messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      })).rejects.toThrow(TimeoutError);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed operations', async () => {
      // Arrange
      const mockConnection = createMockConnection();
      mockConnection.publish
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined); // Success on third attempt

      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Act
      const result = await messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConnection.publish).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      // Arrange
      const mockConnection = createMockConnection();
      mockConnection.publish.mockRejectedValue(new Error('Persistent failure'));
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Act & Assert
      await expect(messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      })).rejects.toThrow('Persistent failure');

      expect(mockConnection.publish).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });
  });
});
```

### 6. イベント駆動テスト

```typescript
// tests/unit/services/events/event-manager.test.ts
import { EventManager } from '../../../../src/services/events/event-manager';
import { MCPEventType, createMCPEvent } from '../../../../src/core/interfaces/mcp-types';

describe('EventManager', () => {
  let eventManager: EventManager;
  let mockMCPInterface: jest.Mocked<MCPInterfaceService>;

  beforeEach(() => {
    mockMCPInterface = createMockMCPInterface();
    eventManager = new EventManager(mockMCPInterface, {
      bufferSize: 1000,
      historySize: 10000
    });
  });

  afterEach(() => {
    eventManager.dispose();
  });

  describe('event emission', () => {
    it('should emit events correctly', () => {
      // Arrange
      const eventSpy = jest.fn();
      eventManager.on('test-event', eventSpy);

      // Act
      eventManager.emit('test-event', { data: 'test' });

      // Assert
      expect(eventSpy).toHaveBeenCalledWith({
        data: 'test'
      });
    });

    it('should handle multiple listeners', () => {
      // Arrange
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      eventManager.on('test-event', listener1);
      eventManager.on('test-event', listener2);

      // Act
      eventManager.emit('test-event', { data: 'test' });

      // Assert
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should not call removed listeners', () => {
      // Arrange
      const listener = jest.fn();
      eventManager.on('test-event', listener);
      eventManager.off('test-event', listener);

      // Act
      eventManager.emit('test-event', { data: 'test' });

      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('MCP event notification', () => {
    it('should send MCP events when client is ready', async () => {
      // Arrange
      eventManager.setClientReady(true);
      const event = createMCPEvent(MCPEventType.MQTT_MESSAGE, {
        topic: 'test/topic',
        message: 'test message'
      });

      // Act
      await eventManager.sendEvent(event);

      // Assert
      expect(mockMCPInterface.sendEvent).toHaveBeenCalledWith(event);
    });

    it('should buffer events when client is not ready', async () => {
      // Arrange
      eventManager.setClientReady(false);
      const event = createMCPEvent(MCPEventType.MQTT_MESSAGE, {
        topic: 'test/topic',
        message: 'test message'
      });

      // Act
      await eventManager.sendEvent(event);

      // Assert
      expect(mockMCPInterface.sendEvent).not.toHaveBeenCalled();
      expect(eventManager.getEventBufferSize()).toBe(1);
    });

    it('should flush buffered events when client becomes ready', async () => {
      // Arrange
      eventManager.setClientReady(false);
      const events = [
        createMCPEvent(MCPEventType.MQTT_MESSAGE, { topic: 'topic1' }),
        createMCPEvent(MCPEventType.MQTT_MESSAGE, { topic: 'topic2' })
      ];

      // Buffer events
      for (const event of events) {
        await eventManager.sendEvent(event);
      }

      // Act
      eventManager.setClientReady(true);
      eventManager.flushEventBuffer();

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(mockMCPInterface.sendEvent).toHaveBeenCalledTimes(2);
      expect(eventManager.getEventBufferSize()).toBe(0);
    });
  });

  describe('event history', () => {
    it('should maintain event history', () => {
      // Arrange
      const events = [
        { type: 'event1', data: { value: 1 } },
        { type: 'event2', data: { value: 2 } },
        { type: 'event3', data: { value: 3 } }
      ];

      // Act
      events.forEach(event => eventManager.addToHistory(event));

      // Assert
      const history = eventManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history.map(e => e.type)).toEqual(['event1', 'event2', 'event3']);
    });

    it('should limit history size', () => {
      // Arrange
      const maxSize = 5;
      eventManager = new EventManager(mockMCPInterface, {
        bufferSize: 1000,
        historySize: maxSize
      });

      // Act
      for (let i = 0; i < 10; i++) {
        eventManager.addToHistory({ type: `event${i}`, data: { value: i } });
      }

      // Assert
      const history = eventManager.getHistory();
      expect(history).toHaveLength(maxSize);
      expect(history[0].type).toBe('event5'); // Oldest remaining event
      expect(history[4].type).toBe('event9'); // Newest event
    });
  });
});
```

## 🎯 テストベストプラクティス

### 1. AAA パターン (Arrange-Act-Assert)
```typescript
it('should do something', () => {
  // Arrange - テストデータとモックの準備
  const input = { value: 'test' };
  mockService.method.mockReturnValue('result');
  
  // Act - テスト対象の実行
  const result = service.doSomething(input);
  
  // Assert - 結果の検証
  expect(result).toBe('result');
  expect(mockService.method).toHaveBeenCalledWith(input);
});
```

### 2. 意味のあるテスト名
```typescript
// ❌ 悪い例
it('should work', () => { ... });

// ✅ 良い例
it('should return error when input is null', () => { ... });
it('should emit connection event after successful connect', () => { ... });
it('should retry 3 times before failing', () => { ... });
```

### 3. エラーケースのテスト
```typescript
// 例外のテスト
await expect(service.method(invalidInput)).rejects.toThrow(ValidationError);
await expect(service.method(invalidInput)).rejects.toThrow('Specific error message');

// エラー状態のテスト
const result = service.methodThatReturnsResult(errorInput);
expect(result.success).toBe(false);
expect(result.error).toContain('expected error');
```

### 4. 非同期処理のテスト
```typescript
// Promise のテスト
it('should handle async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});

// イベントのテスト
it('should emit event', (done) => {
  service.on('event', (data) => {
    expect(data).toBe('expected');
    done();
  });
  service.triggerEvent();
});

// タイマーのテスト
it('should handle timeouts', () => {
  jest.useFakeTimers();
  
  const callback = jest.fn();
  service.setTimeout(callback, 1000);
  
  jest.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalled();
  
  jest.useRealTimers();
});
```

---

これらのテンプレートを使用して、一貫性のある高品質な単体テストを作成できます。
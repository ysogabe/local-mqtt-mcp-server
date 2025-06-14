# 統合テストシナリオ

## 🎯 概要

MQTT MCP Server の統合テストシナリオを定義し、サービス間連携、外部システムとの統合、エラー処理の検証を行います。

## 📋 テストシナリオ一覧

### 1. MQTT統合シナリオ

#### 1.1 基本的なMQTT接続フロー

```typescript
// tests/integration/mqtt/basic-connection-flow.test.ts
describe('Basic MQTT Connection Flow', () => {
  let testBroker: AedesServer;
  let connectionManager: ConnectionManager;
  let messageHandler: MessageHandler;

  beforeAll(async () => {
    testBroker = await createTestBroker(1883);
  });

  afterAll(async () => {
    await testBroker.close();
  });

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      defaultTimeout: 5000,
      maxConcurrentConnections: 10,
      healthCheckInterval: 30000
    });
    
    messageHandler = new MessageHandler(connectionManager, {
      timeout: 5000,
      retryAttempts: 3,
      batchSize: 100
    });
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
  });

  it('should connect, publish, subscribe and receive messages', async () => {
    // Arrange
    const brokerConfig = createTestBrokerConfig();
    const testTopic = 'integration/test/topic';
    const testMessage = { text: 'Hello Integration Test', timestamp: Date.now() };
    
    const receivedMessages: any[] = [];
    
    // Act - Connect to broker
    await connectionManager.connect(brokerConfig);
    expect(connectionManager.isConnected(brokerConfig.id)).toBe(true);
    
    // Act - Subscribe to topic
    const connection = connectionManager.getConnection(brokerConfig.id);
    
    // Set up message listener
    connection.on('message', (message) => {
      if (message.topic === testTopic) {
        receivedMessages.push({
          topic: message.topic,
          payload: JSON.parse(message.payload.toString()),
          qos: message.qos
        });
      }
    });
    
    await connection.subscribe(testTopic, { qos: 1 });
    
    // Act - Publish message
    await messageHandler.publish({
      brokerId: brokerConfig.id,
      topic: testTopic,
      message: testMessage,
      qos: 1,
      retain: false
    });
    
    // Wait for message to be received
    await waitForCondition(() => receivedMessages.length > 0, 5000);
    
    // Assert
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].topic).toBe(testTopic);
    expect(receivedMessages[0].payload).toEqual(testMessage);
    expect(receivedMessages[0].qos).toBe(1);
  });

  it('should handle multiple concurrent connections', async () => {
    // Arrange
    const brokerConfigs = [
      { ...createTestBrokerConfig(), id: 'broker1' },
      { ...createTestBrokerConfig(), id: 'broker2' },
      { ...createTestBrokerConfig(), id: 'broker3' }
    ];

    // Act
    const connectionPromises = brokerConfigs.map(config => 
      connectionManager.connect(config)
    );
    
    await Promise.all(connectionPromises);

    // Assert
    brokerConfigs.forEach(config => {
      expect(connectionManager.isConnected(config.id)).toBe(true);
    });
    
    const allConnections = connectionManager.getAllConnections();
    expect(allConnections.size).toBe(3);
  });

  it('should handle connection failures gracefully', async () => {
    // Arrange
    const invalidConfig = {
      id: 'invalid-broker',
      url: 'mqtt://invalid-host:1883',
      clientId: 'test-client',
      connection: { connectTimeout: 2000 }
    };

    // Act & Assert
    await expect(connectionManager.connect(invalidConfig)).rejects.toThrow();
    expect(connectionManager.isConnected('invalid-broker')).toBe(false);
  });
});
```

#### 1.2 QoS レベル検証

```typescript
// tests/integration/mqtt/qos-levels.test.ts
describe('QoS Levels Integration', () => {
  let testBroker: AedesServer;
  let connectionManager: ConnectionManager;
  let messageHandler: MessageHandler;

  beforeAll(async () => {
    testBroker = await createTestBroker(1883);
  });

  afterAll(async () => {
    await testBroker.close();
  });

  beforeEach(async () => {
    connectionManager = new ConnectionManager(defaultConnectionConfig);
    messageHandler = new MessageHandler(connectionManager, defaultMessageConfig);
    
    const brokerConfig = createTestBrokerConfig();
    await connectionManager.connect(brokerConfig);
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
  });

  it('should handle QoS 0 (At most once)', async () => {
    // Arrange
    const topic = 'test/qos0';
    const messages = ['message1', 'message2', 'message3'];
    const receivedMessages: string[] = [];
    
    const connection = connectionManager.getConnection();
    connection.on('message', (msg) => {
      if (msg.topic === topic) {
        receivedMessages.push(msg.payload.toString());
      }
    });
    
    await connection.subscribe(topic, { qos: 0 });

    // Act
    for (const message of messages) {
      await messageHandler.publish({
        topic,
        message,
        qos: 0
      });
    }

    await waitForCondition(() => receivedMessages.length >= messages.length, 3000);

    // Assert
    expect(receivedMessages.length).toBeGreaterThanOrEqual(0); // QoS 0 doesn't guarantee delivery
    expect(receivedMessages.length).toBeLessThanOrEqual(messages.length);
  });

  it('should handle QoS 1 (At least once)', async () => {
    // Arrange
    const topic = 'test/qos1';
    const messages = ['message1', 'message2', 'message3'];
    const receivedMessages: string[] = [];
    
    const connection = connectionManager.getConnection();
    connection.on('message', (msg) => {
      if (msg.topic === topic) {
        receivedMessages.push(msg.payload.toString());
      }
    });
    
    await connection.subscribe(topic, { qos: 1 });

    // Act
    for (const message of messages) {
      await messageHandler.publish({
        topic,
        message,
        qos: 1
      });
    }

    await waitForCondition(() => receivedMessages.length >= messages.length, 5000);

    // Assert
    expect(receivedMessages.length).toBeGreaterThanOrEqual(messages.length); // At least once
    expect(receivedMessages).toEqual(expect.arrayContaining(messages));
  });

  it('should handle QoS 2 (Exactly once)', async () => {
    // Arrange
    const topic = 'test/qos2';
    const messages = ['message1', 'message2', 'message3'];
    const receivedMessages: string[] = [];
    
    const connection = connectionManager.getConnection();
    connection.on('message', (msg) => {
      if (msg.topic === topic) {
        receivedMessages.push(msg.payload.toString());
      }
    });
    
    await connection.subscribe(topic, { qos: 2 });

    // Act
    for (const message of messages) {
      await messageHandler.publish({
        topic,
        message,
        qos: 2
      });
    }

    await waitForCondition(() => receivedMessages.length === messages.length, 7000);

    // Assert
    expect(receivedMessages).toHaveLength(messages.length); // Exactly once
    expect(receivedMessages).toEqual(messages);
  });
});
```

### 2. MCP統合シナリオ

#### 2.1 Claude Desktop統合テスト

```typescript
// tests/integration/mcp/claude-desktop-integration.test.ts
describe('Claude Desktop Integration', () => {
  let mcpServer: MCPServer;
  let mcpClient: MCPTestClient;
  let testBroker: AedesServer;

  beforeAll(async () => {
    testBroker = await createTestBroker(1883);
    
    const dependencies = await createTestMCPDependencies();
    mcpServer = new MCPServer(testMCPConfig, dependencies);
    await mcpServer.start();
    
    mcpClient = new MCPTestClient();
    await mcpClient.connect(mcpServer);
  });

  afterAll(async () => {
    await mcpClient.disconnect();
    await mcpServer.stop();
    await testBroker.close();
  });

  it('should complete full MQTT workflow via MCP tools', async () => {
    // Test mqtt_connect tool
    const connectResult = await mcpClient.callTool('mqtt_connect', {
      brokerId: 'test-broker',
      url: 'mqtt://localhost:1883',
      clientId: 'claude-integration-test'
    });
    
    expect(connectResult.isError).toBe(false);
    expect(connectResult.content[0].text).toContain('Successfully connected');

    // Test mqtt_subscribe tool
    const subscribeResult = await mcpClient.callTool('mqtt_subscribe', {
      brokerId: 'test-broker',
      subscriptions: [
        { topic: 'claude/test/+', qos: 1 },
        { topic: 'notifications/#', qos: 0 }
      ]
    });
    
    expect(subscribeResult.isError).toBe(false);
    expect(subscribeResult.content[0].text).toContain('Successfully subscribed');

    // Test mqtt_publish tool
    const publishResult = await mcpClient.callTool('mqtt_publish', {
      brokerId: 'test-broker',
      topic: 'claude/test/message',
      message: {
        from: 'Claude',
        content: 'Hello from Claude Desktop!',
        timestamp: new Date().toISOString()
      },
      qos: 1,
      retain: false
    });
    
    expect(publishResult.isError).toBe(false);
    expect(publishResult.content[0].text).toContain('Successfully published');

    // Verify message event is received
    const messageEvent = await mcpClient.waitForEvent('mqtt_message', 5000);
    expect(messageEvent.type).toBe('mqtt_message');
    expect(messageEvent.data.topic).toBe('claude/test/message');
    expect(messageEvent.data.message).toContain('Claude');

    // Test mqtt_status tool
    const statusResult = await mcpClient.callTool('mqtt_status', {
      brokerId: 'test-broker'
    });
    
    expect(statusResult.isError).toBe(false);
    const statusContent = JSON.parse(statusResult.content[0].text!);
    expect(statusContent.status).toBe('connected');
    expect(statusContent.metrics.messagesSent).toBeGreaterThan(0);
  });

  it('should handle MCP resource access correctly', async () => {
    // Connect to broker first
    await mcpClient.callTool('mqtt_connect', {
      brokerId: 'resource-test-broker',
      url: 'mqtt://localhost:1883'
    });

    // Test connections resource
    const connectionsResource = await mcpClient.readResource('mqtt://connections');
    expect(connectionsResource.contents).toHaveLength(1);
    
    const connectionsData = JSON.parse(connectionsResource.contents[0].text!);
    expect(connectionsData).toBeInstanceOf(Array);
    expect(connectionsData.some((conn: any) => conn.id === 'resource-test-broker')).toBe(true);

    // Test subscriptions resource
    await mcpClient.callTool('mqtt_subscribe', {
      brokerId: 'resource-test-broker',
      subscriptions: [{ topic: 'test/resource', qos: 1 }]
    });

    const subscriptionsResource = await mcpClient.readResource('mqtt://subscriptions');
    expect(subscriptionsResource.contents).toHaveLength(1);
    
    const subscriptionsData = JSON.parse(subscriptionsResource.contents[0].text!);
    expect(subscriptionsData).toBeInstanceOf(Array);
    expect(subscriptionsData.some((sub: any) => sub.topic === 'test/resource')).toBe(true);

    // Test metrics resource
    const metricsResource = await mcpClient.readResource('mqtt://metrics');
    expect(metricsResource.contents).toHaveLength(1);
    
    const metricsData = JSON.parse(metricsResource.contents[0].text!);
    expect(metricsData).toHaveProperty('mqtt');
    expect(metricsData.mqtt).toHaveProperty('connections');
  });

  it('should handle error scenarios gracefully', async () => {
    // Test connection to invalid broker
    const invalidConnectResult = await mcpClient.callTool('mqtt_connect', {
      brokerId: 'invalid-broker',
      url: 'mqtt://invalid-host:1883'
    });
    
    expect(invalidConnectResult.isError).toBe(true);
    expect(invalidConnectResult.content[0].text).toContain('Connection failed');

    // Test publish without connection
    const publishWithoutConnectResult = await mcpClient.callTool('mqtt_publish', {
      brokerId: 'non-existent-broker',
      topic: 'test/topic',
      message: 'test'
    });
    
    expect(publishWithoutConnectResult.isError).toBe(true);
    expect(publishWithoutConnectResult.content[0].text).toContain('Connection not found');

    // Test invalid resource URI
    await expect(mcpClient.readResource('mqtt://invalid-resource')).rejects.toThrow();
  });
});
```

### 3. セキュリティ統合シナリオ

#### 3.1 認証・認可統合テスト

```typescript
// tests/integration/security/auth-integration.test.ts
describe('Authentication & Authorization Integration', () => {
  let authManager: AuthenticationManager;
  let authzEngine: AuthorizationEngine;
  let mcpServer: MCPServer;

  beforeEach(async () => {
    const securityConfig = createTestSecurityConfig();
    authManager = new AuthenticationManager(securityConfig);
    authzEngine = new AuthorizationEngine();
    
    // Create test users with different roles
    await authManager.createUser({
      username: 'mqtt-admin',
      password: 'SecurePass123!',
      roles: ['mqtt:admin', 'system:admin']
    });
    
    await authManager.createUser({
      username: 'mqtt-publisher',
      password: 'SecurePass123!',
      roles: ['mqtt:publisher']
    });
    
    await authManager.createUser({
      username: 'mqtt-reader',
      password: 'SecurePass123!',
      roles: ['mqtt:reader']
    });
  });

  afterEach(async () => {
    authManager.dispose();
  });

  it('should authenticate and authorize admin user for all operations', async () => {
    // Authenticate admin user
    const authResult = await authManager.authenticate({
      type: 'local',
      username: 'mqtt-admin',
      password: 'SecurePass123!'
    });
    
    expect(authResult.success).toBe(true);
    expect(authResult.user?.roles).toContain('mqtt:admin');

    // Test authorization for various operations
    const adminContext = {
      userId: authResult.user!.id,
      userRoles: authResult.user!.roles,
      resource: 'mqtt:connections',
      action: 'create'
    };
    
    const authzResult = authzEngine.authorize(adminContext);
    expect(authzResult.granted).toBe(true);

    // Test admin can access all resources
    const resourceTests = [
      { resource: 'mqtt:messages', action: 'create' },
      { resource: 'mqtt:subscriptions', action: 'delete' },
      { resource: 'system:config', action: 'update' }
    ];
    
    for (const test of resourceTests) {
      const context = { ...adminContext, resource: test.resource, action: test.action };
      const result = authzEngine.authorize(context);
      expect(result.granted).toBe(true);
    }
  });

  it('should restrict publisher user to publish operations only', async () => {
    // Authenticate publisher user
    const authResult = await authManager.authenticate({
      type: 'local',
      username: 'mqtt-publisher',
      password: 'SecurePass123!'
    });
    
    expect(authResult.success).toBe(true);
    expect(authResult.user?.roles).toContain('mqtt:publisher');

    const publisherContext = {
      userId: authResult.user!.id,
      userRoles: authResult.user!.roles,
      resource: '',
      action: ''
    };

    // Should be able to publish messages
    const publishAuthz = authzEngine.authorize({
      ...publisherContext,
      resource: 'mqtt:messages',
      action: 'create'
    });
    expect(publishAuthz.granted).toBe(true);

    // Should be able to read resources
    const readAuthz = authzEngine.authorize({
      ...publisherContext,
      resource: 'mqtt:connections',
      action: 'read'
    });
    expect(readAuthz.granted).toBe(true);

    // Should NOT be able to delete subscriptions
    const deleteAuthz = authzEngine.authorize({
      ...publisherContext,
      resource: 'mqtt:subscriptions',
      action: 'delete'
    });
    expect(deleteAuthz.granted).toBe(false);

    // Should NOT be able to access system resources
    const systemAuthz = authzEngine.authorize({
      ...publisherContext,
      resource: 'system:config',
      action: 'read'
    });
    expect(systemAuthz.granted).toBe(false);
  });

  it('should restrict reader user to read operations only', async () => {
    // Authenticate reader user
    const authResult = await authManager.authenticate({
      type: 'local',
      username: 'mqtt-reader',
      password: 'SecurePass123!'
    });
    
    expect(authResult.success).toBe(true);
    expect(authResult.user?.roles).toContain('mqtt:reader');

    const readerContext = {
      userId: authResult.user!.id,
      userRoles: authResult.user!.roles,
      resource: '',
      action: ''
    };

    // Should be able to read all MQTT resources
    const readTests = [
      'mqtt:connections',
      'mqtt:subscriptions', 
      'mqtt:messages',
      'mqtt:metrics'
    ];
    
    for (const resource of readTests) {
      const authzResult = authzEngine.authorize({
        ...readerContext,
        resource,
        action: 'read'
      });
      expect(authzResult.granted).toBe(true);
    }

    // Should NOT be able to create/update/delete
    const forbiddenTests = [
      { resource: 'mqtt:messages', action: 'create' },
      { resource: 'mqtt:subscriptions', action: 'create' },
      { resource: 'mqtt:connections', action: 'delete' }
    ];
    
    for (const test of forbiddenTests) {
      const authzResult = authzEngine.authorize({
        ...readerContext,
        resource: test.resource,
        action: test.action
      });
      expect(authzResult.granted).toBe(false);
    }
  });

  it('should handle token-based authentication flow', async () => {
    // Create user and get token
    const user = await authManager.createUser({
      username: 'token-user',
      password: 'SecurePass123!',
      roles: ['mqtt:publisher']
    });
    
    const token = authManager.generateToken(user);
    expect(token).toBeDefined();

    // Authenticate with token
    const tokenAuthResult = await authManager.authenticate({
      type: 'token',
      token
    });
    
    expect(tokenAuthResult.success).toBe(true);
    expect(tokenAuthResult.user?.username).toBe('token-user');

    // Test token refresh
    const refreshedToken = await authManager.refreshToken(token);
    expect(refreshedToken).toBeDefined();
    expect(refreshedToken).not.toBe(token);

    // Validate refreshed token
    const validation = await authManager.validateToken(refreshedToken);
    expect(validation.valid).toBe(true);
    expect(validation.user?.username).toBe('token-user');
  });
});
```

### 4. パフォーマンス統合シナリオ

#### 4.1 高負荷テスト

```typescript
// tests/integration/performance/load-test.test.ts
describe('Performance Load Test', () => {
  let testBroker: AedesServer;
  let connectionManager: ConnectionManager;
  let messageHandler: MessageHandler;
  let connectionPool: ConnectionPool;

  beforeAll(async () => {
    testBroker = await createTestBroker(1883);
  });

  afterAll(async () => {
    await testBroker.close();
  });

  beforeEach(async () => {
    const poolConfig = {
      minConnections: 5,
      maxConnections: 20,
      acquireTimeout: 5000,
      idleTimeout: 30000,
      healthCheckInterval: 10000,
      validateOnAcquire: true,
      validateOnReturn: true
    };
    
    connectionPool = new ConnectionPool(createTestBrokerConfig(), poolConfig);
    connectionManager = new ConnectionManager(defaultConnectionConfig);
    messageHandler = new MessageHandler(connectionManager, {
      timeout: 5000,
      retryAttempts: 3,
      batchSize: 1000
    });
  });

  afterEach(async () => {
    await connectionPool.destroy();
    await connectionManager.disconnectAll();
  });

  it('should handle 1000 messages per second', async () => {
    // Arrange
    const messageCount = 1000;
    const testDuration = 1000; // 1 second
    const messagesPerBatch = 100;
    
    await connectionManager.connect(createTestBrokerConfig());
    
    const startTime = Date.now();
    const publishPromises: Promise<any>[] = [];

    // Act
    for (let batch = 0; batch < messageCount / messagesPerBatch; batch++) {
      const batchMessages = Array.from({ length: messagesPerBatch }, (_, i) => ({
        topic: `perf/test/${batch}/${i}`,
        message: { id: batch * messagesPerBatch + i, timestamp: Date.now() },
        qos: 0 as const
      }));
      
      publishPromises.push(messageHandler.publishBatch(batchMessages));
    }

    const results = await Promise.all(publishPromises);
    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    // Assert
    const totalSuccessful = results.reduce((sum, result) => sum + result.successCount, 0);
    const messagesPerSecond = (totalSuccessful * 1000) / actualDuration;
    
    expect(totalSuccessful).toBe(messageCount);
    expect(messagesPerSecond).toBeGreaterThan(900); // Allow some margin
  });

  it('should maintain connection pool efficiently under load', async () => {
    // Arrange
    const concurrentRequests = 50;
    const requestsPerConnection = 10;
    
    // Act
    const connectionPromises = Array.from({ length: concurrentRequests }, async () => {
      const connection = await connectionPool.acquire();
      
      try {
        // Simulate work
        for (let i = 0; i < requestsPerConnection; i++) {
          await connection.connection.publish(
            `pool/test/${i}`,
            `message ${i}`,
            { qos: 0 }
          );
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return { success: true };
      } finally {
        await connectionPool.release(connection);
      }
    });

    const results = await Promise.all(connectionPromises);
    const stats = connectionPool.getStats();

    // Assert
    expect(results.every(r => r.success)).toBe(true);
    expect(stats.acquiredConnections).toBe(concurrentRequests);
    expect(stats.releasedConnections).toBe(concurrentRequests);
    expect(stats.timeoutErrors).toBe(0);
    expect(stats.validationErrors).toBe(0);
  });

  it('should handle memory usage efficiently during sustained load', async () => {
    // Arrange
    const initialMemory = process.memoryUsage();
    const messageCount = 10000;
    
    await connectionManager.connect(createTestBrokerConfig());
    
    // Act - Generate sustained load
    for (let batch = 0; batch < 10; batch++) {
      const batchMessages = Array.from({ length: messageCount / 10 }, (_, i) => ({
        topic: `memory/test/${batch}/${i}`,
        message: { 
          id: i,
          data: 'x'.repeat(1000), // 1KB payload
          timestamp: Date.now()
        },
        qos: 0 as const
      }));
      
      await messageHandler.publishBatch(batchMessages);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePerMessage = memoryIncrease / messageCount;

    // Assert
    expect(memoryIncreasePerMessage).toBeLessThan(1024); // Less than 1KB per message
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total
  });
});
```

### 5. エラー処理統合シナリオ

#### 5.1 ネットワーク障害シミュレーション

```typescript
// tests/integration/error-handling/network-failures.test.ts
describe('Network Failure Scenarios', () => {
  let testBroker: AedesServer;
  let connectionManager: ConnectionManager;
  let reconnectManager: ReconnectManager;

  beforeAll(async () => {
    testBroker = await createTestBroker(1883);
  });

  afterAll(async () => {
    await testBroker.close();
  });

  beforeEach(() => {
    connectionManager = new ConnectionManager(defaultConnectionConfig);
    reconnectManager = new ReconnectManager({
      enabled: true,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      maxAttempts: 5,
      jitter: false
    });
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
  });

  it('should handle broker disconnection and reconnect automatically', async () => {
    // Arrange
    const brokerConfig = createTestBrokerConfig();
    await connectionManager.connect(brokerConfig);
    
    const connectionEvents: string[] = [];
    connectionManager.on('broker-connected', () => connectionEvents.push('connected'));
    connectionManager.on('broker-disconnected', () => connectionEvents.push('disconnected'));

    // Act - Simulate broker shutdown
    await testBroker.close();
    
    // Wait for disconnection to be detected
    await waitForCondition(() => 
      !connectionManager.isConnected(brokerConfig.id), 
      5000
    );
    
    // Restart broker
    testBroker = await createTestBroker(1883);
    
    // Wait for reconnection
    await waitForCondition(() => 
      connectionManager.isConnected(brokerConfig.id), 
      15000
    );

    // Assert
    expect(connectionEvents).toContain('disconnected');
    expect(connectionEvents.filter(e => e === 'connected').length).toBeGreaterThan(1);
  });

  it('should handle partial network failures with retry logic', async () => {
    // Arrange
    const brokerConfig = createTestBrokerConfig();
    await connectionManager.connect(brokerConfig);
    
    const messageHandler = new MessageHandler(connectionManager, {
      timeout: 2000,
      retryAttempts: 3,
      batchSize: 100
    });

    let attemptCount = 0;
    const mockConnection = connectionManager.getConnection(brokerConfig.id);
    
    // Mock intermittent failures
    const originalPublish = mockConnection.publish.bind(mockConnection);
    mockConnection.publish = jest.fn().mockImplementation(async (...args) => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Network timeout');
      }
      return originalPublish(...args);
    });

    // Act
    const result = await messageHandler.publish({
      topic: 'retry/test',
      message: 'test message',
      qos: 1
    });

    // Assert
    expect(result.success).toBe(true);
    expect(attemptCount).toBe(3); // 1 initial + 2 retries
  });

  it('should handle cascading failures gracefully', async () => {
    // Arrange
    const brokerConfigs = [
      { ...createTestBrokerConfig(), id: 'primary' },
      { ...createTestBrokerConfig(), id: 'secondary' },
      { ...createTestBrokerConfig(), id: 'tertiary' }
    ];

    // Connect to all brokers
    for (const config of brokerConfigs) {
      await connectionManager.connect(config);
    }

    const failureEvents: any[] = [];
    connectionManager.on('broker-error', (event) => failureEvents.push(event));

    // Act - Simulate cascading failures
    await testBroker.close(); // This will affect all connections
    
    // Wait for all failures to be detected
    await waitForCondition(() => failureEvents.length >= 3, 10000);

    // Assert
    expect(failureEvents).toHaveLength(3);
    brokerConfigs.forEach(config => {
      expect(connectionManager.isConnected(config.id)).toBe(false);
    });
  });
});
```

## 🛠️ テストユーティリティ

### 条件待機ヘルパー

```typescript
// tests/utils/test-helpers.ts
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

export async function waitForEvents(
  emitter: EventEmitter,
  eventName: string,
  count: number,
  timeout: number = 5000
): Promise<any[]> {
  const events: any[] = [];
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      emitter.removeListener(eventName, listener);
      reject(new Error(`Expected ${count} events, got ${events.length} within ${timeout}ms`));
    }, timeout);

    const listener = (event: any) => {
      events.push(event);
      if (events.length >= count) {
        clearTimeout(timeoutId);
        emitter.removeListener(eventName, listener);
        resolve(events);
      }
    };

    emitter.on(eventName, listener);
  });
}
```

### テスト環境セットアップ

```typescript
// tests/utils/test-environment.ts
export interface TestEnvironment {
  broker: AedesServer;
  connectionManager: ConnectionManager;
  messageHandler: MessageHandler;
  mcpServer?: MCPServer;
}

export async function setupTestEnvironment(
  options: {
    includeMCP?: boolean;
    brokerPort?: number;
    security?: boolean;
  } = {}
): Promise<TestEnvironment> {
  const broker = await createTestBroker(options.brokerPort || 1883);
  
  const connectionManager = new ConnectionManager({
    defaultTimeout: 5000,
    maxConcurrentConnections: 10,
    healthCheckInterval: 30000
  });
  
  const messageHandler = new MessageHandler(connectionManager, {
    timeout: 5000,
    retryAttempts: 3,
    batchSize: 100
  });
  
  let mcpServer: MCPServer | undefined;
  
  if (options.includeMCP) {
    const dependencies = {
      connectionManager,
      messageHandler
    };
    
    mcpServer = new MCPServer(createTestMCPConfig(), dependencies);
    await mcpServer.start();
  }
  
  return {
    broker,
    connectionManager,
    messageHandler,
    mcpServer
  };
}

export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  if (env.mcpServer) {
    await env.mcpServer.stop();
  }
  
  await env.connectionManager.disconnectAll();
  await env.broker.close();
}
```

## 📈 実行とCI/CD

### ローカル実行

```bash
# 統合テストのみ実行
npm run test:integration

# 特定のシナリオ実行
npm test -- --testPathPattern=mqtt/basic-connection

# タイムアウト延長
npm test -- --testTimeout=30000
```

### CI/CD設定

```yaml
# 統合テスト用のサービス設定
services:
  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - 1883:1883
    volumes:
      - ./tests/config/mosquitto.conf:/mosquitto/config/mosquitto.conf

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
```

統合テストは実際のシステム動作を検証する重要なテストレイヤーです。単体テストでは発見できない相互作用の問題や実際の運用環境での動作を確認できます。
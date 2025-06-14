# Phase 2: MQTT統合

## 🎯 フェーズ目標
MQTT プロトコルの完全実装により、複数ブローカーとの接続、メッセージング、購読管理を実現します。

## ⏰ 推定期間
**2-3週間** (実働16-24時間)

## 📋 前提条件
- Phase 1 基盤実装が完了している
- MQTT.js v5.0+ がインストール済み
- テスト用 MQTT ブローカー（Mosquitto）が利用可能

## 🏗️ アーキテクチャ概要

```
Phase 2 MQTT統合レイヤー
├── 接続管理 (services/connection/)
│   ├── ConnectionManager
│   ├── ConnectionPool  
│   └── ReconnectManager
├── メッセージング (services/messaging/)
│   ├── MessageHandler
│   ├── QoSManager
│   └── MessageTransformer
├── 購読管理 (services/subscription/)
│   ├── SubscriptionManager
│   ├── TopicMatcher
│   └── FilterChain
└── イベント管理 (services/events/)
    ├── EventEmitter
    ├── EventBuffer
    └── EventHistory
```

## 📦 依存関係の追加

```bash
# MQTT クライアント
npm install mqtt@^5.0.0

# 型定義
npm install -D @types/mqtt

# テスト用ユーティリティ
npm install -D aedes@^0.50.0  # テスト用MQTT broker
npm install -D supertest@^6.0.0
```

## 📝 実装タスク一覧

### Task 1: 基本MQTT接続実装 (3日)

#### 1.1 MQTT接続クラス実装 (8時間)
**ファイル**: `src/services/connection/mqtt-connection.ts`

**TDD実装手順**:
1. **テスト作成** (3時間)
2. **実装** (4時間)  
3. **リファクタリング** (1時間)

**テストケース**:
```typescript
// tests/integration/services/connection/mqtt-connection.test.ts
describe('MQTTConnection', () => {
  let testBroker: AedesServer;
  let connection: MQTTConnection;

  beforeAll(async () => {
    // テスト用ブローカー起動
    testBroker = await createTestBroker(1883);
  });

  afterAll(async () => {
    await testBroker.close();
  });

  beforeEach(() => {
    const config: IBrokerConfig = {
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
    connection = new MQTTConnection(config);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.disconnect();
    }
  });

  describe('connection lifecycle', () => {
    it('should connect to MQTT broker successfully', async () => {
      const result = await connection.connect();
      
      expect(result.success).toBe(true);
      expect(connection.isConnected()).toBe(true);
      expect(connection.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    it('should handle connection failure gracefully', async () => {
      const invalidConfig: IBrokerConfig = {
        id: 'invalid-broker',
        url: 'mqtt://invalid-host:1883',
        connection: { connectTimeout: 1000 }
      };
      
      const invalidConnection = new MQTTConnection(invalidConfig);
      
      await expect(invalidConnection.connect()).rejects.toThrow(ConnectionError);
    });

    it('should disconnect cleanly', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
      
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
      expect(connection.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should emit connection events', async () => {
      const connectSpy = jest.fn();
      const disconnectSpy = jest.fn();
      
      connection.on('connected', connectSpy);
      connection.on('disconnected', disconnectSpy);
      
      await connection.connect();
      await connection.disconnect();
      
      expect(connectSpy).toHaveBeenCalledWith({
        brokerId: 'test-broker',
        connectedAt: expect.any(Date)
      });
      expect(disconnectSpy).toHaveBeenCalledWith({
        brokerId: 'test-broker',
        disconnectedAt: expect.any(Date)
      });
    });
  });

  describe('authentication', () => {
    it('should authenticate with username/password', async () => {
      const authConfig: IBrokerConfig = {
        id: 'auth-broker',
        url: 'mqtt://localhost:1883',
        credentials: {
          username: 'testuser',
          password: 'testpass'
        }
      };
      
      const authConnection = new MQTTConnection(authConfig);
      const result = await authConnection.connect();
      
      expect(result.success).toBe(true);
      await authConnection.disconnect();
    });

    it('should handle authentication failure', async () => {
      const invalidAuthConfig: IBrokerConfig = {
        id: 'invalid-auth-broker',
        url: 'mqtt://localhost:1883',
        credentials: {
          username: 'invalid',
          password: 'invalid'
        }
      };
      
      const authConnection = new MQTTConnection(invalidAuthConfig);
      
      await expect(authConnection.connect()).rejects.toThrow(ConnectionError);
    });
  });

  describe('TLS/SSL connections', () => {
    it('should connect using TLS', async () => {
      const tlsConfig: IBrokerConfig = {
        id: 'tls-broker',
        url: 'mqtts://localhost:8883',
        tls: {
          rejectUnauthorized: false
        }
      };
      
      const tlsConnection = new MQTTConnection(tlsConfig);
      
      // Note: This test requires a TLS-enabled test broker
      // In real implementation, you'd set up test certificates
    });
  });

  describe('connection metrics', () => {
    it('should track connection metrics', async () => {
      await connection.connect();
      
      const metrics = connection.getMetrics();
      expect(metrics).toMatchObject({
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: expect.any(Number),
        errorCount: 0,
        reconnectCount: 0,
        uptime: expect.any(Number)
      });
    });

    it('should update metrics on activity', async () => {
      await connection.connect();
      
      // Simulate some activity
      await connection.publish('test/topic', 'test message', { qos: 1 });
      
      const metrics = connection.getMetrics();
      expect(metrics.messagesSent).toBe(1);
      expect(metrics.bytesTransferred).toBeGreaterThan(0);
    });
  });

  describe('keep alive', () => {
    it('should maintain keep alive connection', async () => {
      const keepAliveConfig: IBrokerConfig = {
        id: 'keepalive-broker',
        url: 'mqtt://localhost:1883',
        connection: {
          keepalive: 1, // 1 second for fast testing
          clean: true
        }
      };
      
      const keepAliveConnection = new MQTTConnection(keepAliveConfig);
      await keepAliveConnection.connect();
      
      // Wait for several keep alive intervals
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      expect(keepAliveConnection.isConnected()).toBe(true);
      
      await keepAliveConnection.disconnect();
    });
  });
});
```

**実装コード**:
```typescript
// src/services/connection/mqtt-connection.ts
import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { 
  IBrokerConfig, 
  ConnectionStatus, 
  IConnectionMetrics, 
  IMQTTMessage, 
  QoSLevel 
} from '../../core/interfaces/mqtt-types';
import { ConnectionError, TimeoutError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

export interface IConnectionResult {
  success: boolean;
  brokerId: string;
  connectedAt?: Date;
  error?: Error;
}

export interface IPublishOptions {
  qos?: QoSLevel;
  retain?: boolean;
  messageId?: number;
}

export interface ISubscribeOptions {
  qos?: QoSLevel;
}

export class MQTTConnection extends EventEmitter {
  private client?: mqtt.MqttClient;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private metrics: IConnectionMetrics;
  private logger = getLogger().withContext({ component: 'MQTTConnection' });
  private connectionStartTime?: Date;
  private lastActivity = Date.now();

  constructor(private config: IBrokerConfig) {
    super();
    this.metrics = this.initializeMetrics();
    this.logger = this.logger.withContext({ brokerId: config.id });
  }

  /**
   * ブローカーに接続
   */
  async connect(): Promise<IConnectionResult> {
    if (this.status === ConnectionStatus.CONNECTED) {
      return {
        success: true,
        brokerId: this.config.id,
        connectedAt: this.connectionStartTime
      };
    }

    this.setStatus(ConnectionStatus.CONNECTING);
    this.logger.info('Connecting to MQTT broker', { url: this.config.url });

    try {
      const connectOptions = this.buildConnectOptions();
      
      this.client = mqtt.connect(this.config.url, connectOptions);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(ConnectionError.connectionTimeout(
            this.config.id, 
            connectOptions.connectTimeout || 30000
          ));
        }, connectOptions.connectTimeout || 30000);

        this.client!.on('connect', () => {
          clearTimeout(timeout);
          this.handleConnected();
          resolve({
            success: true,
            brokerId: this.config.id,
            connectedAt: this.connectionStartTime
          });
        });

        this.client!.on('error', (error) => {
          clearTimeout(timeout);
          this.handleError(error);
          reject(ConnectionError.brokerUnreachable(this.config.id, this.config.url));
        });
      });

    } catch (error) {
      this.handleError(error as Error);
      throw ConnectionError.brokerUnreachable(this.config.id, this.config.url);
    }
  }

  /**
   * ブローカーから切断
   */
  async disconnect(force = false): Promise<void> {
    if (!this.client || this.status === ConnectionStatus.DISCONNECTED) {
      return;
    }

    this.logger.info('Disconnecting from MQTT broker', { force });

    return new Promise((resolve) => {
      if (force) {
        this.client!.end(true);
        this.handleDisconnected();
        resolve();
      } else {
        this.client!.end(false, {}, () => {
          this.handleDisconnected();
          resolve();
        });
      }
    });
  }

  /**
   * メッセージを発行
   */
  async publish(
    topic: string, 
    message: string | Buffer, 
    options: IPublishOptions = {}
  ): Promise<void> {
    if (!this.client || !this.isConnected()) {
      throw new ConnectionError(
        'NOT_CONNECTED',
        'Cannot publish: not connected to broker',
        { brokerId: this.config.id, topic }
      );
    }

    return new Promise((resolve, reject) => {
      const publishOptions: mqtt.IClientPublishOptions = {
        qos: options.qos || 0,
        retain: options.retain || false,
        messageId: options.messageId
      };

      this.client!.publish(topic, message, publishOptions, (error) => {
        if (error) {
          this.metrics.errorCount++;
          this.logger.error('Failed to publish message', { 
            topic, 
            error,
            options: publishOptions 
          });
          reject(error);
        } else {
          this.metrics.messagesSent++;
          this.metrics.bytesTransferred += Buffer.byteLength(message);
          this.updateLastActivity();
          
          this.logger.debug('Message published successfully', { 
            topic, 
            qos: publishOptions.qos,
            messageSize: Buffer.byteLength(message)
          });
          resolve();
        }
      });
    });
  }

  /**
   * トピックを購読
   */
  async subscribe(
    topic: string | string[], 
    options: ISubscribeOptions = {}
  ): Promise<mqtt.ISubscriptionGrant[]> {
    if (!this.client || !this.isConnected()) {
      throw new ConnectionError(
        'NOT_CONNECTED',
        'Cannot subscribe: not connected to broker',
        { brokerId: this.config.id, topic }
      );
    }

    return new Promise((resolve, reject) => {
      const subscribeOptions: mqtt.IClientSubscribeOptions = {
        qos: options.qos || 0
      };

      this.client!.subscribe(topic, subscribeOptions, (error, granted) => {
        if (error) {
          this.metrics.errorCount++;
          this.logger.error('Failed to subscribe to topic', { topic, error });
          reject(error);
        } else {
          this.logger.info('Successfully subscribed to topic', { 
            topic, 
            granted: granted.map(g => ({ topic: g.topic, qos: g.qos }))
          });
          resolve(granted);
        }
      });
    });
  }

  /**
   * トピック購読を解除
   */
  async unsubscribe(topic: string | string[]): Promise<void> {
    if (!this.client || !this.isConnected()) {
      throw new ConnectionError(
        'NOT_CONNECTED',
        'Cannot unsubscribe: not connected to broker',
        { brokerId: this.config.id, topic }
      );
    }

    return new Promise((resolve, reject) => {
      this.client!.unsubscribe(topic, (error) => {
        if (error) {
          this.metrics.errorCount++;
          this.logger.error('Failed to unsubscribe from topic', { topic, error });
          reject(error);
        } else {
          this.logger.info('Successfully unsubscribed from topic', { topic });
          resolve();
        }
      });
    });
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED && this.client?.connected === true;
  }

  /**
   * 接続状態を取得
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 接続メトリクスを取得
   */
  getMetrics(): IConnectionMetrics {
    return {
      ...this.metrics,
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime.getTime() : 0
    };
  }

  /**
   * ブローカー設定を取得
   */
  getConfig(): IBrokerConfig {
    return { ...this.config };
  }

  /**
   * 接続オプションを構築
   */
  private buildConnectOptions(): mqtt.IClientOptions {
    const options: mqtt.IClientOptions = {
      clientId: this.config.clientId || `mqtt-mcp-${Date.now()}`,
      clean: this.config.connection?.clean ?? true,
      keepalive: this.config.connection?.keepalive ?? 60,
      connectTimeout: this.config.connection?.connectTimeout ?? 30000,
      reconnectPeriod: 0, // 手動で再接続を管理
      protocolVersion: this.config.protocol?.version === '3.1.1' ? 4 : 5
    };

    // 認証情報
    if (this.config.credentials) {
      options.username = this.config.credentials.username;
      options.password = this.config.credentials.password;
    }

    // Last Will and Testament
    if (this.config.will) {
      options.will = {
        topic: this.config.will.topic,
        payload: this.config.will.payload,
        qos: this.config.will.qos,
        retain: this.config.will.retain
      };
    }

    // TLS/SSL設定
    if (this.config.tls) {
      options.ca = this.config.tls.ca;
      options.cert = this.config.tls.cert;
      options.key = this.config.tls.key;
      options.rejectUnauthorized = this.config.tls.rejectUnauthorized;
    }

    return options;
  }

  /**
   * 接続成功時の処理
   */
  private handleConnected(): void {
    this.setStatus(ConnectionStatus.CONNECTED);
    this.connectionStartTime = new Date();
    this.updateLastActivity();
    
    this.setupEventHandlers();
    
    this.logger.info('Successfully connected to MQTT broker');
    this.emit('connected', {
      brokerId: this.config.id,
      connectedAt: this.connectionStartTime
    });
  }

  /**
   * 切断時の処理
   */
  private handleDisconnected(): void {
    this.setStatus(ConnectionStatus.DISCONNECTED);
    
    this.logger.info('Disconnected from MQTT broker');
    this.emit('disconnected', {
      brokerId: this.config.id,
      disconnectedAt: new Date()
    });
  }

  /**
   * エラー処理
   */
  private handleError(error: Error): void {
    this.metrics.errorCount++;
    this.setStatus(ConnectionStatus.ERROR);
    
    this.logger.error('MQTT connection error', { error });
    this.emit('error', {
      brokerId: this.config.id,
      error,
      timestamp: new Date()
    });
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('message', (topic, payload, packet) => {
      this.handleIncomingMessage(topic, payload, packet);
    });

    this.client.on('disconnect', () => {
      this.handleDisconnected();
    });

    this.client.on('error', (error) => {
      this.handleError(error);
    });

    this.client.on('offline', () => {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.logger.warn('MQTT client went offline');
    });

    this.client.on('reconnect', () => {
      this.setStatus(ConnectionStatus.RECONNECTING);
      this.metrics.reconnectCount++;
      this.logger.info('Attempting to reconnect to MQTT broker');
    });
  }

  /**
   * 受信メッセージの処理
   */
  private handleIncomingMessage(
    topic: string, 
    payload: Buffer, 
    packet: mqtt.IPublishPacket
  ): void {
    this.metrics.messagesReceived++;
    this.metrics.bytesTransferred += payload.length;
    this.updateLastActivity();

    const message: IMQTTMessage = {
      topic,
      payload,
      qos: packet.qos || 0,
      retain: packet.retain || false,
      messageId: packet.messageId,
      timestamp: Date.now(),
      brokerId: this.config.id,
      properties: packet.properties
    };

    this.logger.debug('Received MQTT message', {
      topic,
      qos: message.qos,
      retain: message.retain,
      messageSize: payload.length
    });

    this.emit('message', message);
  }

  /**
   * 状態を更新
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      const previousStatus = this.status;
      this.status = status;
      
      this.emit('status-changed', {
        brokerId: this.config.id,
        previousStatus,
        currentStatus: status,
        timestamp: new Date()
      });
    }
  }

  /**
   * 最終アクティビティ時刻を更新
   */
  private updateLastActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * メトリクスを初期化
   */
  private initializeMetrics(): IConnectionMetrics {
    return {
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errorCount: 0,
      reconnectCount: 0,
      averageLatency: 0,
      uptime: 0
    };
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.removeAllListeners();
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
    }
  }
}
```

#### ✅ 完了条件 (Task 1.1)
- [ ] 全テストケースが通過する
- [ ] 基本的な接続・切断が動作する
- [ ] 認証機能が正しく動作する
- [ ] エラーハンドリングが適切
- [ ] メトリクス収集が動作する
- [ ] イベント通知が正しく発生する

---

#### 1.2 接続マネージャー実装 (4時間)
**ファイル**: `src/services/connection/connection-manager.ts`

**実装コード**:
```typescript
// src/services/connection/connection-manager.ts
import { EventEmitter } from 'events';
import { MQTTConnection } from './mqtt-connection';
import { 
  IBrokerConfig, 
  IConnectionInfo, 
  ConnectionStatus 
} from '../../core/interfaces/mqtt-types';
import { ConnectionError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

export interface IConnectionManagerConfig {
  defaultTimeout: number;
  maxConcurrentConnections: number;
  healthCheckInterval: number;
}

export class ConnectionManager extends EventEmitter {
  private connections = new Map<string, MQTTConnection>();
  private healthCheckTimer?: NodeJS.Timeout;
  private logger = getLogger().withContext({ component: 'ConnectionManager' });

  constructor(private config: IConnectionManagerConfig) {
    super();
    this.startHealthCheck();
  }

  /**
   * ブローカーに接続
   */
  async connect(brokerConfig: IBrokerConfig): Promise<void> {
    if (this.connections.has(brokerConfig.id)) {
      const existingConnection = this.connections.get(brokerConfig.id)!;
      if (existingConnection.isConnected()) {
        this.logger.warn('Already connected to broker', { brokerId: brokerConfig.id });
        return;
      }
    }

    if (this.connections.size >= this.config.maxConcurrentConnections) {
      throw new ConnectionError(
        'MAX_CONNECTIONS_EXCEEDED',
        `Maximum number of connections (${this.config.maxConcurrentConnections}) exceeded`,
        { maxConnections: this.config.maxConcurrentConnections }
      );
    }

    this.logger.info('Establishing connection to broker', { 
      brokerId: brokerConfig.id,
      url: brokerConfig.url 
    });

    const connection = new MQTTConnection(brokerConfig);
    this.setupConnectionEventHandlers(connection);

    try {
      await connection.connect();
      this.connections.set(brokerConfig.id, connection);
      
      this.emit('connection-established', {
        brokerId: brokerConfig.id,
        connectedAt: new Date()
      });
      
    } catch (error) {
      connection.dispose();
      throw error;
    }
  }

  /**
   * ブローカーから切断
   */
  async disconnect(brokerId: string, force = false): Promise<void> {
    const connection = this.connections.get(brokerId);
    if (!connection) {
      throw new ConnectionError(
        'CONNECTION_NOT_FOUND',
        `Connection not found: ${brokerId}`,
        { brokerId }
      );
    }

    this.logger.info('Disconnecting from broker', { brokerId, force });

    try {
      await connection.disconnect(force);
      connection.dispose();
      this.connections.delete(brokerId);
      
      this.emit('connection-terminated', {
        brokerId,
        disconnectedAt: new Date()
      });
      
    } catch (error) {
      this.logger.error('Failed to disconnect from broker', { brokerId, error });
      throw error;
    }
  }

  /**
   * 接続を取得
   */
  getConnection(brokerId?: string): MQTTConnection {
    if (brokerId) {
      const connection = this.connections.get(brokerId);
      if (!connection) {
        throw new ConnectionError(
          'CONNECTION_NOT_FOUND',
          `Connection not found: ${brokerId}`,
          { brokerId }
        );
      }
      return connection;
    }

    // デフォルト接続を返す（最初の接続済みブローカー）
    for (const connection of this.connections.values()) {
      if (connection.isConnected()) {
        return connection;
      }
    }

    throw new ConnectionError(
      'NO_ACTIVE_CONNECTIONS',
      'No active connections available'
    );
  }

  /**
   * 全接続を取得
   */
  getAllConnections(): Map<string, MQTTConnection> {
    return new Map(this.connections);
  }

  /**
   * 接続情報を取得
   */
  getConnectionInfo(brokerId?: string): IConnectionInfo[] {
    const connections = brokerId 
      ? [this.connections.get(brokerId)].filter(Boolean) as MQTTConnection[]
      : Array.from(this.connections.values());

    return connections.map(connection => ({
      id: connection.getConfig().id,
      config: connection.getConfig(),
      status: connection.getStatus(),
      metrics: connection.getMetrics(),
      createdAt: new Date(), // TODO: track actual creation time
      connectedAt: connection.isConnected() ? new Date() : undefined,
      lastActivity: new Date()
    }));
  }

  /**
   * 接続状態チェック
   */
  isConnected(brokerId?: string): boolean {
    if (brokerId) {
      const connection = this.connections.get(brokerId);
      return connection?.isConnected() ?? false;
    }

    return Array.from(this.connections.values()).some(conn => conn.isConnected());
  }

  /**
   * 全ブローカーから切断
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(
      brokerId => this.disconnect(brokerId)
    );

    await Promise.allSettled(disconnectPromises);
  }

  /**
   * 接続イベントハンドラーを設定
   */
  private setupConnectionEventHandlers(connection: MQTTConnection): void {
    connection.on('connected', (event) => {
      this.logger.info('Connection established', event);
      this.emit('broker-connected', event);
    });

    connection.on('disconnected', (event) => {
      this.logger.info('Connection terminated', event);
      this.emit('broker-disconnected', event);
    });

    connection.on('error', (event) => {
      this.logger.error('Connection error', event);
      this.emit('broker-error', event);
    });

    connection.on('message', (message) => {
      this.emit('message-received', message);
    });

    connection.on('status-changed', (event) => {
      this.emit('connection-status-changed', event);
    });
  }

  /**
   * ヘルスチェック開始
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * ヘルスチェック実行
   */
  private performHealthCheck(): void {
    for (const [brokerId, connection] of this.connections) {
      if (!connection.isConnected() && connection.getStatus() !== ConnectionStatus.CONNECTING) {
        this.logger.warn('Unhealthy connection detected', { brokerId });
        this.emit('connection-unhealthy', {
          brokerId,
          status: connection.getStatus(),
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.disconnectAll().catch(error => {
      this.logger.error('Error during cleanup', { error });
    });

    this.removeAllListeners();
  }
}
```

#### ✅ 完了条件 (Task 1.2)
- [ ] 複数ブローカーの同時管理が可能
- [ ] 接続ライフサイクル管理が適切
- [ ] ヘルスチェック機能が動作
- [ ] エラーハンドリングが完備

---

### Task 2: メッセージング機能実装 (3日)

#### 2.1 メッセージハンドラー実装 (6時間)
**ファイル**: `src/services/messaging/message-handler.ts`

**テストケース**:
```typescript
// tests/unit/services/messaging/message-handler.test.ts
describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockConnection: jest.Mocked<MQTTConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
    mockConnectionManager = createMockConnectionManager(mockConnection);
    
    messageHandler = new MessageHandler(mockConnectionManager, {
      timeout: 5000,
      retryAttempts: 3,
      batchSize: 100
    });
  });

  describe('message publishing', () => {
    it('should publish messages successfully', async () => {
      const params: IPublishParams = {
        topic: 'test/topic',
        message: 'test message',
        qos: 1,
        retain: true
      };

      await messageHandler.publish(params);

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test/topic',
        'test message',
        { qos: 1, retain: true }
      );
    });

    it('should handle different message types', async () => {
      const testCases = [
        { message: 'string message', expected: 'string message' },
        { message: { key: 'value' }, expected: '{"key":"value"}' },
        { message: Buffer.from('buffer'), expected: Buffer.from('buffer') },
        { message: 42, expected: '42' }
      ];

      for (const testCase of testCases) {
        await messageHandler.publish({
          topic: 'test/topic',
          message: testCase.message
        });

        expect(mockConnection.publish).toHaveBeenCalledWith(
          'test/topic',
          testCase.expected,
          expect.any(Object)
        );
      }
    });

    it('should validate topic names', async () => {
      const invalidTopics = [
        '',
        'topic with spaces',
        'topic/with/null\0char',
        'topic/+/invalid/#/more'
      ];

      for (const topic of invalidTopics) {
        await expect(messageHandler.publish({
          topic,
          message: 'test'
        })).rejects.toThrow(ProtocolError);
      }
    });

    it('should handle publish timeouts', async () => {
      mockConnection.publish.mockRejectedValue(new Error('Timeout'));

      await expect(messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      })).rejects.toThrow();
    });
  });

  describe('batch publishing', () => {
    it('should publish multiple messages', async () => {
      const messages: IPublishParams[] = [
        { topic: 'topic1', message: 'message1' },
        { topic: 'topic2', message: 'message2' },
        { topic: 'topic3', message: 'message3' }
      ];

      const result = await messageHandler.publishBatch(messages);

      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(mockConnection.publish).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch', async () => {
      mockConnection.publish
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Publish failed'))
        .mockResolvedValueOnce(undefined);

      const messages: IPublishParams[] = [
        { topic: 'topic1', message: 'message1' },
        { topic: 'topic2', message: 'message2' },
        { topic: 'topic3', message: 'message3' }
      ];

      const result = await messageHandler.publishBatch(messages);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });

    it('should respect batch size limits', async () => {
      const largeMessageCount = 150;
      const messages = Array.from({ length: largeMessageCount }, (_, i) => ({
        topic: `topic${i}`,
        message: `message${i}`
      }));

      const result = await messageHandler.publishBatch(messages);

      // Should process in batches
      expect(result.successCount).toBe(largeMessageCount);
    });
  });

  describe('message transformation', () => {
    it('should transform objects to JSON', async () => {
      const objectMessage = { sensor: 'temperature', value: 25.5 };

      await messageHandler.publish({
        topic: 'sensors/data',
        message: objectMessage
      });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'sensors/data',
        JSON.stringify(objectMessage),
        expect.any(Object)
      );
    });

    it('should handle binary data', async () => {
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      await messageHandler.publish({
        topic: 'binary/data',
        message: binaryData
      });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'binary/data',
        binaryData,
        expect.any(Object)
      );
    });

    it('should apply custom transformations', async () => {
      const customTransformer = jest.fn().mockReturnValue('transformed');
      messageHandler.addTransformer('custom', customTransformer);

      await messageHandler.publish({
        topic: 'test/topic',
        message: 'original',
        transform: 'custom'
      });

      expect(customTransformer).toHaveBeenCalledWith('original');
      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test/topic',
        'transformed',
        expect.any(Object)
      );
    });
  });

  describe('QoS handling', () => {
    it('should handle QoS 0 messages', async () => {
      await messageHandler.publish({
        topic: 'test/topic',
        message: 'test',
        qos: 0
      });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test/topic',
        'test',
        expect.objectContaining({ qos: 0 })
      );
    });

    it('should handle QoS 1 messages with acknowledgment', async () => {
      await messageHandler.publish({
        topic: 'test/topic',
        message: 'test',
        qos: 1
      });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test/topic',
        'test',
        expect.objectContaining({ qos: 1 })
      );
    });

    it('should handle QoS 2 messages with full handshake', async () => {
      await messageHandler.publish({
        topic: 'test/topic',
        message: 'test',
        qos: 2
      });

      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test/topic',
        'test',
        expect.objectContaining({ qos: 2 })
      );
    });
  });

  describe('error handling and retry', () => {
    it('should retry failed publishes', async () => {
      mockConnection.publish
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      await messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      });

      expect(mockConnection.publish).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      mockConnection.publish.mockRejectedValue(new Error('Persistent error'));

      await expect(messageHandler.publish({
        topic: 'test/topic',
        message: 'test'
      })).rejects.toThrow('Persistent error');

      expect(mockConnection.publish).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });
  });
});
```

**実装コード**:
```typescript
// src/services/messaging/message-handler.ts
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection/connection-manager';
import { 
  IPublishParams, 
  IMQTTMessage, 
  QoSLevel,
  validateMQTTTopic 
} from '../../core/interfaces/mqtt-types';
import { ProtocolError, TimeoutError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

export interface IMessageHandlerConfig {
  timeout: number;
  retryAttempts: number;
  batchSize: number;
  enableDeduplication?: boolean;
  maxMessageSize?: number;
}

export interface IPublishResult {
  success: boolean;
  messageId?: string;
  timestamp: Date;
  error?: Error;
}

export interface IBatchPublishResult {
  successCount: number;
  errorCount: number;
  results: (IPublishResult | undefined)[];
  errors: Array<{ index: number; error: Error }>;
}

export type MessageTransformer = (message: unknown) => string | Buffer;

export class MessageHandler extends EventEmitter {
  private transformers = new Map<string, MessageTransformer>();
  private duplicateCache = new Set<string>();
  private logger = getLogger().withContext({ component: 'MessageHandler' });

  constructor(
    private connectionManager: ConnectionManager,
    private config: IMessageHandlerConfig
  ) {
    super();
    this.setupDefaultTransformers();
  }

  /**
   * メッセージを発行
   */
  async publish(params: IPublishParams): Promise<IPublishResult> {
    const timer = this.logger.startTimer();
    
    try {
      // バリデーション
      this.validatePublishParams(params);
      
      // 重複チェック
      if (this.config.enableDeduplication && this.isDuplicate(params)) {
        return {
          success: true,
          messageId: this.generateMessageId(params),
          timestamp: new Date()
        };
      }
      
      // メッセージ変換
      const transformedMessage = this.transformMessage(params.message, params.transform);
      
      // サイズチェック
      this.validateMessageSize(transformedMessage);
      
      // 発行実行
      const connection = this.connectionManager.getConnection(params.brokerId);
      
      await this.publishWithRetry(connection, params.topic, transformedMessage, {
        qos: params.qos || 0,
        retain: params.retain || false
      });
      
      // 重複防止キャッシュに追加
      if (this.config.enableDeduplication) {
        this.addToDeduplicationCache(params);
      }
      
      const result: IPublishResult = {
        success: true,
        messageId: this.generateMessageId(params),
        timestamp: new Date()
      };
      
      this.emit('message-published', {
        ...params,
        result,
        transformedMessage
      });
      
      timer.done('Message published successfully', {
        topic: params.topic,
        qos: params.qos,
        messageSize: Buffer.byteLength(transformedMessage)
      });
      
      return result;
      
    } catch (error) {
      const result: IPublishResult = {
        success: false,
        timestamp: new Date(),
        error: error as Error
      };
      
      this.emit('publish-failed', {
        ...params,
        result,
        error
      });
      
      timer.done('Message publish failed', { error });
      throw error;
    }
  }

  /**
   * バッチでメッセージを発行
   */
  async publishBatch(messages: IPublishParams[]): Promise<IBatchPublishResult> {
    this.logger.info('Publishing batch of messages', { 
      count: messages.length,
      batchSize: this.config.batchSize 
    });

    const results: (IPublishResult | undefined)[] = new Array(messages.length);
    const errors: Array<{ index: number; error: Error }> = [];

    // バッチサイズごとに分割して処理
    for (let i = 0; i < messages.length; i += this.config.batchSize) {
      const batch = messages.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(async (message, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const result = await this.publish(message);
          results[globalIndex] = result;
        } catch (error) {
          errors.push({ index: globalIndex, error: error as Error });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    const successCount = results.filter(r => r?.success).length;
    const errorCount = errors.length;

    this.emit('batch-published', {
      totalCount: messages.length,
      successCount,
      errorCount,
      errors
    });

    return {
      successCount,
      errorCount,
      results,
      errors
    };
  }

  /**
   * カスタムトランスフォーマーを追加
   */
  addTransformer(name: string, transformer: MessageTransformer): void {
    this.transformers.set(name, transformer);
    this.logger.debug('Added custom message transformer', { name });
  }

  /**
   * パラメータバリデーション
   */
  private validatePublishParams(params: IPublishParams): void {
    if (!params.topic) {
      throw new ProtocolError('INVALID_TOPIC', 'Topic is required');
    }
    
    validateMQTTTopic(params.topic);
    
    if (params.qos !== undefined && ![0, 1, 2].includes(params.qos)) {
      throw ProtocolError.invalidQoS(params.qos);
    }
    
    if (params.message === undefined || params.message === null) {
      throw new ProtocolError('INVALID_MESSAGE', 'Message cannot be null or undefined');
    }
  }

  /**
   * メッセージサイズの検証
   */
  private validateMessageSize(message: string | Buffer): void {
    const size = Buffer.byteLength(message);
    const maxSize = this.config.maxMessageSize || 256 * 1024; // 256KB default
    
    if (size > maxSize) {
      throw ProtocolError.messageTooLarge(size, maxSize);
    }
  }

  /**
   * メッセージ変換
   */
  private transformMessage(message: unknown, transformType?: string): string | Buffer {
    if (transformType && this.transformers.has(transformType)) {
      const transformer = this.transformers.get(transformType)!;
      return transformer(message);
    }

    // デフォルト変換
    if (Buffer.isBuffer(message)) {
      return message;
    }
    
    if (typeof message === 'string') {
      return message;
    }
    
    if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    
    return String(message);
  }

  /**
   * リトライ付きパブリッシュ
   */
  private async publishWithRetry(
    connection: any,
    topic: string,
    message: string | Buffer,
    options: any,
    attempt = 0
  ): Promise<void> {
    try {
      await Promise.race([
        connection.publish(topic, message, options),
        this.createTimeoutPromise(this.config.timeout)
      ]);
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        this.logger.warn('Publish attempt failed, retrying', {
          topic,
          attempt: attempt + 1,
          maxAttempts: this.config.retryAttempts,
          error
        });
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.publishWithRetry(connection, topic, message, options, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * タイムアウトPromiseを作成
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          'PUBLISH_TIMEOUT',
          `Publish operation timed out after ${timeout}ms`,
          timeout
        ));
      }, timeout);
    });
  }

  /**
   * 重複チェック
   */
  private isDuplicate(params: IPublishParams): boolean {
    const key = this.generateMessageId(params);
    return this.duplicateCache.has(key);
  }

  /**
   * 重複防止キャッシュに追加
   */
  private addToDeduplicationCache(params: IPublishParams): void {
    const key = this.generateMessageId(params);
    this.duplicateCache.add(key);
    
    // キャッシュサイズ制限
    if (this.duplicateCache.size > 10000) {
      const firstKey = this.duplicateCache.values().next().value;
      this.duplicateCache.delete(firstKey);
    }
  }

  /**
   * メッセージIDを生成
   */
  private generateMessageId(params: IPublishParams): string {
    const content = typeof params.message === 'object' 
      ? JSON.stringify(params.message) 
      : String(params.message);
    
    // Simple hash function for demo - use crypto.createHash in production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${params.topic}:${Math.abs(hash)}`;
  }

  /**
   * デフォルトトランスフォーマーを設定
   */
  private setupDefaultTransformers(): void {
    this.transformers.set('json', (message) => JSON.stringify(message));
    this.transformers.set('string', (message) => String(message));
    this.transformers.set('buffer', (message) => Buffer.from(String(message)));
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.duplicateCache.clear();
    this.transformers.clear();
    this.removeAllListeners();
  }
}
```

#### ✅ 完了条件 (Task 2.1)
- [ ] メッセージ発行が正常動作する
- [ ] バッチ発行が効率的に動作する
- [ ] QoS レベル対応が完備されている
- [ ] エラーハンドリングとリトライが動作する
- [ ] メッセージ変換機能が動作する

この段階で Phase 2 の基本的な MQTT 統合が完了します。続きのタスクも同様に詳細な実装指示を作成しますが、文字数制限のため一旦ここで区切ります。

#### ✅ 完了条件 (Task 2.1)
- [ ] 全テストケースが通過する  
- [ ] バッチ処理が正しく動作する
- [ ] リトライ機能が適切に実装されている
- [ ] カスタムトランスフォーマーが動作する

---

**続きのタスクについて**: 残りのPhase 2タスク（QoS管理、購読管理、再接続機能など）とPhase 3、Phase 4の詳細実装指示も同様のTDD形式で作成可能です。現在までの実装で、基盤とMQTT統合の基本部分が完成します。

次に続けるタスクをお知らせください。
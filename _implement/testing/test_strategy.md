# テスト戦略

## 🎯 目標
MQTT MCP Server の包括的なテスト戦略を定義し、品質保証とリグレッション防止を実現します。

## 📊 テストピラミッド

```
        /\
       /  \ E2E Tests (5%)
      /____\  - Claude Desktop統合
     /      \  - 実際のMQTTブローカー
    / Integration \ (25%)
   /   Tests      \  - サービス間連携
  /________________\  - 外部システム結合
 /                  \
/   Unit Tests      / (70%)
\     (TDD)        /  - 各クラス・関数
 \________________/   - モック・スタブ使用
```

## 🧪 テスト分類とカバレージ目標

### 1. 単体テスト (Unit Tests) - 70%
**目標カバレージ**: 90%以上

#### 対象コンポーネント
- **基盤機能**: 型定義、設定管理、ログ、エラーハンドリング
- **MQTT機能**: 接続管理、メッセージハンドラー、購読管理
- **MCP機能**: ツール実装、リソース管理、イベント処理
- **セキュリティ**: 認証、認可、暗号化
- **パフォーマンス**: 接続プール、キャッシュ、メトリクス

#### テスト原則
- **テストファースト**: 実装前にテストを作成
- **独立性**: 各テストは他のテストに依存しない
- **高速実行**: 1テスト 100ms以下
- **決定論的**: 実行の度に同じ結果

### 2. 統合テスト (Integration Tests) - 25%
**目標カバレージ**: 80%以上

#### 対象範囲
- **サービス間連携**: ConnectionManager ↔ MessageHandler
- **外部依存**: MQTT ブローカー、ファイルシステム
- **プロトコル準拠**: MCP仕様との互換性
- **エラー処理**: 異常系シナリオの網羅

### 3. E2Eテスト (End-to-End Tests) - 5%
**目標カバレージ**: 主要ユースケース 100%

#### 対象シナリオ
- **Claude Desktop統合**: 実際のMCP通信
- **マルチブローカー**: 複数MQTT接続の管理
- **リアルタイム処理**: メッセージ送受信の全体フロー

## 🛠️ テストツールとフレームワーク

### 基本フレームワーク
```json
{
  "jest": "^29.0.0",
  "@types/jest": "^29.0.0",
  "ts-jest": "^29.0.0"
}
```

### モック・スタブライブラリ
```json
{
  "jest-mock": "^29.0.0",
  "nock": "^13.0.0",
  "supertest": "^6.0.0"
}
```

### テスト用MQTT環境
```json
{
  "aedes": "^0.50.0",
  "mqtt": "^5.0.0"
}
```

### カバレージ測定
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 85,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

## 📋 テスト実装ガイドライン

### 単体テストテンプレート

```typescript
// tests/unit/services/example.test.ts
describe('ExampleService', () => {
  let service: ExampleService;
  let mockDependency: jest.Mocked<DependencyService>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    service = new ExampleService(mockDependency);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = { /* test data */ };
      const expectedOutput = { /* expected result */ };
      mockDependency.someMethod.mockResolvedValue(expectedOutput);

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockDependency.someMethod).toHaveBeenCalledWith(input);
    });

    it('should handle error case', async () => {
      // Arrange
      const input = { /* test data */ };
      const error = new Error('Test error');
      mockDependency.someMethod.mockRejectedValue(error);

      // Act & Assert
      await expect(service.methodName(input)).rejects.toThrow('Test error');
    });

    it('should validate input parameters', async () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      await expect(service.methodName(invalidInput)).rejects.toThrow(ValidationError);
    });
  });
});
```

### 統合テストテンプレート

```typescript
// tests/integration/mqtt-integration.test.ts
describe('MQTT Integration', () => {
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
    connectionManager = new ConnectionManager(testConfig);
    messageHandler = new MessageHandler(connectionManager, testConfig);
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
  });

  it('should establish connection and publish message', async () => {
    // Arrange
    const brokerConfig = createTestBrokerConfig();
    
    // Act
    await connectionManager.connect(brokerConfig);
    
    const result = await messageHandler.publish({
      topic: 'test/topic',
      message: 'test message',
      qos: 1
    });

    // Assert
    expect(result.success).toBe(true);
    expect(connectionManager.isConnected()).toBe(true);
  });
});
```

### E2Eテストテンプレート

```typescript
// tests/e2e/claude-integration.test.ts
describe('Claude Desktop Integration', () => {
  let mcpServer: MCPServer;
  let mcpClient: MCPTestClient;

  beforeAll(async () => {
    mcpServer = await createTestMCPServer();
    mcpClient = new MCPTestClient();
    await mcpClient.connect(mcpServer);
  });

  afterAll(async () => {
    await mcpClient.disconnect();
    await mcpServer.stop();
  });

  it('should complete full MQTT workflow via MCP', async () => {
    // Connect to MQTT broker
    const connectResult = await mcpClient.callTool('mqtt_connect', {
      url: 'mqtt://localhost:1883',
      clientId: 'e2e-test-client'
    });
    expect(connectResult.isError).toBe(false);

    // Subscribe to topic
    const subscribeResult = await mcpClient.callTool('mqtt_subscribe', {
      subscriptions: [{ topic: 'e2e/test', qos: 1 }]
    });
    expect(subscribeResult.isError).toBe(false);

    // Publish message
    const publishResult = await mcpClient.callTool('mqtt_publish', {
      topic: 'e2e/test',
      message: 'Hello E2E',
      qos: 1
    });
    expect(publishResult.isError).toBe(false);

    // Verify message reception via events
    const messageEvent = await mcpClient.waitForEvent('mqtt_message', 5000);
    expect(messageEvent.data.topic).toBe('e2e/test');
    expect(messageEvent.data.message).toBe('Hello E2E');
  });
});
```

## 🎛️ テストユーティリティ

### モックファクトリー

```typescript
// tests/utils/mock-factories.ts
export function createMockConnection(): jest.Mocked<MQTTConnection> {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    getStatus: jest.fn().mockReturnValue(ConnectionStatus.CONNECTED),
    getMetrics: jest.fn().mockReturnValue({
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errorCount: 0,
      reconnectCount: 0,
      averageLatency: 0,
      uptime: 0
    }),
    getConfig: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  } as unknown as jest.Mocked<MQTTConnection>;
}

export function createMockConnectionManager(): jest.Mocked<ConnectionManager> {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getConnection: jest.fn(),
    getAllConnections: jest.fn().mockReturnValue(new Map()),
    getConnectionInfo: jest.fn().mockReturnValue([]),
    isConnected: jest.fn().mockReturnValue(false),
    disconnectAll: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  } as unknown as jest.Mocked<ConnectionManager>;
}

export function createTestBrokerConfig(): IBrokerConfig {
  return {
    id: 'test-broker',
    url: 'mqtt://localhost:1883',
    clientId: `test-client-${Date.now()}`,
    connection: {
      keepalive: 60,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 5000
    }
  };
}
```

### テスト用MQTTブローカー

```typescript
// tests/utils/test-broker.ts
import Aedes from 'aedes';
import { createServer } from 'net';

export interface AedesServer {
  broker: Aedes;
  server: any;
  close(): Promise<void>;
}

export async function createTestBroker(port: number = 1883): Promise<AedesServer> {
  const broker = new Aedes({
    id: 'test-broker',
    persistence: undefined // メモリ内のみ
  });

  const server = createServer(broker.handle);

  return new Promise((resolve, reject) => {
    server.listen(port, (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          broker,
          server,
          async close(): Promise<void> {
            return new Promise((closeResolve) => {
              broker.close(() => {
                server.close(() => {
                  closeResolve();
                });
              });
            });
          }
        });
      }
    });
  });
}

export function createTestMQTTClient(brokerUrl: string): Promise<any> {
  const mqtt = require('mqtt');
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl);
    
    client.on('connect', () => {
      resolve(client);
    });
    
    client.on('error', (error: Error) => {
      reject(error);
    });
  });
}
```

### MCPテストクライアント

```typescript
// tests/utils/mcp-test-client.ts
export class MCPTestClient {
  private server?: MCPServer;
  private events: any[] = [];

  async connect(server: MCPServer): Promise<void> {
    this.server = server;
    
    // イベントリスナーを設定
    server.on('event', (event) => {
      this.events.push(event);
    });
  }

  async disconnect(): Promise<void> {
    this.server = undefined;
    this.events = [];
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.server) {
      throw new Error('Not connected to server');
    }
    
    return this.server.callTool(name, args);
  }

  async readResource(uri: string): Promise<any> {
    if (!this.server) {
      throw new Error('Not connected to server');
    }
    
    return this.server.readResource(uri);
  }

  async waitForEvent(type: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Event ${type} not received within ${timeout}ms`));
      }, timeout);

      const checkEvents = () => {
        const event = this.events.find(e => e.type === type);
        if (event) {
          clearTimeout(timeoutId);
          resolve(event);
        } else {
          setTimeout(checkEvents, 100);
        }
      };

      checkEvents();
    });
  }

  getReceivedEvents(): any[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
}
```

## 📈 テスト実行とCI/CD

### ローカル実行

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレージ付き実行
npm run test:coverage

# 特定のテストファイル
npm test -- --testPathPattern=mqtt-connection

# 特定のテストケース
npm test -- --testNamePattern="should connect successfully"
```

### CI/CD設定 (GitHub Actions例)

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    services:
      mosquitto:
        image: eclipse-mosquitto:2.0
        ports:
          - 1883:1883
        options: >-
          --health-cmd "mosquitto_pub -h localhost -t test -m test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        MQTT_BROKER_URL: mqtt://localhost:1883
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        MQTT_BROKER_URL: mqtt://localhost:1883
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
```

## 🎯 テスト品質メトリクス

### コードカバレージ
- **ライン カバレージ**: 90%以上
- **ブランチ カバレージ**: 85%以上
- **関数 カバレージ**: 90%以上
- **ステートメント カバレージ**: 90%以上

### パフォーマンス
- **単体テスト**: 平均 50ms以下
- **統合テスト**: 平均 500ms以下
- **E2Eテスト**: 平均 5秒以下

### 信頼性
- **フレイキーテスト**: 0.1%以下
- **実行成功率**: 99.9%以上
- **並列実行**: 安全

## 🔧 テストデバッグとトラブルシューティング

### デバッグ設定

```typescript
// jest.config.js
module.exports = {
  // デバッグ時のタイムアウト延長
  testTimeout: process.env.DEBUG ? 600000 : 30000,
  
  // 詳細ログ出力
  verbose: process.env.DEBUG === 'true',
  
  // カバレージ収集の停止（デバッグ時）
  collectCoverage: process.env.DEBUG !== 'true',
  
  // シリアル実行（デバッグ時）
  maxWorkers: process.env.DEBUG ? 1 : undefined
};
```

### よくある問題と対策

#### 1. テストの不安定性
```typescript
// 悪い例：実際の時間に依存
test('should timeout after 1 second', async () => {
  const start = Date.now();
  await someAsyncOperation();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThan(1000);
});

// 良い例：モックタイマー使用
test('should timeout after 1 second', async () => {
  jest.useFakeTimers();
  const promise = someAsyncOperation();
  jest.advanceTimersByTime(1000);
  await expect(promise).rejects.toThrow('Timeout');
  jest.useRealTimers();
});
```

#### 2. 非同期処理の競合
```typescript
// 悪い例：競合状態が発生する可能性
test('should handle concurrent operations', async () => {
  const promises = [operation1(), operation2(), operation3()];
  const results = await Promise.all(promises);
  expect(results).toHaveLength(3);
});

// 良い例：適切な同期化
test('should handle concurrent operations', async () => {
  const results: any[] = [];
  const mutex = new Mutex();
  
  const promises = [operation1, operation2, operation3].map(async (op) => {
    await mutex.acquire();
    try {
      const result = await op();
      results.push(result);
    } finally {
      mutex.release();
    }
  });
  
  await Promise.all(promises);
  expect(results).toHaveLength(3);
});
```

#### 3. リソースリーク
```typescript
// 悪い例：リソースがクリーンアップされない
test('should connect to broker', async () => {
  const connection = new MQTTConnection(config);
  await connection.connect();
  expect(connection.isConnected()).toBe(true);
  // connection.disconnect() が抜けている
});

// 良い例：適切なクリーンアップ
test('should connect to broker', async () => {
  const connection = new MQTTConnection(config);
  try {
    await connection.connect();
    expect(connection.isConnected()).toBe(true);
  } finally {
    await connection.disconnect();
  }
});
```

## 📊 継続的品質改善

### テストメトリクス収集
- 実行時間の追跡
- カバレージ推移の監視
- フレイキーテストの特定
- パフォーマンス低下の検出

### 品質ゲート
- プルリクエスト時のテスト必須実行
- カバレージ低下時のビルド失敗
- クリティカルパス のテスト必須

### レポート自動生成
- 日次テストレポート
- カバレージトレンド分析
- パフォーマンス回帰検出

---

**継続的改善**: テスト戦略は開発の進行とともに継続的に見直し、改善していく必要があります。
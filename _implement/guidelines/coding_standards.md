# コーディング規約

## 🎯 目標

MQTT MCP Server プロジェクトの一貫性のあるコード品質を維持し、チーム開発の効率性を向上させるためのコーディング規約を定義します。

## 📋 基本原則

### 1. 可読性優先
- **明確な命名**: 略語を避け、意図が明確な名前を使用
- **適切なコメント**: なぜそうしたかを説明（何をしているかではなく）
- **一貫したフォーマット**: Prettier + ESLint による自動整形

### 2. 保守性重視
- **単一責任原則**: 1つのクラス/関数は1つの責任
- **疎結合**: 依存関係を最小限に抑制
- **テスタビリティ**: モック可能な設計

### 3. パフォーマンス考慮
- **非同期処理**: 適切なPromise/async-await使用
- **メモリ効率**: 不要なオブジェクト生成を避ける
- **型安全性**: TypeScriptの型システムを最大活用

## 🏗️ プロジェクト構造

### ディレクトリ構成
```
src/
├── core/                   # 基盤機能
│   ├── interfaces/         # TypeScript型定義
│   ├── config/            # 設定管理
│   ├── logging/           # ログ機能
│   └── errors/            # エラー定義
├── services/              # ビジネスロジック
│   ├── connection/        # MQTT接続管理
│   ├── messaging/         # メッセージ処理
│   └── events/           # イベント管理
├── mcp/                   # MCP実装
│   ├── server/           # MCPサーバー
│   ├── tools/            # MCPツール
│   └── resources/        # MCPリソース
├── security/              # セキュリティ機能
├── performance/           # パフォーマンス最適化
└── utils/                 # ユーティリティ
```

### ファイル命名規約
```typescript
// クラスファイル: kebab-case
mqtt-connection.ts
message-handler.ts
connection-manager.ts

// インターフェース: PascalCase with I prefix
interface IConnectionConfig { }
interface IMQTTMessage { }

// 型定義: PascalCase
type ConnectionStatus = 'connected' | 'disconnected';
type MessageQoS = 0 | 1 | 2;

// 定数: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
```

## 📝 TypeScript規約

### 1. 型定義

#### インターフェース定義
```typescript
// ✅ 良い例: 明確で拡張可能
interface IBrokerConfig {
  readonly id: string;
  readonly url: string;
  readonly clientId?: string;
  readonly connection?: IConnectionOptions;
  readonly authentication?: IAuthenticationConfig;
}

interface IConnectionOptions {
  readonly keepalive?: number;
  readonly clean?: boolean;
  readonly reconnectPeriod?: number;
  readonly connectTimeout?: number;
}

// ❌ 悪い例: 曖昧で型安全でない
interface Config {
  broker: any;
  options?: object;
}
```

#### 型ガード実装
```typescript
// ✅ 良い例: 適切な型ガード
export function isBrokerConfig(obj: unknown): obj is IBrokerConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'url' in obj &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).url === 'string'
  );
}

export function isValidQoS(value: unknown): value is MessageQoS {
  return typeof value === 'number' && [0, 1, 2].includes(value);
}
```

#### ジェネリクス活用
```typescript
// ✅ 良い例: 再利用可能で型安全
interface IResult<T, E = Error> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: E;
}

class MessageHandler<TMessage = unknown> {
  async publish<T extends TMessage>(
    params: IPublishParams<T>
  ): Promise<IResult<IPublishResult>> {
    // 実装
  }
}

// ユースケース特化型
type MQTTPublishResult = IResult<IPublishResult, ConnectionError>;
type ConnectionResult = IResult<IConnectionInfo, ConnectionError>;
```

### 2. クラス設計

#### 基本構造
```typescript
// ✅ 良い例: 明確な責任分離
export class MQTTConnection {
  private readonly config: IBrokerConfig;
  private readonly logger: ILogger;
  private client?: mqtt.MqttClient;
  private connectionState: ConnectionStatus = 'disconnected';
  private readonly eventEmitter: EventEmitter;

  constructor(
    config: IBrokerConfig,
    logger: ILogger = new DefaultLogger()
  ) {
    this.config = Object.freeze({ ...config });
    this.logger = logger;
    this.eventEmitter = new EventEmitter();
    
    this.validateConfig();
  }

  // パブリックメソッド: 明確なインターフェース
  public async connect(): Promise<IConnectionResult> {
    if (this.isConnected()) {
      return { success: true, data: this.getConnectionInfo() };
    }

    try {
      await this.establishConnection();
      this.connectionState = 'connected';
      this.logger.info('MQTT connection established', { 
        brokerId: this.config.id 
      });
      
      return { success: true, data: this.getConnectionInfo() };
    } catch (error) {
      this.handleConnectionError(error as Error);
      throw new ConnectionError('CONNECTION_FAILED', error.message, {
        brokerId: this.config.id,
        url: this.config.url
      });
    }
  }

  // プライベートメソッド: 実装詳細の隠蔽
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.config.url, this.getConnectionOptions());
      
      this.client.on('connect', () => {
        this.setupEventHandlers();
        resolve();
      });

      this.client.on('error', reject);
    });
  }

  private validateConfig(): void {
    if (!isBrokerConfig(this.config)) {
      throw new ValidationError('INVALID_BROKER_CONFIG', 
        'Broker configuration is invalid', this.config);
    }
  }
}
```

#### 依存性注入パターン
```typescript
// ✅ 良い例: テスタブルな設計
export class ConnectionManager {
  constructor(
    private readonly config: IConnectionManagerConfig,
    private readonly logger: ILogger,
    private readonly connectionFactory: IConnectionFactory,
    private readonly eventBus: IEventBus
  ) {}

  async connect(brokerConfig: IBrokerConfig): Promise<void> {
    const connection = this.connectionFactory.create(brokerConfig);
    // 実装
  }
}

// ファクトリーパターン使用
export interface IConnectionFactory {
  create(config: IBrokerConfig): IMQTTConnection;
}

export class MQTTConnectionFactory implements IConnectionFactory {
  create(config: IBrokerConfig): IMQTTConnection {
    return new MQTTConnection(config, this.logger);
  }
}
```

### 3. 非同期処理

#### Promise/async-await規約
```typescript
// ✅ 良い例: 適切なエラーハンドリング
export class MessageHandler {
  async publish(params: IPublishParams): Promise<IPublishResult> {
    try {
      this.validatePublishParams(params);
      
      const connection = await this.getConnection(params.brokerId);
      if (!connection.isConnected()) {
        throw new ConnectionError('NOT_CONNECTED', 
          `Broker ${params.brokerId} is not connected`);
      }

      const result = await this.performPublish(connection, params);
      
      this.logger.debug('Message published successfully', {
        topic: params.topic,
        qos: params.qos,
        messageId: result.messageId
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to publish message', { 
        error: error.message,
        params 
      });

      if (error instanceof MQTTError) {
        throw error;
      }

      throw new PublishError('PUBLISH_FAILED', error.message, { params });
    }
  }

  // タイムアウト処理
  private async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // リトライ機能
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break;
        }

        this.logger.warn(`Operation failed, retrying (${attempt}/${maxAttempts})`, {
          error: error.message
        });

        await this.delay(delayMs * attempt); // Exponential backoff
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### バッチ処理パターン
```typescript
// ✅ 良い例: 効率的なバッチ処理
export class MessageBatchProcessor {
  async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    batchSize: number = 100,
    concurrency: number = 5
  ): Promise<IBatchResult> {
    const results: IBatchResult = {
      total: items.length,
      processed: 0,
      errors: []
    };

    // バッチに分割
    const batches = this.chunkArray(items, batchSize);

    for (const batch of batches) {
      // 並行処理（制限付き）
      const semaphore = new Semaphore(concurrency);
      
      const batchPromises = batch.map(async (item, index) => {
        await semaphore.acquire();
        
        try {
          await processor(item);
          results.processed++;
        } catch (error) {
          results.errors.push({
            index: results.processed + index,
            item,
            error: error as Error
          });
        } finally {
          semaphore.release();
        }
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## 🔧 エラーハンドリング規約

### 1. カスタムエラークラス
```typescript
// ベースエラークラス
export abstract class MQTTError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.details = details;
    
    // Stack trace保持
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      details: this.details
    };
  }
}

// 具体的なエラークラス
export class ConnectionError extends MQTTError {
  public readonly category = ErrorCategory.CONNECTION_ERROR;
  public readonly statusCode = 503;

  static brokerUnreachable(brokerId: string, url: string): ConnectionError {
    return new ConnectionError(
      'BROKER_UNREACHABLE',
      `Cannot reach MQTT broker ${brokerId}`,
      { brokerId, url }
    );
  }

  static authenticationFailed(brokerId: string): ConnectionError {
    return new ConnectionError(
      'AUTHENTICATION_FAILED',
      `Authentication failed for broker ${brokerId}`,
      { brokerId }
    );
  }
}
```

### 2. エラーハンドリングパターン
```typescript
// ✅ 良い例: 段階的エラー処理
export class ServiceErrorHandler {
  async handleWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    errorLogger?: (error: Error) => void
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      if (errorLogger) {
        errorLogger(error as Error);
      }

      try {
        return await fallback();
      } catch (fallbackError) {
        // 両方失敗した場合は元のエラーを投げる
        throw error;
      }
    }
  }

  // エラー分類と対応
  categorizeError(error: Error): ErrorCategory {
    if (error instanceof ConnectionError) {
      return ErrorCategory.CONNECTION_ERROR;
    }
    if (error instanceof ValidationError) {
      return ErrorCategory.VALIDATION_ERROR;
    }
    if (error instanceof TimeoutError) {
      return ErrorCategory.TIMEOUT_ERROR;
    }
    
    return ErrorCategory.UNKNOWN_ERROR;
  }

  // 回復可能エラー判定
  isRecoverable(error: Error): boolean {
    const recoverableErrors = [
      'NETWORK_TIMEOUT',
      'TEMPORARY_UNAVAILABLE',
      'RATE_LIMITED'
    ];

    return error instanceof MQTTError && 
           recoverableErrors.includes(error.code);
  }
}
```

## 📊 ログ出力規約

### 1. 構造化ログ
```typescript
// ✅ 良い例: 構造化されたログ出力
export class StructuredLogger implements ILogger {
  private readonly context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}) {
    this.context = context;
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.log('info', message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.log('error', message, meta);
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.log('debug', message, meta);
  }

  private log(level: LogLevel, message: string, meta: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
      // 機密情報のマスキング
      ...this.maskSensitiveData(meta)
    };

    console.log(JSON.stringify(logEntry));
  }

  private maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    const masked = { ...data };

    for (const key of sensitiveKeys) {
      if (key in masked) {
        masked[key] = '***MASKED***';
      }
    }

    return masked;
  }
}

// 使用例
const logger = new StructuredLogger({ 
  service: 'mqtt-mcp-server',
  component: 'connection-manager' 
});

logger.info('Connection established', {
  brokerId: 'production-broker',
  clientId: 'client-001',
  duration: 1500
});
```

### 2. ログレベル運用
```typescript
// ログレベル定義
export enum LogLevel {
  ERROR = 'error',    // システムエラー、クリティカルな問題
  WARN = 'warn',      // 警告、非クリティカルな問題
  INFO = 'info',      // 重要なビジネスイベント
  DEBUG = 'debug',    // デバッグ情報
  TRACE = 'trace'     // 詳細なトレース情報
}

// コンテキスト付きロガー
export class ContextualLogger {
  static forComponent(componentName: string): ILogger {
    return new StructuredLogger({ component: componentName });
  }

  static forConnection(brokerId: string): ILogger {
    return new StructuredLogger({ 
      component: 'connection',
      brokerId 
    });
  }

  static forMessage(topic: string, messageId?: string): ILogger {
    return new StructuredLogger({ 
      component: 'messaging',
      topic,
      messageId 
    });
  }
}
```

## 🧪 テスト規約

### 1. テストファイル構成
```typescript
// tests/unit/services/connection/mqtt-connection.test.ts
import { MQTTConnection } from '../../../../src/services/connection/mqtt-connection';
import { createMockBrokerConfig, createMockLogger } from '../../../utils/test-helpers';

describe('MQTTConnection', () => {
  let connection: MQTTConnection;
  let mockLogger: jest.Mocked<ILogger>;
  let brokerConfig: IBrokerConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    brokerConfig = createMockBrokerConfig();
    connection = new MQTTConnection(brokerConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ネストした describe でグループ化
  describe('connection lifecycle', () => {
    describe('connect()', () => {
      it('should establish connection successfully', async () => {
        // AAA パターン
        // Arrange
        const expectedResult = { success: true };
        
        // Act
        const result = await connection.connect();
        
        // Assert
        expect(result).toMatchObject(expectedResult);
        expect(connection.isConnected()).toBe(true);
      });

      it('should handle connection timeout', async () => {
        // タイムアウトのテスト
        await expect(connection.connect()).rejects.toThrow(ConnectionError);
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle invalid configuration', () => {
      expect(() => new MQTTConnection(null as any)).toThrow(ValidationError);
    });
  });
});
```

### 2. モック作成規約
```typescript
// tests/utils/mock-factories.ts

// 型安全なモック作成
export function createMockConnection(): jest.Mocked<IMQTTConnection> {
  return {
    connect: jest.fn().mockResolvedValue({ success: true }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue([]),
    isConnected: jest.fn().mockReturnValue(true),
    getStatus: jest.fn().mockReturnValue('connected'),
    getMetrics: jest.fn().mockReturnValue({
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0
    }),
    dispose: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };
}

// Builder パターンでテストデータ作成
export class BrokerConfigBuilder {
  private config: Partial<IBrokerConfig> = {};

  withId(id: string): this {
    this.config.id = id;
    return this;
  }

  withUrl(url: string): this {
    this.config.url = url;
    return this;
  }

  withAuthentication(auth: IAuthenticationConfig): this {
    this.config.authentication = auth;
    return this;
  }

  build(): IBrokerConfig {
    return {
      id: this.config.id || 'test-broker',
      url: this.config.url || 'mqtt://localhost:1883',
      clientId: this.config.clientId || 'test-client',
      ...this.config
    };
  }
}

// 使用例
const config = new BrokerConfigBuilder()
  .withId('production-broker')
  .withUrl('mqtts://prod.example.com:8883')
  .withAuthentication({ username: 'user', password: 'pass' })
  .build();
```

## 📏 パフォーマンス規約

### 1. メモリ管理
```typescript
// ✅ 良い例: 適切なリソース管理
export class ResourceAwareService {
  private readonly connections = new Map<string, IMQTTConnection>();
  private readonly subscriptions = new Set<string>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // 定期的なクリーンアップ
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // 1分ごと
  }

  async dispose(): Promise<void> {
    // タイマーのクリア
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 接続のクリーンアップ
    const disconnectPromises = Array.from(this.connections.values())
      .map(conn => conn.disconnect());
    
    await Promise.all(disconnectPromises);
    
    this.connections.clear();
    this.subscriptions.clear();
  }

  private performCleanup(): void {
    // 非アクティブな接続の削除
    for (const [id, connection] of this.connections) {
      if (!connection.isConnected()) {
        this.connections.delete(id);
        connection.dispose();
      }
    }

    // メモリ使用量の監視
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      this.logger.warn('High memory usage detected', { 
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal 
      });
    }
  }
}
```

### 2. 非同期処理の最適化
```typescript
// ✅ 良い例: セマフォによる同期制御
export class ConcurrencyLimiter {
  private readonly semaphore: Semaphore;

  constructor(maxConcurrency: number = 10) {
    this.semaphore = new Semaphore(maxConcurrency);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.semaphore.acquire();
    
    try {
      return await operation();
    } finally {
      this.semaphore.release();
    }
  }
}

// バッチ処理の最適化
export class OptimizedBatchProcessor {
  async processInBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // バッチ間で少し待機（負荷分散）
      if (i + batchSize < items.length) {
        await this.delay(10);
      }
    }
    
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 🔧 設定とツール

### ESLint設定
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-readonly": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Prettier設定
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### husky設定（Git hooks）
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

---

**継続的改善**: コーディング規約はプロジェクトの成長とともに継続的に見直し、改善していく必要があります。
# Phase 1: 基盤実装

## 🎯 フェーズ目標
MQTT MCP Server の核となる基盤機能を実装し、後続フェーズの土台を構築します。

## ⏰ 推定期間
**1-2週間** (実働10-16時間)

## 📋 前提条件
- プロジェクト初期化が完了している
- 開発環境が正しく設定されている
- TypeScript, Jest, ESLint が動作する

## 🏗️ アーキテクチャ概要

```
Phase 1 基盤レイヤー
├── 型定義システム (interfaces/)
├── 設定管理システム (config/)
├── エラーハンドリング (errors/)
├── ログシステム (utils/logger)
└── 基本ユーティリティ (utils/)
```

## 📝 実装タスク一覧

### Task 1: 基本型定義実装 (2日)

#### 1.1 MQTT型定義 (4時間)
**ファイル**: `src/core/interfaces/mqtt-types.ts`

**TDD実装手順**:
1. **テスト作成** (1時間)
2. **実装** (2.5時間)
3. **リファクタリング** (30分)

**テストケース**:
```typescript
// tests/unit/core/interfaces/mqtt-types.test.ts
describe('MQTT Types', () => {
  describe('IBrokerConfig', () => {
    it('should accept valid MQTT URL formats', () => {
      const configs = [
        'mqtt://localhost:1883',
        'mqtts://broker.example.com:8883',
        'ws://localhost:8080/mqtt',
        'wss://broker.example.com:8084/mqtt'
      ];
      
      configs.forEach(url => {
        expect(() => validateBrokerUrl(url)).not.toThrow();
      });
    });

    it('should reject invalid MQTT URLs', () => {
      const invalidUrls = [
        'http://example.com',
        'ftp://broker.com',
        'invalid-url',
        ''
      ];
      
      invalidUrls.forEach(url => {
        expect(() => validateBrokerUrl(url)).toThrow();
      });
    });
  });

  describe('QoS levels', () => {
    it('should only accept valid QoS levels', () => {
      expect([0, 1, 2].every(qos => isValidQoS(qos))).toBe(true);
      expect([3, -1, 'invalid'].every(qos => isValidQoS(qos))).toBe(false);
    });
  });

  describe('Topic validation', () => {
    it('should validate MQTT topic formats', () => {
      const validTopics = [
        'sensors/temperature',
        'home/livingroom/+/status',
        'alerts/#',
        'system/health'
      ];
      
      validTopics.forEach(topic => {
        expect(topic).toBeValidMQTTTopic();
      });
    });

    it('should reject invalid MQTT topics', () => {
      const invalidTopics = [
        'sensors/+/+/invalid/#/more',
        'topic with spaces',
        'topic/with/null\0char',
        ''
      ];
      
      invalidTopics.forEach(topic => {
        expect(() => validateMQTTTopic(topic)).toThrow();
      });
    });
  });
});
```

**実装コード**:
```typescript
// src/core/interfaces/mqtt-types.ts

/**
 * MQTT Quality of Service レベル
 */
export type QoSLevel = 0 | 1 | 2;

/**
 * MQTT プロトコルバージョン
 */
export type MQTTVersion = '3.1.1' | '5.0';

/**
 * MQTT接続状態
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * ブローカー設定インターフェース
 */
export interface IBrokerConfig {
  readonly id: string;
  readonly url: string;
  readonly clientId?: string;
  readonly protocol?: {
    version: MQTTVersion;
    protocolId?: string;
  };
  readonly credentials?: {
    username: string;
    password: string;
  };
  readonly connection?: {
    keepalive: number;
    clean: boolean;
    reconnectPeriod: number;
    connectTimeout: number;
  };
  readonly will?: {
    topic: string;
    payload: string;
    qos: QoSLevel;
    retain: boolean;
  };
  readonly tls?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized: boolean;
  };
}

/**
 * MQTT メッセージインターフェース
 */
export interface IMQTTMessage {
  readonly topic: string;
  readonly payload: Buffer | string | object;
  readonly qos: QoSLevel;
  readonly retain: boolean;
  readonly messageId?: number;
  readonly timestamp: number;
  readonly brokerId: string;
  readonly properties?: IMQTTProperties; // MQTT v5.0
}

/**
 * MQTT v5.0 プロパティ
 */
export interface IMQTTProperties {
  readonly messageExpiryInterval?: number;
  readonly topicAlias?: number;
  readonly responseTopic?: string;
  readonly correlationData?: Buffer;
  readonly userProperties?: Record<string, string>;
  readonly subscriptionIdentifier?: number;
  readonly contentType?: string;
}

/**
 * 購読設定インターフェース
 */
export interface ISubscription {
  readonly id: string;
  readonly brokerId: string;
  readonly topic: string;
  readonly qos: QoSLevel;
  readonly options?: {
    nl?: boolean;  // No Local (MQTT v5.0)
    rap?: boolean; // Retain as Published (MQTT v5.0)
    rh?: number;   // Retain Handling (MQTT v5.0)
  };
  readonly createdAt: Date;
  readonly messageCount: number;
  readonly lastActivity?: Date;
}

/**
 * 接続情報インターフェース
 */
export interface IConnectionInfo {
  readonly id: string;
  readonly config: IBrokerConfig;
  readonly status: ConnectionStatus;
  readonly metrics: IConnectionMetrics;
  readonly createdAt: Date;
  readonly connectedAt?: Date;
  readonly lastActivity: Date;
  readonly error?: Error;
}

/**
 * 接続メトリクス
 */
export interface IConnectionMetrics {
  readonly messagesSent: number;
  readonly messagesReceived: number;
  readonly bytesTransferred: number;
  readonly errorCount: number;
  readonly reconnectCount: number;
  readonly averageLatency: number;
  readonly uptime: number;
}

/**
 * パブリッシュパラメータ
 */
export interface IPublishParams {
  readonly brokerId?: string;
  readonly topic: string;
  readonly message: unknown;
  readonly qos?: QoSLevel;
  readonly retain?: boolean;
  readonly properties?: IMQTTProperties;
}

/**
 * サブスクライブパラメータ
 */
export interface ISubscribeParams {
  readonly brokerId?: string;
  readonly topic: string;
  readonly qos?: QoSLevel;
  readonly options?: {
    nl?: boolean;
    rap?: boolean;
    rh?: number;
  };
}

/**
 * URL検証ユーティリティ
 */
export function validateBrokerUrl(url: string): void {
  const validProtocols = ['mqtt:', 'mqtts:', 'ws:', 'wss:'];
  
  try {
    const parsed = new URL(url);
    if (!validProtocols.includes(parsed.protocol)) {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }
  } catch (error) {
    throw new Error(`Invalid broker URL: ${url}`);
  }
}

/**
 * QoS検証ユーティリティ
 */
export function isValidQoS(qos: unknown): qos is QoSLevel {
  return typeof qos === 'number' && [0, 1, 2].includes(qos);
}

/**
 * MQTT トピック検証ユーティリティ
 */
export function validateMQTTTopic(topic: string): void {
  if (!topic || topic.length === 0) {
    throw new Error('Topic cannot be empty');
  }
  
  if (topic.includes('\0')) {
    throw new Error('Topic cannot contain null characters');
  }
  
  if (topic.includes(' ')) {
    throw new Error('Topic cannot contain spaces');
  }
  
  // ワイルドカード検証
  const hasMultiLevel = topic.includes('#');
  const hasSingleLevel = topic.includes('+');
  
  if (hasMultiLevel) {
    const multiLevelIndex = topic.indexOf('#');
    if (multiLevelIndex !== topic.length - 1) {
      throw new Error('Multi-level wildcard (#) must be at the end');
    }
    if (multiLevelIndex > 0 && topic[multiLevelIndex - 1] !== '/') {
      throw new Error('Multi-level wildcard (#) must be preceded by /');
    }
  }
  
  if (hasSingleLevel) {
    const parts = topic.split('/');
    for (const part of parts) {
      if (part.includes('+') && part !== '+') {
        throw new Error('Single-level wildcard (+) must occupy entire level');
      }
    }
  }
}
```

#### ✅ 完了条件 (Task 1.1)
- [ ] 全テストケースが通過する
- [ ] TypeScript 型チェックが通る
- [ ] ESLint エラーが0件
- [ ] JSDoc が適切に記述されている
- [ ] エクスポート定義が正しい

---

#### 1.2 MCP型定義 (3時間)
**ファイル**: `src/core/interfaces/mcp-types.ts`

**テストケース**:
```typescript
// tests/unit/core/interfaces/mcp-types.test.ts
describe('MCP Types', () => {
  describe('Tool definitions', () => {
    it('should validate tool input schemas', () => {
      const validSchema = {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['topic']
      };
      
      expect(() => validateToolSchema(validSchema)).not.toThrow();
    });

    it('should create proper tool responses', () => {
      const response = createToolResponse('Success', false);
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('isError', false);
    });
  });

  describe('Resource URIs', () => {
    it('should validate resource URI formats', () => {
      const validUris = [
        'mqtt://connections',
        'mqtt://subscriptions/broker-1',
        'mqtt://messages/broker-1/sensor/temperature'
      ];
      
      validUris.forEach(uri => {
        expect(() => validateResourceUri(uri)).not.toThrow();
      });
    });
  });

  describe('Event types', () => {
    it('should define all required event types', () => {
      expect(MCPEventType.MQTT_MESSAGE).toBeDefined();
      expect(MCPEventType.MQTT_CONNECTION).toBeDefined();
      expect(MCPEventType.MQTT_ERROR).toBeDefined();
      expect(MCPEventType.MQTT_SUBSCRIPTION).toBeDefined();
    });
  });
});
```

**実装コード**:
```typescript
// src/core/interfaces/mcp-types.ts
import { JSONSchema7 } from 'json-schema';

/**
 * MCP Tool定義
 */
export interface IMCPTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchema7;
}

/**
 * MCP Tool実行結果
 */
export interface IMCPToolResult {
  readonly content: IMCPContent[];
  readonly isError: boolean;
  readonly _meta?: Record<string, unknown>;
}

/**
 * MCP コンテンツ
 */
export interface IMCPContent {
  readonly type: 'text' | 'resource';
  readonly text?: string;
  readonly resource?: string;
  readonly mimeType?: string;
}

/**
 * MCP リソース定義
 */
export interface IMCPResource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
}

/**
 * MCP イベント種別
 */
export enum MCPEventType {
  MQTT_MESSAGE = 'mqtt_message',
  MQTT_CONNECTION = 'mqtt_connection',
  MQTT_SUBSCRIPTION = 'mqtt_subscription',
  MQTT_ERROR = 'mqtt_error'
}

/**
 * MCP イベント
 */
export interface IMCPEvent {
  readonly type: MCPEventType;
  readonly data: unknown;
  readonly timestamp: number;
  readonly _meta?: Record<string, unknown>;
}

/**
 * MCP メッセージイベントデータ
 */
export interface IMCPMessageEventData {
  readonly brokerId: string;
  readonly topic: string;
  readonly message: unknown;
  readonly qos: number;
  readonly retain: boolean;
  readonly timestamp: number;
}

/**
 * MCP 接続イベントデータ
 */
export interface IMCPConnectionEventData {
  readonly brokerId: string;
  readonly status: 'connected' | 'disconnected' | 'error';
  readonly timestamp: number;
  readonly error?: string;
}

/**
 * MCP エラーイベントデータ
 */
export interface IMCPErrorEventData {
  readonly brokerId: string;
  readonly operation: string;
  readonly error: {
    code: string;
    message: string;
  };
  readonly timestamp: number;
}

/**
 * MCP 購読イベントデータ
 */
export interface IMCPSubscriptionEventData {
  readonly brokerId: string;
  readonly topic: string;
  readonly action: 'subscribed' | 'unsubscribed';
  readonly qos: number;
  readonly timestamp: number;
}

/**
 * Tool スキーマ検証
 */
export function validateToolSchema(schema: JSONSchema7): void {
  if (!schema.type || schema.type !== 'object') {
    throw new Error('Tool schema must be of type "object"');
  }
  
  if (!schema.properties) {
    throw new Error('Tool schema must have properties');
  }
}

/**
 * Tool レスポンス作成ヘルパー
 */
export function createToolResponse(
  text: string, 
  isError: boolean = false,
  meta?: Record<string, unknown>
): IMCPToolResult {
  return {
    content: [{
      type: 'text',
      text
    }],
    isError,
    _meta: meta
  };
}

/**
 * Resource URI 検証
 */
export function validateResourceUri(uri: string): void {
  if (!uri.startsWith('mqtt://')) {
    throw new Error('Resource URI must start with mqtt://');
  }
  
  const path = uri.slice(7); // Remove 'mqtt://'
  if (!path || path.length === 0) {
    throw new Error('Resource URI must have a path');
  }
}

/**
 * Event 作成ヘルパー
 */
export function createMCPEvent(
  type: MCPEventType,
  data: unknown,
  meta?: Record<string, unknown>
): IMCPEvent {
  return {
    type,
    data,
    timestamp: Date.now(),
    _meta: meta
  };
}
```

#### ✅ 完了条件 (Task 1.2)
- [ ] 全テストケースが通過する
- [ ] MCP SDK との互換性確認
- [ ] 型定義が完全で一貫している
- [ ] ヘルパー関数が正しく動作する

---

#### 1.3 設定型定義 (2時間)
**ファイル**: `src/core/interfaces/config-types.ts`

**実装例**:
```typescript
/**
 * システム設定インターフェース
 */
export interface ISystemConfig {
  readonly mcp: IMCPConfig;
  readonly mqtt: IMQTTConfig;
  readonly logging: ILoggingConfig;
  readonly security: ISecurityConfig;
  readonly monitoring: IMonitoringConfig;
}

export interface IMCPConfig {
  readonly name: string;
  readonly version: string;
  readonly transport: 'stdio' | 'http';
  readonly maxConnections?: number;
}

export interface IMQTTConfig {
  readonly brokers: IBrokerConfig[];
  readonly defaultBrokerId?: string;
  readonly messageRetention: {
    enabled: boolean;
    maxMessages: number;
    maxAge: number; // seconds
  };
}

export interface ILoggingConfig {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly format: 'json' | 'text';
  readonly file?: string;
  readonly maxSize: string;
  readonly maxFiles: number;
}

export interface ISecurityConfig {
  readonly authentication: {
    enabled: boolean;
    providers: string[];
  };
  readonly encryption: {
    algorithm: string;
    keyPath: string;
  };
  readonly rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

export interface IMonitoringConfig {
  readonly metrics: {
    enabled: boolean;
    port: number;
    path: string;
  };
  readonly healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}
```

#### ✅ 完了条件 (Task 1.3)
- [ ] 設定型が包括的に定義されている
- [ ] デフォルト値が適切に設定されている
- [ ] バリデーション関数が実装されている

---

### Task 2: 設定管理システム実装 (2日)

#### 2.1 設定ローダー実装 (4時間)
**ファイル**: `src/core/config/config-manager.ts`

**TDD実装手順**:
1. **テスト作成** (1.5時間)
2. **実装** (2時間)
3. **リファクタリング** (30分)

**テストケース**:
```typescript
// tests/unit/core/config/config-manager.test.ts
describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockFs: jest.Mocked<typeof import('fs')>;

  beforeEach(() => {
    mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
    configManager = new ConfigManager();
  });

  describe('loadConfig', () => {
    it('should load config from file', async () => {
      const mockConfig = {
        mcp: { name: 'test', version: '1.0.0', transport: 'stdio' },
        mqtt: { brokers: [] },
        logging: { level: 'info', format: 'json' }
      };
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      
      const config = await configManager.loadConfig('test-config.json');
      
      expect(config).toEqual(expect.objectContaining(mockConfig));
    });

    it('should merge multiple config sources', async () => {
      const fileConfig = { mcp: { name: 'file-config' } };
      const envConfig = { mcp: { version: '2.0.0' } };
      
      jest.spyOn(configManager, 'loadFromFile').mockResolvedValue(fileConfig);
      jest.spyOn(configManager, 'loadFromEnvironment').mockReturnValue(envConfig);
      
      const config = await configManager.loadConfig();
      
      expect(config.mcp.name).toBe('file-config');
      expect(config.mcp.version).toBe('2.0.0');
    });

    it('should validate loaded config', async () => {
      const invalidConfig = { mcp: { name: '' } }; // Invalid: empty name
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));
      
      await expect(configManager.loadConfig('invalid.json')).rejects.toThrow();
    });

    it('should apply default values for missing config', async () => {
      const partialConfig = { mcp: { name: 'test' } };
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));
      
      const config = await configManager.loadConfig('partial.json');
      
      expect(config.logging.level).toBe('info'); // Default value
      expect(config.mqtt.messageRetention.enabled).toBe(true); // Default value
    });
  });

  describe('environment variable handling', () => {
    it('should load config from environment variables', () => {
      process.env.MQTT_MCP_LOG_LEVEL = 'debug';
      process.env.MQTT_MCP_BROKER_URL = 'mqtt://test:1883';
      
      const config = configManager.loadFromEnvironment();
      
      expect(config.logging?.level).toBe('debug');
      expect(config.mqtt?.brokers?.[0]?.url).toBe('mqtt://test:1883');
    });

    it('should handle nested environment variables', () => {
      process.env.MQTT_MCP_SECURITY_AUTHENTICATION_ENABLED = 'true';
      process.env.MQTT_MCP_SECURITY_RATE_LIMIT_MAX_REQUESTS = '100';
      
      const config = configManager.loadFromEnvironment();
      
      expect(config.security?.authentication?.enabled).toBe(true);
      expect(config.security?.rateLimit?.maxRequests).toBe(100);
    });
  });

  describe('config validation', () => {
    it('should validate MCP config', () => {
      const config = { mcp: { name: '', version: '1.0.0' } };
      
      expect(() => configManager.validateConfig(config)).toThrow('MCP name is required');
    });

    it('should validate MQTT broker configs', () => {
      const config = {
        mqtt: {
          brokers: [{ id: 'test', url: 'invalid-url' }]
        }
      };
      
      expect(() => configManager.validateConfig(config)).toThrow('Invalid broker URL');
    });

    it('should validate logging config', () => {
      const config = {
        logging: { level: 'invalid-level' }
      };
      
      expect(() => configManager.validateConfig(config)).toThrow('Invalid log level');
    });
  });

  describe('config watching', () => {
    it('should watch for config file changes', async () => {
      const callback = jest.fn();
      configManager.watch(callback);
      
      // Simulate file change
      const watchCallback = mockFs.watch.mock.calls[0][1];
      watchCallback('change', 'config.json');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should debounce multiple rapid changes', async () => {
      const callback = jest.fn();
      configManager.watch(callback);
      
      const watchCallback = mockFs.watch.mock.calls[0][1];
      
      // Multiple rapid changes
      watchCallback('change', 'config.json');
      watchCallback('change', 'config.json');
      watchCallback('change', 'config.json');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
```

**実装コード**:
```typescript
// src/core/config/config-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import { cosmiconfig } from 'cosmiconfig';
import { ISystemConfig, IMQTTConfig, IMCPConfig, ILoggingConfig } from '../interfaces/config-types';
import { validateBrokerUrl } from '../interfaces/mqtt-types';
import { MQTTMCPError, ErrorCategory } from '../errors';

export type ConfigChangeCallback = (newConfig: ISystemConfig) => void;

export class ConfigManager {
  private config?: ISystemConfig;
  private watchers: fs.FSWatcher[] = [];
  private changeCallbacks: ConfigChangeCallback[] = [];
  private debounceTimer?: NodeJS.Timeout;

  private readonly explorer = cosmiconfig('mqtt-mcp-server');

  /**
   * 設定ファイルを読み込み
   */
  async loadConfig(configPath?: string): Promise<ISystemConfig> {
    try {
      let fileConfig: Partial<ISystemConfig> = {};
      
      if (configPath) {
        fileConfig = await this.loadFromFile(configPath);
      } else {
        const result = await this.explorer.search();
        if (result) {
          fileConfig = result.config;
        }
      }
      
      const envConfig = this.loadFromEnvironment();
      const mergedConfig = this.mergeConfigs(this.getDefaultConfig(), fileConfig, envConfig);
      
      this.validateConfig(mergedConfig);
      
      this.config = mergedConfig;
      return mergedConfig;
      
    } catch (error) {
      throw new MQTTMCPError(
        ErrorCategory.VALIDATION_ERROR,
        'CONFIG_LOAD_FAILED',
        `Failed to load configuration: ${error.message}`,
        500,
        { configPath, error }
      );
    }
  }

  /**
   * ファイルから設定を読み込み
   */
  async loadFromFile(filePath: string): Promise<Partial<ISystemConfig>> {
    try {
      const absolutePath = path.resolve(filePath);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.js':
        case '.ts':
          delete require.cache[absolutePath];
          return require(absolutePath);
        case '.yaml':
        case '.yml':
          const yaml = await import('yaml');
          return yaml.parse(content);
        default:
          throw new Error(`Unsupported config file format: ${ext}`);
      }
    } catch (error) {
      throw new MQTTMCPError(
        ErrorCategory.RESOURCE_ERROR,
        'CONFIG_FILE_READ_FAILED',
        `Failed to read config file: ${filePath}`,
        500,
        { filePath, error }
      );
    }
  }

  /**
   * 環境変数から設定を読み込み
   */
  loadFromEnvironment(): Partial<ISystemConfig> {
    const envConfig: Partial<ISystemConfig> = {};

    // MCP設定
    if (process.env.MQTT_MCP_NAME) {
      envConfig.mcp = { ...envConfig.mcp, name: process.env.MQTT_MCP_NAME };
    }
    if (process.env.MQTT_MCP_VERSION) {
      envConfig.mcp = { ...envConfig.mcp, version: process.env.MQTT_MCP_VERSION };
    }

    // MQTT設定
    if (process.env.MQTT_MCP_BROKER_URL) {
      const brokerConfig = {
        id: 'env-broker',
        url: process.env.MQTT_MCP_BROKER_URL,
        clientId: process.env.MQTT_MCP_CLIENT_ID,
        credentials: process.env.MQTT_MCP_USERNAME ? {
          username: process.env.MQTT_MCP_USERNAME,
          password: process.env.MQTT_MCP_PASSWORD || ''
        } : undefined
      };
      
      envConfig.mqtt = {
        brokers: [brokerConfig],
        defaultBrokerId: 'env-broker'
      };
    }

    // ログ設定
    if (process.env.MQTT_MCP_LOG_LEVEL) {
      envConfig.logging = {
        ...envConfig.logging,
        level: process.env.MQTT_MCP_LOG_LEVEL as any
      };
    }

    // セキュリティ設定
    if (process.env.MQTT_MCP_SECURITY_AUTHENTICATION_ENABLED) {
      envConfig.security = {
        ...envConfig.security,
        authentication: {
          enabled: process.env.MQTT_MCP_SECURITY_AUTHENTICATION_ENABLED === 'true',
          providers: []
        }
      };
    }

    return envConfig;
  }

  /**
   * 設定の妥当性検証
   */
  validateConfig(config: Partial<ISystemConfig>): void {
    // MCP設定検証
    if (config.mcp) {
      if (!config.mcp.name || config.mcp.name.trim().length === 0) {
        throw new Error('MCP name is required');
      }
      if (!config.mcp.version || config.mcp.version.trim().length === 0) {
        throw new Error('MCP version is required');
      }
      if (config.mcp.transport && !['stdio', 'http'].includes(config.mcp.transport)) {
        throw new Error('Invalid MCP transport type');
      }
    }

    // MQTT設定検証
    if (config.mqtt?.brokers) {
      for (const broker of config.mqtt.brokers) {
        validateBrokerUrl(broker.url);
        if (!broker.id || broker.id.trim().length === 0) {
          throw new Error('Broker ID is required');
        }
      }
    }

    // ログ設定検証
    if (config.logging?.level) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(config.logging.level)) {
        throw new Error(`Invalid log level: ${config.logging.level}`);
      }
    }

    if (config.logging?.format) {
      const validFormats = ['json', 'text'];
      if (!validFormats.includes(config.logging.format)) {
        throw new Error(`Invalid log format: ${config.logging.format}`);
      }
    }
  }

  /**
   * 設定ファイルの変更を監視
   */
  watch(callback: ConfigChangeCallback): void {
    this.changeCallbacks.push(callback);
    
    // 設定ファイルのパスを監視対象に追加
    const configPaths = [
      'mqtt-mcp-server.config.js',
      'mqtt-mcp-server.config.json',
      '.mqtt-mcp-serverrc',
      '.mqtt-mcp-serverrc.json',
      'package.json'
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const watcher = fs.watch(configPath, (eventType) => {
          if (eventType === 'change') {
            this.handleConfigChange();
          }
        });
        this.watchers.push(watcher);
      }
    }
  }

  /**
   * 設定変更の処理（デバウンス付き）
   */
  private handleConfigChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const newConfig = await this.loadConfig();
        this.changeCallbacks.forEach(callback => callback(newConfig));
      } catch (error) {
        console.error('Failed to reload configuration:', error);
      }
    }, 500); // 500ms デバウンス
  }

  /**
   * 設定の取得
   */
  getConfig(): ISystemConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * 設定値の取得
   */
  get<T>(keyPath: string, defaultValue?: T): T {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const keys = keyPath.split('.');
    let current: any = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue as T;
      }
    }

    return current;
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultConfig(): ISystemConfig {
    return {
      mcp: {
        name: 'mqtt-mcp-server',
        version: '0.1.0',
        transport: 'stdio'
      },
      mqtt: {
        brokers: [],
        messageRetention: {
          enabled: true,
          maxMessages: 1000,
          maxAge: 3600 // 1 hour
        }
      },
      logging: {
        level: 'info',
        format: 'json',
        maxSize: '10MB',
        maxFiles: 5
      },
      security: {
        authentication: {
          enabled: false,
          providers: []
        },
        encryption: {
          algorithm: 'aes-256-gcm',
          keyPath: ''
        },
        rateLimit: {
          enabled: false,
          windowMs: 60000,
          maxRequests: 100
        }
      },
      monitoring: {
        metrics: {
          enabled: false,
          port: 9090,
          path: '/metrics'
        },
        healthCheck: {
          enabled: true,
          interval: 30,
          timeout: 5
        }
      }
    };
  }

  /**
   * 設定のマージ
   */
  private mergeConfigs(...configs: Partial<ISystemConfig>[]): ISystemConfig {
    const merged = {} as ISystemConfig;
    
    for (const config of configs) {
      this.deepMerge(merged, config);
    }
    
    return merged;
  }

  /**
   * オブジェクトの深いマージ
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.changeCallbacks = [];
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
```

#### ✅ 完了条件 (Task 2.1)
- [ ] 全テストケースが通過する
- [ ] 複数の設定形式をサポート (JSON, YAML, JS)
- [ ] 環境変数からの設定読み込みが動作する
- [ ] 設定検証が適切に機能する
- [ ] ファイル監視とホットリロードが動作する

---

### Task 3: ログシステム実装 (1日)

#### 3.1 構造化ログ実装 (4時間)
**ファイル**: `src/core/utils/logger.ts`

**テストケース**:
```typescript
// tests/unit/core/utils/logger.test.ts
describe('Logger', () => {
  let logger: Logger;
  let mockTransport: jest.MockedObject<ILogTransport>;

  beforeEach(() => {
    mockTransport = {
      log: jest.fn(),
      close: jest.fn()
    } as jest.MockedObject<ILogTransport>;
    
    logger = new Logger({
      level: 'debug',
      format: 'json',
      transports: [mockTransport]
    });
  });

  describe('log levels', () => {
    it('should log at appropriate levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport.log).toHaveBeenCalledTimes(4);
    });

    it('should respect minimum log level', () => {
      const infoLogger = new Logger({
        level: 'info',
        transports: [mockTransport]
      });

      infoLogger.debug('Should not log');
      infoLogger.info('Should log');

      expect(mockTransport.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('structured logging', () => {
    it('should include metadata in log entries', () => {
      logger.info('Test message', { userId: '123', action: 'connect' });

      const logCall = mockTransport.log.mock.calls[0][0];
      expect(logCall).toMatchObject({
        level: 'info',
        message: 'Test message',
        userId: '123',
        action: 'connect',
        timestamp: expect.any(String)
      });
    });

    it('should handle error objects properly', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error });

      const logCall = mockTransport.log.mock.calls[0][0];
      expect(logCall.error).toMatchObject({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String)
      });
    });

    it('should include correlation IDs', () => {
      logger.withCorrelationId('corr-123').info('Correlated message');

      const logCall = mockTransport.log.mock.calls[0][0];
      expect(logCall.correlationId).toBe('corr-123');
    });
  });

  describe('context logging', () => {
    it('should maintain context across related logs', () => {
      const contextLogger = logger.withContext({ component: 'mqtt', brokerId: 'broker-1' });
      
      contextLogger.info('Connection established');
      contextLogger.warn('High latency detected');

      expect(mockTransport.log).toHaveBeenCalledTimes(2);
      mockTransport.log.mock.calls.forEach(call => {
        expect(call[0]).toMatchObject({
          component: 'mqtt',
          brokerId: 'broker-1'
        });
      });
    });
  });

  describe('performance logging', () => {
    it('should measure execution time', async () => {
      const timer = logger.startTimer();
      await new Promise(resolve => setTimeout(resolve, 10));
      timer.done('Operation completed');

      const logCall = mockTransport.log.mock.calls[0][0];
      expect(logCall.duration).toBeGreaterThan(0);
      expect(logCall.message).toBe('Operation completed');
    });
  });
});
```

**実装コード**:
```typescript
// src/core/utils/logger.ts
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface ILogEntry {
  level: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

export interface ILogTransport {
  log(entry: ILogEntry): void;
  close(): void;
}

export interface ILoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  transports?: ILogTransport[];
  file?: string;
  maxSize?: string;
  maxFiles?: number;
}

export class ConsoleTransport implements ILogTransport {
  constructor(private format: 'json' | 'text' = 'json') {}

  log(entry: ILogEntry): void {
    if (this.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      const { timestamp, level, message, correlationId, duration, ...meta } = entry;
      const metaStr = Object.keys(meta).length > 0 ? ` ${util.inspect(meta, { compact: true })}` : '';
      const corrStr = correlationId ? ` [${correlationId}]` : '';
      const durStr = duration ? ` (${duration}ms)` : '';
      
      console.log(`${timestamp} ${level.toUpperCase()}${corrStr}: ${message}${durStr}${metaStr}`);
    }
  }

  close(): void {
    // Console doesn't need cleanup
  }
}

export class FileTransport implements ILogTransport {
  private writeStream: fs.WriteStream;

  constructor(
    private filePath: string,
    private format: 'json' | 'text' = 'json'
  ) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.writeStream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  log(entry: ILogEntry): void {
    const line = this.format === 'json' 
      ? JSON.stringify(entry) + '\n'
      : this.formatTextLine(entry) + '\n';
    
    this.writeStream.write(line);
  }

  private formatTextLine(entry: ILogEntry): string {
    const { timestamp, level, message, correlationId, duration, ...meta } = entry;
    const metaStr = Object.keys(meta).length > 0 ? ` ${util.inspect(meta, { compact: true })}` : '';
    const corrStr = correlationId ? ` [${correlationId}]` : '';
    const durStr = duration ? ` (${duration}ms)` : '';
    
    return `${timestamp} ${level.toUpperCase()}${corrStr}: ${message}${durStr}${metaStr}`;
  }

  close(): void {
    this.writeStream.end();
  }
}

export class Logger {
  private level: LogLevel;
  private transports: ILogTransport[];
  private context: Record<string, unknown> = {};
  private correlationId?: string;

  constructor(config: ILoggerConfig) {
    this.level = this.parseLogLevel(config.level);
    this.transports = config.transports || [new ConsoleTransport(config.format)];

    // ファイル出力が指定されている場合
    if (config.file) {
      this.transports.push(new FileTransport(config.file, config.format));
    }
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.log(LogLevel.DEBUG, 'debug', message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.log(LogLevel.INFO, 'info', message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.log(LogLevel.WARN, 'warn', message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.log(LogLevel.ERROR, 'error', message, meta);
  }

  /**
   * コンテキスト付きロガーを作成
   */
  withContext(context: Record<string, unknown>): Logger {
    const contextLogger = new Logger({ level: 'debug', format: 'json' });
    contextLogger.level = this.level;
    contextLogger.transports = this.transports;
    contextLogger.context = { ...this.context, ...context };
    contextLogger.correlationId = this.correlationId;
    return contextLogger;
  }

  /**
   * 相関ID付きロガーを作成
   */
  withCorrelationId(correlationId: string): Logger {
    const corrLogger = new Logger({ level: 'debug', format: 'json' });
    corrLogger.level = this.level;
    corrLogger.transports = this.transports;
    corrLogger.context = this.context;
    corrLogger.correlationId = correlationId;
    return corrLogger;
  }

  /**
   * 実行時間測定
   */
  startTimer(): { done: (message: string, meta?: Record<string, unknown>) => void } {
    const startTime = Date.now();
    
    return {
      done: (message: string, meta: Record<string, unknown> = {}) => {
        const duration = Date.now() - startTime;
        this.info(message, { ...meta, duration });
      }
    };
  }

  private log(
    level: LogLevel, 
    levelName: string, 
    message: string, 
    meta: Record<string, unknown>
  ): void {
    if (level < this.level) {
      return;
    }

    const entry: ILogEntry = {
      level: levelName,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...this.serializeMeta(meta)
    };

    if (this.correlationId) {
      entry.correlationId = this.correlationId;
    }

    this.transports.forEach(transport => transport.log(entry));
  }

  private serializeMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        serialized[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(value as any).code && { code: (value as any).code }
        };
      } else if (value && typeof value === 'object') {
        try {
          serialized[key] = JSON.parse(JSON.stringify(value));
        } catch {
          serialized[key] = util.inspect(value);
        }
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  close(): void {
    this.transports.forEach(transport => transport.close());
  }
}

/**
 * グローバルロガーインスタンス
 */
let globalLogger: Logger | null = null;

export function createLogger(config: ILoggerConfig): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({ level: 'info', format: 'json' });
  }
  return globalLogger;
}
```

#### ✅ 完了条件 (Task 3.1)
- [ ] 全テストケースが通過する
- [ ] 構造化ログが正しく出力される
- [ ] ファイル出力が動作する
- [ ] パフォーマンス測定機能が動作する
- [ ] コンテキストとコリレーションIDが機能する

---

### Task 4: エラーハンドリング実装 (1日)

#### 4.1 カスタムエラークラス拡張 (4時間)
**ファイル**: `src/core/errors/mqtt-errors.ts`

**実装コード**:
```typescript
// src/core/errors/mqtt-errors.ts
import { MQTTMCPError, ErrorCategory } from './base-error';

/**
 * MQTT 接続エラー
 */
export class ConnectionError extends MQTTMCPError {
  constructor(
    code: string,
    message: string,
    details?: unknown
  ) {
    super(ErrorCategory.CONNECTION_ERROR, code, message, 503, details);
    this.name = 'ConnectionError';
  }

  static brokerUnreachable(brokerId: string, url: string): ConnectionError {
    return new ConnectionError(
      'BROKER_UNREACHABLE',
      `Cannot reach MQTT broker: ${brokerId}`,
      { brokerId, url }
    );
  }

  static authenticationFailed(brokerId: string): ConnectionError {
    return new ConnectionError(
      'AUTHENTICATION_FAILED',
      `Authentication failed for broker: ${brokerId}`,
      { brokerId }
    );
  }

  static connectionTimeout(brokerId: string, timeout: number): ConnectionError {
    return new ConnectionError(
      'CONNECTION_TIMEOUT',
      `Connection timeout after ${timeout}ms for broker: ${brokerId}`,
      { brokerId, timeout }
    );
  }
}

/**
 * MQTT プロトコルエラー
 */
export class ProtocolError extends MQTTMCPError {
  constructor(
    code: string,
    message: string,
    details?: unknown
  ) {
    super(ErrorCategory.PROTOCOL_ERROR, code, message, 400, details);
    this.name = 'ProtocolError';
  }

  static invalidTopic(topic: string): ProtocolError {
    return new ProtocolError(
      'INVALID_TOPIC',
      `Invalid MQTT topic: ${topic}`,
      { topic }
    );
  }

  static invalidQoS(qos: unknown): ProtocolError {
    return new ProtocolError(
      'INVALID_QOS',
      `Invalid QoS level: ${qos}`,
      { qos }
    );
  }

  static messageTooLarge(size: number, maxSize: number): ProtocolError {
    return new ProtocolError(
      'MESSAGE_TOO_LARGE',
      `Message size ${size} exceeds maximum ${maxSize}`,
      { size, maxSize }
    );
  }
}

/**
 * MCP プロトコルエラー
 */
export class MCPError extends MQTTMCPError {
  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: unknown
  ) {
    super(ErrorCategory.PROTOCOL_ERROR, code, message, statusCode, details);
    this.name = 'MCPError';
  }

  static toolNotFound(toolName: string): MCPError {
    return new MCPError(
      'TOOL_NOT_FOUND',
      `Tool not found: ${toolName}`,
      404,
      { toolName }
    );
  }

  static invalidArguments(toolName: string, errors: string[]): MCPError {
    return new MCPError(
      'INVALID_ARGUMENTS',
      `Invalid arguments for tool ${toolName}: ${errors.join(', ')}`,
      400,
      { toolName, errors }
    );
  }

  static resourceNotFound(uri: string): MCPError {
    return new MCPError(
      'RESOURCE_NOT_FOUND',
      `Resource not found: ${uri}`,
      404,
      { uri }
    );
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends MQTTMCPError {
  constructor(
    code: string,
    message: string,
    details?: unknown
  ) {
    super(ErrorCategory.VALIDATION_ERROR, code, message, 400, details);
    this.name = 'ValidationError';
  }

  static invalidConfig(field: string, value: unknown, reason: string): ValidationError {
    return new ValidationError(
      'INVALID_CONFIG',
      `Invalid configuration for ${field}: ${reason}`,
      { field, value, reason }
    );
  }

  static missingRequiredField(field: string): ValidationError {
    return new ValidationError(
      'MISSING_REQUIRED_FIELD',
      `Required field is missing: ${field}`,
      { field }
    );
  }
}

/**
 * タイムアウトエラー
 */
export class TimeoutError extends MQTTMCPError {
  constructor(
    code: string,
    message: string,
    timeout: number,
    details?: unknown
  ) {
    super(ErrorCategory.TIMEOUT_ERROR, code, message, 408, { ...details, timeout });
    this.name = 'TimeoutError';
  }

  static operationTimeout(operation: string, timeout: number): TimeoutError {
    return new TimeoutError(
      'OPERATION_TIMEOUT',
      `Operation '${operation}' timed out after ${timeout}ms`,
      timeout,
      { operation }
    );
  }

  static publishTimeout(topic: string, timeout: number): TimeoutError {
    return new TimeoutError(
      'PUBLISH_TIMEOUT',
      `Publish to topic '${topic}' timed out after ${timeout}ms`,
      timeout,
      { topic }
    );
  }
}
```

#### ✅ 完了条件 (Task 4.1)
- [ ] 全エラータイプが適切に定義されている
- [ ] ファクトリーメソッドが実装されている  
- [ ] エラーの継承関係が正しい
- [ ] 適切なHTTPステータスコードが設定されている

---

## 📊 Phase 1 完了チェックリスト

### 🔍 テスト要件
- [ ] 単体テストカバレージ 90%以上
- [ ] 全テストケースが通過
- [ ] リント・フォーマットエラー 0件
- [ ] TypeScript コンパイルエラー 0件

### 🏗️ 実装要件
- [ ] 全型定義が完成している
- [ ] 設定管理システムが動作する
- [ ] ログシステムが動作する
- [ ] エラーハンドリングが実装されている
- [ ] JSDoc ドキュメントが完備されている

### 🚀 統合要件
- [ ] 全コンポーネントが相互に動作する
- [ ] 設定からロガーが正しく初期化される
- [ ] エラーが適切にログ出力される
- [ ] パフォーマンスが要件を満たす

### 📋 ドキュメント要件
- [ ] API ドキュメントが生成される
- [ ] 使用例が提供されている
- [ ] トラブルシューティングガイドがある

## 🎯 Phase 1 完了後の次ステップ

1. **コードレビュー**: 実装内容の確認
2. **パフォーマンステスト**: 基盤性能の測定
3. **Phase 2 準備**: MQTT統合の準備
4. **依存関係インストール**: MQTT.js など必要なライブラリの追加

---

**推定完了時間**: 10-16時間  
**次フェーズ**: Phase 2 - MQTT統合  
**担当者**: 開発チーム
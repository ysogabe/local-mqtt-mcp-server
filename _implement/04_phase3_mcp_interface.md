# Phase 3: MCPインターフェース

## 🎯 フェーズ目標
Model Context Protocol (MCP) の完全実装により、Claude Desktop との統合を実現します。

## ⏰ 推定期間
**2-3週間** (実働16-24時間)

## 📋 前提条件
- Phase 1,2 が完了している
- MCP SDK がインストール済み
- Claude Desktop が利用可能（テスト用）

## 🏗️ アーキテクチャ概要

```
Phase 3 MCPインターフェースレイヤー
├── MCP Server (mcp/server/)
│   ├── MCPServer
│   ├── ToolRegistry
│   └── ResourceRegistry
├── Tools実装 (mcp/tools/)
│   ├── mqtt_connect
│   ├── mqtt_publish
│   ├── mqtt_subscribe
│   └── mqtt_status
├── Resources実装 (mcp/resources/)
│   ├── connections
│   ├── subscriptions
│   ├── messages
│   └── metrics
└── Events実装 (mcp/events/)
    ├── EventManager
    ├── EventBuffer
    └── EventNotifier
```

## 📦 依存関係の追加

```bash
# MCP SDK
npm install @modelcontextprotocol/sdk@^1.0.0

# JSON Schema バリデーション
npm install ajv@^8.0.0
npm install -D @types/ajv

# stdio Transport用
npm install @modelcontextprotocol/sdk-stdio@^1.0.0
```

## 📝 実装タスク一覧

### Task 1: MCP基盤実装 (2日)

#### 1.1 MCPサーバー基盤実装 (6時間)
**ファイル**: `src/mcp/server/mcp-server.ts`

**TDD実装手順**:
1. **テスト作成** (2時間)
2. **実装** (3.5時間)
3. **リファクタリング** (30分)

**テストケース**:
```typescript
// tests/integration/mcp/server/mcp-server.test.ts
describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockMessageHandler: jest.Mocked<MessageHandler>;
  
  beforeEach(() => {
    const config: IMCPConfig = {
      name: 'test-mqtt-mcp-server',
      version: '1.0.0',
      transport: 'stdio'
    };
    
    mockConnectionManager = createMockConnectionManager();
    mockMessageHandler = createMockMessageHandler();
    
    mcpServer = new MCPServer(config, {
      connectionManager: mockConnectionManager,
      messageHandler: mockMessageHandler
    });
  });

  describe('server lifecycle', () => {
    it('should initialize server with correct capabilities', async () => {
      await mcpServer.start();
      
      const capabilities = mcpServer.getCapabilities();
      
      expect(capabilities).toMatchObject({
        tools: {
          listChanged: true
        },
        resources: {
          subscribe: true,
          listChanged: true
        },
        logging: {}
      });
    });

    it('should register all MQTT tools', async () => {
      await mcpServer.start();
      
      const tools = mcpServer.listTools();
      const toolNames = tools.map(tool => tool.name);
      
      expect(toolNames).toContain('mqtt_connect');
      expect(toolNames).toContain('mqtt_disconnect');
      expect(toolNames).toContain('mqtt_publish');
      expect(toolNames).toContain('mqtt_subscribe');
      expect(toolNames).toContain('mqtt_unsubscribe');
      expect(toolNames).toContain('mqtt_status');
      expect(toolNames).toContain('mqtt_get_messages');
      expect(toolNames).toContain('mqtt_get_retained_messages');
    });

    it('should register all MQTT resources', async () => {
      await mcpServer.start();
      
      const resources = mcpServer.listResources();
      const resourceUris = resources.map(resource => resource.uri);
      
      expect(resourceUris).toContain('mqtt://connections');
      expect(resourceUris).toContain('mqtt://subscriptions');
      expect(resourceUris).toContain('mqtt://messages');
      expect(resourceUris).toContain('mqtt://metrics');
      expect(resourceUris).toContain('mqtt://health');
    });

    it('should handle graceful shutdown', async () => {
      await mcpServer.start();
      expect(mcpServer.isRunning()).toBe(true);
      
      await mcpServer.stop();
      expect(mcpServer.isRunning()).toBe(false);
      
      // リソースがクリーンアップされていることを確認
      expect(mockConnectionManager.dispose).toHaveBeenCalled();
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should execute mqtt_connect tool successfully', async () => {
      const args = {
        brokerId: 'test-broker',
        url: 'mqtt://localhost:1883',
        clientId: 'test-client'
      };

      const result = await mcpServer.callTool('mqtt_connect', args);

      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Successfully connected to broker')
        })
      ]);
      expect(mockConnectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-broker',
          url: 'mqtt://localhost:1883',
          clientId: 'test-client'
        })
      );
    });

    it('should handle tool execution errors gracefully', async () => {
      mockConnectionManager.connect.mockRejectedValue(
        new ConnectionError('BROKER_UNREACHABLE', 'Cannot reach broker')
      );

      const args = {
        brokerId: 'invalid-broker',
        url: 'mqtt://invalid:1883'
      };

      const result = await mcpServer.callTool('mqtt_connect', args);

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Cannot reach broker')
        })
      ]);
    });

    it('should validate tool arguments', async () => {
      const invalidArgs = {
        brokerId: '', // Invalid: empty string
        url: 'invalid-url' // Invalid: not a valid MQTT URL
      };

      const result = await mcpServer.callTool('mqtt_connect', invalidArgs);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });

    it('should handle unknown tools', async () => {
      const result = await mcpServer.callTool('unknown_tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });
  });

  describe('resource access', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should return connection information', async () => {
      const mockConnections = [
        {
          id: 'broker1',
          status: ConnectionStatus.CONNECTED,
          config: { id: 'broker1', url: 'mqtt://localhost:1883' },
          metrics: { messagesSent: 10, messagesReceived: 5 }
        }
      ];
      
      mockConnectionManager.getConnectionInfo.mockReturnValue(mockConnections);

      const result = await mcpServer.readResource('mqtt://connections');

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toMatchObject({
        uri: 'mqtt://connections',
        mimeType: 'application/json'
      });
      
      const content = JSON.parse(result.contents[0].text!);
      expect(content).toEqual(mockConnections);
    });

    it('should handle resource not found', async () => {
      await expect(
        mcpServer.readResource('mqtt://invalid-resource')
      ).rejects.toThrow('Resource not found');
    });

    it('should support resource subscription', async () => {
      const subscriptionCallback = jest.fn();
      
      await mcpServer.subscribeToResource('mqtt://connections', subscriptionCallback);
      
      // リソース変更を模擬
      mcpServer.notifyResourceChange('mqtt://connections');
      
      expect(subscriptionCallback).toHaveBeenCalledWith({
        uri: 'mqtt://connections',
        change: 'updated'
      });
    });
  });

  describe('event notifications', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should send MQTT message events', async () => {
      const mockMessage: IMQTTMessage = {
        topic: 'test/topic',
        payload: 'test message',
        qos: 1,
        retain: false,
        timestamp: Date.now(),
        brokerId: 'test-broker'
      };

      const eventSpy = jest.spyOn(mcpServer, 'sendEvent');

      // メッセージ受信をシミュレート
      mockConnectionManager.emit('message-received', mockMessage);

      expect(eventSpy).toHaveBeenCalledWith({
        type: MCPEventType.MQTT_MESSAGE,
        data: {
          brokerId: 'test-broker',
          topic: 'test/topic',
          message: 'test message',
          qos: 1,
          retain: false,
          timestamp: expect.any(Number)
        }
      });
    });

    it('should send connection events', async () => {
      const eventSpy = jest.spyOn(mcpServer, 'sendEvent');

      // 接続イベントをシミュレート
      mockConnectionManager.emit('broker-connected', {
        brokerId: 'test-broker',
        connectedAt: new Date()
      });

      expect(eventSpy).toHaveBeenCalledWith({
        type: MCPEventType.MQTT_CONNECTION,
        data: {
          brokerId: 'test-broker',
          status: 'connected',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should buffer events when client is not ready', async () => {
      // クライアントが準備できていない状態をシミュレート
      mcpServer.setClientReady(false);

      const mockMessage: IMQTTMessage = {
        topic: 'test/topic',
        payload: 'buffered message',
        qos: 0,
        retain: false,
        timestamp: Date.now(),
        brokerId: 'test-broker'
      };

      mockConnectionManager.emit('message-received', mockMessage);

      // イベントがバッファリングされていることを確認
      expect(mcpServer.getEventBufferSize()).toBe(1);

      // クライアントが準備完了したときにバッファされたイベントが送信される
      mcpServer.setClientReady(true);
      mcpServer.flushEventBuffer();

      expect(mcpServer.getEventBufferSize()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      mockConnectionManager.getAllConnections.mockImplementation(() => {
        throw new Error('Connection manager error');
      });

      await expect(mcpServer.start()).rejects.toThrow('Connection manager error');
    });

    it('should handle runtime errors gracefully', async () => {
      await mcpServer.start();

      // ランタイムエラーをシミュレート
      mockConnectionManager.getConnection.mockImplementation(() => {
        throw new ConnectionError('RUNTIME_ERROR', 'Runtime error occurred');
      });

      const result = await mcpServer.callTool('mqtt_status', { brokerId: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Runtime error occurred');
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should handle multiple concurrent tool calls', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        mcpServer.callTool('mqtt_status', { brokerId: `broker-${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('isError');
      });
    });

    it('should handle concurrent resource reads', async () => {
      const promises = Array.from({ length: 5 }, () =>
        mcpServer.readResource('mqtt://connections')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.contents).toHaveLength(1);
      });
    });
  });
});
```

**実装コード**:
```typescript
// src/mcp/server/mcp-server.ts
import { 
  Server, 
  StdioServerTransport,
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  ReadResourceResult
} from '@modelcontextprotocol/sdk/server/index.js';
import { EventEmitter } from 'events';

import { IMCPConfig } from '../../core/interfaces/config-types';
import { 
  IMCPTool, 
  IMCPResource, 
  IMCPEvent, 
  MCPEventType,
  createMCPEvent,
  createToolResponse 
} from '../../core/interfaces/mcp-types';
import { ConnectionManager } from '../../services/connection/connection-manager';
import { MessageHandler } from '../../services/messaging/message-handler';
import { SubscriptionManager } from '../../services/subscription/subscription-manager';
import { MCPError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

// Tools
import { MQTTConnectTool } from '../tools/mqtt-connect-tool';
import { MQTTDisconnectTool } from '../tools/mqtt-disconnect-tool';
import { MQTTPublishTool } from '../tools/mqtt-publish-tool';
import { MQTTSubscribeTool } from '../tools/mqtt-subscribe-tool';
import { MQTTUnsubscribeTool } from '../tools/mqtt-unsubscribe-tool';
import { MQTTStatusTool } from '../tools/mqtt-status-tool';
import { MQTTGetMessagesTool } from '../tools/mqtt-get-messages-tool';
import { MQTTGetRetainedMessagesTool } from '../tools/mqtt-get-retained-messages-tool';

// Resources
import { ConnectionsResource } from '../resources/connections-resource';
import { SubscriptionsResource } from '../resources/subscriptions-resource';
import { MessagesResource } from '../resources/messages-resource';
import { MetricsResource } from '../resources/metrics-resource';
import { HealthResource } from '../resources/health-resource';

export interface IMCPServerDependencies {
  connectionManager: ConnectionManager;
  messageHandler: MessageHandler;
  subscriptionManager?: SubscriptionManager;
}

export class MCPServer extends EventEmitter {
  private server: Server;
  private transport: StdioServerTransport;
  private tools = new Map<string, IMCPTool>();
  private resources = new Map<string, IMCPResource>();
  private eventBuffer: IMCPEvent[] = [];
  private isClientReady = false;
  private isServerRunning = false;
  
  private logger = getLogger().withContext({ component: 'MCPServer' });

  constructor(
    private config: IMCPConfig,
    private dependencies: IMCPServerDependencies
  ) {
    super();
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          },
          resources: {
            subscribe: true,
            listChanged: true
          },
          logging: {}
        }
      }
    );

    this.transport = new StdioServerTransport();
    this.setupEventHandlers();
  }

  /**
   * サーバーを開始
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting MCP Server', {
        name: this.config.name,
        version: this.config.version
      });

      this.registerTools();
      this.registerResources();
      this.setupMQTTEventHandlers();
      this.setupServerHandlers();

      await this.server.connect(this.transport);
      this.isServerRunning = true;

      this.logger.info('MCP Server started successfully');
      this.emit('server-started');

    } catch (error) {
      this.logger.error('Failed to start MCP Server', { error });
      throw error;
    }
  }

  /**
   * サーバーを停止
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping MCP Server');

      this.isServerRunning = false;
      this.isClientReady = false;

      // リソースのクリーンアップ
      this.dependencies.connectionManager.dispose?.();
      this.dependencies.messageHandler.dispose?.();
      this.dependencies.subscriptionManager?.dispose?.();

      await this.server.close();

      this.logger.info('MCP Server stopped successfully');
      this.emit('server-stopped');

    } catch (error) {
      this.logger.error('Error stopping MCP Server', { error });
      throw error;
    }
  }

  /**
   * ツールを実行
   */
  async callTool(name: string, args: unknown): Promise<CallToolResult> {
    const timer = this.logger.startTimer();
    
    try {
      const tool = this.tools.get(name);
      if (!tool) {
        throw MCPError.toolNotFound(name);
      }

      this.logger.debug('Executing tool', { name, args });

      // 引数の検証
      const validationResult = await this.validateToolArguments(tool, args);
      if (!validationResult.valid) {
        throw MCPError.invalidArguments(name, validationResult.errors);
      }

      // ツール実行
      const result = await this.executeToolSafely(tool, args);
      
      timer.done('Tool executed successfully', { tool: name });
      
      return result;

    } catch (error) {
      timer.done('Tool execution failed', { tool: name, error });
      
      return createToolResponse(
        `Error executing tool ${name}: ${(error as Error).message}`,
        true,
        { error: (error as Error).name }
      );
    }
  }

  /**
   * リソースを読み取り
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    try {
      const resource = this.findResourceByUri(uri);
      if (!resource) {
        throw MCPError.resourceNotFound(uri);
      }

      this.logger.debug('Reading resource', { uri });

      const handler = this.getResourceHandler(uri);
      const content = await handler(uri);

      return {
        contents: Array.isArray(content) ? content : [content]
      };

    } catch (error) {
      this.logger.error('Failed to read resource', { uri, error });
      throw error;
    }
  }

  /**
   * リソース購読
   */
  async subscribeToResource(uri: string, callback: (change: any) => void): Promise<void> {
    this.logger.debug('Subscribing to resource', { uri });
    this.on(`resource-changed:${uri}`, callback);
  }

  /**
   * リソース購読解除
   */
  async unsubscribeFromResource(uri: string, callback: (change: any) => void): Promise<void> {
    this.logger.debug('Unsubscribing from resource', { uri });
    this.off(`resource-changed:${uri}`, callback);
  }

  /**
   * イベントを送信
   */
  async sendEvent(event: IMCPEvent): Promise<void> {
    if (!this.isClientReady) {
      this.bufferEvent(event);
      return;
    }

    try {
      await this.server.notification({
        method: 'notifications/message',
        params: {
          level: 'info',
          data: event
        }
      });

      this.logger.debug('Event sent', { type: event.type });

    } catch (error) {
      this.logger.error('Failed to send event', { event, error });
      this.bufferEvent(event);
    }
  }

  /**
   * ツール一覧を取得
   */
  listTools(): IMCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * リソース一覧を取得
   */
  listResources(): IMCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * サーバー状態を取得
   */
  isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * クライアント準備状態を設定
   */
  setClientReady(ready: boolean): void {
    this.isClientReady = ready;
    if (ready) {
      this.flushEventBuffer();
    }
  }

  /**
   * イベントバッファサイズを取得
   */
  getEventBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * イベントバッファをフラッシュ
   */
  flushEventBuffer(): void {
    if (!this.isClientReady) return;

    const bufferedEvents = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of bufferedEvents) {
      this.sendEvent(event).catch(error => {
        this.logger.error('Failed to send buffered event', { event, error });
      });
    }

    if (bufferedEvents.length > 0) {
      this.logger.info('Flushed event buffer', { count: bufferedEvents.length });
    }
  }

  /**
   * サーバー機能を取得
   */
  getCapabilities(): any {
    return this.server.getCapabilities();
  }

  /**
   * リソース変更を通知
   */
  notifyResourceChange(uri: string): void {
    this.emit(`resource-changed:${uri}`, {
      uri,
      change: 'updated'
    });
  }

  /**
   * ツールを登録
   */
  private registerTools(): void {
    const tools = [
      new MQTTConnectTool(this.dependencies),
      new MQTTDisconnectTool(this.dependencies),
      new MQTTPublishTool(this.dependencies),
      new MQTTSubscribeTool(this.dependencies),
      new MQTTUnsubscribeTool(this.dependencies),
      new MQTTStatusTool(this.dependencies),
      new MQTTGetMessagesTool(this.dependencies),
      new MQTTGetRetainedMessagesTool(this.dependencies)
    ];

    for (const tool of tools) {
      this.tools.set(tool.name, tool);
      this.logger.debug('Registered tool', { name: tool.name });
    }

    this.logger.info('All tools registered', { count: tools.length });
  }

  /**
   * リソースを登録
   */
  private registerResources(): void {
    const resources = [
      new ConnectionsResource(this.dependencies),
      new SubscriptionsResource(this.dependencies),
      new MessagesResource(this.dependencies),
      new MetricsResource(this.dependencies),
      new HealthResource(this.dependencies)
    ];

    for (const resource of resources) {
      this.resources.set(resource.uri, resource);
      this.logger.debug('Registered resource', { uri: resource.uri });
    }

    this.logger.info('All resources registered', { count: resources.length });
  }

  /**
   * サーバーハンドラーを設定
   */
  private setupServerHandlers(): void {
    this.server.setRequestHandler(
      'tools/list',
      async (): Promise<any> => ({
        tools: this.listTools()
      })
    );

    this.server.setRequestHandler(
      'tools/call',
      async (request: CallToolRequest): Promise<CallToolResult> => 
        this.callTool(request.params.name, request.params.arguments)
    );

    this.server.setRequestHandler(
      'resources/list',
      async (): Promise<any> => ({
        resources: this.listResources()
      })
    );

    this.server.setRequestHandler(
      'resources/read',
      async (request: ReadResourceRequest): Promise<ReadResourceResult> => 
        this.readResource(request.params.uri)
    );
  }

  /**
   * MQTTイベントハンドラーを設定
   */
  private setupMQTTEventHandlers(): void {
    // メッセージ受信イベント
    this.dependencies.connectionManager.on('message-received', (message) => {
      const event = createMCPEvent(MCPEventType.MQTT_MESSAGE, {
        brokerId: message.brokerId,
        topic: message.topic,
        message: message.payload.toString(),
        qos: message.qos,
        retain: message.retain,
        timestamp: message.timestamp
      });
      this.sendEvent(event);
    });

    // 接続イベント
    this.dependencies.connectionManager.on('broker-connected', (data) => {
      const event = createMCPEvent(MCPEventType.MQTT_CONNECTION, {
        brokerId: data.brokerId,
        status: 'connected',
        timestamp: Date.now()
      });
      this.sendEvent(event);
    });

    this.dependencies.connectionManager.on('broker-disconnected', (data) => {
      const event = createMCPEvent(MCPEventType.MQTT_CONNECTION, {
        brokerId: data.brokerId,
        status: 'disconnected',
        timestamp: Date.now()
      });
      this.sendEvent(event);
    });

    // エラーイベント
    this.dependencies.connectionManager.on('broker-error', (data) => {
      const event = createMCPEvent(MCPEventType.MQTT_ERROR, {
        brokerId: data.brokerId,
        operation: 'connection',
        error: {
          code: data.error.name,
          message: data.error.message
        },
        timestamp: Date.now()
      });
      this.sendEvent(event);
    });
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    this.transport.onclose = () => {
      this.logger.info('MCP transport closed');
      this.isClientReady = false;
    };

    this.server.onerror = (error) => {
      this.logger.error('MCP Server error', { error });
      this.emit('error', error);
    };
  }

  /**
   * ツール引数を検証
   */
  private async validateToolArguments(tool: IMCPTool, args: unknown): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    // JSON Schema バリデーション実装
    // 実装簡略化のため基本的なチェックのみ
    const errors: string[] = [];

    if (!args || typeof args !== 'object') {
      errors.push('Arguments must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * ツールを安全に実行
   */
  private async executeToolSafely(tool: IMCPTool, args: unknown): Promise<CallToolResult> {
    try {
      // ツール実行デリゲート実装が必要
      // 各ツールクラスにexecuteメソッドを追加
      const result = await (tool as any).execute(args);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * URIからリソースを検索
   */
  private findResourceByUri(uri: string): IMCPResource | undefined {
    return this.resources.get(uri);
  }

  /**
   * リソースハンドラーを取得
   */
  private getResourceHandler(uri: string): (uri: string) => Promise<any> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw MCPError.resourceNotFound(uri);
    }

    // リソースハンドラー実装が必要
    return (resource as any).handler;
  }

  /**
   * イベントをバッファに追加
   */
  private bufferEvent(event: IMCPEvent): void {
    this.eventBuffer.push(event);
    
    // バッファサイズ制限
    const maxBufferSize = 1000;
    if (this.eventBuffer.length > maxBufferSize) {
      this.eventBuffer.shift(); // 古いイベントを削除
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.stop().catch(error => {
      this.logger.error('Error during disposal', { error });
    });
    
    this.removeAllListeners();
  }
}
```

#### ✅ 完了条件 (Task 1.1)
- [ ] MCPサーバーが正常に起動する
- [ ] 全ツールが正しく登録される
- [ ] 全リソースが正しく登録される
- [ ] イベント通知が動作する
- [ ] エラーハンドリングが適切
- [ ] Claude Desktopとの基本的な通信が可能

---

#### 1.2 ツールレジストリ実装 (3時間)
**ファイル**: `src/mcp/server/tool-registry.ts`

**実装コード**:
```typescript
// src/mcp/server/tool-registry.ts
import { IMCPTool } from '../../core/interfaces/mcp-types';
import { MCPError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

export interface IToolExecutionContext {
  toolName: string;
  arguments: unknown;
  correlationId?: string;
  userId?: string;
}

export interface IToolExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
  executionTime: number;
}

export class ToolRegistry {
  private tools = new Map<string, IMCPTool>();
  private executionStats = new Map<string, {
    calls: number;
    totalTime: number;
    errors: number;
    lastCalled: Date;
  }>();
  
  private logger = getLogger().withContext({ component: 'ToolRegistry' });

  /**
   * ツールを登録
   */
  register(tool: IMCPTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn('Overriding existing tool', { name: tool.name });
    }

    this.tools.set(tool.name, tool);
    this.initializeStats(tool.name);
    
    this.logger.debug('Tool registered', { 
      name: tool.name, 
      description: tool.description 
    });
  }

  /**
   * ツールを取得
   */
  get(name: string): IMCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * ツールが存在するかチェック
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 全ツールを取得
   */
  getAll(): IMCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * ツール一覧を取得
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * ツールを削除
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.executionStats.delete(name);
      this.logger.debug('Tool unregistered', { name });
    }
    return removed;
  }

  /**
   * ツール実行統計を取得
   */
  getStats(name?: string): any {
    if (name) {
      return this.executionStats.get(name);
    }
    
    const allStats: Record<string, any> = {};
    for (const [toolName, stats] of this.executionStats) {
      allStats[toolName] = stats;
    }
    return allStats;
  }

  /**
   * ツール実行を記録
   */
  recordExecution(name: string, result: IToolExecutionResult): void {
    const stats = this.executionStats.get(name);
    if (!stats) return;

    stats.calls++;
    stats.totalTime += result.executionTime;
    stats.lastCalled = new Date();
    
    if (!result.success) {
      stats.errors++;
    }

    // 平均実行時間をログ出力
    const avgTime = stats.totalTime / stats.calls;
    if (avgTime > 5000) { // 5秒以上の場合は警告
      this.logger.warn('Slow tool execution detected', {
        name,
        averageTime: avgTime,
        lastExecutionTime: result.executionTime
      });
    }
  }

  /**
   * 統計を初期化
   */
  private initializeStats(name: string): void {
    this.executionStats.set(name, {
      calls: 0,
      totalTime: 0,
      errors: 0,
      lastCalled: new Date()
    });
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.tools.clear();
    this.executionStats.clear();
  }
}
```

#### ✅ 完了条件 (Task 1.2)
- [ ] ツール登録・管理が動作する
- [ ] 実行統計が正しく収集される
- [ ] パフォーマンス監視が機能する

---

### Task 2: Tools API実装 (4日)

#### 2.1 mqtt_connect ツール実装 (3時間)
**ファイル**: `src/mcp/tools/mqtt-connect-tool.ts`

**実装コード**:
```typescript
// src/mcp/tools/mqtt-connect-tool.ts
import { JSONSchema7 } from 'json-schema';
import { 
  IMCPTool, 
  IMCPToolResult, 
  createToolResponse 
} from '../../core/interfaces/mcp-types';
import { IBrokerConfig } from '../../core/interfaces/mqtt-types';
import { IMCPServerDependencies } from '../server/mcp-server';
import { ValidationError, ConnectionError } from '../../core/errors/mqtt-errors';
import { getLogger } from '../../core/utils/logger';

export class MQTTConnectTool implements IMCPTool {
  readonly name = 'mqtt_connect';
  readonly description = 'Connect to an MQTT broker with authentication and configuration options';
  
  readonly inputSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      brokerId: {
        type: 'string',
        description: 'Unique identifier for this broker connection. If not specified, generates a default ID based on URL',
        pattern: '^[a-zA-Z0-9_-]+$',
        maxLength: 64
      },
      url: {
        type: 'string',
        description: 'MQTT broker URL',
        format: 'uri',
        examples: [
          'mqtt://localhost:1883',
          'mqtts://broker.example.com:8883',
          'ws://localhost:8080/mqtt',
          'wss://broker.example.com:8084/mqtt'
        ]
      },
      clientId: {
        type: 'string',
        description: 'MQTT client identifier (1-23 UTF-8 characters). If not specified, server generates a unique ID',
        minLength: 1,
        maxLength: 23,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      credentials: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Username for authentication'
          },
          password: {
            type: 'string',
            description: 'Password for authentication'
          }
        },
        additionalProperties: false
      },
      connection: {
        type: 'object',
        properties: {
          keepalive: {
            type: 'integer',
            description: 'Keep alive interval in seconds',
            minimum: 1,
            maximum: 65535,
            default: 60
          },
          clean: {
            type: 'boolean',
            description: 'Clean session flag',
            default: true
          },
          reconnectPeriod: {
            type: 'integer',
            description: 'Reconnect period in milliseconds',
            minimum: 100,
            maximum: 60000,
            default: 1000
          },
          connectTimeout: {
            type: 'integer',
            description: 'Connection timeout in milliseconds',
            minimum: 1000,
            maximum: 60000,
            default: 30000
          }
        },
        additionalProperties: false
      },
      will: {
        type: 'object',
        description: 'Last Will and Testament configuration',
        properties: {
          topic: {
            type: 'string',
            description: 'Will message topic'
          },
          payload: {
            type: 'string',
            description: 'Will message payload'
          },
          qos: {
            type: 'integer',
            enum: [0, 1, 2],
            description: 'Will message QoS level',
            default: 0
          },
          retain: {
            type: 'boolean',
            description: 'Will message retain flag',
            default: false
          }
        },
        required: ['topic', 'payload'],
        additionalProperties: false
      },
      tls: {
        type: 'object',
        description: 'TLS/SSL configuration',
        properties: {
          ca: {
            type: 'string',
            description: 'CA certificate path or content'
          },
          cert: {
            type: 'string',
            description: 'Client certificate path or content'
          },
          key: {
            type: 'string',
            description: 'Client private key path or content'
          },
          rejectUnauthorized: {
            type: 'boolean',
            description: 'Reject unauthorized certificates',
            default: true
          }
        },
        additionalProperties: false
      },
      protocol: {
        type: 'object',
        description: 'MQTT protocol configuration',
        properties: {
          version: {
            type: 'string',
            enum: ['3.1.1', '5.0'],
            description: 'MQTT protocol version',
            default: '5.0'
          }
        }
      }
    },
    required: ['url'],
    additionalProperties: false
  };

  private logger = getLogger().withContext({ 
    component: 'MQTTConnectTool' 
  });

  constructor(private dependencies: IMCPServerDependencies) {}

  /**
   * ツールを実行
   */
  async execute(args: any): Promise<IMCPToolResult> {
    const timer = this.logger.startTimer();
    
    try {
      this.logger.info('Executing MQTT connect', { args });

      // 引数の検証と変換
      const brokerConfig = this.buildBrokerConfig(args);
      
      // 接続実行
      await this.dependencies.connectionManager.connect(brokerConfig);
      
      const result = createToolResponse(
        `Successfully connected to broker '${brokerConfig.id}' at ${brokerConfig.url}`,
        false,
        {
          brokerId: brokerConfig.id,
          url: brokerConfig.url,
          clientId: brokerConfig.clientId,
          protocol: brokerConfig.protocol?.version || '5.0'
        }
      );

      timer.done('MQTT connect completed', { 
        brokerId: brokerConfig.id 
      });

      return result;

    } catch (error) {
      this.logger.error('MQTT connect failed', { error, args });
      
      timer.done('MQTT connect failed', { error });

      if (error instanceof ConnectionError) {
        return createToolResponse(
          `Connection failed: ${error.message}`,
          true,
          { 
            errorCode: error.code,
            errorCategory: error.category 
          }
        );
      }

      if (error instanceof ValidationError) {
        return createToolResponse(
          `Invalid configuration: ${error.message}`,
          true,
          { 
            errorCode: error.code,
            field: (error.details as any)?.field 
          }
        );
      }

      return createToolResponse(
        `Unexpected error: ${error.message}`,
        true,
        { error: error.name }
      );
    }
  }

  /**
   * ブローカー設定を構築
   */
  private buildBrokerConfig(args: any): IBrokerConfig {
    // brokerId の生成または検証
    const brokerId = args.brokerId || this.generateBrokerIdFromUrl(args.url);
    
    // clientId の生成または検証
    const clientId = args.clientId || this.generateClientId();

    const config: IBrokerConfig = {
      id: brokerId,
      url: args.url,
      clientId: clientId,
      protocol: args.protocol || { version: '5.0' },
      credentials: args.credentials,
      connection: {
        keepalive: args.connection?.keepalive || 60,
        clean: args.connection?.clean ?? true,
        reconnectPeriod: args.connection?.reconnectPeriod || 1000,
        connectTimeout: args.connection?.connectTimeout || 30000
      },
      will: args.will,
      tls: args.tls
    };

    this.validateBrokerConfig(config);
    return config;
  }

  /**
   * URL からブローカーID を生成
   */
  private generateBrokerIdFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/\./g, '-');
      const port = parsed.port || (parsed.protocol === 'mqtts:' ? '8883' : '1883');
      return `broker-${host}-${port}`;
    } catch {
      return `broker-${Date.now()}`;
    }
  }

  /**
   * クライアントID を生成
   */
  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `mcp-${timestamp}-${random}`;
  }

  /**
   * ブローカー設定を検証
   */
  private validateBrokerConfig(config: IBrokerConfig): void {
    // URL検証
    try {
      const url = new URL(config.url);
      const validProtocols = ['mqtt:', 'mqtts:', 'ws:', 'wss:'];
      if (!validProtocols.includes(url.protocol)) {
        throw new ValidationError(
          'INVALID_PROTOCOL',
          `Unsupported protocol: ${url.protocol}`,
          { protocol: url.protocol }
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(
        'INVALID_URL',
        `Invalid broker URL: ${config.url}`,
        { url: config.url }
      );
    }

    // clientId 検証
    if (config.clientId) {
      if (config.clientId.length === 0 || config.clientId.length > 23) {
        throw new ValidationError(
          'INVALID_CLIENT_ID',
          'Client ID must be 1-23 characters long',
          { clientId: config.clientId }
        );
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(config.clientId)) {
        throw new ValidationError(
          'INVALID_CLIENT_ID',
          'Client ID contains invalid characters',
          { clientId: config.clientId }
        );
      }
    }

    // 接続設定検証
    if (config.connection) {
      const conn = config.connection;
      
      if (conn.keepalive < 1 || conn.keepalive > 65535) {
        throw new ValidationError(
          'INVALID_KEEPALIVE',
          'Keep alive must be between 1 and 65535 seconds',
          { keepalive: conn.keepalive }
        );
      }
      
      if (conn.connectTimeout < 1000 || conn.connectTimeout > 60000) {
        throw new ValidationError(
          'INVALID_CONNECT_TIMEOUT',
          'Connect timeout must be between 1000 and 60000 milliseconds',
          { connectTimeout: conn.connectTimeout }
        );
      }
    }

    // Will設定検証
    if (config.will) {
      if (!config.will.topic || config.will.topic.trim().length === 0) {
        throw new ValidationError(
          'INVALID_WILL_TOPIC',
          'Will topic cannot be empty',
          { willTopic: config.will.topic }
        );
      }
      
      if (![0, 1, 2].includes(config.will.qos)) {
        throw new ValidationError(
          'INVALID_WILL_QOS',
          'Will QoS must be 0, 1, or 2',
          { willQos: config.will.qos }
        );
      }
    }
  }
}
```

#### ✅ 完了条件 (Task 2.1)
- [ ] mqtt_connect ツールが正常動作する
- [ ] 引数検証が適切に実行される
- [ ] エラーハンドリングが完備されている
- [ ] ログ出力が適切

---

残りのツール実装（mqtt_publish, mqtt_subscribe等）も同様のパターンで実装指示を作成可能ですが、文字数制限のため、ここで一旦区切ります。

この時点で、Phase 3 の基盤部分とメインツールの実装パターンが完成しています。

#### ✅ 完了条件 (Task 2.1)
- [ ] 全テストケースが通過する
- [ ] MCPプロトコル準拠の動作をする
- [ ] Claude Desktop との統合が動作する
- [ ] エラーハンドリングが適切
- [ ] パフォーマンス要件を満たす

**続きについて**: 残りのPhase 3タスク（他のツール実装、Resources API、Events実装）とPhase 4の実装指示も同様に詳細なTDD形式で作成可能です。また、テスト戦略やコーディング規約のドキュメントも作成予定です。

次に進めるタスクをお知らせください。
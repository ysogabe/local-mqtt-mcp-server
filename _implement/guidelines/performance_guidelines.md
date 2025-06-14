# パフォーマンス ガイドライン

## 🎯 目標

MQTT MCP Server の高性能・高効率な実装を実現し、リアルタイム性と拡張性を両立させるためのパフォーマンスガイドラインを定義します。

## 📊 パフォーマンス要件

### 1. レスポンス時間目標
```typescript
// 目標値の定義
export const PERFORMANCE_TARGETS = {
  // MQTT操作
  CONNECTION_ESTABLISHMENT: 2000,    // 2秒以内
  MESSAGE_PUBLISH_LATENCY: 50,       // 50ms以内
  MESSAGE_SUBSCRIBE_LATENCY: 100,    // 100ms以内
  
  // MCP操作
  TOOL_EXECUTION_LATENCY: 500,       // 500ms以内
  RESOURCE_READ_LATENCY: 200,        // 200ms以内
  
  // スループット
  MESSAGES_PER_SECOND: 1000,         // 1000 msg/s
  CONCURRENT_CONNECTIONS: 100,        // 100接続同時
  
  // リソース使用量
  MAX_MEMORY_USAGE: 512 * 1024 * 1024, // 512MB
  CPU_USAGE_THRESHOLD: 80,           // CPU 80%以下
} as const;
```

### 2. 監視メトリクス
```typescript
export interface IPerformanceMetrics {
  // レイテンシメトリクス
  latency: {
    mqtt: {
      connect: ILatencyStats;
      publish: ILatencyStats;
      subscribe: ILatencyStats;
    };
    mcp: {
      toolExecution: ILatencyStats;
      resourceRead: ILatencyStats;
    };
  };
  
  // スループットメトリクス
  throughput: {
    messagesPerSecond: number;
    connectionsPerSecond: number;
    operationsPerSecond: number;
  };
  
  // リソース使用量
  resources: {
    memory: IMemoryStats;
    cpu: ICpuStats;
    network: INetworkStats;
  };
  
  // エラー率
  errorRates: {
    mqtt: number;
    mcp: number;
    overall: number;
  };
}

export interface ILatencyStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}
```

## 🚀 パフォーマンス最適化戦略

### 1. 接続管理の最適化

#### 接続プール実装
```typescript
export class ConnectionPool {
  private readonly connections: Map<string, IPooledConnection[]>;
  private readonly config: IConnectionPoolConfig;
  private readonly metrics: IPoolMetrics;
  private readonly logger: ILogger;

  constructor(config: IConnectionPoolConfig, logger: ILogger) {
    this.connections = new Map();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.logger = logger;
    
    this.startHealthChecking();
    this.startMetricsReporting();
  }

  // 接続の取得（高速化）
  async acquire(brokerId: string): Promise<IPooledConnection> {
    const startTime = performance.now();
    
    try {
      // 既存の利用可能な接続を検索
      const availableConnection = await this.findAvailableConnection(brokerId);
      
      if (availableConnection) {
        availableConnection.lastUsed = Date.now();
        availableConnection.inUse = true;
        
        this.metrics.recordAcquisition(performance.now() - startTime, 'cached');
        return availableConnection;
      }

      // 新しい接続を作成
      const newConnection = await this.createConnection(brokerId);
      this.addToPool(brokerId, newConnection);
      
      this.metrics.recordAcquisition(performance.now() - startTime, 'new');
      return newConnection;

    } catch (error) {
      this.metrics.recordAcquisitionError();
      throw new PerformanceError(
        'CONNECTION_POOL_ACQUIRE_FAILED',
        `Failed to acquire connection for broker ${brokerId}`,
        { brokerId, duration: performance.now() - startTime }
      );
    }
  }

  // 接続の返却（メモリリーク防止）
  async release(connection: IPooledConnection): Promise<void> {
    if (!connection.inUse) {
      this.logger.warn('Attempt to release connection that is not in use', {
        connectionId: connection.id
      });
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    // 接続の健全性チェック
    if (!await this.isConnectionHealthy(connection)) {
      await this.removeFromPool(connection);
      return;
    }

    // プールサイズ制限の確認
    const poolSize = this.getPoolSize(connection.brokerId);
    if (poolSize > this.config.maxPoolSize) {
      await this.removeFromPool(connection);
    }

    this.metrics.recordRelease();
  }

  // 効率的な接続検索
  private async findAvailableConnection(brokerId: string): Promise<IPooledConnection | null> {
    const brokerConnections = this.connections.get(brokerId);
    
    if (!brokerConnections || brokerConnections.length === 0) {
      return null;
    }

    // インデックスによる高速検索
    for (let i = 0; i < brokerConnections.length; i++) {
      const connection = brokerConnections[i];
      
      if (!connection.inUse && await this.isConnectionHealthy(connection)) {
        return connection;
      }
    }

    return null;
  }

  // 接続の健全性チェック（軽量化）
  private async isConnectionHealthy(connection: IPooledConnection): Promise<boolean> {
    // タイムアウトベースの簡易チェック
    const healthCheckTimeout = 100; // 100ms
    
    try {
      const startTime = Date.now();
      const isConnected = connection.client.connected;
      const checkDuration = Date.now() - startTime;

      // 高速なローカルチェック
      if (!isConnected || checkDuration > healthCheckTimeout) {
        return false;
      }

      // 最後の使用時刻のチェック
      const idleTime = Date.now() - connection.lastUsed;
      if (idleTime > this.config.maxIdleTime) {
        return false;
      }

      return true;

    } catch (error) {
      this.logger.debug('Connection health check failed', {
        connectionId: connection.id,
        error: (error as Error).message
      });
      return false;
    }
  }
}
```

#### 非同期処理の最適化
```typescript
export class OptimizedAsyncProcessor {
  private readonly semaphore: Semaphore;
  private readonly workQueue: PriorityQueue<IWorkItem>;
  private readonly workers: Worker[];
  private readonly metrics: IProcessorMetrics;

  constructor(config: IProcessorConfig) {
    this.semaphore = new Semaphore(config.maxConcurrency);
    this.workQueue = new PriorityQueue((a, b) => b.priority - a.priority);
    this.workers = this.createWorkers(config.workerCount);
    this.metrics = new ProcessorMetrics();
    
    this.startWorkers();
  }

  // 高効率バッチ処理
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: IBatchProcessOptions = {}
  ): Promise<IBatchResult<R>> {
    const {
      batchSize = 100,
      maxConcurrency = 10,
      priority = Priority.NORMAL,
      timeout = 30000
    } = options;

    const startTime = performance.now();
    const results: R[] = [];
    const errors: IProcessingError[] = [];

    // チャンクに分割（メモリ効率化）
    const chunks = this.createChunks(items, batchSize);
    const totalChunks = chunks.length;

    // 並行処理制御
    const semaphore = new Semaphore(maxConcurrency);
    const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
      await semaphore.acquire();
      
      try {
        return await this.processChunk(chunk, processor, timeout, chunkIndex);
      } finally {
        semaphore.release();
      }
    });

    // 結果の集約
    const chunkResults = await Promise.allSettled(chunkPromises);
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value.results);
        errors.push(...result.value.errors);
      } else {
        errors.push({
          index,
          error: result.reason,
          item: chunks[index]
        });
      }
    });

    const duration = performance.now() - startTime;
    
    this.metrics.recordBatchProcessing({
      itemCount: items.length,
      chunkCount: totalChunks,
      successCount: results.length,
      errorCount: errors.length,
      duration
    });

    return {
      results,
      errors,
      totalProcessed: items.length,
      successCount: results.length,
      errorCount: errors.length,
      duration
    };
  }

  // チャンク処理（エラー分離）
  private async processChunk<T, R>(
    chunk: T[],
    processor: (item: T) => Promise<R>,
    timeout: number,
    chunkIndex: number
  ): Promise<IChunkResult<R>> {
    const results: R[] = [];
    const errors: IProcessingError[] = [];

    // 各アイテムの処理
    const itemPromises = chunk.map(async (item, itemIndex) => {
      try {
        const result = await this.withTimeout(processor(item), timeout);
        results.push(result);
      } catch (error) {
        errors.push({
          index: chunkIndex * chunk.length + itemIndex,
          error: error as Error,
          item
        });
      }
    });

    await Promise.allSettled(itemPromises);

    return { results, errors };
  }

  // タイムアウト制御
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  // メモリ効率的なチャンク分割
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}
```

### 2. メッセージ処理の最適化

#### キューイングシステム
```typescript
export class HighPerformanceMessageQueue {
  private readonly queues: Map<string, IRingBuffer<IMessage>>;
  private readonly processors: Map<string, IMessageProcessor>;
  private readonly metrics: IQueueMetrics;
  private readonly config: IQueueConfig;

  constructor(config: IQueueConfig) {
    this.queues = new Map();
    this.processors = new Map();
    this.metrics = new QueueMetrics();
    this.config = config;
  }

  // 高速メッセージエンキュー
  enqueue(topic: string, message: IMessage, priority: Priority = Priority.NORMAL): boolean {
    const startTime = performance.now();
    
    try {
      const queue = this.getOrCreateQueue(topic);
      
      // キューの容量チェック
      if (queue.isFull()) {
        if (this.config.dropPolicy === 'drop-oldest') {
          queue.dequeue(); // 古いメッセージを削除
        } else {
          this.metrics.recordDrop(topic, 'queue-full');
          return false;
        }
      }

      // メッセージのエンキュー
      const envelope: IMessageEnvelope = {
        id: this.generateMessageId(),
        message,
        priority,
        timestamp: Date.now(),
        attempts: 0
      };

      queue.enqueue(envelope);
      
      this.metrics.recordEnqueue(topic, performance.now() - startTime);
      this.notifyProcessor(topic);
      
      return true;

    } catch (error) {
      this.metrics.recordError(topic, 'enqueue', error as Error);
      return false;
    }
  }

  // バッチデキュー（スループット向上）
  dequeueBatch(topic: string, maxCount: number = 10): IMessageEnvelope[] {
    const queue = this.queues.get(topic);
    
    if (!queue || queue.isEmpty()) {
      return [];
    }

    const messages: IMessageEnvelope[] = [];
    const batchSize = Math.min(maxCount, queue.size());

    for (let i = 0; i < batchSize; i++) {
      const message = queue.dequeue();
      if (message) {
        messages.push(message);
      }
    }

    this.metrics.recordBatchDequeue(topic, messages.length);
    return messages;
  }

  // リングバッファベースのキュー実装
  private getOrCreateQueue(topic: string): IRingBuffer<IMessageEnvelope> {
    if (!this.queues.has(topic)) {
      const buffer = new RingBuffer<IMessageEnvelope>(this.config.queueSize);
      this.queues.set(topic, buffer);
    }
    
    return this.queues.get(topic)!;
  }
}

// 高効率リングバッファ実装
export class RingBuffer<T> implements IRingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private readonly maxSize: number;
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.maxSize = size;
    this.buffer = new Array(size);
  }

  enqueue(item: T): boolean {
    if (this.isFull()) {
      return false;
    }

    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    this.count++;
    
    return true;
  }

  dequeue(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined; // メモリリーク防止
    this.head = (this.head + 1) % this.maxSize;
    this.count--;
    
    return item;
  }

  isFull(): boolean {
    return this.count === this.maxSize;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  size(): number {
    return this.count;
  }
}
```

#### ストリーミング処理
```typescript
export class StreamProcessor {
  private readonly streams: Map<string, Transform>;
  private readonly metrics: IStreamMetrics;

  constructor() {
    this.streams = new Map();
    this.metrics = new StreamMetrics();
  }

  // 高効率ストリーム処理
  createMessageStream(topic: string, options: IStreamOptions = {}): Transform {
    const {
      highWaterMark = 16384,  // 16KB バッファ
      objectMode = true,
      transform = this.defaultTransform
    } = options;

    const stream = new Transform({
      highWaterMark,
      objectMode,
      transform: (chunk, encoding, callback) => {
        this.processStreamChunk(chunk, transform, callback);
      }
    });

    // ストリームイベントハンドリング
    this.setupStreamEvents(stream, topic);
    
    this.streams.set(topic, stream);
    return stream;
  }

  // チャンク処理（バックプレッシャー考慮）
  private processStreamChunk(
    chunk: any,
    transform: ITransformFunction,
    callback: TransformCallback
  ): void {
    const startTime = performance.now();

    try {
      // 非同期変換処理
      Promise.resolve(transform(chunk))
        .then(result => {
          const duration = performance.now() - startTime;
          this.metrics.recordTransform(duration, true);
          callback(null, result);
        })
        .catch(error => {
          const duration = performance.now() - startTime;
          this.metrics.recordTransform(duration, false);
          callback(error);
        });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.recordTransform(duration, false);
      callback(error as Error);
    }
  }

  // ストリームイベント設定
  private setupStreamEvents(stream: Transform, topic: string): void {
    stream.on('pipe', () => {
      this.metrics.recordStreamEvent(topic, 'pipe');
    });

    stream.on('unpipe', () => {
      this.metrics.recordStreamEvent(topic, 'unpipe');
    });

    stream.on('error', (error) => {
      this.metrics.recordStreamEvent(topic, 'error');
      console.error(`Stream error for topic ${topic}:`, error);
    });

    stream.on('finish', () => {
      this.metrics.recordStreamEvent(topic, 'finish');
    });
  }

  // デフォルト変換関数（パススルー）
  private defaultTransform(chunk: any): any {
    return chunk;
  }
}
```

### 3. メモリ管理の最適化

#### オブジェクトプール
```typescript
export class ObjectPool<T> {
  private readonly available: T[];
  private readonly inUse: Set<T>;
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.available = [];
    this.inUse = new Set();
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // 初期オブジェクト作成
    this.preallocate(Math.min(10, maxSize));
  }

  // オブジェクト取得
  acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  // オブジェクト返却
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      return; // 既に返却済み
    }

    this.inUse.delete(obj);
    
    // オブジェクトのリセット
    this.reset(obj);

    // プールサイズ制限
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
    // サイズ超過の場合はGCに委ねる
  }

  // 事前割り当て
  private preallocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.available.push(this.factory());
    }
  }

  // 統計情報
  getStats(): IPoolStats {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }
}

// メッセージ用オブジェクトプール
export class MessageObjectPool {
  private readonly messagePool: ObjectPool<IMessage>;
  private readonly envelopePool: ObjectPool<IMessageEnvelope>;

  constructor() {
    this.messagePool = new ObjectPool(
      () => ({ topic: '', payload: null, qos: 0 }),
      (msg) => {
        msg.topic = '';
        msg.payload = null;
        msg.qos = 0;
      },
      1000
    );

    this.envelopePool = new ObjectPool(
      () => ({ id: '', message: null as any, priority: Priority.NORMAL, timestamp: 0, attempts: 0 }),
      (env) => {
        env.id = '';
        env.message = null as any;
        env.priority = Priority.NORMAL;
        env.timestamp = 0;
        env.attempts = 0;
      },
      1000
    );
  }

  acquireMessage(): IMessage {
    return this.messagePool.acquire();
  }

  releaseMessage(message: IMessage): void {
    this.messagePool.release(message);
  }

  acquireEnvelope(): IMessageEnvelope {
    return this.envelopePool.acquire();
  }

  releaseEnvelope(envelope: IMessageEnvelope): void {
    this.envelopePool.release(envelope);
  }
}
```

#### ガベージコレクション最適化
```typescript
export class MemoryManager {
  private readonly gcMetrics: IGCMetrics;
  private readonly monitoringInterval: NodeJS.Timeout;

  constructor() {
    this.gcMetrics = this.initializeGCMetrics();
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats();
    }, 30000); // 30秒間隔

    this.setupGCEvents();
  }

  // メモリ使用量監視
  private collectMemoryStats(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.gcMetrics.recordMemoryUsage({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cpu: cpuUsage
    });

    // メモリリーク検出
    if (this.detectMemoryLeak(memUsage)) {
      this.triggerMemoryCleanup();
    }
  }

  // メモリリーク検出
  private detectMemoryLeak(memUsage: NodeJS.MemoryUsage): boolean {
    const threshold = 512 * 1024 * 1024; // 512MB
    const growthRate = this.calculateMemoryGrowthRate();

    return memUsage.heapUsed > threshold || growthRate > 0.1; // 10%以上の成長率
  }

  // メモリクリーンアップ
  private triggerMemoryCleanup(): void {
    console.warn('Memory cleanup triggered');

    // 強制ガベージコレクション
    if (global.gc) {
      global.gc();
    }

    // キャッシュクリア
    this.clearCaches();

    // 古い接続のクリーンアップ
    this.cleanupIdleConnections();
  }

  // キャッシュクリア
  private clearCaches(): void {
    // 実装されたキャッシュシステムのクリア
    CacheManager.clearExpired();
    MessageCache.cleanup();
  }

  // アイドル接続のクリーンアップ
  private cleanupIdleConnections(): void {
    // 実装されたコネクションプールのクリーンアップ
    ConnectionPoolManager.cleanupIdle();
  }

  // GCイベントの設定
  private setupGCEvents(): void {
    // Node.js v14+でのGCイベント監視
    if (typeof performance !== 'undefined' && performance.eventLoopUtilization) {
      setInterval(() => {
        const utilization = performance.eventLoopUtilization();
        this.gcMetrics.recordEventLoopUtilization(utilization);
      }, 5000);
    }
  }

  // メモリ成長率計算
  private calculateMemoryGrowthRate(): number {
    const history = this.gcMetrics.getMemoryHistory();
    
    if (history.length < 2) {
      return 0;
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    
    return (current.heapUsed - previous.heapUsed) / previous.heapUsed;
  }

  dispose(): void {
    clearInterval(this.monitoringInterval);
  }
}
```

### 4. ネットワーク最適化

#### 接続の多重化
```typescript
export class ConnectionMultiplexer {
  private readonly connections: Map<string, IMultiplexedConnection>;
  private readonly channelManager: IChannelManager;

  constructor() {
    this.connections = new Map();
    this.channelManager = new ChannelManager();
  }

  // 仮想チャネルの作成
  async createChannel(
    brokerId: string,
    channelId: string,
    options: IChannelOptions = {}
  ): Promise<IVirtualChannel> {
    const connection = await this.getOrCreateConnection(brokerId);
    
    const channel = await this.channelManager.createChannel(
      connection,
      channelId,
      options
    );

    return channel;
  }

  // 接続の共有
  private async getOrCreateConnection(brokerId: string): Promise<IMultiplexedConnection> {
    if (this.connections.has(brokerId)) {
      return this.connections.get(brokerId)!;
    }

    const connection = await this.establishMultiplexedConnection(brokerId);
    this.connections.set(brokerId, connection);
    
    return connection;
  }

  // 多重化接続の確立
  private async establishMultiplexedConnection(brokerId: string): Promise<IMultiplexedConnection> {
    const config = await this.getConnectionConfig(brokerId);
    
    const connection = new MultiplexedConnection(config, {
      maxChannels: 100,
      heartbeatInterval: 30000,
      compressionEnabled: true,
      keepAliveInterval: 60000
    });

    await connection.connect();
    
    return connection;
  }
}
```

#### データ圧縮
```typescript
export class MessageCompressor {
  private readonly compressionAlgorithm: CompressionAlgorithm;
  private readonly compressionLevel: number;

  constructor(
    algorithm: CompressionAlgorithm = 'gzip',
    level: number = 6
  ) {
    this.compressionAlgorithm = algorithm;
    this.compressionLevel = level;
  }

  // メッセージ圧縮
  async compressMessage(message: IMessage): Promise<ICompressedMessage> {
    const startTime = performance.now();
    
    try {
      const payload = JSON.stringify(message.payload);
      const originalSize = Buffer.byteLength(payload, 'utf8');

      // 小さなペイロードは圧縮しない
      if (originalSize < 1024) {
        return {
          ...message,
          compressed: false,
          originalSize,
          compressedSize: originalSize
        };
      }

      const compressed = await this.compress(payload);
      const compressedSize = compressed.length;
      
      const compressionRatio = compressedSize / originalSize;
      const duration = performance.now() - startTime;

      // 圧縮効果が低い場合は非圧縮を返す
      if (compressionRatio > 0.9) {
        return {
          ...message,
          compressed: false,
          originalSize,
          compressedSize: originalSize
        };
      }

      return {
        ...message,
        payload: compressed,
        compressed: true,
        compressionAlgorithm: this.compressionAlgorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime: duration
      };

    } catch (error) {
      console.error('Compression failed:', error);
      return {
        ...message,
        compressed: false,
        originalSize: Buffer.byteLength(JSON.stringify(message.payload), 'utf8'),
        compressedSize: Buffer.byteLength(JSON.stringify(message.payload), 'utf8')
      };
    }
  }

  // データ圧縮実行
  private async compress(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const algorithm = this.getCompressionModule();
      
      algorithm(Buffer.from(data, 'utf8'), {
        level: this.compressionLevel
      }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  private getCompressionModule(): any {
    const zlib = require('zlib');
    
    switch (this.compressionAlgorithm) {
      case 'gzip':
        return zlib.gzip;
      case 'deflate':
        return zlib.deflate;
      case 'brotli':
        return zlib.brotliCompress;
      default:
        throw new Error(`Unsupported compression algorithm: ${this.compressionAlgorithm}`);
    }
  }
}
```

## 📊 パフォーマンス監視

### 1. リアルタイム監視
```typescript
export class PerformanceMonitor {
  private readonly metrics: Map<string, IMetricCollector>;
  private readonly alertThresholds: IAlertThresholds;
  private readonly reportingInterval: NodeJS.Timeout;

  constructor(config: IMonitorConfig) {
    this.metrics = new Map();
    this.alertThresholds = config.alertThresholds;
    
    this.initializeMetrics();
    this.startReporting(config.reportingInterval || 60000);
  }

  // メトリクス初期化
  private initializeMetrics(): void {
    // レイテンシメトリクス
    this.metrics.set('latency', new LatencyCollector([
      0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0
    ]));

    // スループットメトリクス
    this.metrics.set('throughput', new ThroughputCollector());

    // リソース使用量メトリクス
    this.metrics.set('resources', new ResourceCollector());

    // エラー率メトリクス
    this.metrics.set('errors', new ErrorRateCollector());
  }

  // パフォーマンス測定
  measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const startCpu = process.cpuUsage();

    return operation().then(
      result => {
        this.recordSuccess(operationName, startTime, startCpu);
        return result;
      },
      error => {
        this.recordError(operationName, startTime, startCpu, error);
        throw error;
      }
    );
  }

  // 成功記録
  private recordSuccess(
    operationName: string,
    startTime: number,
    startCpu: NodeJS.CpuUsage
  ): void {
    const duration = performance.now() - startTime;
    const cpuUsage = process.cpuUsage(startCpu);

    const latencyCollector = this.metrics.get('latency') as LatencyCollector;
    latencyCollector.record(operationName, duration);

    const throughputCollector = this.metrics.get('throughput') as ThroughputCollector;
    throughputCollector.recordOperation(operationName);

    // しきい値チェック
    this.checkThresholds(operationName, duration);
  }

  // エラー記録
  private recordError(
    operationName: string,
    startTime: number,
    startCpu: NodeJS.CpuUsage,
    error: Error
  ): void {
    const duration = performance.now() - startTime;

    const errorCollector = this.metrics.get('errors') as ErrorRateCollector;
    errorCollector.recordError(operationName, error);

    // パフォーマンス影響の記録
    if (duration > this.alertThresholds.operationTimeout) {
      this.triggerAlert('SLOW_OPERATION', {
        operation: operationName,
        duration,
        error: error.message
      });
    }
  }

  // しきい値チェック
  private checkThresholds(operationName: string, duration: number): void {
    const thresholds = this.alertThresholds;

    if (duration > thresholds.operationTimeout) {
      this.triggerAlert('OPERATION_TIMEOUT', {
        operation: operationName,
        duration,
        threshold: thresholds.operationTimeout
      });
    }

    // メモリ使用量チェック
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > thresholds.memoryUsage) {
      this.triggerAlert('HIGH_MEMORY_USAGE', {
        current: memUsage.heapUsed,
        threshold: thresholds.memoryUsage
      });
    }
  }

  // アラート発火
  private triggerAlert(type: string, details: any): void {
    console.warn(`Performance Alert [${type}]:`, details);
    
    // 外部アラートシステムとの連携
    // AlertManager.send(type, details);
  }

  // レポート生成
  generateReport(): IPerformanceReport {
    const latencyCollector = this.metrics.get('latency') as LatencyCollector;
    const throughputCollector = this.metrics.get('throughput') as ThroughputCollector;
    const resourceCollector = this.metrics.get('resources') as ResourceCollector;
    const errorCollector = this.metrics.get('errors') as ErrorRateCollector;

    return {
      timestamp: new Date(),
      latency: latencyCollector.getStats(),
      throughput: throughputCollector.getStats(),
      resources: resourceCollector.getStats(),
      errors: errorCollector.getStats(),
      summary: this.generateSummary()
    };
  }

  private generateSummary(): IPerformanceSummary {
    // 総合的なパフォーマンス評価
    return {
      overallHealth: 'good', // good, warning, critical
      recommendedActions: [],
      trends: this.analyzeTrends()
    };
  }
}
```

### 2. プロファイリング
```typescript
export class PerformanceProfiler {
  private readonly profiles: Map<string, IProfile>;
  private readonly samplingInterval: number;

  constructor(samplingInterval: number = 100) {
    this.profiles = new Map();
    this.samplingInterval = samplingInterval;
  }

  // プロファイル開始
  startProfiling(profileName: string): void {
    const profile: IProfile = {
      name: profileName,
      startTime: performance.now(),
      samples: [],
      callStack: [],
      memorySnapshots: []
    };

    this.profiles.set(profileName, profile);
    this.startSampling(profile);
  }

  // プロファイル終了
  stopProfiling(profileName: string): IProfileResult {
    const profile = this.profiles.get(profileName);
    
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    profile.endTime = performance.now();
    this.stopSampling(profile);

    const result = this.analyzeProfile(profile);
    this.profiles.delete(profileName);

    return result;
  }

  // サンプリング開始
  private startSampling(profile: IProfile): void {
    profile.samplingTimer = setInterval(() => {
      const sample: IPerformanceSample = {
        timestamp: performance.now(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        eventLoopDelay: this.measureEventLoopDelay()
      };

      profile.samples.push(sample);
    }, this.samplingInterval);
  }

  // イベントループ遅延測定
  private measureEventLoopDelay(): number {
    const start = performance.now();
    
    return new Promise<number>(resolve => {
      setImmediate(() => {
        resolve(performance.now() - start);
      });
    }) as any; // 簡易実装
  }

  // プロファイル分析
  private analyzeProfile(profile: IProfile): IProfileResult {
    const duration = profile.endTime! - profile.startTime;
    const samples = profile.samples;

    return {
      name: profile.name,
      duration,
      totalSamples: samples.length,
      averageMemory: this.calculateAverageMemory(samples),
      peakMemory: this.calculatePeakMemory(samples),
      averageCpu: this.calculateAverageCpu(samples),
      eventLoopDelayStats: this.calculateEventLoopStats(samples),
      hotspots: this.identifyHotspots(samples),
      recommendations: this.generateRecommendations(samples)
    };
  }

  private identifyHotspots(samples: IPerformanceSample[]): IHotspot[] {
    // パフォーマンスボトルネックの特定
    const hotspots: IHotspot[] = [];

    // メモリ使用量の急激な増加を検出
    for (let i = 1; i < samples.length; i++) {
      const current = samples[i];
      const previous = samples[i - 1];
      
      const memoryIncrease = current.memory.heapUsed - previous.memory.heapUsed;
      if (memoryIncrease > 10 * 1024 * 1024) { // 10MB増加
        hotspots.push({
          type: 'memory_spike',
          timestamp: current.timestamp,
          severity: 'high',
          details: { memoryIncrease }
        });
      }
    }

    return hotspots;
  }
}
```

---

**継続的改善**: パフォーマンス最適化は測定結果とボトルネック分析をもとに継続的に改善していく必要があります。
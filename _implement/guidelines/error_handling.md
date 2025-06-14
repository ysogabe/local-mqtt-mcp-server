# エラーハンドリング ガイドライン

## 🎯 目標

MQTT MCP Server の堅牢なエラーハンドリング戦略を定義し、障害発生時の適切な対応とユーザー体験の向上を実現します。

## 📋 基本原則

### 1. 段階的エラー処理
- **早期検出**: 入力検証で問題を早期発見
- **適切な分類**: エラーの種類と重要度を明確化
- **回復可能性**: 自動回復できるエラーとできないエラーの識別
- **情報保持**: デバッグに必要な情報を適切に保持

### 2. ユーザー体験重視
- **明確なメッセージ**: 技術者でなくても理解できるエラーメッセージ
- **実行可能な提案**: 解決方法の具体的な提示
- **状況に応じた対応**: エラーレベルに応じた適切な動作

### 3. 運用監視対応
- **構造化ログ**: 解析しやすい形式でのエラー記録
- **メトリクス収集**: エラー発生パターンの分析用データ
- **アラート連携**: 重要なエラーの自動通知

## 🏗️ エラー分類体系

### ErrorCategory 定義
```typescript
export enum ErrorCategory {
  // 接続関連エラー
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // 認証・認可エラー
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  
  // プロトコルエラー
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  
  // 設定・検証エラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // タイムアウト・パフォーマンス
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  
  // リソース関連
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  CAPACITY_ERROR = 'CAPACITY_ERROR',
  
  // ビジネスロジックエラー
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  
  // システムエラー
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

### エラー重要度レベル
```typescript
export enum ErrorSeverity {
  CRITICAL = 'critical',    // システム停止、データ損失
  HIGH = 'high',           // 主要機能停止
  MEDIUM = 'medium',       // 一部機能制限
  LOW = 'low',            // 軽微な問題
  INFO = 'info'           // 情報提供
}
```

## 🔧 カスタムエラークラス設計

### 基底エラークラス
```typescript
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly correlationId?: string;
  public readonly details?: Record<string, unknown>;
  public readonly userMessage?: string;
  public readonly suggestions?: string[];

  constructor(
    code: string,
    message: string,
    options: {
      category: ErrorCategory;
      severity: ErrorSeverity;
      details?: Record<string, unknown>;
      userMessage?: string;
      suggestions?: string[];
      cause?: Error;
      correlationId?: string;
    }
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.category = options.category;
    this.severity = options.severity;
    this.timestamp = new Date();
    this.details = options.details;
    this.userMessage = options.userMessage;
    this.suggestions = options.suggestions;
    this.correlationId = options.correlationId || this.generateCorrelationId();

    // 原因エラーのチェーン
    if (options.cause) {
      this.cause = options.cause;
    }

    // スタックトレース保持
    Error.captureStackTrace(this, this.constructor);
  }

  // エラー情報の構造化出力
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      details: this.details,
      suggestions: this.suggestions,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message
      } : undefined
    };
  }

  // 回復可能性の判定
  public abstract isRecoverable(): boolean;

  // ユーザー向けエラー情報
  public getUserFriendlyInfo(): IUserErrorInfo {
    return {
      message: this.userMessage || this.message,
      suggestions: this.suggestions || [],
      severity: this.severity,
      canRetry: this.isRecoverable()
    };
  }

  private generateCorrelationId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export interface IUserErrorInfo {
  message: string;
  suggestions: string[];
  severity: ErrorSeverity;
  canRetry: boolean;
}
```

### 具体的エラークラス実装

#### 接続エラー
```typescript
export class ConnectionError extends BaseError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(code, message, {
      category: ErrorCategory.CONNECTION_ERROR,
      severity: ErrorSeverity.HIGH,
      details,
      cause,
      userMessage: 'MQTT ブローカーへの接続に問題が発生しました',
      suggestions: [
        'ネットワーク接続を確認してください',
        'ブローカーのURLと設定を確認してください',
        'しばらく待ってから再試行してください'
      ]
    });
  }

  public isRecoverable(): boolean {
    const recoverableCodes = [
      'NETWORK_TIMEOUT',
      'CONNECTION_REFUSED',
      'DNS_LOOKUP_FAILED'
    ];
    return recoverableCodes.includes(this.code);
  }

  // ファクトリーメソッド
  static brokerUnreachable(brokerId: string, url: string, cause?: Error): ConnectionError {
    return new ConnectionError(
      'BROKER_UNREACHABLE',
      `Cannot reach MQTT broker '${brokerId}' at ${url}`,
      { brokerId, url },
      cause
    );
  }

  static authenticationFailed(brokerId: string, username?: string): ConnectionError {
    return new ConnectionError(
      'AUTHENTICATION_FAILED',
      `Authentication failed for broker '${brokerId}'`,
      { brokerId, username },
      undefined
    );
  }

  static connectionTimeout(brokerId: string, timeoutMs: number): ConnectionError {
    return new ConnectionError(
      'CONNECTION_TIMEOUT',
      `Connection to broker '${brokerId}' timed out after ${timeoutMs}ms`,
      { brokerId, timeoutMs }
    );
  }
}
```

#### プロトコルエラー
```typescript
export class ProtocolError extends BaseError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, {
      category: ErrorCategory.PROTOCOL_ERROR,
      severity: ErrorSeverity.MEDIUM,
      details,
      userMessage: 'MQTT プロトコルの使用方法に問題があります',
      suggestions: [
        'トピック名の形式を確認してください',
        'QoS レベルが正しいか確認してください',
        'メッセージサイズの制限を確認してください'
      ]
    });
  }

  public isRecoverable(): boolean {
    return false; // プロトコルエラーは通常回復不可
  }

  static invalidTopic(topic: string, reason?: string): ProtocolError {
    return new ProtocolError(
      'INVALID_TOPIC',
      `Invalid MQTT topic: '${topic}'${reason ? ` - ${reason}` : ''}`,
      { topic, reason }
    );
  }

  static invalidQoS(qos: unknown): ProtocolError {
    return new ProtocolError(
      'INVALID_QOS',
      `Invalid QoS level: ${qos}. Must be 0, 1, or 2`,
      { qos, validValues: [0, 1, 2] }
    );
  }

  static messageTooLarge(size: number, maxSize: number): ProtocolError {
    return new ProtocolError(
      'MESSAGE_TOO_LARGE',
      `Message size ${size} bytes exceeds maximum ${maxSize} bytes`,
      { actualSize: size, maxSize }
    );
  }
}
```

#### 検証エラー
```typescript
export class ValidationError extends BaseError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, {
      category: ErrorCategory.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      details,
      userMessage: '入力された設定やパラメータに問題があります',
      suggestions: [
        '必須項目が入力されているか確認してください',
        '値の形式や範囲を確認してください',
        'ドキュメントを参照して正しい設定を確認してください'
      ]
    });
  }

  public isRecoverable(): boolean {
    return false; // バリデーションエラーは入力修正が必要
  }

  static requiredField(fieldName: string): ValidationError {
    return new ValidationError(
      'REQUIRED_FIELD',
      `Required field '${fieldName}' is missing`,
      { field: fieldName }
    );
  }

  static invalidFormat(fieldName: string, value: unknown, expectedFormat: string): ValidationError {
    return new ValidationError(
      'INVALID_FORMAT',
      `Field '${fieldName}' has invalid format. Expected: ${expectedFormat}`,
      { field: fieldName, value, expectedFormat }
    );
  }

  static outOfRange(fieldName: string, value: number, min: number, max: number): ValidationError {
    return new ValidationError(
      'OUT_OF_RANGE',
      `Field '${fieldName}' value ${value} is out of range [${min}, ${max}]`,
      { field: fieldName, value, min, max }
    );
  }
}
```

## 🛡️ エラーハンドリング戦略

### 1. 階層的エラー処理
```typescript
export class LayeredErrorHandler {
  private readonly logger: ILogger;
  private readonly metrics: IMetricsCollector;
  private readonly alertManager: IAlertManager;

  constructor(
    logger: ILogger,
    metrics: IMetricsCollector,
    alertManager: IAlertManager
  ) {
    this.logger = logger;
    this.metrics = metrics;
    this.alertManager = alertManager;
  }

  // メインエラー処理エントリーポイント
  async handleError(error: Error, context: IErrorContext): Promise<IErrorResult> {
    const startTime = Date.now();
    let processedError: BaseError;

    try {
      // 1. エラーの正規化
      processedError = this.normalizeError(error, context);

      // 2. エラーの分類と重要度判定
      const classification = this.classifyError(processedError);

      // 3. ログ出力
      await this.logError(processedError, context, classification);

      // 4. メトリクス更新
      this.updateMetrics(processedError, classification);

      // 5. アラート判定と送信
      await this.handleAlerting(processedError, classification);

      // 6. 回復処理の実行
      const recoveryResult = await this.attemptRecovery(processedError, context);

      // 7. 結果の構築
      return this.buildErrorResult(processedError, recoveryResult, context);

    } catch (handlingError) {
      // エラーハンドリング自体でエラーが発生した場合の緊急処理
      return this.handleCriticalFailure(error, handlingError as Error, context);
    } finally {
      // 処理時間の記録
      const duration = Date.now() - startTime;
      this.metrics.recordHandlingDuration(duration);
    }
  }

  // エラーの正規化（BaseErrorに変換）
  private normalizeError(error: Error, context: IErrorContext): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    // 一般的なエラーをBaseErrorに変換
    if (error.name === 'TypeError') {
      return new ValidationError(
        'TYPE_ERROR',
        error.message,
        { originalError: error.name, context: context.operation }
      );
    }

    // その他の未知のエラー
    return new SystemError(
      'UNKNOWN_ERROR',
      error.message,
      { originalError: error.name, stack: error.stack }
    );
  }

  // エラー分類
  private classifyError(error: BaseError): IErrorClassification {
    return {
      category: error.category,
      severity: error.severity,
      isRecoverable: error.isRecoverable(),
      requiresAlert: this.shouldAlert(error),
      retryStrategy: this.getRetryStrategy(error)
    };
  }

  // ログ出力
  private async logError(
    error: BaseError, 
    context: IErrorContext,
    classification: IErrorClassification
  ): Promise<void> {
    const logLevel = this.getLogLevel(error.severity);
    
    this.logger[logLevel]('Error occurred', {
      ...error.toJSON(),
      context: {
        operation: context.operation,
        userId: context.userId,
        sessionId: context.sessionId,
        brokerId: context.brokerId
      },
      classification,
      environment: process.env.NODE_ENV
    });
  }

  // 回復処理
  private async attemptRecovery(
    error: BaseError, 
    context: IErrorContext
  ): Promise<IRecoveryResult> {
    if (!error.isRecoverable()) {
      return { attempted: false, success: false };
    }

    try {
      const strategy = this.getRecoveryStrategy(error);
      const success = await strategy.execute(error, context);
      
      return { attempted: true, success, strategy: strategy.name };
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed', {
        originalError: error.code,
        recoveryError: (recoveryError as Error).message
      });
      
      return { attempted: true, success: false, error: recoveryError as Error };
    }
  }

  // 回復戦略の取得
  private getRecoveryStrategy(error: BaseError): IRecoveryStrategy {
    switch (error.category) {
      case ErrorCategory.CONNECTION_ERROR:
        return new ConnectionRecoveryStrategy();
      case ErrorCategory.TIMEOUT_ERROR:
        return new RetryRecoveryStrategy();
      case ErrorCategory.RATE_LIMIT_ERROR:
        return new BackoffRecoveryStrategy();
      default:
        return new NoOpRecoveryStrategy();
    }
  }
}

// エラーコンテキスト
export interface IErrorContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  brokerId?: string;
  requestId?: string;
  additionalInfo?: Record<string, unknown>;
}

// エラー分類結果
export interface IErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRecoverable: boolean;
  requiresAlert: boolean;
  retryStrategy: RetryStrategy;
}

// エラー処理結果
export interface IErrorResult {
  error: BaseError;
  handled: boolean;
  recovered: boolean;
  userInfo: IUserErrorInfo;
  nextAction: 'retry' | 'abort' | 'fallback';
}
```

### 2. 回復戦略の実装
```typescript
// 基底回復戦略
export abstract class BaseRecoveryStrategy implements IRecoveryStrategy {
  abstract readonly name: string;
  
  abstract execute(error: BaseError, context: IErrorContext): Promise<boolean>;
  
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 接続回復戦略
export class ConnectionRecoveryStrategy extends BaseRecoveryStrategy {
  readonly name = 'ConnectionRecovery';
  
  async execute(error: BaseError, context: IErrorContext): Promise<boolean> {
    if (!(error instanceof ConnectionError)) {
      return false;
    }

    const maxAttempts = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 接続の再確立を試行
        await this.reconnect(context.brokerId!);
        return true;
      } catch (reconnectError) {
        if (attempt === maxAttempts) {
          return false;
        }
        
        // 指数バックオフで待機
        await this.delay(baseDelay * Math.pow(2, attempt - 1));
      }
    }

    return false;
  }

  private async reconnect(brokerId: string): Promise<void> {
    // 実際の再接続ロジック
    const connectionManager = ServiceLocator.get<ConnectionManager>('connectionManager');
    await connectionManager.reconnect(brokerId);
  }
}

// リトライ戦略
export class RetryRecoveryStrategy extends BaseRecoveryStrategy {
  readonly name = 'RetryRecovery';
  
  async execute(error: BaseError, context: IErrorContext): Promise<boolean> {
    const operation = context.operation;
    const maxRetries = this.getMaxRetries(error);
    
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        await this.retryOperation(operation, context);
        return true;
      } catch (retryError) {
        if (retry === maxRetries) {
          return false;
        }
        
        await this.delay(1000 * retry); // リニアバックオフ
      }
    }

    return false;
  }

  private getMaxRetries(error: BaseError): number {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 5;
      case ErrorSeverity.HIGH:
        return 3;
      default:
        return 1;
    }
  }

  private async retryOperation(operation: string, context: IErrorContext): Promise<void> {
    // 操作の再実行ロジック
    const operationHandler = ServiceLocator.get<IOperationHandler>('operationHandler');
    await operationHandler.execute(operation, context);
  }
}
```

### 3. 非同期エラーハンドリング
```typescript
export class AsyncErrorHandler {
  private readonly errorQueue: Queue<IAsyncError>;
  private readonly processor: IAsyncErrorProcessor;
  private readonly logger: ILogger;

  constructor(
    processor: IAsyncErrorProcessor,
    logger: ILogger
  ) {
    this.errorQueue = new Queue('async-errors');
    this.processor = processor;
    this.logger = logger;
    
    this.startProcessing();
  }

  // 非同期エラーのキュー追加
  public enqueueError(error: Error, context: IErrorContext): void {
    const asyncError: IAsyncError = {
      id: this.generateErrorId(),
      error,
      context,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    this.errorQueue.add(asyncError);
  }

  // Promise拒否の自動処理
  public setupGlobalHandlers(): void {
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      this.logger.error('Unhandled promise rejection', {
        error: error.message,
        stack: error.stack,
        promise: promise.toString()
      });

      this.enqueueError(error, {
        operation: 'unhandled_rejection',
        additionalInfo: { promise: promise.toString() }
      });
    });

    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });

      // 致命的エラーとして処理
      this.handleCriticalError(error);
      
      // プロセス終了
      process.exit(1);
    });
  }

  // エラー処理の開始
  private startProcessing(): void {
    this.errorQueue.process(async (job) => {
      const asyncError = job.data;
      
      try {
        await this.processor.process(asyncError);
      } catch (processingError) {
        // 処理に失敗した場合のリトライ
        if (asyncError.retryCount < asyncError.maxRetries) {
          asyncError.retryCount++;
          this.errorQueue.add(asyncError, {
            delay: 1000 * Math.pow(2, asyncError.retryCount) // 指数バックオフ
          });
        } else {
          this.logger.error('Failed to process async error after max retries', {
            errorId: asyncError.id,
            originalError: asyncError.error.message,
            processingError: (processingError as Error).message
          });
        }
      }
    });
  }

  private handleCriticalError(error: Error): void {
    // 重要なシステムエラーの緊急処理
    // ファイルシステムへの直接書き込み、外部アラートなど
  }

  private generateErrorId(): string {
    return `async-err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
```

## 📊 エラー監視とメトリクス

### 1. エラーメトリクス収集
```typescript
export class ErrorMetricsCollector implements IMetricsCollector {
  private readonly errorCountCounter: Counter;
  private readonly errorDurationHistogram: Histogram;
  private readonly recoverySuccessCounter: Counter;

  constructor() {
    // Prometheus メトリクス定義
    this.errorCountCounter = new Counter({
      name: 'mqtt_mcp_errors_total',
      help: 'Total number of errors by category and severity',
      labelNames: ['category', 'severity', 'code', 'recoverable']
    });

    this.errorDurationHistogram = new Histogram({
      name: 'mqtt_mcp_error_handling_duration_seconds',
      help: 'Time spent handling errors',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    });

    this.recoverySuccessCounter = new Counter({
      name: 'mqtt_mcp_recovery_attempts_total',
      help: 'Number of recovery attempts by strategy and outcome',
      labelNames: ['strategy', 'success']
    });
  }

  recordError(error: BaseError): void {
    this.errorCountCounter.inc({
      category: error.category,
      severity: error.severity,
      code: error.code,
      recoverable: error.isRecoverable().toString()
    });
  }

  recordHandlingDuration(durationMs: number): void {
    this.errorDurationHistogram.observe(durationMs / 1000);
  }

  recordRecoveryAttempt(strategy: string, success: boolean): void {
    this.recoverySuccessCounter.inc({
      strategy,
      success: success.toString()
    });
  }

  // エラー統計の取得
  getErrorStats(): IErrorStats {
    return {
      totalErrors: this.errorCountCounter.get().values.reduce((sum, metric) => sum + metric.value, 0),
      errorsByCategory: this.getErrorsByCategory(),
      averageHandlingTime: this.getAverageHandlingTime(),
      recoverySuccessRate: this.getRecoverySuccessRate()
    };
  }

  private getErrorsByCategory(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.errorCountCounter.get().values.forEach(metric => {
      const category = metric.labels.category as string;
      stats[category] = (stats[category] || 0) + metric.value;
    });

    return stats;
  }

  private getAverageHandlingTime(): number {
    const histogram = this.errorDurationHistogram.get();
    return histogram.count > 0 ? histogram.sum / histogram.count : 0;
  }

  private getRecoverySuccessRate(): number {
    const attempts = this.recoverySuccessCounter.get().values;
    const total = attempts.reduce((sum, metric) => sum + metric.value, 0);
    const successful = attempts
      .filter(metric => metric.labels.success === 'true')
      .reduce((sum, metric) => sum + metric.value, 0);

    return total > 0 ? successful / total : 0;
  }
}
```

### 2. アラート管理
```typescript
export class AlertManager implements IAlertManager {
  private readonly alertRules: IAlertRule[];
  private readonly notifiers: INotifier[];
  private readonly suppressionCache: Map<string, Date>;

  constructor(alertRules: IAlertRule[], notifiers: INotifier[]) {
    this.alertRules = alertRules;
    this.notifiers = notifiers;
    this.suppressionCache = new Map();
  }

  async evaluateAlert(error: BaseError, context: IErrorContext): Promise<void> {
    for (const rule of this.alertRules) {
      if (await this.shouldTriggerAlert(rule, error, context)) {
        await this.sendAlert(rule, error, context);
      }
    }
  }

  private async shouldTriggerAlert(
    rule: IAlertRule, 
    error: BaseError, 
    context: IErrorContext
  ): Promise<boolean> {
    // ルール条件の評価
    if (!this.matchesConditions(rule.conditions, error, context)) {
      return false;
    }

    // 抑制ルールの確認
    const suppressionKey = this.getSuppressionKey(rule, error);
    const lastAlert = this.suppressionCache.get(suppressionKey);
    
    if (lastAlert && Date.now() - lastAlert.getTime() < rule.suppressionWindow) {
      return false;
    }

    return true;
  }

  private matchesConditions(
    conditions: IAlertCondition[], 
    error: BaseError, 
    context: IErrorContext
  ): boolean {
    return conditions.every(condition => {
      switch (condition.field) {
        case 'severity':
          return this.compareValues(error.severity, condition.operator, condition.value);
        case 'category':
          return this.compareValues(error.category, condition.operator, condition.value);
        case 'code':
          return this.compareValues(error.code, condition.operator, condition.value);
        case 'brokerId':
          return this.compareValues(context.brokerId, condition.operator, condition.value);
        default:
          return false;
      }
    });
  }

  private async sendAlert(
    rule: IAlertRule, 
    error: BaseError, 
    context: IErrorContext
  ): Promise<void> {
    const alert: IAlert = {
      id: this.generateAlertId(),
      rule: rule.name,
      severity: rule.severity,
      title: rule.title,
      description: this.formatAlertDescription(rule, error, context),
      error: error.toJSON(),
      context,
      timestamp: new Date()
    };

    // 全通知チャネルに送信
    const notificationPromises = this.notifiers.map(notifier => 
      notifier.send(alert).catch(notifyError => {
        console.error('Failed to send alert:', notifyError);
      })
    );

    await Promise.allSettled(notificationPromises);

    // 抑制キャッシュの更新
    const suppressionKey = this.getSuppressionKey(rule, error);
    this.suppressionCache.set(suppressionKey, new Date());
  }

  private formatAlertDescription(
    rule: IAlertRule, 
    error: BaseError, 
    context: IErrorContext
  ): string {
    return rule.template
      .replace('{{error.code}}', error.code)
      .replace('{{error.message}}', error.message)
      .replace('{{context.operation}}', context.operation || 'unknown')
      .replace('{{context.brokerId}}', context.brokerId || 'unknown');
  }
}

// アラートルール例
export const DEFAULT_ALERT_RULES: IAlertRule[] = [
  {
    name: 'critical_connection_failure',
    severity: ErrorSeverity.CRITICAL,
    title: 'Critical MQTT Connection Failure',
    template: 'MQTT connection to broker {{context.brokerId}} failed: {{error.message}}',
    conditions: [
      { field: 'category', operator: 'equals', value: ErrorCategory.CONNECTION_ERROR },
      { field: 'severity', operator: 'equals', value: ErrorSeverity.CRITICAL }
    ],
    suppressionWindow: 300000 // 5分間
  },
  {
    name: 'high_error_rate',
    severity: ErrorSeverity.HIGH,
    title: 'High Error Rate Detected',
    template: 'High error rate detected for operation {{context.operation}}',
    conditions: [
      { field: 'severity', operator: 'greaterThanOrEqual', value: ErrorSeverity.HIGH }
    ],
    suppressionWindow: 600000 // 10分間
  }
];
```

## 🔧 実装のベストプラクティス

### 1. エラー境界の設定
```typescript
// サービス境界でのエラーキャッチ
export class ServiceBoundaryWrapper<T> {
  constructor(
    private readonly service: T,
    private readonly errorHandler: IErrorHandler,
    private readonly serviceName: string
  ) {}

  // メソッドの自動ラップ
  wrap(): T {
    const wrapper = {} as T;
    
    Object.getOwnPropertyNames(Object.getPrototypeOf(this.service))
      .filter(name => name !== 'constructor')
      .forEach(methodName => {
        const originalMethod = (this.service as any)[methodName];
        
        if (typeof originalMethod === 'function') {
          (wrapper as any)[methodName] = this.createWrappedMethod(methodName, originalMethod);
        }
      });

    return wrapper;
  }

  private createWrappedMethod(methodName: string, originalMethod: Function) {
    return async (...args: any[]) => {
      try {
        return await originalMethod.apply(this.service, args);
      } catch (error) {
        const context: IErrorContext = {
          operation: `${this.serviceName}.${methodName}`,
          additionalInfo: { arguments: args }
        };

        const result = await this.errorHandler.handleError(error as Error, context);
        
        if (result.nextAction === 'retry') {
          // リトライロジック
          return await originalMethod.apply(this.service, args);
        } else if (result.nextAction === 'fallback') {
          // フォールバック処理
          return this.getFallbackResult(methodName);
        } else {
          // エラーを再スロー
          throw result.error;
        }
      }
    };
  }
}
```

### 2. エラー情報の集約
```typescript
export class ErrorAggregator {
  private readonly errors: Map<string, IErrorGroup> = new Map();
  private readonly timeWindow: number = 60000; // 1分間

  addError(error: BaseError, context: IErrorContext): void {
    const key = this.getGroupKey(error);
    const now = Date.now();

    if (!this.errors.has(key)) {
      this.errors.set(key, {
        key,
        firstOccurrence: now,
        lastOccurrence: now,
        count: 1,
        errors: [error],
        contexts: [context]
      });
    } else {
      const group = this.errors.get(key)!;
      group.lastOccurrence = now;
      group.count++;
      group.errors.push(error);
      group.contexts.push(context);

      // 最大保持数の制限
      if (group.errors.length > 10) {
        group.errors = group.errors.slice(-5); // 最新5件のみ保持
        group.contexts = group.contexts.slice(-5);
      }
    }

    // 古いエラーグループのクリーンアップ
    this.cleanupOldGroups(now);
  }

  getErrorSummary(): IErrorSummary {
    const groups = Array.from(this.errors.values());
    
    return {
      totalGroups: groups.length,
      totalErrors: groups.reduce((sum, group) => sum + group.count, 0),
      mostFrequent: groups.sort((a, b) => b.count - a.count).slice(0, 5),
      recentGroups: groups
        .filter(group => Date.now() - group.lastOccurrence < this.timeWindow)
        .sort((a, b) => b.lastOccurrence - a.lastOccurrence)
    };
  }

  private getGroupKey(error: BaseError): string {
    return `${error.category}:${error.code}`;
  }

  private cleanupOldGroups(now: number): void {
    for (const [key, group] of this.errors.entries()) {
      if (now - group.lastOccurrence > this.timeWindow * 10) { // 10分で削除
        this.errors.delete(key);
      }
    }
  }
}
```

---

**継続的改善**: エラーハンドリング戦略は運用経験と障害分析結果をもとに継続的に改善していく必要があります。
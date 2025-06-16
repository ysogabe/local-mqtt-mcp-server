/**
 * Connection status types
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * MQTT connection options
 */
export interface MqttConnectionOptions {
  clientId?: string;
  username?: string;
  password?: string;
  keepalive?: number;
  clean?: boolean;
  reconnectPeriod?: number;
  connectTimeout?: number;
  will?: {
    topic: string;
    payload: string | Buffer;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
}

/**
 * MQTT connection information
 */
export interface MqttConnection {
  id: string;
  brokerUrl: string;
  status: ConnectionStatus;
  connectedAt?: Date;
  disconnectedAt?: Date;
  error?: string;
  options?: MqttConnectionOptions;
}

/**
 * MQTT message structure
 */
export interface MqttMessage {
  id: string;
  connectionId: string;
  topic: string;
  payload: string | Buffer;
  timestamp: Date;
  qos: 0 | 1 | 2;
  retain: boolean;
  direction: 'inbound' | 'outbound';
}

/**
 * Subscription information
 */
export interface SubscriptionInfo {
  connectionId: string;
  topic: string;
  qos: 0 | 1 | 2;
  subscribedAt: Date;
}

/**
 * Publish request parameters
 */
export interface PublishRequest {
  connectionId: string;
  topic: string;
  message: string | Buffer;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

/**
 * Subscribe request parameters
 */
export interface SubscribeRequest {
  connectionId: string;
  topic: string;
  qos?: 0 | 1 | 2;
}

/**
 * Speech payload for AITuber integration
 * Compatible with AITuberKit MQTT message format
 */
export interface SpeechPayload {
  /** ユニークなメッセージID */
  id: string;
  /** 発話テキスト */
  text: string;
  /** 発話タイプ */
  type: 'speech' | 'alert' | 'notification';
  /** 優先度（高い方が先に再生される） */
  priority: 'high' | 'medium' | 'low';
  /** タイムスタンプ（ISO 8601形式） */
  timestamp: string;
  /** 発話者名（オプション） */
  speaker?: string;
  /** 感情表現（Live2D/VRM用） */
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'relaxed' | 'surprised';
  /** 音声設定（オプション） */
  voice?: string;
  speed?: number;
  pitch?: number;
  /** 追加メタデータ */
  metadata?: Record<string, any>;
}

/**
 * Tool result structure for MCP responses
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Message callback function type
 */
export type MessageCallback = (topic: string, payload: Buffer, packet: any) => void;

/**
 * Helper function to validate connection status
 */
export function isValidConnectionStatus(status: string): status is ConnectionStatus {
  return ['connected', 'disconnected', 'connecting', 'error'].includes(status);
}

/**
 * Helper function to generate unique message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper function to generate unique connection ID
 */
export function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
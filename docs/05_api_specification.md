# MQTT MCP Server API仕様書

## 1. API概要

### 1.1 プロトコル概要
MQTT MCP ServerはModel Context Protocol (MCP) v1.0に完全準拠したAPIを提供します。MCPのTools、Resources、Event Notificationsの3つの主要機能を通じてMQTT操作を実行できます。

### 1.2 通信方式
- **プライマリ**: stdio Transport (Claude Desktop標準)
- **セカンダリ**: HTTP Transport (Web統合用)
- **データ形式**: JSON-RPC 2.0
- **文字エンコーディング**: UTF-8

### 1.3 API設計原則
- **RESTful**: リソース指向の設計
- **Idempotent**: 冪等性の保証
- **Extensible**: プラグインによる拡張性
- **Consistent**: 一貫したエラーハンドリング
- **Secure**: デフォルトセキュア設定

## 2. API設計方針

### 2.1 Tools API vs Resources API の役割分担

MQTT MCP Serverでは、MCPの2つの主要なAPIパターンを以下のように使い分けています：

#### Tools API（操作）
- **目的**: MQTT操作の実行と制御
- **特徴**: パラメータを受け取り、操作を実行して結果を返す
- **使用例**:
  - `mqtt_connect`: ブローカーへの接続確立
  - `mqtt_publish`: メッセージの送信
  - `mqtt_subscribe`: トピックの購読開始
  - `mqtt_get_retained_messages`: 能動的なメッセージ取得（デバッグ用）

#### Resources API（状態照会）
- **目的**: システム状態の照会と情報取得
- **特徴**: 現在の状態を構造化データで提供
- **使用例**:
  - `/connections`: 接続状態の一覧表示
  - `/subscriptions`: アクティブな購読の一覧
  - `/messages`: メッセージ履歴の照会
  - `/retained-messages`: 保持メッセージの状態表示

#### 重複する機能の使い分け
- **保持メッセージ取得**:
  - `mqtt_get_retained_messages`（Tools）: デバッグやトラブルシューティングでの能動的取得
  - `/retained-messages`（Resources）: 管理画面での状態表示や定期的な監視

## 3. MCP Tools API

### 3.1 接続管理ツール

#### mqtt_connect
MQTTブローカーへの接続を確立します。

**Tool Schema:**
```json
{
  "name": "mqtt_connect",
  "description": "Connect to an MQTT broker with authentication and configuration options",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Unique identifier for this broker connection. If not specified, generates a default ID based on URL",
        "pattern": "^[a-zA-Z0-9_-]+$",
        "maxLength": 64
      },
      "url": {
        "type": "string",
        "description": "MQTT broker URL",
        "format": "uri",
        "examples": [
          "mqtt://localhost:1883",
          "mqtts://broker.example.com:8883",
          "ws://localhost:8080/mqtt",
          "wss://broker.example.com:8084/mqtt"
        ]
      },
      "clientId": {
        "type": "string",
        "description": "MQTT client identifier (1-23 UTF-8 characters). If not specified, server generates a unique ID",
        "minLength": 1,
        "maxLength": 23,
        "pattern": "^[a-zA-Z0-9_-]+$"
      },
      "credentials": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string",
            "description": "Username for authentication"
          },
          "password": {
            "type": "string",
            "description": "Password for authentication"
          }
        },
        "additionalProperties": false
      },
      "connection": {
        "type": "object",
        "properties": {
          "keepalive": {
            "type": "integer",
            "description": "Keep alive interval in seconds",
            "minimum": 1,
            "maximum": 65535,
            "default": 60
          },
          "clean": {
            "type": "boolean",
            "description": "Clean session flag",
            "default": true
          },
          "reconnectPeriod": {
            "type": "integer",
            "description": "Reconnect period in milliseconds",
            "minimum": 100,
            "maximum": 60000,
            "default": 1000
          },
          "connectTimeout": {
            "type": "integer",
            "description": "Connection timeout in milliseconds",
            "minimum": 1000,
            "maximum": 60000,
            "default": 30000
          }
        },
        "additionalProperties": false
      },
      "will": {
        "type": "object",
        "description": "Last Will and Testament configuration",
        "properties": {
          "topic": {
            "type": "string",
            "description": "Will message topic"
          },
          "payload": {
            "type": "string",
            "description": "Will message payload"
          },
          "qos": {
            "type": "integer",
            "enum": [0, 1, 2],
            "description": "Will message QoS level",
            "default": 0
          },
          "retain": {
            "type": "boolean",
            "description": "Will message retain flag",
            "default": false
          }
        },
        "required": ["topic", "payload"],
        "additionalProperties": false
      },
      "tls": {
        "type": "object",
        "description": "TLS/SSL configuration",
        "properties": {
          "ca": {
            "type": "string",
            "description": "CA certificate path or content"
          },
          "cert": {
            "type": "string",
            "description": "Client certificate path or content"
          },
          "key": {
            "type": "string",
            "description": "Client private key path or content"
          },
          "rejectUnauthorized": {
            "type": "boolean",
            "description": "Reject unauthorized certificates",
            "default": true
          }
        },
        "additionalProperties": false
      },
      "protocol": {
        "type": "object",
        "description": "MQTT protocol configuration",
        "properties": {
          "version": {
            "type": "string",
            "enum": ["3.1.1", "5.0"],
            "description": "MQTT protocol version",
            "default": "5.0"
          },
          "protocolId": {
            "type": "string",
            "description": "Protocol identifier (auto-detected from version if not specified)"
          }
        },
        "additionalProperties": false
      }
    },
    "required": ["url"],
    "additionalProperties": false
  }
}
```

**Request Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "tools/call",
  "params": {
    "name": "mqtt_connect",
    "arguments": {
      "brokerId": "primary-broker",
      "url": "mqtts://broker.example.com:8883",
      "clientId": "mcp-client-001",
      "credentials": {
        "username": "user123",
        "password": "secure-password"
      },
      "connection": {
        "keepalive": 60,
        "clean": true,
        "reconnectPeriod": 1000,
        "connectTimeout": 30000
      },
      "will": {
        "topic": "clients/mcp-client-001/status",
        "payload": "offline",
        "qos": 1,
        "retain": true
      },
      "tls": {
        "ca": "/path/to/ca.crt",
        "cert": "/path/to/client.crt",
        "key": "/path/to/client.key",
        "rejectUnauthorized": true
      },
      "protocol": {
        "version": "5.0"
      }
    }
  }
}
```

**Response Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully connected to MQTT broker primary-broker (mqtts://broker.example.com:8883)\n\nConnection Details:\n- Client ID: mcp-client-001\n- Keep Alive: 60s\n- Clean Session: true\n- TLS: enabled\n- Connected at: 2024-12-15T10:30:45.123Z"
      }
    ],
    "isError": false
  }
}
```

---

#### mqtt_disconnect
MQTTブローカーとの接続を切断します。

**Tool Schema:**
```json
{
  "name": "mqtt_disconnect",
  "description": "Disconnect from an MQTT broker",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Broker connection identifier to disconnect. If not specified, disconnects from all brokers"
      },
      "force": {
        "type": "boolean",
        "description": "Force disconnect without sending DISCONNECT packet. If true, immediately closes the TCP connection; if false, sends DISCONNECT packet first and waits for acknowledgment",
        "default": false
      }
    },
    "additionalProperties": false
  }
}
```

---

#### mqtt_status
接続状態と統計情報を取得します。

**Tool Schema:**
```json
{
  "name": "mqtt_status",
  "description": "Get MQTT connection status and statistics",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Specific broker ID to get status for. If not specified, returns status for all brokers"
      },
      "detailed": {
        "type": "boolean",
        "description": "Include detailed metrics and performance statistics",
        "default": false
      },
      "format": {
        "type": "string",
        "enum": ["text", "json"],
        "description": "Output format",
        "default": "text"
      }
    },
    "additionalProperties": false
  }
}
```

**Response Example (detailed=true):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "MQTT Connection Status Report\n\n📊 **Overview**\nActive Connections: 2/3\nTotal Uptime: 2h 15m 30s\nOverall Health: ✅ Healthy\n\n🔗 **Broker: primary-broker**\nURL: mqtts://broker.example.com:8883\nStatus: 🟢 Connected\nUptime: 2h 15m 30s\nLast Activity: 2s ago\n\nMetrics:\n- Messages Sent: 1,234\n- Messages Received: 5,678\n- Bytes Transferred: 2.1 MB\n- Average Latency: 12ms\n- Reconnects: 0\n\nSubscriptions: 5 active\n- sensors/+/temperature (QoS 1)\n- alerts/# (QoS 2)\n- status/system (QoS 0)\n- chat/messages/+ (QoS 1)\n- monitoring/health (QoS 1)\n\n🔗 **Broker: secondary-broker**\nURL: mqtt://localhost:1883\nStatus: 🟡 Connecting (attempt 3/5)\nLast Error: Connection timeout\nNext Retry: in 8s"
      }
    ],
    "isError": false
  }
}
```

### 3.2 メッセージングツール

#### mqtt_publish
指定したトピックにメッセージを発行します。

**Tool Schema:**
```json
{
  "name": "mqtt_publish",
  "description": "Publish a message to an MQTT topic with full QoS and configuration support",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier. If not specified, uses default broker"
      },
      "topic": {
        "type": "string",
        "description": "MQTT topic to publish to",
        "minLength": 1,
        "maxLength": 65535,
        "pattern": "^[^#+]*$"
      },
      "message": {
        "oneOf": [
          {
            "type": "string",
            "description": "Plain text message"
          },
          {
            "type": "object",
            "description": "JSON object message (will be stringified)"
          },
          {
            "type": "array",
            "description": "Array message (will be stringified)"
          }
        ],
        "description": "Message payload"
      },
      "qos": {
        "type": "integer",
        "enum": [0, 1, 2],
        "description": "Quality of Service level",
        "default": 0
      },
      "retain": {
        "type": "boolean",
        "description": "Retain message flag",
        "default": false
      },
      "properties": {
        "type": "object",
        "description": "MQTT 5.0 properties",
        "properties": {
          "messageExpiryInterval": {
            "type": "integer",
            "description": "Message expiry interval in seconds",
            "minimum": 1
          },
          "topicAlias": {
            "type": "integer",
            "description": "Topic alias",
            "minimum": 1,
            "maximum": 65535
          },
          "responseTopic": {
            "type": "string",
            "description": "Response topic"
          },
          "correlationData": {
            "type": "string",
            "description": "Correlation data"
          },
          "userProperties": {
            "type": "object",
            "description": "User-defined properties",
            "additionalProperties": {
              "type": "string"
            }
          },
          "subscriptionIdentifier": {
            "type": "integer",
            "description": "Subscription identifier",
            "minimum": 1
          },
          "contentType": {
            "type": "string",
            "description": "Content type of the payload"
          }
        },
        "additionalProperties": false
      },
      "timeout": {
        "type": "integer",
        "description": "Publish timeout in milliseconds",
        "minimum": 1000,
        "maximum": 60000,
        "default": 10000
      }
    },
    "required": ["topic", "message"],
    "additionalProperties": false
  }
}
```

**Request Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "method": "tools/call",
  "params": {
    "name": "mqtt_publish",
    "arguments": {
      "brokerId": "primary-broker",
      "topic": "sensors/temperature/room1",
      "message": {
        "value": 25.5,
        "unit": "celsius",
        "timestamp": "2024-12-15T10:30:45.123Z",
        "sensorId": "temp-001",
        "location": {
          "building": "A",
          "floor": 2,
          "room": "201"
        }
      },
      "qos": 1,
      "retain": true,
      "properties": {
        "messageExpiryInterval": 3600,
        "contentType": "application/json",
        "userProperties": {
          "source": "mcp-client",
          "priority": "normal"
        }
      },
      "timeout": 5000
    }
  }
}
```

**Response Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Message published successfully\n\nTopic: sensors/temperature/room1\nQoS: 1 (At least once)\nRetain: Yes\nMessage ID: 12345\nPayload Size: 156 bytes\nPublish Time: 12ms\nTimestamp: 2024-12-15T10:30:45.135Z"
      }
    ],
    "isError": false
  }
}
```

---

#### mqtt_subscribe
トピックを購読します。

**Tool Schema:**
```json
{
  "name": "mqtt_subscribe",
  "description": "Subscribe to MQTT topics with wildcard support and filtering options",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier"
      },
      "subscriptions": {
        "oneOf": [
          {
            "type": "string",
            "description": "Single topic pattern to subscribe to"
          },
          {
            "type": "array",
            "description": "Multiple topic subscriptions",
            "items": {
              "oneOf": [
                {
                  "type": "string",
                  "description": "Topic pattern"
                },
                {
                  "type": "object",
                  "properties": {
                    "topic": {
                      "type": "string",
                      "description": "Topic pattern"
                    },
                    "qos": {
                      "type": "integer",
                      "enum": [0, 1, 2],
                      "description": "QoS level for this subscription",
                      "default": 0
                    },
                    "nl": {
                      "type": "boolean",
                      "description": "No Local flag (MQTT 5.0)",
                      "default": false
                    },
                    "rap": {
                      "type": "boolean",
                      "description": "Retain as Published flag (MQTT 5.0)",
                      "default": false
                    },
                    "rh": {
                      "type": "integer",
                      "enum": [0, 1, 2],
                      "description": "Retain Handling (MQTT 5.0)",
                      "default": 0
                    }
                  },
                  "required": ["topic"],
                  "additionalProperties": false
                }
              ]
            },
            "minItems": 1
          }
        ]
      },
      "defaultQos": {
        "type": "integer",
        "enum": [0, 1, 2],
        "description": "Default QoS for string-only subscriptions",
        "default": 0
      },
      "filters": {
        "type": "array",
        "description": "Message filters to apply",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["content", "size", "rate", "source"],
              "description": "Filter type"
            },
            "condition": {
              "type": "string",
              "description": "Filter condition expression"
            },
            "action": {
              "type": "string",
              "enum": ["allow", "deny", "transform"],
              "description": "Action to take when filter matches"
            },
            "parameters": {
              "type": "object",
              "description": "Additional filter parameters"
            }
          },
          "required": ["type", "condition", "action"],
          "additionalProperties": false
        }
      }
    },
    "required": ["subscriptions"],
    "additionalProperties": false
  }
}
```

**Request Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "method": "tools/call",
  "params": {
    "name": "mqtt_subscribe",
    "arguments": {
      "brokerId": "primary-broker",
      "subscriptions": [
        {
          "topic": "sensors/+/temperature",
          "qos": 1
        },
        {
          "topic": "alerts/#",
          "qos": 2,
          "rh": 1
        },
        "status/system"
      ],
      "defaultQos": 0,
      "filters": [
        {
          "type": "content",
          "condition": "payload.value > 30",
          "action": "allow"
        },
        {
          "type": "rate",
          "condition": "messages_per_minute < 100",
          "action": "allow"
        }
      ]
    }
  }
}
```

---

#### mqtt_get_retained_messages
保持されたメッセージを取得します。

**背景**: MQTTの保持メッセージ（Retained Messages）は、新しい購読者が接続した際に最新の状態を即座に取得するための重要な機能です。このツールにより、現在保持されているメッセージを能動的に取得し、システムの状態確認やデバッグに活用できます。

**Tool Schema:**
```json
{
  "name": "mqtt_get_retained_messages",
  "description": "Retrieve retained messages from MQTT broker for debugging and state verification",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier"
      },
      "topicFilter": {
        "type": "string",
        "description": "Topic filter pattern for retained messages",
        "default": "#"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum number of messages to retrieve",
        "minimum": 1,
        "maximum": 1000,
        "default": 100
      },
      "format": {
        "type": "string",
        "enum": ["table", "json"],
        "description": "Output format",
        "default": "table"
      }
    },
    "additionalProperties": false
  }
}
```

---

#### mqtt_unsubscribe
トピックの購読を解除します。

**Tool Schema:**
```json
{
  "name": "mqtt_unsubscribe",
  "description": "Unsubscribe from MQTT topics",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier"
      },
      "topics": {
        "oneOf": [
          {
            "type": "string",
            "description": "Single topic to unsubscribe from"
          },
          {
            "type": "array",
            "description": "Multiple topics to unsubscribe from",
            "items": {
              "type": "string"
            },
            "minItems": 1
          }
        ]
      },
      "all": {
        "type": "boolean",
        "description": "Unsubscribe from all topics on the broker",
        "default": false
      }
    },
    "oneOf": [
      {
        "required": ["topics"]
      },
      {
        "required": ["all"],
        "properties": {
          "all": {
            "const": true
          }
        }
      }
    ],
    "additionalProperties": false
  }
}
```

### 3.3 管理ツール

#### mqtt_get_messages
メッセージ履歴を取得します。

**Tool Schema:**
```json
{
  "name": "mqtt_get_messages",
  "description": "Retrieve MQTT message history with filtering and pagination",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Filter by broker ID"
      },
      "topic": {
        "type": "string",
        "description": "Filter by topic pattern"
      },
      "direction": {
        "type": "string",
        "enum": ["inbound", "outbound", "both"],
        "description": "Message direction filter",
        "default": "both"
      },
      "timeRange": {
        "type": "object",
        "properties": {
          "start": {
            "type": "string",
            "format": "date-time",
            "description": "Start time (ISO 8601)"
          },
          "end": {
            "type": "string",
            "format": "date-time",
            "description": "End time (ISO 8601)"
          },
          "last": {
            "type": "string",
            "description": "Relative time (e.g., '1h', '30m', '5s')",
            "pattern": "^\\d+[smhd]$"
          }
        },
        "oneOf": [
          {
            "required": ["start", "end"]
          },
          {
            "required": ["last"]
          }
        ],
        "additionalProperties": false
      },
      "pagination": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "integer",
            "description": "Maximum number of messages to return",
            "minimum": 1,
            "maximum": 1000,
            "default": 50
          },
          "offset": {
            "type": "integer",
            "description": "Number of messages to skip",
            "minimum": 0,
            "default": 0
          },
          "order": {
            "type": "string",
            "enum": ["asc", "desc"],
            "description": "Sort order by timestamp",
            "default": "desc"
          }
        },
        "additionalProperties": false
      },
      "format": {
        "type": "string",
        "enum": ["table", "json", "csv"],
        "description": "Output format",
        "default": "table"
      },
      "includePayload": {
        "type": "boolean",
        "description": "Include message payload in output",
        "default": true
      }
    },
    "additionalProperties": false
  }
}
```

**Response Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-005",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "📬 **Message History** (Last 1 hour)\n\n| Time | Direction | Broker | Topic | QoS | Size | Payload Preview |\n|------|-----------|--------|-------|-----|------|----------------|\n| 10:30:45 | ⬇️ IN | primary | sensors/temp/room1 | 1 | 156B | {\"value\": 25.5, \"unit\": \"celsius\"...} |\n| 10:30:40 | ⬆️ OUT | primary | status/system | 0 | 23B | {\"status\": \"online\"} |\n| 10:30:35 | ⬇️ IN | primary | alerts/critical | 2 | 89B | {\"level\": \"critical\", \"message\": \"High temp...\"} |\n| 10:30:30 | ⬇️ IN | secondary | chat/messages/user1 | 1 | 45B | \"Hello, how are you today?\" |\n\n**Summary:**\n- Total Messages: 143\n- Inbound: 89 (62%)\n- Outbound: 54 (38%)\n- Average Size: 127 bytes\n- Time Range: 2024-12-15 09:30:45 - 10:30:45"
      }
    ],
    "isError": false
  }
}
```

---

#### mqtt_list_subscriptions
アクティブな購読情報を一覧表示します。

**Tool Schema:**
```json
{
  "name": "mqtt_list_subscriptions",
  "description": "List active MQTT subscriptions with statistics",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Filter by broker ID"
      },
      "format": {
        "type": "string",
        "enum": ["table", "json", "tree"],
        "description": "Output format",
        "default": "table"
      },
      "includeStats": {
        "type": "boolean",
        "description": "Include message statistics",
        "default": true
      },
      "sortBy": {
        "type": "string",
        "enum": ["topic", "qos", "messageCount", "createdAt"],
        "description": "Sort subscriptions by field",
        "default": "topic"
      }
    },
    "additionalProperties": false
  }
}
```

---

#### mqtt_add_subscriptions
新しい購読を追加します。

**Tool Schema:**
```json
{
  "name": "mqtt_add_subscriptions",
  "description": "Add new MQTT topic subscriptions to existing connections",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier"
      },
      "subscriptions": {
        "type": "array",
        "description": "Subscriptions to add",
        "items": {
          "type": "object",
          "properties": {
            "topic": {
              "type": "string",
              "description": "Topic pattern"
            },
            "qos": {
              "type": "integer",
              "enum": [0, 1, 2],
              "description": "QoS level",
              "default": 0
            }
          },
          "required": ["topic"],
          "additionalProperties": false
        },
        "minItems": 1
      }
    },
    "required": ["subscriptions"],
    "additionalProperties": false
  }
}
```

---

#### mqtt_remove_subscriptions
購読を削除します。

**Tool Schema:**
```json
{
  "name": "mqtt_remove_subscriptions",
  "description": "Remove MQTT topic subscriptions",
  "inputSchema": {
    "type": "object",
    "properties": {
      "brokerId": {
        "type": "string",
        "description": "Target broker connection identifier"
      },
      "subscriptions": {
        "oneOf": [
          {
            "type": "array",
            "description": "Subscription IDs to remove",
            "items": {
              "type": "string"
            },
            "minItems": 1
          },
          {
            "type": "array",
            "description": "Topic patterns to remove",
            "items": {
              "type": "string"
            },
            "minItems": 1
          }
        ]
      },
      "removeAll": {
        "type": "boolean",
        "description": "Remove all subscriptions from the broker",
        "default": false
      }
    },
    "oneOf": [
      {
        "required": ["subscriptions"]
      },
      {
        "required": ["removeAll"],
        "properties": {
          "removeAll": {
            "const": true
          }
        }
      }
    ],
    "additionalProperties": false
  }
}
```

## 4. MCP Resources API

### 4.1 接続情報リソース

#### mqtt://connections
```json
{
  "uri": "mqtt://connections",
  "name": "MQTT Broker Connections",
  "description": "Information about all MQTT broker connections",
  "mimeType": "application/json"
}
```

**Response Example:**
```json
{
  "contents": [
    {
      "uri": "mqtt://connections",
      "mimeType": "application/json",
      "text": "{\"connections\":[{\"id\":\"primary-broker\",\"url\":\"mqtts://broker.example.com:8883\",\"status\":\"connected\",\"clientId\":\"mcp-client-001\",\"connectedAt\":\"2024-12-15T08:15:30.123Z\",\"lastActivity\":\"2024-12-15T10:30:45.123Z\",\"metrics\":{\"messagesSent\":1234,\"messagesReceived\":5678,\"bytesTransferred\":2150400,\"averageLatency\":12,\"reconnectCount\":0,\"uptime\":8115}},{\"id\":\"secondary-broker\",\"url\":\"mqtt://localhost:1883\",\"status\":\"disconnected\",\"error\":\"Connection timeout\",\"lastAttempt\":\"2024-12-15T10:25:00.000Z\"}]}"
    }
  ]
}
```

---

#### mqtt://connections/{brokerId}
```json
{
  "uri": "mqtt://connections/{brokerId}",
  "name": "Specific MQTT Broker Connection",
  "description": "Detailed information about a specific MQTT broker connection",
  "mimeType": "application/json"
}
```

### 4.2 購読情報リソース

#### mqtt://subscriptions
```json
{
  "uri": "mqtt://subscriptions",
  "name": "MQTT Topic Subscriptions",
  "description": "List of all active MQTT topic subscriptions across all brokers",
  "mimeType": "application/json"
}
```

**Response Example:**
```json
{
  "contents": [
    {
      "uri": "mqtt://subscriptions",
      "mimeType": "application/json",
      "text": "{\"subscriptions\":[{\"id\":\"sub-001\",\"brokerId\":\"primary-broker\",\"topic\":\"sensors/+/temperature\",\"qos\":1,\"active\":true,\"createdAt\":\"2024-12-15T08:20:00.000Z\",\"messageCount\":456,\"lastMessage\":\"2024-12-15T10:30:40.000Z\"},{\"id\":\"sub-002\",\"brokerId\":\"primary-broker\",\"topic\":\"alerts/#\",\"qos\":2,\"active\":true,\"createdAt\":\"2024-12-15T08:20:05.000Z\",\"messageCount\":23,\"lastMessage\":\"2024-12-15T10:25:15.000Z\"}]}"
    }
  ]
}
```

### 4.3 メッセージ履歴リソース

#### mqtt://messages
```json
{
  "uri": "mqtt://messages",
  "name": "MQTT Message History",
  "description": "Recent MQTT message history across all brokers",
  "mimeType": "application/json"
}
```

#### mqtt://messages/{brokerId}
```json
{
  "uri": "mqtt://messages/{brokerId}",
  "name": "Broker-specific Message History",
  "description": "Message history for a specific broker",
  "mimeType": "application/json"
}
```

#### mqtt://messages/{brokerId}/{topic}
```json
{
  "uri": "mqtt://messages/{brokerId}/{topic}",
  "name": "Topic-specific Message History",
  "description": "Message history for a specific topic on a specific broker",
  "mimeType": "application/json"
}
```

### 4.4 システム情報リソース

#### mqtt://metrics
```json
{
  "uri": "mqtt://metrics",
  "name": "System Metrics",
  "description": "Real-time system and MQTT performance metrics",
  "mimeType": "application/json"
}
```

**Response Example:**
```json
{
  "contents": [
    {
      "uri": "mqtt://metrics",
      "mimeType": "application/json",
      "text": "{\"timestamp\":\"2024-12-15T10:30:45.123Z\",\"system\":{\"uptime\":8115,\"memoryUsage\":134217728,\"cpuUsage\":15.5},\"mqtt\":{\"connectionsActive\":2,\"connectionsTotal\":3,\"messagesSentTotal\":1234,\"messagesReceivedTotal\":5678,\"averageLatency\":12,\"throughput\":45.2},\"mcp\":{\"toolCallsTotal\":89,\"toolCallsSuccess\":87,\"toolCallsError\":2,\"eventsEmitted\":1456}}"
    }
  ]
}
```

#### mqtt://health
```json
{
  "uri": "mqtt://health",
  "name": "System Health Status",
  "description": "Overall system health and component status",
  "mimeType": "application/json"
}
```

## 5. Event Notifications

### 5.1 メッセージイベント

#### mqtt_message
購読したトピックからメッセージを受信した際に送信されます。

**Event Schema:**
```typescript
interface MqttMessageEvent {
  type: "notification";
  method: "notifications/message";
  params: {
    type: "mqtt_message";
    data: {
      id: string;              // メッセージID
      brokerId: string;        // ブローカーID
      topic: string;           // トピック名
      message: any;            // メッセージペイロード
      qos: 0 | 1 | 2;         // QoSレベル
      retain: boolean;         // Retainフラグ
      duplicate: boolean;      // Duplicateフラグ
      timestamp: number;       // 受信タイムスタンプ (Unix time)
      size: number;           // メッセージサイズ (bytes)
      properties?: {          // MQTT 5.0 プロパティ
        messageExpiryInterval?: number;
        topicAlias?: number;
        responseTopic?: string;
        correlationData?: string;
        userProperties?: Record<string, string>;
        subscriptionIdentifier?: number;
        contentType?: string;
      };
    };
  };
}
```

**Event Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "type": "mqtt_message",
    "data": {
      "id": "msg-20241215-103045-001",
      "brokerId": "primary-broker",
      "topic": "sensors/temperature/room1",
      "message": {
        "value": 25.5,
        "unit": "celsius",
        "timestamp": "2024-12-15T10:30:45.123Z",
        "sensorId": "temp-001"
      },
      "qos": 1,
      "retain": false,
      "duplicate": false,
      "timestamp": 1734253845123,
      "size": 156,
      "properties": {
        "contentType": "application/json",
        "userProperties": {
          "source": "iot-gateway",
          "priority": "normal"
        }
      }
    }
  }
}
```

### 5.2 接続状態イベント

#### mqtt_connection
接続状態が変更された際に送信されます。

**Event Schema:**
```typescript
interface MqttConnectionEvent {
  type: "notification";
  method: "notifications/message";
  params: {
    type: "mqtt_connection";
    data: {
      brokerId: string;
      status: "connected" | "disconnected" | "reconnecting" | "error";
      url: string;
      clientId?: string;
      timestamp: number;
      previousStatus?: string;
      connectionAttempt?: number;
      error?: {
        code: string;
        message: string;
        details?: any;
      };
      metrics?: {
        connectTime?: number;    // 接続にかかった時間 (ms)
        lastActivity?: number;   // 最後のアクティビティ (Unix time)
        uptime?: number;         // 稼働時間 (seconds)
      };
    };
  };
}
```

### 5.3 購読状態イベント

#### mqtt_subscription
購読状態が変更された際に送信されます。

**Event Schema:**
```typescript
interface MqttSubscriptionEvent {
  type: "notification";
  method: "notifications/message";
  params: {
    type: "mqtt_subscription";
    data: {
      action: "added" | "removed" | "updated";
      brokerId: string;
      subscriptions: Array<{
        id: string;
        topic: string;
        qos: 0 | 1 | 2;
        grantedQos?: 0 | 1 | 2;
      }>;
      timestamp: number;
    };
  };
}
```

### 5.4 エラーイベント

#### mqtt_error
エラーが発生した際に送信されます。

**Event Schema:**
```typescript
interface MqttErrorEvent {
  type: "notification";
  method: "notifications/message";
  params: {
    type: "mqtt_error";
    data: {
      id: string;              // エラーID
      brokerId?: string;       // 関連ブローカーID
      operation: string;       // エラーが発生した操作
      category: "connection" | "authentication" | "authorization" | 
               "protocol" | "validation" | "timeout" | "internal";
      error: {
        code: string;          // エラーコード
        message: string;       // エラーメッセージ
        details?: any;         // 詳細情報
      };
      context?: {             // エラーコンテキスト
        topic?: string;
        messageId?: string;
        clientId?: string;
        [key: string]: any;
      };
      timestamp: number;
      recoverable: boolean;    // 自動復旧可能かどうか
    };
  };
}
```

## 6. エラーレスポンス

### 6.1 標準エラーコード

| エラーコード | HTTPステータス | 説明 | カテゴリ |
|------------|---------------|------|----------|
| INVALID_PARAMS | 400 | 入力パラメータが無効 | validation |
| MISSING_REQUIRED_FIELD | 400 | 必須フィールドが不足 | validation |
| INVALID_TOPIC_FORMAT | 400 | トピック形式が無効 | validation |
| CONNECTION_FAILED | 503 | ブローカー接続に失敗 | connection |
| CONNECTION_TIMEOUT | 408 | 接続タイムアウト | connection |
| NOT_CONNECTED | 412 | 未接続状態での操作試行 | connection |
| AUTHENTICATION_FAILED | 401 | 認証に失敗 | authentication |
| AUTHORIZATION_FAILED | 403 | 認可に失敗 | authorization |
| BROKER_NOT_FOUND | 404 | 指定ブローカーが存在しない | validation |
| SUBSCRIPTION_FAILED | 500 | 購読に失敗 | protocol |
| PUBLISH_FAILED | 500 | 発行に失敗 | protocol |
| MESSAGE_TOO_LARGE | 413 | メッセージサイズが制限超過 | validation |
| RATE_LIMIT_EXCEEDED | 429 | レート制限超過 | rate_limit |
| INTERNAL_ERROR | 500 | 内部エラー | internal |
| SERVICE_UNAVAILABLE | 503 | サービス利用不可 | internal |

### 6.2 エラーレスポンス形式

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "mqttError": "CONNECTION_FAILED",
      "details": "Connection refused: Not authorized",
      "brokerId": "primary-broker",
      "brokerUrl": "mqtts://broker.example.com:8883",
      "timestamp": 1734253845123,
      "category": "connection",
      "recoverable": true,
      "retryAfter": 5000,
      "context": {
        "clientId": "mcp-client-001",
        "operation": "connect"
      }
    }
  }
}
```

### 6.3 詳細エラー情報

#### 接続エラー
```json
{
  "mqttError": "CONNECTION_FAILED",
  "details": "ENOTFOUND broker.example.com",
  "brokerId": "primary-broker",
  "brokerUrl": "mqtts://broker.example.com:8883",
  "category": "connection",
  "possibleCauses": [
    "DNS resolution failed",
    "Network connectivity issues",
    "Broker is down",
    "Firewall blocking connection"
  ],
  "suggestedActions": [
    "Check network connectivity",
    "Verify broker URL and port",
    "Check firewall settings"
  ]
}
```

#### 認証エラー
```json
{
  "mqttError": "AUTHENTICATION_FAILED",
  "details": "Connection refused: Bad user name or password",
  "brokerId": "primary-broker",
  "category": "authentication",
  "possibleCauses": [
    "Invalid username or password",
    "Account locked or disabled",
    "Credential encryption/decryption error"
  ],
  "suggestedActions": [
    "Verify credentials",
    "Check account status",
    "Contact administrator"
  ]
}
```

## 7. 使用例とベストプラクティス

### 7.1 基本的な使用フロー

```typescript
// 1. 接続確立
const connectResult = await mcp.call('mqtt_connect', {
  brokerId: 'production',
  url: 'mqtts://broker.example.com:8883',
  credentials: {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  },
  connection: {
    keepalive: 60,
    clean: true
  },
  tls: {
    rejectUnauthorized: true
  }
});

// 2. 購読設定
await mcp.call('mqtt_subscribe', {
  brokerId: 'production',
  subscriptions: [
    { topic: 'sensors/+/temperature', qos: 1 },
    { topic: 'alerts/#', qos: 2 }
  ]
});

// 3. イベントハンドリング
mcp.on('mqtt_message', (event) => {
  const { topic, message, qos } = event.data;
  console.log(`Received message on ${topic}:`, message);
});

// 4. メッセージ発行
await mcp.call('mqtt_publish', {
  brokerId: 'production',
  topic: 'status/system',
  message: { status: 'online', timestamp: new Date().toISOString() },
  qos: 1,
  retain: true
});
```

### 7.2 エラーハンドリング

```typescript
try {
  await mcp.call('mqtt_publish', {
    topic: 'sensors/data',
    message: sensorData
  });
} catch (error) {
  if (error.data?.mqttError === 'NOT_CONNECTED') {
    // 再接続を試行
    await mcp.call('mqtt_connect', connectionConfig);
    // リトライ
    await mcp.call('mqtt_publish', {
      topic: 'sensors/data',
      message: sensorData
    });
  } else {
    console.error('Publish failed:', error.message);
  }
}
```

### 7.3 パフォーマンス最適化

```typescript
// バッチ発行でスループット向上
const messages = [
  { topic: 'sensors/temp/1', message: tempData1 },
  { topic: 'sensors/temp/2', message: tempData2 },
  // ... more messages
];

// 並列発行
const results = await Promise.allSettled(
  messages.map(msg => mcp.call('mqtt_publish', msg))
);

// QoS設定の最適化
// - 重要でないデータ: QoS 0
// - 重要なデータ: QoS 1
// - 決済情報など: QoS 2
```

---

**版数**: 1.0  
**作成日**: 2024年12月15日  
**準拠仕様**: MCP v1.0, MQTT v3.1.1/v5.0  
**次回レビュー**: 2025年3月15日
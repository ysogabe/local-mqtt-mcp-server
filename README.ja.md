# MQTT MCP Server

[English](README.md) | 日本語

Model Context Protocol (MCP) に対応した強力なサーバーで、Claude Desktop や他の MCP クライアントが MQTT ブローカーとシームレスに連携できます。標準化された MCP ツール、リソース、イベントを通じて包括的な MQTT パブリッシュ/サブスクライブ機能を提供します。

## 🌟 特徴

- **完全な MQTT サポート**: 認証対応で任意の MQTT v3.1.1/5.0 ブローカーに接続
- **MCP 統合**: Claude Desktop 向けネイティブ Model Context Protocol サポート
- **マルチブローカー管理**: 複数の MQTT ブローカー接続を同時管理
- **リアルタイムメッセージング**: QoS 0/1/2 対応のパブリッシュ・サブスクライブ
- **メッセージ履歴**: メッセージ履歴の永続化ストレージと取得
- **イベント通知**: MCP イベントによるリアルタイム更新
- **セキュリティ**: TLS/SSL 暗号化と認証サポート
- **AITuberKit 対応**: 音声合成システム統合に最適化

## 📋 必要要件

- Node.js v18.0 以上
- MQTT ブローカー (Mosquitto、EMQX、HiveMQ など)
- Claude Desktop App (MCP 統合用)

## 🚀 クイックスタート

### 1. インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/mqtt-mcp-server.git
cd mqtt-mcp-server

# 依存関係をインストール（利用可能になったら）
npm install
```

### 2. 基本的な使用方法

#### MQTT ブローカーに接続

```json
{
  "tool": "mqtt_connect",
  "parameters": {
    "url": "mqtt://localhost:1883",
    "clientId": "mcp-client-001"
  }
}
```

#### メッセージをパブリッシュ

```json
{
  "tool": "mqtt_publish",
  "parameters": {
    "topic": "sensors/temperature",
    "message": {"value": 25.5, "unit": "celsius"},
    "qos": 1,
    "retain": true
  }
}
```

#### トピックをサブスクライブ

```json
{
  "tool": "mqtt_subscribe",
  "parameters": {
    "subscriptions": [
      {"topic": "sensors/+/temperature", "qos": 1},
      {"topic": "alerts/#", "qos": 2}
    ]
  }
}
```

### 3. Claude Desktop 統合

Claude Desktop の設定に追加：

```json
{
  "mcpServers": {
    "mqtt-server": {
      "command": "node",
      "args": ["path/to/mqtt-mcp-server/src/server.js"],
      "env": {
        "MQTT_BROKER_URL": "mqtt://localhost:1883"
      }
    }
  }
}
```

## 📚 ドキュメント

- **[API 仕様書](docs/05_api_specification.md)** - 完全な API リファレンス
- **[システム設計書](docs/04_system_design.md)** - アーキテクチャとコンポーネント
- **[ユースケース設計書](docs/03_use_cases.md)** - 実用的な使用シナリオ
- **[技術要件仕様書](docs/02_technical_requirements.md)** - 詳細仕様

## 🎯 使用事例

### IoT デバイス統合

MQTT トピックを通じて IoT デバイスを監視・制御し、AI による分析と応答生成を実現。

### リアルタイムチャットシステム

チャットプラットフォームと音声合成システムを統合して自動応答を生成。

### システム監視

監視システムからのアラートと通知をインテリジェントに処理。

### スマートホーム自動化

自然言語コマンドでスマートホームデバイスを制御・監視。

## 🔧 高度な設定

### TLS/SSL 接続

```json
{
  "tool": "mqtt_connect",
  "parameters": {
    "url": "mqtts://broker.example.com:8883",
    "tls": {
      "ca": "/path/to/ca.crt",
      "cert": "/path/to/client.crt",
      "key": "/path/to/client.key"
    }
  }
}
```

### メッセージフィルタリング

```json
{
  "tool": "mqtt_subscribe",
  "parameters": {
    "subscriptions": [{"topic": "sensors/+/data", "qos": 1}],
    "filters": [
      {
        "type": "content",
        "condition": "payload.value > 30",
        "action": "allow"
      }
    ]
  }
}
```

## 🔌 利用可能なツール

| ツール | 説明 |
|------|-------------|
| `mqtt_connect` | MQTT ブローカーに接続 |
| `mqtt_disconnect` | ブローカーから切断 |
| `mqtt_publish` | メッセージをパブリッシュ |
| `mqtt_subscribe` | トピックをサブスクライブ |
| `mqtt_unsubscribe` | トピックのサブスクライブ解除 |
| `mqtt_get_messages` | メッセージ履歴を取得 |
| `mqtt_status` | 接続状態を取得 |
| `mqtt_get_retained_messages` | 保持メッセージを取得 |

## 📊 リソース

| リソース | 説明 |
|----------|-------------|
| `/connections` | MQTT 接続情報 |
| `/subscriptions` | アクティブな購読 |
| `/messages` | メッセージ履歴 |
| `/metrics` | システムパフォーマンス指標 |
| `/health` | システムヘルス状態 |

## 🎭 イベント通知

- `mqtt_message` - 新しいメッセージを受信
- `mqtt_connection` - 接続状態の変更
- `mqtt_subscription` - 購読の更新
- `mqtt_error` - エラー通知

## 🤝 開発

### プロジェクト構造

```
mqtt-mcp-server/
├── docs/           # 包括的なドキュメント
├── src/            # ソースコード（実装）
├── examples/       # 使用例と統合設定
├── tests/          # テストスイート
├── scripts/        # ユーティリティとセットアップスクリプト
└── templates/      # 設定テンプレート
```

### コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを開く

### テスト

```bash
npm test                    # テストスイートを実行
npm run test:watch         # ウォッチモード
npm run test:coverage      # カバレッジレポート
```

### コード品質

```bash
npm run lint               # ESLint チェック
npm run lint:fix           # 問題を自動修正
```

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- [Model Context Protocol](https://github.com/modelcontextprotocol) の MCP 仕様
- [MQTT.js](https://github.com/mqttjs/MQTT.js) の優秀な MQTT クライアントライブラリ
- [Claude](https://claude.ai) がこの統合を可能にしてくれたこと

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/yourusername/mqtt-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/mqtt-mcp-server/discussions)
- **ドキュメント**: [プロジェクトドキュメント](docs/)

---

**注意**: このプロジェクトは積極的に開発中です。包括的な設計ドキュメントと実装ガイドラインについては [docs](docs/) フォルダを参照してください。
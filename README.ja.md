# ローカルMQTT MCPサーバー

[English](README.md) | 日本語

> **注意**: この実装はMVP（Minimum Viable Product）です。MQTTブローカーへの接続と、AITuberのための音声合成リクエストを公開するための基本的な機能を提供します。

これは、CascadeのようなAIエージェントがMQTTブローカーと対話できるようにするModel Context Protocol (MCP) サーバーです。特に、AITuberシステムに発話コマンドを送信するように設計されています。

## 🌟 主な機能

- **MQTTブローカーへの接続**: 任意のMQTT v3.1.1/5.0ブローカーへの接続を確立します。
- **AITuberへの発話公開**: AITuberに発話させるテキストを優先度付きで送信します。

## 📋 必要なもの

- Node.js v18.0 以上
- MQTTブローカー

## 🚀 クイックスタート

### 1. インストール

```bash
# このリポジトリをクローンします
git clone https://github.com/ysogabe/local-mqtt-mcp-server.git
cd local-mqtt-mcp-server

# 依存関係をインストールします
npm install
```

### 2. サーバーの実行

```bash
npm run start
```

サーバーが起動し、MCP接続を受け入れる準備が整います。

## 🔌 Cascadeとの連携

このサーバーをCascadeで使用するには、`mcp_config.json`ファイルに以下の設定を追加してください。

```json
{
  "name": "local-mqtt-mcp-server",
  "enabled": true,
  "command": [
    "npm",
    "--prefix",
    "/path/to/your/local-mqtt-mcp-server",
    "run",
    "start"
  ]
}
```

*`/path/to/your/local-mqtt-mcp-server`の部分は、あなたのシステム上のこのプロジェクトディレクトリへの実際の絶対パスに置き換えることを忘れないでください。*

## 🛠️ 利用可能なツール

| ツール | 説明 |
|------|-------------|
| `mqtt_connect` | MQTTブローカーに接続します。 |
| `aituber_speech_publish` | AITuberに発話メッセージを公開します。 |

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。
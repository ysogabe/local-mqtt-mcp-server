# Local MQTT MCP Server

English | [日本語](README.ja.md)

> **Note**: This is an MVP (Minimum Viable Product) implementation. It provides basic functionality for connecting to an MQTT broker and publishing speech synthesis requests for an AITuber.

This is a Model Context Protocol (MCP) server that allows AI agents like Cascade to interact with an MQTT broker. It's specifically designed to send speech commands to an AITuber system.

## 🌟 Features

- **Connect to MQTT Broker**: Establish a connection to any MQTT v3.1.1/5.0 broker.
- **Publish Speech to AITuber**: Send text to be spoken by an AITuber, with priority levels.

## 📋 Requirements

- Node.js v18.0 or higher
- An MQTT Broker

## 🚀 Quick Start

### 1. Installation

```bash
# Clone this repository
git clone https://github.com/ysogabe/local-mqtt-mcp-server.git
cd local-mqtt-mcp-server

# Install dependencies
npm install
```

### 2. Running the Server

```bash
npm run start
```

The server will start and be ready to accept MCP connections.

## 🔌 Cascade Integration

To use this server with Cascade, add the following configuration to your `mcp_config.json` file:

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

*Remember to replace `/path/to/your/local-mqtt-mcp-server` with the actual absolute path to this project directory on your system.*

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `mqtt_connect` | Connect to an MQTT broker. |
| `aituber_speech_publish` | Publish a speech message to the AITuber. |

## 📄 License

This project is licensed under the MIT License.
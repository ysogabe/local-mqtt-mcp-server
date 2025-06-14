# MQTT MCP Server

English | [日本語](README.ja.md)

A powerful Model Context Protocol (MCP) server that enables Claude Desktop and other MCP clients to interact with MQTT brokers seamlessly. This server provides comprehensive MQTT publish/subscribe functionality through standardized MCP tools, resources, and events.

## 🌟 Features

- **Full MQTT Support**: Connect to any MQTT v3.1.1/5.0 broker with authentication
- **MCP Integration**: Native Model Context Protocol support for Claude Desktop
- **Multi-Broker Management**: Handle multiple MQTT broker connections simultaneously
- **Real-time Messaging**: Publish and subscribe with QoS 0/1/2 support
- **Message History**: Persistent storage and retrieval of message history
- **Event Notifications**: Real-time updates via MCP events
- **Security**: TLS/SSL encryption and authentication support
- **AITuberKit Ready**: Optimized for voice synthesis system integration

## 📋 Requirements

- Node.js v18.0 or higher
- MQTT Broker (Mosquitto, EMQX, HiveMQ, etc.)
- Claude Desktop App (for MCP integration)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mqtt-mcp-server.git
cd mqtt-mcp-server

# Install dependencies (when available)
npm install
```

### 2. Basic Usage

#### Connect to MQTT Broker
```json
{
  "tool": "mqtt_connect",
  "parameters": {
    "url": "mqtt://localhost:1883",
    "clientId": "mcp-client-001"
  }
}
```

#### Publish Message
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

#### Subscribe to Topics
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

### 3. Claude Desktop Integration

Add to your Claude Desktop configuration:

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

## 📚 Documentation

- **[API Specification](docs/05_api_specification.md)** - Complete API reference
- **[System Design](docs/04_system_design.md)** - Architecture and components
- **[Use Cases](docs/03_use_cases.md)** - Practical usage scenarios
- **[Technical Requirements](docs/02_technical_requirements.md)** - Detailed specifications

## 🎯 Use Cases

### IoT Device Integration
Monitor and control IoT devices through MQTT topics with AI-powered analysis and response generation.

### Real-time Chat Systems
Integrate chat platforms with voice synthesis systems for automated responses.

### System Monitoring
Receive alerts and notifications from monitoring systems with intelligent processing.

### Smart Home Automation
Control and monitor smart home devices with natural language commands.

## 🔧 Advanced Configuration

### TLS/SSL Connection
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

### Message Filtering
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

## 🔌 Available Tools

| Tool | Description |
|------|-------------|
| `mqtt_connect` | Connect to MQTT broker |
| `mqtt_disconnect` | Disconnect from broker |
| `mqtt_publish` | Publish messages |
| `mqtt_subscribe` | Subscribe to topics |
| `mqtt_unsubscribe` | Unsubscribe from topics |
| `mqtt_get_messages` | Retrieve message history |
| `mqtt_status` | Get connection status |
| `mqtt_get_retained_messages` | Get retained messages |

## 📊 Resources

| Resource | Description |
|----------|-------------|
| `/connections` | MQTT connection information |
| `/subscriptions` | Active subscriptions |
| `/messages` | Message history |
| `/metrics` | System performance metrics |
| `/health` | System health status |

## 🎭 Event Notifications

- `mqtt_message` - New message received
- `mqtt_connection` - Connection status changes
- `mqtt_subscription` - Subscription updates
- `mqtt_error` - Error notifications

## 🤝 Development

### Project Structure
```
mqtt-mcp-server/
├── docs/           # Comprehensive documentation
├── src/            # Source code (implementation)
├── examples/       # Usage examples and integrations
├── tests/          # Test suite
├── scripts/        # Utilities and setup scripts
└── templates/      # Configuration templates
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Testing

```bash
npm test                    # Run test suite
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Code Quality

```bash
npm run lint               # ESLint check
npm run lint:fix           # Auto-fix issues
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [MQTT.js](https://github.com/mqttjs/MQTT.js) for the excellent MQTT client library
- [Claude](https://claude.ai) for enabling this integration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mqtt-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/mqtt-mcp-server/discussions)
- **Documentation**: [Project Docs](docs/)

---

**Note**: This project is in active development. See the [docs](docs/) folder for comprehensive design documentation and implementation guidelines.
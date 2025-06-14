# AITuberKit Integration Setup Guide

This guide explains how to integrate MQTT MCP Server with AITuberKit for voice synthesis and multi-system speech integration.

## 🎯 Overview

The integration enables AITuberKit to receive speech requests from multiple sources (chat systems, IoT sensors, monitoring alerts) through MQTT topics and convert them to natural speech with appropriate voice settings and priorities.

## 📋 Prerequisites

1. **AITuberKit** installed and configured
2. **MQTT Broker** running (Mosquitto, EMQX, etc.)
3. **Claude Desktop** with MCP support
4. **Node.js** v18+ for MQTT MCP Server

## 🚀 Quick Setup

### 1. Configure Claude Desktop

Copy the `claude_desktop_config.json` to your Claude Desktop configuration directory:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Update the paths in the configuration:
```json
{
  "mcpServers": {
    "mqtt-aituber": {
      "command": "node",
      "args": ["/actual/path/to/mqtt-mcp-server/src/server.js"],
      "env": {
        "CONFIG_FILE": "/actual/path/to/aituber-config.yaml"
      }
    }
  }
}
```

### 2. Configure MQTT Settings

Edit `aituber-config.yaml` to match your environment:

```yaml
mqtt:
  brokers:
    - id: "primary"
      url: "mqtt://your-broker-ip:1883"  # Update broker URL
      clientId: "aituber-mcp-client"
      # Add authentication if needed
      # auth:
      #   username: "your_username"
      #   password: "your_password"
```

### 3. Set Up Speech Rules

Configure how different MQTT topics should be converted to speech:

```yaml
speech:
  rules:
    # High-priority alerts interrupt current speech
    - pattern: "alerts/critical"
      priority: "interrupt"
      voice: "urgent"
      template: "緊急アラート: {{message}}"
      interrupt_current: true
    
    # Chat messages use friendly voice
    - pattern: "chat/messages/+"
      priority: "normal"
      voice: "friendly"
      template: "{{username}}さん: {{text}}"
```

### 4. Configure AITuberKit Integration

Update the AITuberKit settings to match your TTS engine:

```yaml
aituber:
  tts:
    engine: "voicevox"  # Change to your TTS engine
    voice_id: 1         # Adjust voice ID
    speed: 1.0
    pitch: 0.0
```

## 🔧 Advanced Configuration

### Multi-Source Integration

Set up different voice characteristics for different sources:

```yaml
speech:
  rules:
    # Chat system - friendly and casual
    - pattern: "chat/+/messages"
      voice: "friendly"
      template: "{{source}}から{{username}}さん: {{text}}"
    
    # IoT sensors - informative and factual
    - pattern: "sensors/+/+"
      voice: "informative"
      template: "{{location}}の{{sensor_type}}は{{value}}{{unit}}です"
      conditions:
        - "value > threshold"
    
    # Monitoring alerts - urgent and clear
    - pattern: "monitoring/alerts/+"
      voice: "urgent"
      template: "{{system}}でエラーが発生: {{description}}"
      priority: "high"
```

### Message Filtering

Prevent spam and unwanted messages:

```yaml
processing:
  filters:
    # Block very long messages
    - type: "content"
      condition: "text.length > 200"
      action: "deny"
    
    # Rate limit per source
    - type: "rate"
      condition: "messages_per_minute < 10"
      action: "allow"
    
    # Only specific roles can trigger speech
    - type: "source"
      condition: "role in ['moderator', 'admin', 'user']"
      action: "allow"
```

### Emotion-Based Voice Settings

Configure different voice characteristics for emotions:

```yaml
aituber:
  emotions:
    "happy": 
      voice_id: 1
      pitch: 0.1    # Slightly higher pitch
      speed: 1.1    # Slightly faster
    "sad":
      voice_id: 2
      pitch: -0.1   # Lower pitch
      speed: 0.9    # Slower
    "urgent":
      voice_id: 4
      pitch: 0.15   # Higher pitch
      speed: 1.3    # Much faster
```

## 📡 Usage Examples

### 1. Chat Integration

Send a chat message for speech synthesis:

```bash
# Using MQTT client
mosquitto_pub -h localhost -t "chat/messages/user1" -m '{
  "username": "Alice",
  "text": "こんにちは！今日は良い天気ですね。",
  "timestamp": "2024-12-15T10:30:00Z"
}'
```

### 2. Alert Notifications

Send a critical alert:

```bash
mosquitto_pub -h localhost -t "alerts/critical" -m '{
  "message": "サーバーが応答していません",
  "severity": "critical",
  "source": "monitoring-system"
}'
```

### 3. Sensor Data

Send temperature data (only speaks if above threshold):

```bash
mosquitto_pub -h localhost -t "sensors/livingroom/temperature" -m '{
  "location": "リビングルーム",
  "value": 32,
  "unit": "度",
  "sensor_type": "温度"
}'
```

## 🔍 Testing the Integration

### 1. Test MQTT Connection

Using Claude Desktop, test the MQTT connection:

```
Please connect to the MQTT broker and show the status.
```

Claude will use the `mqtt_connect` and `mqtt_status` tools to establish connection and show current status.

### 2. Test Subscription

Subscribe to test topics:

```
Please subscribe to these topics:
- chat/messages/+
- alerts/#
- sensors/+/temperature
```

### 3. Test Message Flow

Send a test message and verify speech synthesis:

```
Please publish a test message to topic "chat/messages/test" with the message "テスト音声です"
```

## 🛠️ Troubleshooting

### Common Issues

1. **No Speech Output**
   - Check AITuberKit is running and accessible
   - Verify TTS engine configuration
   - Check message filtering rules

2. **MQTT Connection Failed**
   - Verify broker URL and credentials
   - Check network connectivity
   - Review firewall settings

3. **Messages Not Processed**
   - Check topic patterns match subscription
   - Verify message format matches template variables
   - Review filtering conditions

### Debug Mode

Enable debug logging:

```yaml
logging:
  level: "debug"
  file: "/var/log/mqtt-aituber-debug.log"
```

### Health Monitoring

Check system health:

```bash
# Monitor log file
tail -f /var/log/mqtt-aituber.log

# Check MQTT broker status
mosquitto_sub -h localhost -t "\$SYS/#" | head -20
```

## 📚 Related Documentation

- [API Specification](../../docs/05_api_specification.md) - Complete MQTT MCP API reference
- [Use Cases](../../docs/03_use_cases.md) - Detailed integration scenarios
- [System Design](../../docs/04_system_design.md) - Architecture overview

## 🤝 Support

For issues and questions:
- Check the main [README](../../README.md)
- Review [documentation](../../docs/)
- Open an issue on GitHub
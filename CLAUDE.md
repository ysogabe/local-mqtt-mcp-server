# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### Code Development Guidelines
- **絶対にフルパスのハードコーディングをしない**
  - NG: `/Users/username/project/...`
  - OK: `Path.cwd()`, `Path(__file__).parent`, 相対パス
- **ハードコーディングは基本的に避ける**
  - 設定値は設定ファイルや環境変数から取得
  - マジックナンバーは定数として定義
  - 固定値の代わりに動的な計算や設定を使用

## Project Overview

This is an MQTT MCP (Model Context Protocol) server that enables Claude Desktop/Claude Code to interact with MQTT brokers. The server provides tools for publishing, subscribing, and managing MQTT messages through the MCP protocol.

## Commands

### Development Commands
```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint the code
npm run lint

# Type checking
npm run typecheck

# Build TypeScript
npm run build
```

## Architecture

### Current Structure
The project is implemented in TypeScript with the following structure:

```
src/
├── index.ts              # Main MCP server entry point
├── mqttManager.ts        # MQTT client management
├── handlers/
│   ├── toolHandlers.ts   # MCP tool handlers
│   ├── resourceHandlers.ts # Resource management
│   └── speechPublisher.ts  # AITuber speech integration
├── storage/
│   └── fileStorage.ts    # Persistent storage implementation
├── types/
│   └── index.ts          # TypeScript type definitions
└── __tests__/            # Test files for all modules
```

### Key Components
- **MCP Server**: Uses `@modelcontextprotocol/sdk` with stdio transport
- **MQTT Manager**: Built on `mqtt` library with connection management
- **Tool Handlers**: Implements all MQTT operations as MCP tools
- **File Storage**: JSON-based persistence for messages and subscriptions
- **Speech Publisher**: Special handler for AITuber voice synthesis integration

### Available MCP Tools
1. `mqtt_connect` - Connect to MQTT broker with optional authentication
2. `mqtt_disconnect` - Disconnect from MQTT broker
3. `mqtt_publish` - Publish messages with QoS and retain options
4. `mqtt_subscribe` - Subscribe to topics (supports wildcards + and #)
5. `mqtt_unsubscribe` - Unsubscribe from topics
6. `aituber_speech_publish` - Publish speech messages to AITuber for TTS

## Important Implementation Notes

### Message Storage
- Messages stored in `data/mqtt-messages.json` with full metadata
- Subscriptions persisted in `data/mqtt-subscriptions.json`
- Automatic directory creation on first run
- Circular buffer implementation for message history

### Connection Management
- Each connection identified by unique `connectionId`
- Multiple concurrent broker connections supported
- Automatic reconnection with configurable retry
- Clean session flag support for persistent sessions

### AITuber Integration
The `aituber_speech_publish` tool provides special integration:
- Default connection ID: `aituber-default`
- Topic: `aituber/speech/request`
- Priority levels: low, medium, high, normal, urgent
- Support for emotion, voice, pitch, and speed parameters

### Error Handling
- All errors return structured MCP error responses
- Connection failures don't crash the server
- File I/O errors handled gracefully
- Type validation on all tool parameters

## Development Guidelines

### TypeScript Best Practices
- Strict mode enabled - no implicit any
- All exports must have explicit types
- Use interfaces for data structures
- Proper error typing with custom error classes

### Testing Requirements
- Unit tests for all handlers and utilities
- Mock MQTT client for isolated testing
- Coverage target: 80%+ for critical paths
- Integration tests for MCP protocol

### Adding New Features
1. Define types in `src/types/index.ts`
2. Implement handler in appropriate module
3. Add unit tests with mocks
4. Update this documentation
5. Test with real MQTT broker

### Local Development Setup
```bash
# Install mosquitto for local testing
brew install mosquitto  # macOS
sudo apt-get install mosquitto  # Ubuntu

# Start mosquitto
mosquitto -v

# Configure Claude Desktop
# Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "mqtt": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/local_mqtt_mcp_server"
    }
  }
}
```

## Common Tasks

### Testing MQTT Communication
```bash
# Subscribe to test topic
mosquitto_sub -t "test/topic" -v

# Publish test message
mosquitto_pub -t "test/topic" -m "Hello MQTT"
```

### Testing AITuber Integration
1. Start AITuberKit on http://localhost:3000
2. Configure MQTT settings in AITuber
3. Use `aituber_speech_publish` to send TTS commands
4. Verify speech playback in browser

### Debugging MCP Protocol
- Check Claude Desktop logs for connection issues
- Use `--verbose` flag for detailed logging
- Monitor `data/*.json` files for persistence
- Test tools individually before integration
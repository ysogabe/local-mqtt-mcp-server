# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Check code coverage
npm run test:coverage

# Lint the code
npm run lint

# Build (runs tests and lint)
npm run build
```

### Setup Commands
```bash
# Run initial setup
npm run setup

# Check server health
npm run health
```

## Architecture

### Current Structure
The main implementation is currently in `00_ideas/mqtt_mcp_server.js` (810 lines). The project needs restructuring to match the documented architecture:

```
src/
├── server.js          # Main MCP server entry point
├── mqtt/
│   ├── client.js      # MQTT client wrapper
│   └── handlers.js    # Message handlers
├── storage/
│   ├── history.js     # Message history management
│   └── subscriptions.js # Subscription persistence
├── tools/
│   └── index.js       # MCP tool definitions
└── utils/
    ├── config.js      # Configuration management
    └── logger.js      # Logging utilities
```

### Key Components
- **MCP Server**: Uses `@modelcontextprotocol/sdk` with stdio transport
- **MQTT Client**: Built on `mqtt` library with reconnection support
- **Persistence**: JSON files for history (`mqtt-history.json`) and subscriptions (`mqtt-subscriptions.json`)
- **Message Buffer**: In-memory storage limited to 1000 messages

### Available MCP Tools
1. `mqtt_connect` - Connect to broker with authentication
2. `mqtt_publish` - Publish with QoS and retain options
3. `mqtt_subscribe` - Subscribe to topics (supports wildcards)
4. `mqtt_unsubscribe` - Unsubscribe from topics
5. `mqtt_get_messages` - Retrieve message history
6. `mqtt_status` - Get connection status
7. `mqtt_add_subscriptions` - Add new subscriptions dynamically
8. `mqtt_remove_subscriptions` - Remove specific subscriptions
9. `mqtt_list_subscriptions` - List all active subscriptions
10. `mqtt_get_retained` - Get retained messages from topics

## Important Implementation Notes

### Message Handling
- Messages are stored with timestamps and full metadata
- History is persisted to disk on every new message
- Maximum 1000 messages in history (FIFO)

### Subscription Management
- Subscriptions persist across reconnections
- Wildcard topics supported (+, #)
- All subscriptions restored on reconnect

### Error Handling
- Connection errors are logged but don't crash the server
- Reconnection is automatic with exponential backoff
- Tool errors return descriptive error messages

### Integration Points
- Designed for AITuberKit integration (voice synthesis)
- Supports IoT device control via MQTT
- Can bridge chat systems through MQTT topics

## Development Guidelines

### When Adding New Features
1. Follow the modular structure in design documents
2. Add corresponding tests in the test suite
3. Update API documentation in `02_docs/05_api_design.md`
4. Ensure compatibility with existing MCP tools

### Testing MQTT Functionality
- Use local Mosquitto broker for development
- Test with QoS levels 0, 1, and 2
- Verify retained message handling
- Test wildcard subscriptions

### Configuration
The server expects Claude Desktop configuration at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
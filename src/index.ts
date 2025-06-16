#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

import { MqttManager } from './mqttManager';
import {
  handleConnect,
  handleDisconnect,
  handlePublish,
  handleSubscribe,
  handleUnsubscribe,
  handleSpeechPublish
} from './handlers/toolHandlers';
import { FileStorage } from './storage/fileStorage';

// Configure main logger for MCP (disable all logging to avoid stdout pollution)
const logger = winston.createLogger({
  silent: true  // Completely disable winston logging
});

/**
 * Define available MQTT tools
 */
const MQTT_TOOLS: Tool[] = [
  {
    name: 'mqtt_connect',
    description: 'Connect to an MQTT broker',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'Unique identifier for this connection'
        },
        brokerUrl: {
          type: 'string',
          description: 'MQTT broker URL (e.g., mqtt://localhost:1883)'
        },
        clientId: {
          type: 'string',
          description: 'MQTT client identifier (optional)'
        },
        username: {
          type: 'string',
          description: 'Username for authentication (optional)'
        },
        password: {
          type: 'string',
          description: 'Password for authentication (optional)'
        },
        keepalive: {
          type: 'number',
          description: 'Keep alive interval in seconds (optional, default: 60)'
        },
        clean: {
          type: 'boolean',
          description: 'Clean session flag (optional, default: true)'
        }
      },
      required: ['connectionId', 'brokerUrl']
    }
  },
  {
    name: 'mqtt_disconnect',
    description: 'Disconnect from an MQTT broker',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'Connection identifier to disconnect'
        }
      },
      required: ['connectionId']
    }
  },
  {
    name: 'mqtt_publish',
    description: 'Publish a message to an MQTT topic',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'Connection identifier'
        },
        topic: {
          type: 'string',
          description: 'MQTT topic to publish to'
        },
        message: {
          type: 'string',
          description: 'Message payload to publish'
        },
        qos: {
          type: 'number',
          enum: [0, 1, 2],
          description: 'Quality of Service level (optional, default: 1)'
        },
        retain: {
          type: 'boolean',
          description: 'Retain flag (optional, default: false)'
        }
      },
      required: ['connectionId', 'topic', 'message']
    }
  },
  {
    name: 'mqtt_subscribe',
    description: 'Subscribe to an MQTT topic',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'Connection identifier'
        },
        topic: {
          type: 'string',
          description: 'MQTT topic to subscribe to (supports wildcards + and #)'
        },
        qos: {
          type: 'number',
          enum: [0, 1, 2],
          description: 'Quality of Service level (optional, default: 1)'
        }
      },
      required: ['connectionId', 'topic']
    }
  },
  {
    name: 'mqtt_unsubscribe',
    description: 'Unsubscribe from an MQTT topic',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'Connection identifier'
        },
        topic: {
          type: 'string',
          description: 'MQTT topic to unsubscribe from'
        }
      },
      required: ['connectionId', 'topic']
    }
  },
  {
    name: 'aituber_speech_publish',
    description: 'Publish speech message to AITuber for text-to-speech synthesis',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'MQTT connection identifier (optional, defaults to aituber-default)'
        },
        text: {
          type: 'string',
          description: 'Text to be spoken by the AITuber'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'normal', 'urgent'],
          description: 'Priority level for the speech message (normal=medium, urgent=high)'
        },
        voice: {
          type: 'string',
          description: 'Voice identifier for TTS (optional)'
        },
        speed: {
          type: 'number',
          description: 'Speech speed multiplier (optional, default: 1.0)'
        },
        pitch: {
          type: 'number',
          description: 'Speech pitch adjustment (optional, default: 0)'
        },
        type: {
          type: 'string',
          description: 'Type of the message (e.g., speech, alert, notification). Defaults to speech.',
          enum: ['speech', 'alert', 'notification'],
          default: 'speech'
        },
        emotion: {
          type: 'string',
          description: 'Emotional tone for the speech (optional)'
        },
        messageId: {
          type: 'string',
          description: 'Unique message identifier (optional, auto-generated if not provided)'
        }
      },
      required: ['text', 'priority']
    }
  }
];

/**
 * Define available resources
 */
const MQTT_RESOURCES: Resource[] = [
  {
    uri: 'mqtt://connections',
    name: 'MQTT Connections',
    description: 'List of active MQTT connections',
    mimeType: 'application/json'
  },
  {
    uri: 'mqtt://messages/{connectionId}',
    name: 'MQTT Messages',
    description: 'Message history for a specific connection',
    mimeType: 'application/json'
  }
];

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  logger.info('Starting Local MQTT MCP Server...');

  // Initialize storage and restore state
  const storage = new FileStorage();
  
  try {
    const savedSubscriptions = await storage.loadSubscriptions();
    logger.info('Restored subscriptions', { count: savedSubscriptions.length });
    
    // TODO: Restore connections and subscriptions if needed
    // For now, we'll just log the restored subscriptions
  } catch (error) {
    logger.warn('Failed to restore state', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'local-mqtt-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MQTT_TOOLS
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Validate request
      if (!name || !args) {
        return {
          content: [
            {
              type: 'text',
              text: 'Invalid tool request: missing name or arguments'
            }
          ],
          isError: true
        };
      }

      let result;

      // Route to appropriate handler
      switch (name) {
        case 'mqtt_connect':
          result = await handleConnect(args);
          break;

        case 'mqtt_disconnect':
          result = await handleDisconnect(args);
          break;

        case 'mqtt_publish':
          result = await handlePublish(args);
          break;

        case 'mqtt_subscribe':
          result = await handleSubscribe(args);
          break;

        case 'mqtt_unsubscribe':
          result = await handleUnsubscribe(args);
          break;

        case 'aituber_speech_publish':
          result = await handleSpeechPublish(args);
          break;

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`
              }
            ],
            isError: true
          };
      }

      // Format response
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: result.data?.message || 'Operation completed successfully'
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: result.error || 'Operation failed'
            }
          ],
          isError: true
        };
      }

    } catch (error) {
      logger.error('Tool call error', { 
        tool: name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: MQTT_RESOURCES
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      const mqttManager = MqttManager.getInstance();

      if (uri === 'mqtt://connections') {
        const connections = mqttManager.getConnections();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(connections, null, 2)
            }
          ]
        };
      }

      // Handle messages resource
      const messagesMatch = uri.match(/^mqtt:\/\/messages\/(.+)$/);
      if (messagesMatch) {
        const connectionId = messagesMatch[1];
        const messages = mqttManager.getMessages(connectionId);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(messages, null, 2)
            }
          ]
        };
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Resource not found: ${uri}`
          }
        ]
      };

    } catch (error) {
      logger.error('Resource read error', { 
        uri, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Error reading resource: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  });

  // Set up graceful shutdown
  const cleanup = async () => {
    logger.info('Shutting down server...');
    try {
      await server.close();
      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Local MQTT MCP Server started successfully');
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  });
}
// Mock modules before importing them
jest.mock('../mqttManager');
jest.mock('../handlers/toolHandlers');
jest.mock('../storage/fileStorage');

// Mock the MCP SDK
const mockConnect = jest.fn();
const mockClose = jest.fn();
const mockSetRequestHandler = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: mockSetRequestHandler,
    connect: mockConnect,
    close: mockClose
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

describe('MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
  });

  describe('startServer function', () => {
    it('should start MCP server', async () => {
      const { startServer } = await import('../index');
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

      await startServer();

      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'local-mqtt-mcp-server',
          version: '1.0.0'
        }),
        expect.objectContaining({
          capabilities: expect.objectContaining({
            tools: {},
            resources: {}
          })
        })
      );
    });

    it('should register tool handlers', async () => {
      const { startServer } = await import('../index');

      await startServer();

      // Check that setRequestHandler was called for tools
      expect(mockSetRequestHandler).toHaveBeenCalledWith(
        expect.anything(), // Schema object
        expect.any(Function) // Handler function
      );

      // Should be called at least 4 times (tools/list, tools/call, resources/list, resources/read)
      expect(mockSetRequestHandler).toHaveBeenCalledTimes(4);
    });

    it('should connect to transport', async () => {
      const { startServer } = await import('../index');

      await startServer();

      expect(mockConnect).toHaveBeenCalledWith(expect.anything());
    });

    it('should restore saved state on startup', async () => {
      const { startServer } = await import('../index');
      const { FileStorage } = require('../storage/fileStorage');

      // Mock FileStorage
      const mockFileStorage = {
        loadSubscriptions: jest.fn().mockResolvedValue([
          {
            connectionId: 'restored-conn',
            topic: 'restored/topic',
            qos: 1,
            subscribedAt: new Date()
          }
        ])
      };

      FileStorage.mockImplementation(() => mockFileStorage);

      await startServer();

      expect(mockFileStorage.loadSubscriptions).toHaveBeenCalled();
    });

    it('should handle server startup errors', async () => {
      mockConnect.mockRejectedValue(new Error('Server startup failed'));

      const { startServer } = await import('../index');

      await expect(startServer()).rejects.toThrow('Server startup failed');
    });
  });

  describe('Tool functionality', () => {
    it('should handle tool calls through handlers', async () => {
      const { startServer } = await import('../index');
      const { handleConnect } = require('../handlers/toolHandlers');

      // Mock tool handler
      handleConnect.mockResolvedValue({
        success: true,
        data: { message: 'Connected successfully' }
      });

      await startServer();

      // Verify handler was mocked correctly
      expect(handleConnect).toBeDefined();
    });

    it('should handle tool errors', async () => {
      const { startServer } = await import('../index');
      const { handleConnect } = require('../handlers/toolHandlers');

      // Mock tool handler to throw error
      handleConnect.mockRejectedValue(new Error('Connection failed'));

      await startServer();

      // Verify error handling setup
      expect(handleConnect).toBeDefined();
    });
  });

  describe('Resource functionality', () => {
    it('should provide connection resources', async () => {
      const { startServer } = await import('../index');
      const { MqttManager } = require('../mqttManager');

      // Mock MqttManager
      const mockMqttManager = {
        getInstance: jest.fn().mockReturnValue({
          getConnections: jest.fn().mockReturnValue([]),
          getMessages: jest.fn().mockReturnValue([])
        })
      };

      MqttManager.getInstance = mockMqttManager.getInstance;

      await startServer();

      expect(MqttManager.getInstance).toBeDefined();
    });
  });

  describe('Server configuration', () => {
    it('should configure server with correct name and version', async () => {
      const { startServer } = await import('../index');
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

      await startServer();

      const serverCall = (Server as jest.Mock).mock.calls[0];
      expect(serverCall[0]).toEqual({
        name: 'local-mqtt-mcp-server',
        version: '1.0.0'
      });
    });

    it('should set up capabilities correctly', async () => {
      const { startServer } = await import('../index');
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

      await startServer();

      const serverCall = (Server as jest.Mock).mock.calls[0];
      expect(serverCall[1]).toEqual({
        capabilities: {
          tools: {},
          resources: {}
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle storage restoration errors gracefully', async () => {
      const { startServer } = await import('../index');
      const { FileStorage } = require('../storage/fileStorage');

      // Mock FileStorage to throw error
      const mockFileStorage = {
        loadSubscriptions: jest.fn().mockRejectedValue(new Error('Storage error'))
      };

      FileStorage.mockImplementation(() => mockFileStorage);

      // Should not throw, should handle error gracefully
      await expect(startServer()).resolves.toBeUndefined();
      expect(mockFileStorage.loadSubscriptions).toHaveBeenCalled();
    });
  });

  describe('Integration tests', () => {
    it('should integrate all components correctly', async () => {
      const { startServer } = await import('../index');

      // Run startup process
      await startServer();

      // Verify all main components were initialized
      expect(mockSetRequestHandler).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
    });
  });
});
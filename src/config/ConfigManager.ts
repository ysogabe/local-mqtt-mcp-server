import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Configure logger for config manager (disable all logging for MCP)
const logger = winston.createLogger({
  silent: true
});

export interface MqttBrokerConfig {
  url: string;
  clientIdPrefix: string;
  options?: {
    clean?: boolean;
    keepalive?: number;
    reconnectPeriod?: number;
  };
}

export interface AituberTopicConfig {
  speech: string;
  alert: string;
  notification: string;
}

export interface AppConfig {
  mqtt: {
    defaultBroker: MqttBrokerConfig;
  };
  aituber: {
    topics: AituberTopicConfig;
  };
}

/**
 * Configuration manager for the MQTT MCP Server
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    // Default configuration
    this.config = {
      mqtt: {
        defaultBroker: {
          url: 'mqtt://localhost:1883',
          clientIdPrefix: 'aituber-mcp',
          options: {
            clean: true,
            keepalive: 60,
            reconnectPeriod: 5000
          }
        }
      },
      aituber: {
        topics: {
          speech: 'aituber/speech',
          alert: 'aituber/speech/alert',
          notification: 'aituber/speech/notification'
        }
      }
    };

    // Determine config path
    this.configPath = this.findConfigPath();
    
    // Load configuration
    this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Find configuration file path
   */
  private findConfigPath(): string {
    // Check environment variable first
    if (process.env.MQTT_MCP_CONFIG_PATH) {
      return process.env.MQTT_MCP_CONFIG_PATH;
    }

    // Check common locations
    const configLocations = [
      path.join(process.cwd(), 'config', 'default.json'),
      path.join(process.cwd(), 'config.json'),
      path.join(__dirname, '..', '..', 'config', 'default.json'),
      path.join(__dirname, '..', '..', 'config.json')
    ];

    for (const location of configLocations) {
      if (fs.existsSync(location)) {
        logger.info(`Found config file at: ${location}`);
        return location;
      }
    }

    // Return default path
    return path.join(process.cwd(), 'config', 'default.json');
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(fileContent) as Partial<AppConfig>;
        
        // Merge with default config
        this.config = this.mergeConfig(this.config, loadedConfig);
        
        logger.info('Configuration loaded successfully', { path: this.configPath });
      } else {
        logger.warn('Configuration file not found, using defaults', { path: this.configPath });
      }
    } catch (error) {
      logger.error('Failed to load configuration', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        path: this.configPath 
      });
    }

    // Override with environment variables if present
    this.overrideWithEnv();
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(defaultConfig: AppConfig, loadedConfig: Partial<AppConfig>): AppConfig {
    const result = { ...defaultConfig };

    if (loadedConfig.mqtt) {
      result.mqtt = {
        ...result.mqtt,
        ...loadedConfig.mqtt
      };
      
      if (loadedConfig.mqtt.defaultBroker) {
        result.mqtt.defaultBroker = {
          ...result.mqtt.defaultBroker,
          ...loadedConfig.mqtt.defaultBroker
        };
        
        if (loadedConfig.mqtt.defaultBroker.options) {
          result.mqtt.defaultBroker.options = {
            ...result.mqtt.defaultBroker.options,
            ...loadedConfig.mqtt.defaultBroker.options
          };
        }
      }
    }

    if (loadedConfig.aituber) {
      result.aituber = {
        ...result.aituber,
        ...loadedConfig.aituber
      };
      
      if (loadedConfig.aituber.topics) {
        result.aituber.topics = {
          ...result.aituber.topics,
          ...loadedConfig.aituber.topics
        };
      }
    }

    return result;
  }

  /**
   * Override configuration with environment variables
   */
  private overrideWithEnv(): void {
    // MQTT broker URL
    if (process.env.MQTT_BROKER_URL) {
      this.config.mqtt.defaultBroker.url = process.env.MQTT_BROKER_URL;
      logger.info('MQTT broker URL overridden by environment variable');
    }

    // MQTT client ID prefix
    if (process.env.MQTT_CLIENT_ID_PREFIX) {
      this.config.mqtt.defaultBroker.clientIdPrefix = process.env.MQTT_CLIENT_ID_PREFIX;
    }

    // AITuber topics
    if (process.env.AITUBER_TOPIC_SPEECH) {
      this.config.aituber.topics.speech = process.env.AITUBER_TOPIC_SPEECH;
    }
    if (process.env.AITUBER_TOPIC_ALERT) {
      this.config.aituber.topics.alert = process.env.AITUBER_TOPIC_ALERT;
    }
    if (process.env.AITUBER_TOPIC_NOTIFICATION) {
      this.config.aituber.topics.notification = process.env.AITUBER_TOPIC_NOTIFICATION;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get MQTT default broker configuration
   */
  getDefaultBrokerConfig(): MqttBrokerConfig {
    return this.config.mqtt.defaultBroker;
  }

  /**
   * Get AITuber topic configuration
   */
  getAituberTopics(): AituberTopicConfig {
    return this.config.aituber.topics;
  }

  /**
   * Save current configuration to file
   */
  saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write configuration
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );

      logger.info('Configuration saved successfully', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save configuration', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        path: this.configPath 
      });
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.saveConfig();
  }
}
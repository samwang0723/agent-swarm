import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import config from './index';
import logger from '../utils/logger';

// User profile schema for structured working memory
const userProfileSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  preferences: z
    .object({
      communicationStyle: z.enum(['formal', 'casual', 'technical']).optional(),
      projectGoal: z.string().optional(),
      keyDeadlines: z
        .array(
          z.object({
            name: z.string(),
            date: z.string(),
          })
        )
        .optional(),
      preferredLanguage: z.string().optional(),
      notificationSettings: z
        .object({
          email: z.boolean().optional(),
          slack: z.boolean().optional(),
          sms: z.boolean().optional(),
        })
        .optional(),
      workingHours: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
          timezone: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  sessionState: z
    .object({
      currentProject: z.string().optional(),
      activeFeatures: z.array(z.string()).optional(),
      lastActivity: z.string().optional(),
      lastTaskDiscussed: z.string().optional(),
      lastAgentUsed: z.string().optional(),
      currentContext: z.string().optional(),
    })
    .optional(),
});

// PostgreSQL connection configuration using shared config
const createPostgresConfig = () => {
  // Support both DATABASE_URL and individual components
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      schemaName: process.env.MASTRA_MEMORY_SCHEMA || undefined,
    };
  }

  // Build connection string from shared database config
  const { host, port, user, password } = config.db;
  const database = process.env.DB_NAME || 'mastra_memory';

  return {
    connectionString: `postgresql://${user}:${password}@${host}:${port}/${database}`,
    schemaName: process.env.MASTRA_MEMORY_SCHEMA || undefined,
  };
};

// Singleton instance for PostgreSQL storage to prevent duplicate connections
let postgresStorageInstance: PostgresStore | null = null;

// Create PostgreSQL storage with proper error handling and singleton pattern
const createPostgresStorage = () => {
  // Return existing instance if already created
  if (postgresStorageInstance) {
    logger.debug('Reusing existing PostgreSQL storage instance');
    return postgresStorageInstance;
  }

  try {
    const config = createPostgresConfig();
    logger.info('Initializing PostgreSQL storage for memory persistence');

    // Create PostgresStore following official Mastra documentation
    const storage = new PostgresStore({
      connectionString: config.connectionString,
      ...(config.schemaName && { schemaName: config.schemaName }),
    });

    // Store the instance for reuse
    postgresStorageInstance = storage;
    logger.info('PostgreSQL storage singleton instance created');

    return storage;
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL storage:', error);
    logger.warn('Memory will not persist between sessions');
    return null;
  }
};

// Singleton instance for Memory to prevent multiple instances
let memoryInstance: Memory | null = null;

// Memory configuration following Mastra best practices with singleton pattern
export const createMastraMemory = () => {
  // Return existing instance if already created
  if (memoryInstance) {
    logger.debug('Reusing existing Mastra Memory instance');
    return memoryInstance;
  }

  try {
    const storage = createPostgresStorage();

    // Create memory configuration with PostgreSQL storage
    const memoryConfig: {
      storage?: PostgresStore;
      options: {
        workingMemory: {
          enabled: boolean;
          scope: 'resource' | 'thread';
          schema: typeof userProfileSchema;
        };
      };
    } = {
      options: {
        workingMemory: {
          enabled: true,
          scope: 'resource', // Enable resource-scoped memory for cross-conversation persistence
          schema: userProfileSchema,
        },
      },
    };

    // Add PostgreSQL storage if available
    if (storage) {
      memoryConfig.storage = storage;
    }

    const memory = new Memory(memoryConfig);

    // Store the instance for reuse
    memoryInstance = memory;

    if (storage) {
      logger.info(
        'Successfully initialized Mastra Memory singleton with PostgreSQL persistence'
      );
    } else {
      logger.warn(
        'Initialized Mastra Memory singleton without persistent storage'
      );
    }

    return memory;
  } catch (error) {
    logger.error('Failed to initialize Mastra Memory with PostgreSQL:', error);

    // Fallback to in-memory storage
    logger.warn(
      'Falling back to in-memory storage - data will not persist between sessions'
    );
    const fallbackMemory = new Memory({
      options: {
        workingMemory: {
          enabled: true,
          scope: 'resource',
          schema: userProfileSchema,
        },
      },
    });

    // Store the fallback instance for reuse
    memoryInstance = fallbackMemory;
    return fallbackMemory;
  }
};

// Memory utilities for monitoring and management
export const memoryUtils = {
  // Get memory usage stats
  getMemoryStats: async () => {
    try {
      const config = createPostgresConfig();
      logger.info(
        `PostgreSQL memory storage: ${config.connectionString.replace(/password=[^&;]*/i, 'password=***')}`
      );
      return {
        storage: 'postgresql',
        schema_name: config.schemaName || 'default',
        connection: config.connectionString.includes('postgresql://')
          ? 'valid'
          : 'invalid',
        singleton_status: {
          postgres_storage: postgresStorageInstance
            ? 'initialized'
            : 'not_initialized',
          memory_instance: memoryInstance ? 'initialized' : 'not_initialized',
        },
      };
    } catch (error) {
      logger.error('Failed to get memory stats:', error);
      return {
        storage: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  // Check PostgreSQL connection
  checkConnection: async () => {
    try {
      const storage = createPostgresStorage();
      if (!storage) {
        return {
          connected: false,
          error: 'Failed to create PostgreSQL storage',
        };
      }
      return { connected: true, storage: 'postgresql' };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  // Reset singleton instances (useful for testing or debugging)
  resetSingletonInstances: () => {
    logger.info('Resetting Mastra singleton instances');
    postgresStorageInstance = null;
    memoryInstance = null;
  },

  // Check if singleton instances are initialized
  getSingletonStatus: () => {
    return {
      postgres_storage: postgresStorageInstance
        ? 'initialized'
        : 'not_initialized',
      memory_instance: memoryInstance ? 'initialized' : 'not_initialized',
    };
  },
};

// Default agent configuration options with environment variables
export const defaultAgentOptions = {
  // Model configuration - use environment variable from models config
  model: process.env.LLM_MODEL || 'gpt-4o-mini',

  // Memory configuration with PostgreSQL persistence
  memory: createMastraMemory(),

  // Default instructions template
  instructions: `You are a helpful AI assistant. Use the working memory to remember user preferences and context across conversations.
  
Always:
- Be professional and helpful
- Remember user preferences from working memory
- Update working memory with new information about the user
- Maintain context across conversation threads`,

  // Tool execution settings
  toolChoice: 'auto' as const,
  maxToolRoundtrips: parseInt(process.env.MASTRA_WORKFLOW_MAX_STEPS || '5'),

  // Response settings
  temperature: 0.7,
  maxTokens: parseInt(process.env.MASTRA_MAX_TOKENS || '2000'),

  // Stream settings
  stream: true,
};

// Resource ID and Thread ID patterns for user-specific memory scoping
export const memoryPatterns = {
  // Generate resourceId from user ID for persistent cross-session memory
  getResourceId: (userId: string): string => `user:${userId}`,

  // Generate threadId from session ID for conversation threads
  getThreadId: (sessionId: string): string => `session:${sessionId}`,

  // Generate combined ID for specific use cases
  getCombinedId: (userId: string, sessionId: string): string =>
    `user:${userId}:session:${sessionId}`,

  // Extract user ID from resourceId
  extractUserId: (resourceId: string): string =>
    resourceId.replace('user:', ''),

  // Extract session ID from threadId
  extractSessionId: (threadId: string): string =>
    threadId.replace('session:', ''),
};

// Working memory templates for different use cases
export const workingMemoryTemplates = {
  // Basic user profile template
  userProfile: `
# User Profile

## Personal Information
- Name: 
- Location: 
- Timezone: 
- Preferred Language: 

## Communication Preferences
- Style: [formal/casual/technical]
- Notification Settings:
  - Email: [enabled/disabled]
  - SMS: [enabled/disabled]
  - Push: [enabled/disabled]

## Project Context
- Current Goal: 
- Key Deadlines:
  - [Deadline 1]: [Date]
  - [Deadline 2]: [Date]

## Session State
- Last Task Discussed: 
- Open Questions:
  - [Question 1]
  - [Question 2]
- Current Context: 
- Last Agent Used: 
`,

  // Business context template
  businessContext: `
# Business Context

## Company Information
- Company Name: 
- Industry: 
- Role: 
- Team: 

## Current Projects
- Active Projects: 
- Priority Level: 
- Stakeholders: 

## Preferences
- Meeting Times: 
- Communication Channels: 
- Reporting Frequency: 
`,

  // Technical context template
  technicalContext: `
# Technical Context

## Technology Stack
- Programming Languages: 
- Frameworks: 
- Tools: 
- Environment: 

## Current Work
- Active Tasks: 
- Blockers: 
- Next Steps: 

## Preferences
- Code Style: 
- Documentation Level: 
- Testing Approach: 
`,
};

// Mastra-specific configuration settings with environment variables
export const mastraConfig = {
  // Development settings
  development: {
    enableDebugLogs:
      process.env.MASTRA_DEV_MODE === 'true' ||
      process.env.NODE_ENV === 'development',
    enableMemoryInspection:
      process.env.MASTRA_ENABLE_DEBUGGING === 'true' ||
      process.env.NODE_ENV === 'development',
  },

  // Memory settings with PostgreSQL
  memory: {
    // PostgreSQL-specific settings
    schemaName: process.env.MASTRA_MEMORY_SCHEMA || 'mastra',

    // Retention settings from environment
    retentionDays: parseInt(process.env.MASTRA_MEMORY_RETENTION_DAYS || '30'),
    maxMessages: parseInt(process.env.MASTRA_MEMORY_MAX_MESSAGES || '1000'),

    // Cleanup settings
    enableAutoCleanup: true,
    cleanupIntervalHours: 24,

    // Performance settings
    batchSize: 100,
    maxConcurrentOperations: 5,
  },

  // Workflow settings
  workflow: {
    maxSteps: parseInt(process.env.MASTRA_WORKFLOW_MAX_STEPS || '5'),
    timeoutMs: parseInt(process.env.MASTRA_WORKFLOW_TIMEOUT || '30000'),
  },

  // Feature flags
  features: {
    enableTelemetry: process.env.MASTRA_ENABLE_TELEMETRY === 'true',
    enableVectorSearch:
      process.env.MASTRA_MEMORY_ENABLE_VECTOR_SEARCH !== 'false',
    useOptimizedEmbeddings: true,
  },

  // Logging and monitoring
  logging: {
    level: process.env.MASTRA_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
    enableStructuredLogs: process.env.NODE_ENV === 'production',
    enableMemoryLogs: process.env.MASTRA_DEV_MODE === 'true',
  },
};

// Export configuration validation function
export const validateMastraConfig = () => {
  const errors: string[] = [];

  // Check required PostgreSQL configuration
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    errors.push(
      'PostgreSQL configuration missing: Either DATABASE_URL or DB_HOST must be provided'
    );
  }

  // Check model configuration
  if (!process.env.LLM_MODEL) {
    logger.warn('LLM_MODEL not set, using default: gpt-4o-mini');
  }

  if (errors.length > 0) {
    logger.error('Mastra configuration validation failed:', errors);
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }

  logger.info('Mastra configuration validation passed');
  return true;
};

// Export types for TypeScript support
export type UserProfileSchema = z.infer<typeof userProfileSchema>;
export type MastraMemoryInstance = ReturnType<typeof createMastraMemory>;

// Memory configuration interface
export interface MastraMemoryConfig {
  resource: string;
  thread: string;
}

// Helper function to create agent memory configuration for use in agent creation
export const createAgentMemoryConfig = (userId: string, sessionId: string) => {
  return {
    resource: `user:${userId}`,
    thread: `session:${sessionId}`,
    userId,
  };
};

// Utility function to validate memory configuration
export const validateMemoryConfig = (config: MastraMemoryConfig): boolean => {
  try {
    if (!config.resource || !config.thread) {
      logger.warn('Memory configuration missing resource or thread ID');
      return false;
    }
    return true;
  } catch (error) {
    logger.error('Invalid memory configuration', { error, config });
    return false;
  }
};

// Best practices for Mastra memory configuration
export const mastraBestPractices = {
  memory: {
    // Working memory should be structured with clear schemas
    workingMemoryDesign: {
      useZodSchemas: true,
      keepStructureFlat: true,
      limitNesting: 3,
      useConsistentNaming: true,
    },

    // Resource and thread patterns
    resourcePatterns: {
      userScoped: 'user:{userId}',
      sessionScoped: 'session:{sessionId}',
      organizationScoped: 'org:{orgId}:user:{userId}',
    },

    // Performance considerations
    performance: {
      batchOperations: true,
      limitConcurrentConnections: 10,
      useConnectionPooling: true,
      enableCleanupScheduler: true,
    },

    // Data management
    dataManagement: {
      defineRetentionPolicies: true,
      implementBackupStrategy: true,
      monitorMemoryUsage: true,
      useStructuredLogging: true,
    },
  },

  // Agent configuration best practices
  agents: {
    memory: {
      // Always scope memory to users for data isolation
      alwaysUserScope: true,

      // Use descriptive resource and thread IDs
      useDescriptiveIds: true,

      // Implement proper cleanup
      enableAutoCleanup: true,

      // Monitor memory usage
      trackUsage: true,
    },

    // Tool integration
    tools: {
      // Tools should update working memory when appropriate
      updateWorkingMemory: true,

      // Use structured data for tool results
      useStructuredResults: true,

      // Log tool usage for debugging
      logToolUsage: true,
    },
  },
};

// Memory monitoring utilities
export const memoryMonitoring = {
  // Get memory usage statistics
  getMemoryStats: () => ({
    heapUsed: process.memoryUsage().heapUsed,
    heapTotal: process.memoryUsage().heapTotal,
    rss: process.memoryUsage().rss,
    external: process.memoryUsage().external,
  }),

  // Log memory usage with context
  logMemoryUsage: (context: string) => {
    const stats = memoryMonitoring.getMemoryStats();
    logger.info('Memory usage', { context, ...stats });
  },

  // Check if memory usage is within acceptable limits
  checkMemoryLimits: (maxHeapMB: number = 1024): boolean => {
    const stats = memoryMonitoring.getMemoryStats();
    const heapMB = stats.heapUsed / 1024 / 1024;
    return heapMB < maxHeapMB;
  },
};

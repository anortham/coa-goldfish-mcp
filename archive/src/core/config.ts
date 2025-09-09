/**
 * Configuration manager for Goldfish MCP
 * Supports environment variables and runtime configuration
 */

export interface GoldfishConfig {
  // Storage configuration
  basePath?: string;
  workspaceDetection: boolean;
  
  // Memory configuration
  defaultTtlHours: number;
  maxMemoriesPerWorkspace: number;
  autoCleanupEnabled: boolean;
  cleanupThresholdDays: number;
  
  // Tool quotas and limits
  maxTodoItemsPerList: number;
  maxPlanItemsPerPlan: number;
  maxCheckpointsPerSession: number;
  maxStandupDays: number;
  
  // Feature flags
  vsCodeBridgeEnabled: boolean;
  relationshipTrackingEnabled: boolean;
  indexingEnabled: boolean;
  
  // Output configuration
  defaultOutputMode: 'plain' | 'emoji' | 'json' | 'dual';
  enableVerboseLogging: boolean;
  
  // Search configuration
  fuzzySearchThreshold: number;
  searchResultLimit: number;
  
  // Integration settings
  gitIntegrationEnabled: boolean;
  autoDetectWorkspace: boolean;
  
  // Performance settings
  concurrentIndexUpdates: boolean;
  batchSizeForBulkOperations: number;
}

export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private config: GoldfishConfig;

  private constructor() {
    this.config = this.loadConfigFromEnvironment();
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
   * Load configuration from environment variables with defaults
   */
  private loadConfigFromEnvironment(): GoldfishConfig {
    return {
      // Storage configuration
      basePath: process.env.COA_GOLDFISH_BASE_PATH,
      workspaceDetection: this.getBooleanEnv('COA_GOLDFISH_WORKSPACE_DETECTION', true),
      
      // Memory configuration
      defaultTtlHours: this.getNumberEnv('COA_GOLDFISH_DEFAULT_TTL_HOURS', 72),
      maxMemoriesPerWorkspace: this.getNumberEnv('COA_GOLDFISH_MAX_MEMORIES_PER_WORKSPACE', 50),
      autoCleanupEnabled: this.getBooleanEnv('COA_GOLDFISH_AUTO_CLEANUP', true),
      cleanupThresholdDays: this.getNumberEnv('COA_GOLDFISH_CLEANUP_THRESHOLD_DAYS', 7),
      
      // Tool quotas and limits
      maxTodoItemsPerList: this.getNumberEnv('COA_GOLDFISH_MAX_TODO_ITEMS', 100),
      maxPlanItemsPerPlan: this.getNumberEnv('COA_GOLDFISH_MAX_PLAN_ITEMS', 50),
      maxCheckpointsPerSession: this.getNumberEnv('COA_GOLDFISH_MAX_CHECKPOINTS_PER_SESSION', 20),
      maxStandupDays: this.getNumberEnv('COA_GOLDFISH_MAX_STANDUP_DAYS', 30),
      
      // Feature flags
      vsCodeBridgeEnabled: this.getBooleanEnv('COA_GOLDFISH_VSCODE_BRIDGE', true),
      relationshipTrackingEnabled: this.getBooleanEnv('COA_GOLDFISH_RELATIONSHIP_TRACKING', true),
      indexingEnabled: this.getBooleanEnv('COA_GOLDFISH_INDEXING_ENABLED', true),
      
      // Output configuration
      defaultOutputMode: this.getEnumEnv(
        'COA_GOLDFISH_OUTPUT_MODE', 
        ['plain', 'emoji', 'json', 'dual'], 
        'dual'
      ) as 'plain' | 'emoji' | 'json' | 'dual',
      enableVerboseLogging: this.getBooleanEnv('COA_GOLDFISH_VERBOSE_LOGGING', false),
      
      // Search configuration
      fuzzySearchThreshold: this.getNumberEnv('COA_GOLDFISH_FUZZY_SEARCH_THRESHOLD', 0.3),
      searchResultLimit: this.getNumberEnv('COA_GOLDFISH_SEARCH_RESULT_LIMIT', 100),
      
      // Integration settings
      gitIntegrationEnabled: this.getBooleanEnv('COA_GOLDFISH_GIT_INTEGRATION', true),
      autoDetectWorkspace: this.getBooleanEnv('COA_GOLDFISH_AUTO_DETECT_WORKSPACE', true),
      
      // Performance settings
      concurrentIndexUpdates: this.getBooleanEnv('COA_GOLDFISH_CONCURRENT_INDEX_UPDATES', false),
      batchSizeForBulkOperations: this.getNumberEnv('COA_GOLDFISH_BATCH_SIZE', 10)
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): GoldfishConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<GoldfishConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof GoldfishConfig>(key: K): GoldfishConfig[K] {
    return this.config[key];
  }

  /**
   * Set a specific configuration value
   */
  set<K extends keyof GoldfishConfig>(key: K, value: GoldfishConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Reset configuration to environment defaults
   */
  reset(): void {
    this.config = this.loadConfigFromEnvironment();
  }

  /**
   * Get configuration as JSON string for debugging
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Validate configuration values
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate numeric ranges
    if (this.config.defaultTtlHours < 0 || this.config.defaultTtlHours > 8760) { // 0 to 1 year
      errors.push('defaultTtlHours must be between 0 and 8760');
    }

    if (this.config.maxMemoriesPerWorkspace < 1 || this.config.maxMemoriesPerWorkspace > 10000) {
      errors.push('maxMemoriesPerWorkspace must be between 1 and 10000');
    }

    if (this.config.cleanupThresholdDays < 1 || this.config.cleanupThresholdDays > 365) {
      errors.push('cleanupThresholdDays must be between 1 and 365');
    }

    if (this.config.fuzzySearchThreshold < 0 || this.config.fuzzySearchThreshold > 1) {
      errors.push('fuzzySearchThreshold must be between 0 and 1');
    }

    if (this.config.searchResultLimit < 1 || this.config.searchResultLimit > 10000) {
      errors.push('searchResultLimit must be between 1 and 10000');
    }

    if (this.config.batchSizeForBulkOperations < 1 || this.config.batchSizeForBulkOperations > 1000) {
      errors.push('batchSizeForBulkOperations must be between 1 and 1000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper: Parse boolean environment variable
   */
  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Helper: Parse number environment variable
   */
  private getNumberEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Helper: Parse enum environment variable
   */
  private getEnumEnv<T extends string>(key: string, allowedValues: T[], defaultValue: T): T {
    const value = process.env[key] as T;
    if (value === undefined) return defaultValue;
    return allowedValues.includes(value) ? value : defaultValue;
  }

  /**
   * Get environment variable summary for debugging
   */
  getEnvironmentSummary(): Record<string, string | undefined> {
    return {
      COA_GOLDFISH_BASE_PATH: process.env.COA_GOLDFISH_BASE_PATH,
      COA_GOLDFISH_WORKSPACE_DETECTION: process.env.COA_GOLDFISH_WORKSPACE_DETECTION,
      COA_GOLDFISH_DEFAULT_TTL_HOURS: process.env.COA_GOLDFISH_DEFAULT_TTL_HOURS,
      COA_GOLDFISH_MAX_MEMORIES_PER_WORKSPACE: process.env.COA_GOLDFISH_MAX_MEMORIES_PER_WORKSPACE,
      COA_GOLDFISH_AUTO_CLEANUP: process.env.COA_GOLDFISH_AUTO_CLEANUP,
      COA_GOLDFISH_CLEANUP_THRESHOLD_DAYS: process.env.COA_GOLDFISH_CLEANUP_THRESHOLD_DAYS,
      COA_GOLDFISH_MAX_TODO_ITEMS: process.env.COA_GOLDFISH_MAX_TODO_ITEMS,
      COA_GOLDFISH_MAX_PLAN_ITEMS: process.env.COA_GOLDFISH_MAX_PLAN_ITEMS,
      COA_GOLDFISH_MAX_CHECKPOINTS_PER_SESSION: process.env.COA_GOLDFISH_MAX_CHECKPOINTS_PER_SESSION,
      COA_GOLDFISH_MAX_STANDUP_DAYS: process.env.COA_GOLDFISH_MAX_STANDUP_DAYS,
      COA_GOLDFISH_VSCODE_BRIDGE: process.env.COA_GOLDFISH_VSCODE_BRIDGE,
      COA_GOLDFISH_RELATIONSHIP_TRACKING: process.env.COA_GOLDFISH_RELATIONSHIP_TRACKING,
      COA_GOLDFISH_INDEXING_ENABLED: process.env.COA_GOLDFISH_INDEXING_ENABLED,
      COA_GOLDFISH_OUTPUT_MODE: process.env.COA_GOLDFISH_OUTPUT_MODE,
      COA_GOLDFISH_VERBOSE_LOGGING: process.env.COA_GOLDFISH_VERBOSE_LOGGING,
      COA_GOLDFISH_FUZZY_SEARCH_THRESHOLD: process.env.COA_GOLDFISH_FUZZY_SEARCH_THRESHOLD,
      COA_GOLDFISH_SEARCH_RESULT_LIMIT: process.env.COA_GOLDFISH_SEARCH_RESULT_LIMIT,
      COA_GOLDFISH_GIT_INTEGRATION: process.env.COA_GOLDFISH_GIT_INTEGRATION,
      COA_GOLDFISH_AUTO_DETECT_WORKSPACE: process.env.COA_GOLDFISH_AUTO_DETECT_WORKSPACE,
      COA_GOLDFISH_CONCURRENT_INDEX_UPDATES: process.env.COA_GOLDFISH_CONCURRENT_INDEX_UPDATES,
      COA_GOLDFISH_BATCH_SIZE: process.env.COA_GOLDFISH_BATCH_SIZE
    };
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: 'vsCodeBridge' | 'relationshipTracking' | 'indexing' | 'gitIntegration' | 'autoCleanup'): boolean {
    switch (feature) {
      case 'vsCodeBridge':
        return this.config.vsCodeBridgeEnabled;
      case 'relationshipTracking':
        return this.config.relationshipTrackingEnabled;
      case 'indexing':
        return this.config.indexingEnabled;
      case 'gitIntegration':
        return this.config.gitIntegrationEnabled;
      case 'autoCleanup':
        return this.config.autoCleanupEnabled;
      default:
        return false;
    }
  }

  /**
   * Get quota for a specific tool/operation
   */
  getQuota(operation: 'todoItems' | 'planItems' | 'checkpoints' | 'standupDays' | 'searchResults' | 'memories'): number {
    switch (operation) {
      case 'todoItems':
        return this.config.maxTodoItemsPerList;
      case 'planItems':
        return this.config.maxPlanItemsPerPlan;
      case 'checkpoints':
        return this.config.maxCheckpointsPerSession;
      case 'standupDays':
        return this.config.maxStandupDays;
      case 'searchResults':
        return this.config.searchResultLimit;
      case 'memories':
        return this.config.maxMemoriesPerWorkspace;
      default:
        return 100; // Default fallback
    }
  }
}
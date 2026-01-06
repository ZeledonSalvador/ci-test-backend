export interface ConnectionTestResult {
  success: boolean;
  message: string;
  timestamp: Date;
  details: {
    error?: string;
    fromEmail?: string;
    connectionType?: string;
    fromName?: string;
    templatesDir?: string;
    tokenObtained?: boolean;
    graphApiAccess?: boolean;
    usersFound?: number;
    warning?: string;
    authProviderExists?: boolean;
  };
}

export interface ConfigurationTestResult {
  success: boolean;
  message: string;
  timestamp: Date;
  details: {
    configured: string[];
    missing: string[];
    serviceInitialized: boolean;
    authProviderExists: boolean;
    graphClientExists: boolean;
    templatesDirectory?: {
      path: string;
      exists: boolean;
      templateFiles: string[];
    };
  };
}

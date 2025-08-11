export type WebhookType = 'chat' | 'file_upload' | 'google_drive';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: WebhookType;
  enabled: boolean;
  lastTested?: Date;
  lastUsed?: Date;
  successRate?: number;
  timeout: number;
  retryAttempts: number;
  headers?: Record<string, string>;
}

export interface WebhookStorageData {
  webhooks: WebhookConfig[];
  version: string;
  lastUpdated: Date;
}

export const DEFAULT_WEBHOOK_CONFIGS: Omit<WebhookConfig, 'id' | 'url'>[] = [
  {
    name: 'Chat Assistant',
    type: 'chat',
    enabled: true,
    timeout: 30000,
    retryAttempts: 2,
  },
  {
    name: 'File Upload Processor',
    type: 'file_upload',
    enabled: true,
    timeout: 60000,
    retryAttempts: 3,
  },
  {
    name: 'Google Drive Sync',
    type: 'google_drive',
    enabled: true,
    timeout: 45000,
    retryAttempts: 2,
  },
];
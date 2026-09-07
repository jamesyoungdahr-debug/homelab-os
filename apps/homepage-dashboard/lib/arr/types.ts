export interface HealthIssue {
  type: string;
  message: string;
}

export interface SonarrSummary {
  online: boolean;
  version?: string;
  queueCount?: number;
  missingCount?: number;
  healthIssues?: HealthIssue[];
  error?: string;
}

export interface RadarrSummary {
  online: boolean;
  version?: string;
  queueCount?: number;
  missingCount?: number;
  healthIssues?: HealthIssue[];
  error?: string;
}

export interface ProwlarrSummary {
  online: boolean;
  version?: string;
  indexerCount?: number;
  activeIndexerCount?: number;
  failingIndexers?: { name: string; message: string }[];
  error?: string;
}

export interface AuthConfig {
  enabled: boolean;
  required: boolean;
  clientId: string | null;
  tenantId: string | null;
  apiScope: string | null;
  graphScopes: string[];
}

export interface User {
  id: string;
  microsoftOid: string;
  tenantId: string;
  displayName: string;
  email: string | null;
  preferredUsername: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface GraphProfile {
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
}
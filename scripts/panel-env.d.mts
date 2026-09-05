export function maskDatabaseUrl(url?: string): string;

export function checkDatabaseHost(
  url?: string,
  options?: { inContainer?: boolean },
): { ok: boolean; reason?: 'missing' | 'invalid' | 'loopback-in-container'; host?: string };

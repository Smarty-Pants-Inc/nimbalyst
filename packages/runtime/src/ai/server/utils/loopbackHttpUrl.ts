const LOOPBACK_HOSTS = new Set(['localhost', '::1']);

export function normalizeLoopbackHttpUrl(
  rawValue: unknown,
  fallbackUrl: string,
  label = 'URL',
): string {
  const candidate = typeof rawValue === 'string' && rawValue.trim()
    ? rawValue.trim()
    : fallbackUrl;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${label} must be an absolute loopback HTTP(S) URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https on a loopback host`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain query parameters or fragments`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!isLoopbackHost(hostname)) {
    throw new Error(`${label} must use a loopback host`);
  }

  return parsed.toString().replace(/\/+$/, '');
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || isIPv4Loopback(hostname);
}

function isIPv4Loopback(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts[0] !== '127') return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

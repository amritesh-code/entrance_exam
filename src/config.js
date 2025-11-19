const DEFAULT_API_BASE = 'http://localhost:8000';

const params = new URLSearchParams(window.location.search);
const overrideBase = params.get('wq');
const sanitizedBase = (() => {
  if (!overrideBase) return DEFAULT_API_BASE;
  try {
    const url = new URL(overrideBase.trim());
    return url.origin;
  } catch {
    return DEFAULT_API_BASE;
  }
})();

export const API_BASE_URL = sanitizedBase;
export const WS_BASE_URL = sanitizedBase.startsWith('https')
  ? sanitizedBase.replace('https', 'wss')
  : sanitizedBase.replace('http', 'ws');

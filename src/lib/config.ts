export function getBackendUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('backend');
    if (fromQuery) {
      localStorage.setItem('BACKEND_URL', fromQuery);
      return fromQuery.replace(/\/$/, '');
    }
    const stored = localStorage.getItem('BACKEND_URL');
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    // no-op
  }
  return 'http://127.0.0.1:5000';
}

export function setBackendUrl(url: string) {
  try {
    localStorage.setItem('BACKEND_URL', url.replace(/\/$/, ''));
  } catch {
    // no-op
  }
}

/**
 * Utility to proxy Firebase Storage URLs through the server to avoid CORS issues.
 * Firebase Storage doesn't set Access-Control-Allow-Origin for cross-origin requests,
 * so we route them through /api/proxy/firebase-file on the server.
 */

export function isFirebaseStorageUrl(url: string): boolean {
  return url.includes('storage.googleapis.com') || 
         url.includes('firebasestorage.googleapis.com');
}

/**
 * Returns a proxied URL if the input is a Firebase Storage URL, otherwise returns as-is.
 */
export function getProxiedUrl(url: string): string {
  if (isFirebaseStorageUrl(url)) {
    return `/api/proxy/firebase-file?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Fetches a URL, automatically proxying Firebase Storage URLs to avoid CORS.
 * Falls back to proxy if direct fetch fails.
 */
export async function fetchWithFirebaseProxy(url: string, init?: RequestInit): Promise<Response> {
  const proxiedUrl = getProxiedUrl(url);
  const response = await fetch(proxiedUrl, init);
  
  // If direct fetch failed and we didn't already use proxy, try proxy as fallback
  if (!response.ok && proxiedUrl === url) {
    return fetch(`/api/proxy/firebase-file?url=${encodeURIComponent(url)}`, init);
  }
  
  return response;
}

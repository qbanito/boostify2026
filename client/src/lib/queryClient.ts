import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ─── Desktop / Web API base URL ──────────────────────────────────────────────
// In Electron production the API lives on a remote server; in web/dev it's relative.
let _apiBaseUrl = '';

/** Call once at app startup (from Electron preload or leave empty for web). */
export function setApiBaseUrl(url: string) {
  _apiBaseUrl = url.replace(/\/+$/, ''); // strip trailing slash
}

/** Resolve a relative path (e.g. "/api/foo") to a full URL when in Electron */
export function resolveApiUrl(path: string): string {
  if (_apiBaseUrl && path.startsWith('/')) return `${_apiBaseUrl}${path}`;
  return path;
}

// Initialize from Electron if available
if (window.electronAPI) {
  window.electronAPI.getConfig().then(cfg => {
    if (cfg.apiBaseUrl) setApiBaseUrl(cfg.apiBaseUrl);
  });
}

// Variable global para almacenar la función getToken de Clerk
let clerkGetToken: (() => Promise<string | null>) | null = null;

/**
 * Set the Clerk getToken function from the ClerkProvider context
 * This should be called from a component that has access to useAuth()
 */
export function setClerkGetToken(getToken: () => Promise<string | null>) {
  clerkGetToken = getToken;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Detect if a body payload is a "raw" type that the browser must serialize itself
 * (FormData, Blob, File, URLSearchParams, ArrayBuffer, ReadableStream).
 * For these we must NOT JSON.stringify and MUST NOT set Content-Type
 * (the browser will set it with the correct multipart boundary).
 */
function isRawBody(data: unknown): boolean {
  if (data == null) return false;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return true;
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return true;
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) return true;
  return false;
}

function stripContentType(headers: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === 'content-type') continue;
    out[k] = headers[k];
  }
  return out;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  // Clerk session auth normally rides on the `__session` cookie
  // (credentials: "include"). However that cookie is scoped to a single host,
  // so it is NOT sent when the app is opened on a different host than the one
  // used to sign in (e.g. signed in on `localhost:5000` but browsing on
  // `[::1]:5000`, or behind a proxy). To make authenticated requests robust we
  // ALSO attach the Clerk-issued JWT as a Bearer token when available — the
  // server's auth middleware verifies it (routing Clerk vs Firebase tokens),
  // so this is strictly additive and never weakens cookie-based auth.
  try {
    if (clerkGetToken) {
      const token = await clerkGetToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // Token unavailable (signed out / Clerk not ready) — fall back to cookies.
  }

  return headers;
}

interface ApiRequestOptions {
  url: string;
  method: string;
  data?: unknown;
  body?: unknown;
  headers?: HeadersInit;
  params?: Record<string, string>; // Parámetros de consulta (query parameters)
}

export async function apiRequest(
  options: ApiRequestOptions | string,
  urlOrOptions?: string | Partial<ApiRequestOptions>,
  data?: unknown | undefined,
): Promise<any> {
  const headers = await getAuthHeaders();
  
  // Handle both the new object-based API and the old string-based API
  if (typeof options === 'object') {
    // New API: options is an object with configuration
    const { url: baseUrl, method, data: requestData, body: requestBody, headers: customHeaders, params } = options;
    const finalData = requestData || requestBody;
    let requestHeaders: Record<string, any> = { ...headers, ...customHeaders };
    
    // Procesar parámetros de consulta si existen
    let finalUrl = baseUrl;
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      for (const key in params) {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      }
      finalUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;
    }
    
    // If raw body (FormData/Blob/etc.), send as-is and strip Content-Type
    // so the browser sets the correct multipart boundary.
    let bodyToSend: any;
    if (finalData == null) {
      bodyToSend = undefined;
    } else if (isRawBody(finalData)) {
      bodyToSend = finalData as any;
      requestHeaders = stripContentType(requestHeaders);
    } else if (typeof finalData === 'string') {
      bodyToSend = finalData;
    } else {
      bodyToSend = JSON.stringify(finalData);
    }

    const res = await fetch(resolveApiUrl(finalUrl), {
      method: method || 'GET',
      headers: requestHeaders,
      body: bodyToSend,
      credentials: "include",
    });
    
    await throwIfResNotOk(res);
    return await res.json();
  } else if (typeof options === 'string' && options.startsWith('/')) {
    // URL-first API: apiRequest('/api/...', { method: 'POST', data: {...} }) or apiRequest('/api/...', 'POST', data)
    const url = options;
    
    if (typeof urlOrOptions === 'object') {
      // apiRequest('/api/...', { method: 'POST', data: {...} })
      const { method = 'GET', data: requestData, body: requestBody, headers: customHeaders } = urlOrOptions as Partial<ApiRequestOptions>;
      const finalData = requestData || requestBody;
      let requestHeaders: Record<string, any> = { ...headers, ...customHeaders };
      
      // Build body: FormData/Blob/etc. must be sent as-is with no Content-Type
      // header so the browser sets the multipart boundary. Strings pass through.
      let bodyToSend: any;
      if (finalData == null) {
        bodyToSend = undefined;
      } else if (isRawBody(finalData)) {
        bodyToSend = finalData as any;
        requestHeaders = stripContentType(requestHeaders);
      } else if (typeof finalData === 'string') {
        bodyToSend = finalData;
      } else {
        bodyToSend = JSON.stringify(finalData);
      }
      
      const res = await fetch(resolveApiUrl(url), {
        method,
        headers: requestHeaders,
        body: bodyToSend,
        credentials: "include",
      });
      
      await throwIfResNotOk(res);
      return await res.json();
    } else {
      // apiRequest('/api/...', 'POST', data) or apiRequest('/api/...')
      const method = urlOrOptions || 'GET';
      
      const res = await fetch(resolveApiUrl(url), {
        method,
        headers: data ? { ...headers } : headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      
      await throwIfResNotOk(res);
      return await res.json();
    }
  } else {
    // Old API: options is the method, url is the URL
    const method = options;
    const url = urlOrOptions as string;
    
    const res = await fetch(resolveApiUrl(url), {
      method,
      headers: data ? { ...headers } : headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    await throwIfResNotOk(res);
    return await res.json();
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await getAuthHeaders();

    const res = await fetch(resolveApiUrl(queryKey[0] as string), {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // ─── Performance defaults — reduce redundant network traffic ──────────
      // NOTE: Any individual query can still override these (and many already do
      // for live data: ticker 15s, notifications 30s, economy dashboard 30s, etc.)
      refetchInterval: false,
      // Refetch on tab focus disabled by default — was the single biggest source
      // of "navigation feels slow" because returning to a tab would fan-out 20+
      // refetches simultaneously across mounted components. Critical live views
      // can opt back in per-query with `refetchOnWindowFocus: true`.
      refetchOnWindowFocus: false,
      // Don't refetch on network reconnect (covers wifi flips, vpn toggles).
      refetchOnReconnect: false,
      // Polling pauses when the browser tab is hidden — saves bandwidth and
      // CPU; resumes automatically when the tab becomes visible again.
      refetchIntervalInBackground: false,
      // Data is considered fresh for 60s — within this window, remounting a
      // component (e.g., navigating back) reads instantly from cache.
      staleTime: 60 * 1000,
      // Cached data is kept for 10 min after last observer unmounts — so that
      // back-navigation through the SPA hydrates instantly instead of refetching.
      gcTime: 10 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
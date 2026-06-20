/**
 * API call tracker — wraps axios calls to auto-log API usage
 * Use this for FAL, PiAPI, OpenRouter, and other HTTP-based API calls
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logApiUsage, ApiLogInput } from './api-logger';

type ApiProvider = ApiLogInput['apiProvider'];

/**
 * Make a tracked HTTP POST request. Logs usage to api_usage_log automatically.
 */
export async function trackedPost(
  url: string,
  data: any,
  config: AxiosRequestConfig,
  meta: {
    provider: ApiProvider;
    model?: string;
    userId?: number | null;
    endpoint?: string;
  }
): Promise<AxiosResponse> {
  const startTime = Date.now();
  let status: 'success' | 'error' = 'success';
  let errorMessage: string | null = null;
  let response: AxiosResponse | undefined;

  try {
    response = await axios.post(url, data, config);
    return response;
  } catch (err: any) {
    status = 'error';
    errorMessage = err?.message || 'Request failed';
    throw err;
  } finally {
    const elapsed = Date.now() - startTime;

    logApiUsage({
      userId: meta.userId,
      apiProvider: meta.provider,
      endpoint: meta.endpoint || url.substring(0, 200),
      model: meta.model || null,
      totalTokens: 0,
      responseTime: elapsed,
      status,
      errorMessage,
      metadata: { source: 'tracked-post', url: url.substring(0, 200) },
    }).catch(() => {});
  }
}

/**
 * Make a tracked HTTP GET request
 */
export async function trackedGet(
  url: string,
  config: AxiosRequestConfig,
  meta: {
    provider: ApiProvider;
    model?: string;
    userId?: number | null;
    endpoint?: string;
  }
): Promise<AxiosResponse> {
  const startTime = Date.now();
  let status: 'success' | 'error' = 'success';
  let errorMessage: string | null = null;

  try {
    const response = await axios.get(url, config);
    return response;
  } catch (err: any) {
    status = 'error';
    errorMessage = err?.message || 'Request failed';
    throw err;
  } finally {
    const elapsed = Date.now() - startTime;

    logApiUsage({
      userId: meta.userId,
      apiProvider: meta.provider,
      endpoint: meta.endpoint || url.substring(0, 200),
      model: meta.model || null,
      totalTokens: 0,
      responseTime: elapsed,
      status,
      errorMessage,
      metadata: { source: 'tracked-get', url: url.substring(0, 200) },
    }).catch(() => {});
  }
}

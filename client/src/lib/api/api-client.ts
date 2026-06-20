import { logger } from "../logger";
/**
 * API client for making requests to the server
 * Wraps fetch with common options and error handling
 */

// Base URL for API requests
const API_BASE_URL = '/api';

// Default options for fetch requests
const DEFAULT_OPTIONS: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Make a request to the API
 * @param endpoint The API endpoint to request
 * @param options Additional fetch options
 * @returns Promise with the response data
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Combine the endpoint with the base URL
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Merge default options with provided options
  const fetchOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Parse the response as JSON
    const data = await response.json();
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(data.error || 'An unknown error occurred');
    }
    
    return data as T;
  } catch (error) {
    logger.error('API request error:', error);
    throw error;
  }
}
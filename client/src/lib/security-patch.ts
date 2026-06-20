import { logger } from "./logger";

/**
 * Security utility to prevent sensitive credentials from being exposed in the browser
 */

// Create a proxy handler that prevents direct access to sensitive keys in development
const createSecureEnvProxy = () => {
  // List of sensitive environment variables that should be protected
  const sensitiveKeys = [
    'FAL_API_KEY', 'OPENAI_API_KEY', 'VITE_FAL_API_KEY', 'VITE_OPENAI_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'
  ];

  return new Proxy(import.meta.env, {
    get(target, prop) {
      if (
        typeof prop === 'string' && 
        sensitiveKeys.some(key => prop.includes(key))
      ) {
        // Only log in development, not in production
        if (import.meta.env.DEV) {
          logger.warn(`Attempted to access sensitive key ${String(prop)} directly in the browser. Use server-side API instead.`);
        }
        return '[PROTECTED]';
      }
      return target[prop as keyof typeof target];
    }
  });
};

// Export a secure version of environment variables
export const secureEnv = createSecureEnvProxy();

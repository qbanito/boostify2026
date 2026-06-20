type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const isDevelopment = process.env.NODE_ENV === 'development';

const createLogger = (): Logger => {
  const shouldLog = (level: LogLevel): boolean => {
    if (level === 'error') return true;
    return isDevelopment;
  };

  return {
    log: (...args: any[]) => {
      if (shouldLog('log')) console.log(...args);
    },
    
    warn: (...args: any[]) => {
      if (shouldLog('warn')) console.warn(...args);
    },
    
    error: (...args: any[]) => {
      if (shouldLog('error')) console.error(...args);
    },
    
    info: (...args: any[]) => {
      if (shouldLog('info')) console.info(...args);
    },
    
    debug: (...args: any[]) => {
      if (shouldLog('debug')) console.debug(...args);
    },
  };
};

export const logger = createLogger();

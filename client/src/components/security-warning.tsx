
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function SecurityWarning() {
  const [showWarning, setShowWarning] = useState(false);
  
  useEffect(() => {
    // Listen for security warnings in the console
    const originalConsoleWarn = console.warn;
    
    console.warn = function(...args) {
      const warningText = args.join(' ');
      
      // Check for specific security warnings
      if (
        warningText.includes('credentials are exposed') || 
        warningText.includes('API key') ||
        warningText.includes('not recommended for production')
      ) {
        setShowWarning(true);
      }
      
      // Call original console.warn
      originalConsoleWarn.apply(console, args);
    };
    
    return () => {
      console.warn = originalConsoleWarn;
    };
  }, []);
  
  if (!showWarning) return null;
  
  return (
    <Alert className="fixed bottom-4 right-4 z-50 max-w-md border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle>Security Warning</AlertTitle>
      <AlertDescription>
        Some API credentials are exposed in the browser. This is fine for development, but not recommended for production.
        <div className="mt-2">
          <button 
            className="text-xs text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
            onClick={() => setShowWarning(false)}
          >
            Dismiss
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

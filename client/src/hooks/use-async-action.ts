import { useState, useCallback } from "react";
import { useToast } from "./use-toast";

interface AsyncActionOptions {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useAsyncAction<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  options: AsyncActionOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const execute = useCallback(
    async (...args: T) => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await action(...args);
        
        if (options.successTitle) {
          toast({
            title: options.successTitle,
            description: options.successDescription,
          });
        }
        
        options.onSuccess?.();
        
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        if (options.errorTitle) {
          toast({
            title: options.errorTitle,
            description: options.errorDescription || error.message,
            variant: "destructive",
          });
        }
        
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [action, options, toast]
  );

  return { execute, isLoading, error };
}

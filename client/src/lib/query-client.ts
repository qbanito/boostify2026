import { 
  QueryClient, 
  useMutation, 
  useQuery 
} from '@tanstack/react-query';

/**
 * Cliente de consulta global para React Query
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

/**
 * Opciones para las solicitudes API
 */
interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  body?: any;
}

/**
 * Función para realizar solicitudes a la API
 * 
 * @param endpoint Ruta de la API
 * @param options Opciones de la solicitud
 * @returns Respuesta de la API
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, body, ...init } = options;
  
  // Construir URL con parámetros
  const url = new URL(endpoint, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  // Configurar opciones de fetch
  const fetchOptions: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  };
  
  // Añadir cuerpo JSON si es necesario
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  // Realizar la solicitud
  const response = await fetch(url.toString(), fetchOptions);
  
  // Manejar errores de respuesta
  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error: ${response.status}`);
    } catch (e) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
  }
  
  // Si la respuesta está vacía (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }
  
  // Devolver datos JSON
  return response.json();
}

export default queryClient;
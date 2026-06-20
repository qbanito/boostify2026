/**
 * Módulo API principal para gestionar peticiones al servidor
 */

/**
 * Función para realizar solicitudes a la API del servidor
 * 
 * @param url URL de la API a la que realizar la solicitud
 * @param options Opciones de fetch (método, cuerpo, headers, etc.)
 * @returns Datos de la respuesta
 */
export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  // Asegurarse de que las opciones incluyan los headers correctos
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Realizar la solicitud
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Importante para enviar cookies en peticiones cross-origin
  });

  // Si la respuesta no es exitosa, lanzar un error
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: 'Error del servidor',
    }));

    throw new Error(
      errorData.message || `Error ${response.status}: ${response.statusText}`
    );
  }

  // Devolver los datos de la respuesta
  return response.json();
}
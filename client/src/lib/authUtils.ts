/**
 * Utilidades para manejar errores de autenticación de Replit Auth
 */

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

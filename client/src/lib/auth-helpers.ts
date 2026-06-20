/**
 * Utilidades para autenticación y gestión de tokens
 */

import { auth } from './firebase';
import { getAuthToken as getFirebaseAuthToken } from './firebase';

/**
 * Obtiene el ID del usuario actual autenticado
 * @returns ID del usuario o null si no hay usuario autenticado
 */
export function getUserId(): string | null {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

/**
 * Obtiene el token de autenticación del usuario actual
 * Utiliza la función de firebase.ts para evitar duplicación
 * @returns Promise con el token o null si no hay usuario autenticado
 */
export const getAuthToken = getFirebaseAuthToken;

/**
 * Verifica si el usuario actual está autenticado
 * @returns Si hay un usuario autenticado
 */
export function isAuthenticated(): boolean {
  return !!auth.currentUser;
}

/**
 * Obtiene el email del usuario autenticado
 * @returns Email del usuario o null si no está autenticado
 */
export function getUserEmail(): string | null {
  const user = auth.currentUser;
  return user?.email || null;
}

/**
 * Obtiene el nombre de visualización del usuario
 * @returns Nombre del usuario o null si no está autenticado
 */
export function getUserDisplayName(): string | null {
  const user = auth.currentUser;
  return user?.displayName || null;
}

/**
 * Obtiene la URL de la foto de perfil del usuario
 * @returns URL de la foto de perfil o null si no está autenticado o no tiene foto
 */
export function getUserPhotoURL(): string | null {
  const user = auth.currentUser;
  return user?.photoURL || null;
}
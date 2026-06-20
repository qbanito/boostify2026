/**
 * Directores de Videos Musicales con Perfiles Detallados
 * 
 * Este módulo exporta todos los perfiles de directores disponibles.
 * Cada director tiene un JSON completo con su estilo, técnicas, preferencias, etc.
 */

import type { DirectorProfile } from './director-schema';

// Import JSON files
import sofiaRamirezData from './sofia-ramirez.json';
import marcusChenData from './marcus-chen.json';
import isabellaMorettiData from './isabella-moretti.json';
import davidKimData from './david-kim.json';
import amaraJohnsonData from './amara-johnson.json';
import carlosRodriguezData from './carlos-rodriguez.json';
import yukiTanakaData from './yuki-tanaka.json';
import elenaPetrovData from './elena-petrov.json';
import michaelBrooksData from './michael-brooks.json';
import davidOConnorData from './david-oconnor.json';
import elenaRodriguezData from './elena-rodriguez.json';
import alexThompsonData from './alex-thompson.json';
import jamesWilsonData from './james-wilson.json';
import ninaPatelData from './nina-patel.json';

// Export typed director profiles (14 directores completos)
export const DIRECTORS: DirectorProfile[] = [
  sofiaRamirezData as DirectorProfile,
  marcusChenData as DirectorProfile,
  isabellaMorettiData as DirectorProfile,
  davidKimData as DirectorProfile,
  amaraJohnsonData as DirectorProfile,
  carlosRodriguezData as DirectorProfile,
  yukiTanakaData as DirectorProfile,
  elenaPetrovData as DirectorProfile,
  michaelBrooksData as DirectorProfile,
  davidOConnorData as DirectorProfile,
  elenaRodriguezData as DirectorProfile,
  alexThompsonData as DirectorProfile,
  jamesWilsonData as DirectorProfile,
  ninaPatelData as DirectorProfile,
];

// Export individual directors for direct access
export const SOFIA_RAMIREZ = sofiaRamirezData as DirectorProfile;
export const MARCUS_CHEN = marcusChenData as DirectorProfile;
export const ISABELLA_MORETTI = isabellaMorettiData as DirectorProfile;
export const DAVID_KIM = davidKimData as DirectorProfile;
export const AMARA_JOHNSON = amaraJohnsonData as DirectorProfile;
export const CARLOS_RODRIGUEZ = carlosRodriguezData as DirectorProfile;
export const YUKI_TANAKA = yukiTanakaData as DirectorProfile;
export const ELENA_PETROV = elenaPetrovData as DirectorProfile;
export const MICHAEL_BROOKS = michaelBrooksData as DirectorProfile;
export const DAVID_OCONNOR = davidOConnorData as DirectorProfile;
export const ELENA_RODRIGUEZ = elenaRodriguezData as DirectorProfile;
export const ALEX_THOMPSON = alexThompsonData as DirectorProfile;
export const JAMES_WILSON = jamesWilsonData as DirectorProfile;
export const NINA_PATEL = ninaPatelData as DirectorProfile;

/**
 * Get director by ID
 * @param id Director ID
 * @returns DirectorProfile or undefined
 */
export function getDirectorById(id: string): DirectorProfile | undefined {
  return DIRECTORS.find(director => director.id === id);
}

/**
 * Get director by name
 * @param name Director name
 * @returns DirectorProfile or undefined
 */
export function getDirectorByName(name: string): DirectorProfile | undefined {
  return DIRECTORS.find(director => director.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get all directors
 * @returns Array of all DirectorProfiles
 */
export function getAllDirectors(): DirectorProfile[] {
  return DIRECTORS;
}

// Export types
export type { DirectorProfile };

/**
 * Cinematographers Database - Hollywood Level
 * Directores de Fotografía legendarios que trabajarán con los directores
 */

import type { CinematographerProfile } from './cinematographer-schema';

import januszData from './janusz-kaminski.json';
import emmanuelData from './emmanuel-lubezki.json';
import rogerData from './roger-deakins.json';
import harisData from './haris-zambarloukos.json';
import vittorioData from './vittorio-storaro.json';
import robertData from './robert-richardson.json';
import bradfordData from './bradford-young.json';
import michaelData from './michael-chapman.json';

export const CINEMATOGRAPHERS: CinematographerProfile[] = [
  januszData as CinematographerProfile,
  emmanuelData as CinematographerProfile,
  rogerData as CinematographerProfile,
  harisData as CinematographerProfile,
  vittorioData as CinematographerProfile,
  robertData as CinematographerProfile,
  bradfordData as CinematographerProfile,
  michaelData as CinematographerProfile,
];

export const JANUSZ_KAMINSKI = januszData as CinematographerProfile;
export const EMMANUEL_LUBEZKI = emmanuelData as CinematographerProfile;
export const ROGER_DEAKINS = rogerData as CinematographerProfile;
export const HARIS_ZAMBARLOUKOS = harisData as CinematographerProfile;
export const VITTORIO_STORARO = vittorioData as CinematographerProfile;
export const ROBERT_RICHARDSON = robertData as CinematographerProfile;
export const BRADFORD_YOUNG = bradfordData as CinematographerProfile;
export const MICHAEL_CHAPMAN = michaelData as CinematographerProfile;

/**
 * Director-DP Optimal Pairings for cinematographic coherence
 */
export const OPTIMAL_DIRECTOR_DP_PAIRINGS: Record<string, string> = {
  'sofia-ramirez': 'haris-zambarloukos', // Urban energy
  'marcus-chen': 'roger-deakins', // Technical mastery
  'isabella-moretti': 'vittorio-storaro', // Romantic cinematography
  'david-kim': 'janusz-kaminski', // Emotional depth
  'amara-johnson': 'emmanuel-lubezki', // Natural poetry
  'carlos-rodriguez': 'michael-chapman', // Urban grit
  'yuki-tanaka': 'roger-deakins', // Precision + innovation
  'elena-petrov': 'janusz-kaminski', // Emotional landscapes
  'michael-brooks': 'robert-richardson', // Bold style
  'david-oconnor': 'bradford-young', // Intimate psychology
  'elena-rodriguez': 'vittorio-storaro', // Color mastery
  'alex-thompson': 'emmanuel-lubezki', // Natural beauty
  'james-wilson': 'michael-chapman', // Urban narrative
  'nina-patel': 'roger-deakins', // Contemporary precision
};

/**
 * Get cinematographer by ID
 */
export function getCinematographerById(id: string): CinematographerProfile | undefined {
  return CINEMATOGRAPHERS.find(dp => dp.id === id);
}

/**
 * Get cinematographer by name
 */
export function getCinematographerByName(name: string): CinematographerProfile | undefined {
  return CINEMATOGRAPHERS.find(dp => dp.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get optimal DP for director
 */
export function getOptimalDPForDirector(directorId: string): CinematographerProfile | undefined {
  const dpId = OPTIMAL_DIRECTOR_DP_PAIRINGS[directorId];
  return dpId ? getCinematographerById(dpId) : undefined;
}

/**
 * Get all cinematographers
 */
export function getAllCinematographers(): CinematographerProfile[] {
  return CINEMATOGRAPHERS;
}

export type { CinematographerProfile };

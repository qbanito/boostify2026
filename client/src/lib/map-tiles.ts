/** Shared basemap credentials and no-key fallback for all Boostify maps. */
export const CARTO_API_KEY = import.meta.env.CARTO_API_KEY?.trim() || '';

export const CARTO_DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export const OPEN_STREET_MAP_TILE_URL =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const OPEN_STREET_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function withCartoApiKey(url: string): string {
  if (!CARTO_API_KEY || !url.includes('basemaps.cartocdn.com')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(CARTO_API_KEY)}`;
}

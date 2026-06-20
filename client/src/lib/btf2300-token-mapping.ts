/**
 * BTF-2300 Token Mapping
 * 
 * Este archivo mapea los artistas de la UI a los tokenIds reales del contrato BTF-2300
 * Contrato: 0x16ba188e438b4ebc7edc6acb49bdc1256de2f027 (Polygon Mainnet)
 * 
 * ESTADO DEL CONTRATO (verificado en Enero 2026):
 * - 7 artistas registrados
 * - 8 canciones tokenizadas
 * - Precio: 0.001 MATIC por token
 * - Supply: 10,000 tokens por canción
 */

// Prefijos de tokenId según el contrato BTF-2300
export const TOKEN_PREFIXES = {
  ARTIST: 1_000_000_000,   // 1B+ para artistas
  SONG: 2_000_000_000,     // 2B+ para canciones
  CATALOG: 3_000_000_000,  // 3B+ para catálogos
  LICENSE: 4_000_000_000,  // 4B+ para licencias
} as const;

// Artistas registrados en el contrato (7 artistas)
export const REGISTERED_ARTISTS = [
  { contractId: 1, name: "Test Artist V2", wallet: null },
  { contractId: 2, name: "Marcus Cole", wallet: null },
  { contractId: 3, name: "The Midnight Echoes", wallet: null },
  { contractId: 4, name: "Sarah Chen", wallet: null },
  { contractId: 5, name: "Django Rhythms", wallet: null },
  { contractId: 6, name: "Northern Lights", wallet: null },
  { contractId: 7, name: "Reel", wallet: null },
] as const;

// Canciones tokenizadas en el contrato (8 canciones)
export const TOKENIZED_SONGS = [
  { tokenId: 2000000001, artistId: 1, title: "Song 1", supply: 10000, price: "0.001" },
  { tokenId: 2000000002, artistId: 2, title: "Song 2", supply: 10000, price: "0.001" },
  { tokenId: 2000000003, artistId: 3, title: "Song 3", supply: 10000, price: "0.001" },
  { tokenId: 2000000004, artistId: 4, title: "Song 4", supply: 10000, price: "0.001" },
  { tokenId: 2000000005, artistId: 5, title: "Song 5", supply: 10000, price: "0.001" },
  { tokenId: 2000000006, artistId: 6, title: "Song 6", supply: 10000, price: "0.001" },
  { tokenId: 2000000007, artistId: 7, title: "Song 7", supply: 10000, price: "0.001" },
  { tokenId: 2000000008, artistId: 7, title: "Song 8", supply: 10000, price: "0.001" },
] as const;

// Precio del contrato en MATIC
export const CONTRACT_PRICE_MATIC = "0.001";

// Mapeo de UI artistId a tokenId de canción del contrato
// Artistas UI 1-8 → TokenIds 2000000001-2000000008
export function getContractTokenId(uiArtistId: number): bigint {
  // Si el artistId está en el rango 1-8, mapear directamente a los songs tokenizados
  if (uiArtistId >= 1 && uiArtistId <= 8) {
    return BigInt(TOKEN_PREFIXES.SONG + uiArtistId);
  }
  // Para IDs fuera de rango, usar modulo para ciclar
  const mappedId = ((uiArtistId - 1) % 8) + 1;
  return BigInt(TOKEN_PREFIXES.SONG + mappedId);
}

// Verificar si un artistId de la UI tiene un token disponible en el contrato
export function hasContractToken(uiArtistId: number): boolean {
  return uiArtistId >= 1 && uiArtistId <= 8;
}

// Obtener información del token del contrato
export function getContractTokenInfo(uiArtistId: number) {
  const mappedId = ((uiArtistId - 1) % 8) + 1;
  const song = TOKENIZED_SONGS.find(s => s.tokenId === TOKEN_PREFIXES.SONG + mappedId);
  return song || null;
}

// Mapeo de nombre de artista UI a artista del contrato
export function findContractArtist(uiArtistName: string) {
  const nameLower = uiArtistName.toLowerCase();
  return REGISTERED_ARTISTS.find(a => 
    a.name.toLowerCase().includes(nameLower) || 
    nameLower.includes(a.name.toLowerCase())
  );
}

// Obtener el siguiente ID disponible para registrar un nuevo artista
export function getNextArtistId(): number {
  return REGISTERED_ARTISTS.length + 1;
}

// Obtener el siguiente tokenId disponible para una nueva canción
export function getNextSongTokenId(): bigint {
  return BigInt(TOKEN_PREFIXES.SONG + TOKENIZED_SONGS.length + 1);
}

// Map artist IDs to their image URLs - served from public folder
export const artistImageMap: Record<number, string> = {
  1: "/artist-images/luna_echo_-_female_pop_singer.png",
  2: "/artist-images/urban_flow_-_hip-hop_artist.png",
  3: "/artist-images/electric_dreams_-_electronic_artist.png",
  4: "/artist-images/soul_harmony_-_r&b_artist.png",
  5: "/artist-images/maya_rivers_-_indie_folk.png",
  6: "/artist-images/jah_vibes_-_reggae_artist.png",
  7: "/artist-images/david_chen_-_classical_pianist.png",
  8: "/artist-images/sophia_kim_-_k-pop_star.png",
  9: "/artist-images/marcus_stone_-_jazz_saxophonist.png",
  10: "/artist-images/isabella_santos_-_reggaeton.png",
  11: "/artist-images/luke_bradley_-_country_artist.png",
  12: "/artist-images/aria_nova_-_ambient_electronic.png",
  13: "/artist-images/alex_thunder_-_trap_producer.png",
  14: "/artist-images/victoria_cross_-_opera_singer.png",
  15: "/artist-images/prince_diesel_-_funk_artist.png",
  16: "/artist-images/ryan_phoenix_-_indie_rock.png",
  17: "/artist-images/pablo_fuego_-_latin_artist.png",
  18: "/artist-images/emma_white_-_pop_princess.png",
  19: "/artist-images/chris_void_-_dubstep_producer.png",
  20: "/artist-images/james_grant_-_soul_singer.png",
};

export function getArtistImage(artistId: number): string {
  return artistImageMap[artistId] || "";
}

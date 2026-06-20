import { db } from './server/db.js';
import { tokenizedSongs } from './server/db/schema.js';

const artistImageMap = {
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

const CONTRACT = '0x0000000000000000000000000000000000000000';

const SONGS = [
  { id: 1, artistId: 1, name: "Moonlight Dreams", symbol: "LUNA", price: "2.45", available: 3500, total: 10000 },
  { id: 2, artistId: 2, name: "Urban Rhythm", symbol: "URBAN", price: "3.15", available: 5200, total: 15000 },
  { id: 3, artistId: 3, name: "Electric Pulse", symbol: "ELDREAM", price: "4.22", available: 1200, total: 8000 },
  { id: 4, artistId: 4, name: "Soul Connection", symbol: "SOUL", price: "2.88", available: 4100, total: 12000 },
  { id: 5, artistId: 5, name: "River Road", symbol: "MAYA", price: "1.99", available: 3200, total: 9000 },
  { id: 6, artistId: 6, name: "Reggae Sunset", symbol: "JAH", price: "2.15", available: 4100, total: 11000 },
  { id: 7, artistId: 7, name: "Classical Symphony", symbol: "CHEN", price: "5.50", available: 800, total: 5000 },
  { id: 8, artistId: 8, name: "K-Pop Dream", symbol: "SOPHIA", price: "3.80", available: 2500, total: 12000 },
  { id: 9, artistId: 9, name: "Jazz Nights", symbol: "MARCUS", price: "4.15", available: 1500, total: 7000 },
  { id: 10, artistId: 10, name: "Reggaeton Fire", symbol: "BELLA", price: "3.45", available: 3800, total: 13000 },
  { id: 11, artistId: 11, name: "Country Roads", symbol: "LUKE", price: "2.65", available: 3900, total: 10000 },
  { id: 12, artistId: 12, name: "Ambient Cosmos", symbol: "ARIA", price: "2.20", available: 4200, total: 8500 },
  { id: 13, artistId: 13, name: "Trap Beats", symbol: "ALEX", price: "3.55", available: 2800, total: 11000 },
  { id: 14, artistId: 14, name: "Opera Aria", symbol: "VICTORIA", price: "6.10", available: 600, total: 4000 },
  { id: 15, artistId: 15, name: "Funk Groove", symbol: "DIESEL", price: "3.90", available: 2200, total: 9500 },
  { id: 16, artistId: 16, name: "Rock Anthem", symbol: "RYAN", price: "3.25", available: 3600, total: 10500 },
  { id: 17, artistId: 17, name: "Latin Fire", symbol: "PABLO", price: "2.99", available: 4500, total: 12000 },
  { id: 18, artistId: 18, name: "Pop Perfection", symbol: "EMMA", price: "3.55", available: 3200, total: 13500 },
  { id: 19, artistId: 19, name: "Dubstep Drop", symbol: "VOID", price: "4.05", available: 1800, total: 9000 },
  { id: 20, artistId: 20, name: "Soul Serenade", symbol: "JAMES", price: "3.35", available: 3400, total: 11000 },
];

async function populate() {
  console.log('🌱 Populando 20 canciones tokenizadas...');
  
  for (const song of SONGS) {
    try {
      await db.insert(tokenizedSongs).values({
        tokenId: song.id,
        artistId: song.artistId,
        songName: song.name,
        tokenSymbol: song.symbol,
        pricePerTokenUsd: song.price,
        pricePerTokenEth: (parseFloat(song.price) * 0.0002).toFixed(4),
        contractAddress: CONTRACT,
        imageUrl: artistImageMap[song.artistId] || '',
        totalSupply: song.total,
        availableSupply: song.available,
        royaltyPercentageArtist: 80,
        royaltyPercentagePlatform: 20,
        metadataUri: `ipfs://QmXxSong${song.id}`,
        description: `Token for ${song.name}`,
        isActive: true,
        benefits: ['Royalty rights', 'VIP access', 'Exclusive content'],
        songUrl: null,
      });
      console.log(`✅ ${song.name}`);
    } catch (e) {
      console.error(`❌ ${song.name}:`, e.message);
    }
  }
  console.log('✅ ¡Completado!');
  process.exit(0);
}

populate().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

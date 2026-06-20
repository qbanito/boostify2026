import { seedTokenizedSongs } from './server/seed-tokenized-songs.js';

async function main() {
  console.log('🌱 Ejecutando seed de canciones tokenizadas...');
  try {
    await seedTokenizedSongs();
    console.log('✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
}

main();

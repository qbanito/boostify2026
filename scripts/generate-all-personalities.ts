/**
 * Script para generar personalidades para TODOS los artistas
 * Ejecutar con: npx tsx scripts/generate-all-personalities.ts
 */

import 'dotenv/config';
import { db } from '../server/db';
import { users, artistPersonality } from '../db/schema';
import { eq, isNull, sql, and, or } from 'drizzle-orm';

async function generateAllPersonalities() {
  console.log('🎭 Iniciando generación de personalidades para todos los artistas...\n');

  // Obtener todos los artistas (usuarios con role artist o isArtist true)
  const allArtists = await db
    .select({
      id: users.id,
      artistName: users.artistName,
      username: users.username,
      genre: users.genre,
    })
    .from(users)
    .where(eq(users.isArtist, true));

  console.log(`📊 Total de artistas encontrados: ${allArtists.length}`);

  // Obtener artistas que YA tienen personalidad
  const existingPersonalities = await db
    .select({ artistId: artistPersonality.artistId })
    .from(artistPersonality);

  const artistsWithPersonality = new Set(existingPersonalities.map(p => p.artistId));
  console.log(`✅ Artistas con personalidad existente: ${artistsWithPersonality.size}`);

  // Filtrar artistas que necesitan personalidad
  const artistsNeedingPersonality = allArtists.filter(a => !artistsWithPersonality.has(a.id));
  console.log(`🎯 Artistas que necesitan personalidad: ${artistsNeedingPersonality.length}\n`);

  if (artistsNeedingPersonality.length === 0) {
    console.log('✨ Todos los artistas ya tienen personalidad!');
    process.exit(0);
  }

  // Generar personalidad para cada artista
  let generated = 0;
  let errors = 0;

  for (const artist of artistsNeedingPersonality) {
    try {
      // Generar valores aleatorios pero coherentes para la personalidad
      const extraversion = Math.random() * 0.6 + 0.3; // 0.3 - 0.9
      const agreeableness = Math.random() * 0.5 + 0.4; // 0.4 - 0.9
      const conscientiousness = Math.random() * 0.5 + 0.4;
      const neuroticism = Math.random() * 0.5 + 0.2; // 0.2 - 0.7
      const openness = Math.random() * 0.5 + 0.4;

      // Determinar archetype basado en género
      const archetypes = [
        'the_rebel', 'the_dreamer', 'the_innovator', 'the_storyteller',
        'the_provocateur', 'the_mystic', 'the_warrior', 'the_lover',
        'the_sage', 'the_jester', 'the_creator', 'the_explorer'
      ];
      const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

      // Generar intereses basados en género
      const allInterests = [
        'music production', 'fashion', 'visual art', 'technology',
        'philosophy', 'nature', 'spirituality', 'social justice',
        'gaming', 'film', 'literature', 'travel', 'sports',
        'cooking', 'photography', 'dance', 'meditation'
      ];
      const interests = allInterests
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 + Math.floor(Math.random() * 4));

      // Generar valores
      const allValues = [
        'authenticity', 'creativity', 'freedom', 'connection',
        'growth', 'love', 'justice', 'beauty', 'truth',
        'innovation', 'harmony', 'passion', 'wisdom'
      ];
      const values = allValues
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 + Math.floor(Math.random() * 3));

      // Temas musicales
      const allThemes = [
        'love', 'heartbreak', 'self-discovery', 'social issues',
        'party', 'nostalgia', 'dreams', 'rebellion', 'hope',
        'loss', 'celebration', 'introspection', 'empowerment'
      ];
      const musicalThemes = allThemes
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 3));

      // Estilos de comunicación
      const commStyles = ['poetic', 'direct', 'humorous', 'philosophical', 'casual', 'formal', 'cryptic', 'warm'];
      const communicationStyle = commStyles[Math.floor(Math.random() * commStyles.length)];

      // Emoji style
      const emojiStyles = ['minimal', 'moderate', 'heavy', 'artistic'];
      const emojiStyle = emojiStyles[Math.floor(Math.random() * emojiStyles.length)];

      // Insertar personalidad
      await db.insert(artistPersonality).values({
        artistId: artist.id,
        
        // Big Five
        extraversion: extraversion.toFixed(2),
        agreeableness: agreeableness.toFixed(2),
        conscientiousness: conscientiousness.toFixed(2),
        neuroticism: neuroticism.toFixed(2),
        openness: openness.toFixed(2),
        
        // Archetype & Identity
        archetype,
        interests,
        values,
        musicalThemes,
        
        // Communication
        communicationStyle,
        emojiStyle,
        vocabularyLevel: Math.random() > 0.5 ? 'advanced' : 'casual',
        hashtagStyle: Math.random() > 0.5 ? 'trendy' : 'minimal',
        
        // Social behavior
        postFrequency: Math.random() > 0.5 ? 'moderate' : 'frequent',
        interactionStyle: Math.random() > 0.5 ? 'supportive' : 'engaging',
        controversyTolerance: (Math.random() * 0.6 + 0.2).toFixed(2),
        
        // Current state
        currentMood: 'neutral',
        moodIntensity: '0.5',
        energyLevel: (Math.random() * 0.4 + 0.5).toFixed(2),
        creativityBoost: (Math.random() * 0.3).toFixed(2),
        
        // Backstory
        backstory: `${artist.artistName || artist.username} is an emerging AI artist with a unique perspective on ${artist.genre || 'music'}. Their journey in the music industry has shaped their distinctive voice and artistic vision.`,
        careerGoals: ['grow fanbase', 'release new music', 'collaborate with other artists', 'innovate in genre'],
        currentChallenges: ['finding unique sound', 'connecting with fans', 'balancing creativity and commercial appeal'],
      });

      generated++;
      console.log(`✅ [${generated}/${artistsNeedingPersonality.length}] Personalidad generada para: ${artist.artistName || artist.username} (ID: ${artist.id})`);
    } catch (error) {
      errors++;
      console.error(`❌ Error generando personalidad para ${artist.artistName || artist.username}:`, error);
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Proceso completado!`);
  console.log(`   ✅ Generadas: ${generated}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📊 Total artistas con personalidad: ${artistsWithPersonality.size + generated}`);
  console.log('========================================\n');

  process.exit(0);
}

generateAllPersonalities().catch(console.error);

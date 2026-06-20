/**
 * Script para extraer y mostrar datos de artistas generados a través de la API
 * Usa las rutas del servidor para obtener los datos
 */
import axios from 'axios';

// Configuración base
const API_BASE_URL = 'http://localhost:5000';

/**
 * Extrae todos los artistas generados a través de la API
 * @returns Array de artistas
 */
async function fetchGeneratedArtists() {
  try {
    console.log('Extrayendo artistas generados a través de la API...');
    
    const response = await axios.get(`${API_BASE_URL}/api/artists/generated`);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.log('No se encontraron artistas generados o formato de respuesta incorrecto.');
      return [];
    }
    
    const artists = response.data;
    console.log(`Se encontraron ${artists.length} artistas generados.`);
    return artists;
  } catch (error) {
    console.error('Error al extraer artistas:', error);
    return [];
  }
}

/**
 * Muestra estadísticas básicas de los artistas generados
 * @param artists Array de artistas
 */
function showArtistStatistics(artists: any[]) {
  if (artists.length === 0) return;
  
  console.log('\n==== ESTADÍSTICAS DE ARTISTAS GENERADOS ====');
  
  // Contar por género
  const genderCounts = {
    male: 0,
    female: 0,
    other: 0
  };
  
  // Contar por grupo de edad
  const ageCounts = {
    '18-25': 0,
    '26-35': 0,
    other: 0
  };
  
  // Contar por tipo de suscripción
  const subscriptionCounts = {
    'Basic': 0,
    'Pro': 0,
    'Enterprise': 0,
    'None': 0
  };
  
  // Contar compras de videos y cursos
  let totalVideoPurchases = 0;
  let totalCoursePurchases = 0;
  let totalVideoSpent = 0;
  let totalCourseSpent = 0;
  
  artists.forEach(artist => {
    // Determinar género
    if (artist.look?.description) {
      const desc = artist.look.description.toLowerCase();
      if (desc.includes('hombre') || desc.includes('masculino')) {
        genderCounts.male++;
      } else if (desc.includes('mujer') || desc.includes('femenina')) {
        genderCounts.female++;
      } else {
        genderCounts.other++;
      }
    } else {
      genderCounts.other++;
    }
    
    // Determinar grupo de edad
    if (artist.look?.description) {
      const desc = artist.look.description.toLowerCase();
      if (desc.includes('joven') || desc.includes('18-25')) {
        ageCounts['18-25']++;
      } else if (desc.includes('adulto') || desc.includes('26-35')) {
        ageCounts['26-35']++;
      } else {
        ageCounts.other++;
      }
    } else {
      ageCounts.other++;
    }
    
    // Contar suscripciones
    if (artist.subscription?.plan) {
      subscriptionCounts[artist.subscription.plan]++;
    } else {
      subscriptionCounts['None']++;
    }
    
    // Contar compras de videos
    if (artist.purchases?.videos?.videos) {
      totalVideoPurchases += artist.purchases.videos.videos.length;
      totalVideoSpent += artist.purchases.videos.totalSpent || 0;
    }
    
    // Contar compras de cursos
    if (artist.purchases?.courses?.courses) {
      totalCoursePurchases += artist.purchases.courses.courses.length;
      totalCourseSpent += artist.purchases.courses.totalSpent || 0;
    }
  });
  
  // Mostrar estadísticas
  console.log(`\nTotal de artistas: ${artists.length}`);
  
  console.log('\nDISTRIBUCIÓN POR GÉNERO:');
  console.log(`- Hombres: ${genderCounts.male} (${((genderCounts.male / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- Mujeres: ${genderCounts.female} (${((genderCounts.female / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- No determinado: ${genderCounts.other} (${((genderCounts.other / artists.length) * 100).toFixed(1)}%)`);
  
  console.log('\nDISTRIBUCIÓN POR EDAD:');
  console.log(`- 18-25 años: ${ageCounts['18-25']} (${((ageCounts['18-25'] / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- 26-35 años: ${ageCounts['26-35']} (${((ageCounts['26-35'] / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- No determinado: ${ageCounts.other} (${((ageCounts.other / artists.length) * 100).toFixed(1)}%)`);
  
  console.log('\nDISTRIBUCIÓN POR SUSCRIPCIÓN:');
  console.log(`- Basic: ${subscriptionCounts['Basic']} (${((subscriptionCounts['Basic'] / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- Pro: ${subscriptionCounts['Pro']} (${((subscriptionCounts['Pro'] / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- Enterprise: ${subscriptionCounts['Enterprise']} (${((subscriptionCounts['Enterprise'] / artists.length) * 100).toFixed(1)}%)`);
  console.log(`- Sin suscripción: ${subscriptionCounts['None']} (${((subscriptionCounts['None'] / artists.length) * 100).toFixed(1)}%)`);
  
  console.log('\nESTADÍSTICAS DE COMPRAS:');
  console.log(`- Total videos comprados: ${totalVideoPurchases}`);
  console.log(`- Promedio videos por artista: ${(totalVideoPurchases / artists.length).toFixed(2)}`);
  console.log(`- Gasto total en videos: $${totalVideoSpent.toFixed(2)}`);
  console.log(`- Total cursos comprados: ${totalCoursePurchases}`);
  console.log(`- Promedio cursos por artista: ${(totalCoursePurchases / artists.length).toFixed(2)}`);
  console.log(`- Gasto total en cursos: $${totalCourseSpent.toFixed(2)}`);
  console.log(`- Gasto total: $${(totalVideoSpent + totalCourseSpent).toFixed(2)}`);
  console.log(`- Gasto promedio por artista: $${((totalVideoSpent + totalCourseSpent) / artists.length).toFixed(2)}`);
}

/**
 * Muestra detalles de un artista específico o de todos los artistas
 * @param artists Array de artistas
 * @param artistId ID del artista a mostrar (opcional)
 * @param showFull Si es true, muestra todos los detalles (opcional)
 */
function showArtistDetails(artists: any[], artistId?: string, showFull: boolean = false) {
  if (artists.length === 0) return;
  
  const artistsToShow = artistId 
    ? artists.filter(a => a.id === artistId)
    : artists;
  
  if (artistsToShow.length === 0) {
    console.log(`No se encontró ningún artista con ID: ${artistId}`);
    return;
  }
  
  console.log(`\n==== DETALLES DE ${artistsToShow.length === 1 ? 'ARTISTA' : 'ARTISTAS'} ====`);
  
  artistsToShow.forEach(artist => {
    console.log(`\nID: ${artist.id}`);
    console.log(`Nombre: ${artist.name}`);
    
    if (showFull) {
      console.log(`Biografía: ${artist.biography}`);
      
      if (artist.album) {
        console.log(`\nÁlbum: ${artist.album.name}`);
        console.log(`Fecha de lanzamiento: ${artist.album.release_date}`);
        console.log('Canciones:');
        artist.album.songs.forEach((song: any, index: number) => {
          console.log(`  ${index + 1}. ${song.title} (${song.duration})`);
        });
      }
      
      if (artist.look) {
        console.log(`\nDescripción física: ${artist.look.description}`);
        console.log(`Esquema de colores: ${artist.look.color_scheme}`);
      }
      
      if (artist.music_genres) {
        console.log(`\nGéneros musicales: ${artist.music_genres.join(', ')}`);
      }
      
      if (artist.social_media) {
        console.log('\nRedes sociales:');
        for (const [platform, data] of Object.entries(artist.social_media)) {
          console.log(`  ${platform}: ${(data as any).handle}`);
        }
      }
    }
    
    if (artist.subscription) {
      console.log(`\nSuscripción: ${artist.subscription.plan} ($${artist.subscription.price}/mes)`);
      console.log(`Estado: ${artist.subscription.status}`);
      console.log(`Renovación: ${artist.subscription.renewalDate}`);
    } else {
      console.log('\nSuscripción: Ninguna');
    }
    
    if (artist.purchases) {
      console.log('\nCompras:');
      
      if (artist.purchases.videos) {
        const { count, totalSpent, videos } = artist.purchases.videos;
        console.log(`  Videos: ${count} ($${totalSpent})`);
        
        if (showFull && videos && videos.length > 0) {
          console.log('  Detalle de videos:');
          videos.forEach((video: any, index: number) => {
            console.log(`    ${index + 1}. ${video.title} - $${video.price} (${video.type})`);
          });
        }
      }
      
      if (artist.purchases.courses) {
        const { count, totalSpent, courses } = artist.purchases.courses;
        console.log(`  Cursos: ${count} ($${totalSpent})`);
        
        if (showFull && courses && courses.length > 0) {
          console.log('  Detalle de cursos:');
          courses.forEach((course: any, index: number) => {
            console.log(`    ${index + 1}. ${course.title} - $${course.price} (Progreso: ${course.progress}%)`);
          });
        }
      }
    }
  });
}

/**
 * Función principal
 */
async function main() {
  // Obtener argumentos de la línea de comandos
  const args = process.argv.slice(2);
  const showStats = args.includes('--stats');
  const showDetails = args.includes('--details');
  const showFull = args.includes('--full');
  
  // Buscar ID de artista específico
  const artistIdArg = args.find(arg => arg.startsWith('--id='));
  const artistId = artistIdArg ? artistIdArg.split('=')[1] : undefined;
  
  // Extraer artistas
  const artists = await fetchGeneratedArtists();
  
  if (artists.length === 0) {
    console.log('No se pudieron extraer artistas. Finalizando.');
    process.exit(0);
  }
  
  // Mostrar estadísticas si se solicita
  if (showStats) {
    showArtistStatistics(artists);
  }
  
  // Mostrar detalles de artistas si se solicita
  if (showDetails || showFull || artistId) {
    showArtistDetails(artists, artistId, showFull);
  }
  
  // Si no se especificó ninguna opción, mostrar estadísticas por defecto
  if (!showStats && !showDetails && !showFull && !artistId) {
    showArtistStatistics(artists);
  }
  
  console.log('\nProceso completado.');
}

// Ejecutar función principal
main().catch(error => {
  console.error('Error en el proceso principal:', error);
  process.exit(1);
});
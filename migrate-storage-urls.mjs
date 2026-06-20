/**
 * Migración: Convierte URLs rotas de storage.googleapis.com
 * al formato correcto firebasestorage.googleapis.com/v0/b/...?alt=media
 * 
 * URLs rotas: https://storage.googleapis.com/artist-boost.firebasestorage.app/PATH
 * URLs correctas: https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/ENCODED_PATH?alt=media
 */

import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Convierte una URL rota al formato correcto de Firebase Storage
 */
function fixStorageUrl(url) {
  if (!url) return url;
  
  // Solo arreglar URLs del bucket de artist-boost con formato antiguo
  const OLD_PREFIX = 'https://storage.googleapis.com/artist-boost.firebasestorage.app/';
  if (!url.startsWith(OLD_PREFIX)) return url;
  
  const filePath = url.slice(OLD_PREFIX.length);
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/${encodedPath}?alt=media`;
}

/**
 * Migra una columna de una tabla
 */
async function migrateColumn(tableName, columnName, idColumn = 'id') {
  const result = await db.query(
    `SELECT ${idColumn}, ${columnName} FROM ${tableName} WHERE ${columnName} LIKE 'https://storage.googleapis.com/artist-boost.firebasestorage.app/%'`
  );
  
  if (result.rows.length === 0) {
    console.log(`  ✅ ${tableName}.${columnName}: sin URLs rotas`);
    return 0;
  }
  
  console.log(`  ⚠️  ${tableName}.${columnName}: ${result.rows.length} URLs a migrar`);
  
  let updated = 0;
  for (const row of result.rows) {
    const oldUrl = row[columnName];
    const newUrl = fixStorageUrl(oldUrl);
    
    await db.query(
      `UPDATE ${tableName} SET ${columnName} = $1 WHERE ${idColumn} = $2`,
      [newUrl, row[idColumn]]
    );
    
    console.log(`    ID ${row[idColumn]}: ${oldUrl.substring(40, 90)}... -> OK`);
    updated++;
  }
  
  return updated;
}

async function main() {
  await db.connect();
  console.log('🔗 Conectado a Neon PostgreSQL\n');
  
  let totalUpdated = 0;
  
  // Tablas y columnas que pueden tener URLs de Firebase Storage
  const migrations = [
    // Artistas
    { table: 'musicians',       columns: ['profile_image_url', 'loop_video_url'] },
    // Canciones
    { table: 'songs',           columns: ['audio_url', 'image_url', 'cover_image_url'] },
    // Cursos / media
    { table: 'course_lessons',  columns: ['video_url', 'image_url'] },
    { table: 'courses',         columns: ['image_url', 'video_url'] },
    // Merch
    { table: 'merch_items',     columns: ['image_url'] },
    // Videos de servicio
    { table: 'video_services',  columns: ['video_url', 'image_url'] },
    // Clips de editor
    { table: 'editor_projects', columns: ['thumbnail_url', 'final_video_url'] },
    // Tokens / NFTs
    { table: 'artist_tokens',   columns: ['image_url', 'song_url'] },
    // Coreografías
    { table: 'choreographies',  columns: ['video_url', 'image_url'] },
    // Influencers
    { table: 'influencer_profiles', columns: ['profile_image_url'] },
    // Usuarios
    { table: 'users',           columns: ['profile_image_url', 'loop_video_url'] },
  ];
  
  for (const { table, columns } of migrations) {
    // Verificar si la tabla existe
    const exists = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
      [table]
    );
    
    if (exists.rows.length === 0) {
      console.log(`⏭️  Tabla "${table}" no existe, saltando...`);
      continue;
    }
    
    console.log(`📋 Tabla: ${table}`);
    
    for (const col of columns) {
      // Verificar que la columna existe
      const colExists = await db.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'`,
        [table, col]
      );
      
      if (colExists.rows.length === 0) {
        console.log(`  ⏭️  Columna "${col}" no existe en ${table}`);
        continue;
      }
      
      try {
        const n = await migrateColumn(table, col);
        totalUpdated += n;
      } catch (err) {
        console.error(`  ❌ Error en ${table}.${col}:`, err.message);
      }
    }
  }
  
  console.log(`\n✅ Migración completada: ${totalUpdated} registros actualizados`);
  
  // Verificación final
  console.log('\n🔍 Verificación: buscando URLs rotas restantes...');
  const tables = migrations.map(m => m.table);
  let remainingBroken = 0;
  
  for (const { table, columns } of migrations) {
    for (const col of columns) {
      try {
        const r = await db.query(
          `SELECT count(*) FROM ${table} WHERE ${col} LIKE 'https://storage.googleapis.com/artist-boost%'`
        );
        const count = parseInt(r.rows[0].count);
        if (count > 0) {
          console.log(`  ⚠️  ${table}.${col}: ${count} URLs rotas restantes`);
          remainingBroken += count;
        }
      } catch {}
    }
  }
  
  if (remainingBroken === 0) {
    console.log('  ✅ No quedan URLs rotas en la base de datos');
  }
  
  await db.end();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

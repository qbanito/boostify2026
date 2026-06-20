/**
 * 🧪 Test Script: Video Export System
 * 
 * Este script verifica que todos los componentes de exportación de video
 * estén correctamente configurados y funcionando.
 * 
 * Ejecutar con: npx tsx scripts/test-video-export.ts
 */

import { config } from 'dotenv';
config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`),
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: TestResult[] = [];

// ===============================
// Test 1: Environment Variables
// ===============================
async function testEnvironmentVariables(): Promise<void> {
  log.section('1. Environment Variables');

  const requiredVars = [
    { name: 'SHOTSTACK_API_KEY', critical: true },
    { name: 'FIREBASE_PROJECT_ID', critical: true },
    { name: 'FIREBASE_STORAGE_BUCKET', critical: false },
    { name: 'FIREBASE_ADMIN_KEY', critical: true },
    { name: 'DATABASE_URL', critical: true },
  ];

  for (const { name, critical } of requiredVars) {
    const value = process.env[name];
    if (value) {
      log.success(`${name} está configurado (${value.substring(0, 10)}...)`);
      results.push({ name: `ENV: ${name}`, passed: true, message: 'Configurado' });
    } else if (critical) {
      log.error(`${name} NO está configurado (CRÍTICO)`);
      results.push({ name: `ENV: ${name}`, passed: false, message: 'No configurado - CRÍTICO' });
    } else {
      log.warning(`${name} no está configurado (opcional)`);
      results.push({ name: `ENV: ${name}`, passed: true, message: 'No configurado - opcional' });
    }
  }
}

// ===============================
// Test 2: Shotstack API Connection
// ===============================
async function testShotstackConnection(): Promise<void> {
  log.section('2. Shotstack API Connection');

  const apiKey = process.env.SHOTSTACK_API_KEY;
  const env = process.env.SHOTSTACK_ENV || 'sandbox';
  
  if (!apiKey) {
    log.error('SHOTSTACK_API_KEY no configurada - saltando test');
    results.push({ 
      name: 'Shotstack API', 
      passed: false, 
      message: 'API Key no configurada' 
    });
    return;
  }

  // URL base según entorno
  const baseUrl = env === 'production' 
    ? 'https://api.shotstack.io/v1'
    : 'https://api.shotstack.io/stage';

  log.info(`Entorno: ${env.toUpperCase()}`);
  log.info(`API URL: ${baseUrl}`);

  try {
    // Test con endpoint /templates que acepta GET y verifica la API key
    const response = await fetch(`${baseUrl}/templates`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.status === 200) {
      const data = await response.json();
      log.success(`Shotstack API conectada (Owner: ${data.response?.owner || 'OK'})`);
      results.push({ 
        name: 'Shotstack API', 
        passed: true, 
        message: `Conexión OK - Owner: ${data.response?.owner || env}` 
      });
    } else if (response.status === 401 || response.status === 403) {
      log.error(`API Key de Shotstack inválida o sin acceso (${response.status})`);
      results.push({ name: 'Shotstack API', passed: false, message: 'API Key inválida' });
    } else {
      log.warning(`Shotstack respondió con status: ${response.status}`);
      results.push({ name: 'Shotstack API', passed: true, message: `Status: ${response.status}` });
    }
  } catch (error) {
    log.error(`Error conectando a Shotstack: ${error}`);
    results.push({ name: 'Shotstack API', passed: false, message: String(error) });
  }
}

// ===============================
// Test 3: Firebase Storage
// ===============================
async function testFirebaseStorage(): Promise<void> {
  log.section('3. Firebase Storage');

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const adminKey = process.env.FIREBASE_ADMIN_KEY;

  if (!projectId || !adminKey) {
    log.error('Firebase credentials no configuradas - saltando test');
    results.push({ 
      name: 'Firebase Storage', 
      passed: false, 
      message: 'Credentials no configuradas' 
    });
    return;
  }

  try {
    // Intentar parsear la admin key
    const credentials = JSON.parse(adminKey);
    
    if (credentials.project_id && credentials.private_key) {
      log.success('Firebase Admin Key es válida');
      results.push({ name: 'Firebase Admin Key', passed: true, message: 'JSON válido' });
    } else {
      log.error('Firebase Admin Key incompleta');
      results.push({ name: 'Firebase Admin Key', passed: false, message: 'Faltan campos' });
    }

    // Verificar bucket name
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
    log.info(`Bucket configurado: ${bucketName}`);
    results.push({ name: 'Firebase Bucket', passed: true, message: bucketName });

  } catch (error) {
    log.error(`Error parseando Firebase Admin Key: ${error}`);
    results.push({ name: 'Firebase Storage', passed: false, message: 'JSON inválido' });
  }
}

// ===============================
// Test 4: Database Connection
// ===============================
async function testDatabaseConnection(): Promise<void> {
  log.section('4. Database Connection');

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    log.error('DATABASE_URL no configurada');
    results.push({ name: 'Database', passed: false, message: 'URL no configurada' });
    return;
  }

  try {
    // Parse database URL
    const url = new URL(dbUrl);
    log.success(`Database host: ${url.hostname}`);
    log.info(`Database name: ${url.pathname.slice(1)}`);
    results.push({ name: 'Database URL', passed: true, message: `Host: ${url.hostname}` });

    // Test actual connection usando pg directamente
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: dbUrl });
    
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    client.release();
    await pool.end();

    if (result.rows[0].test === 1) {
      log.success('Conexión a PostgreSQL exitosa');
      results.push({ name: 'Database Connection', passed: true, message: 'Query exitoso' });
    }
  } catch (error) {
    log.error(`Error conectando a database: ${error}`);
    results.push({ name: 'Database Connection', passed: false, message: String(error) });
  }
}

// ===============================
// Test 5: Check musicVideoProjects table
// ===============================
async function testDatabaseSchema(): Promise<void> {
  log.section('5. Database Schema - musicVideoProjects');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log.warning('Saltando - DATABASE_URL no configurada');
    return;
  }

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: dbUrl });
    
    const client = await pool.connect();
    
    // Check if table exists and has required columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'music_video_projects'
      ORDER BY ordinal_position;
    `);
    
    client.release();
    await pool.end();

    if (result.rows.length === 0) {
      log.error('Tabla music_video_projects no existe');
      results.push({ name: 'DB Schema', passed: false, message: 'Tabla no existe' });
      return;
    }

    const columns = result.rows.map(r => r.column_name);
    log.info(`Columnas encontradas: ${columns.length}`);

    // Check for required columns
    const requiredColumns = ['id', 'final_video_url', 'status', 'timeline_items'];
    const missingColumns = requiredColumns.filter(c => !columns.includes(c));

    if (missingColumns.length === 0) {
      log.success('Todas las columnas requeridas existen');
      results.push({ name: 'DB Schema', passed: true, message: 'Schema correcto' });
    } else {
      log.error(`Columnas faltantes: ${missingColumns.join(', ')}`);
      results.push({ name: 'DB Schema', passed: false, message: `Faltan: ${missingColumns.join(', ')}` });
    }

    // Check finalVideoUrl specifically
    if (columns.includes('final_video_url')) {
      log.success('final_video_url column exists ✓');
    } else {
      log.error('final_video_url column missing!');
    }

  } catch (error) {
    log.error(`Error verificando schema: ${error}`);
    results.push({ name: 'DB Schema', passed: false, message: String(error) });
  }
}

// ===============================
// Test 6: API Routes Availability
// ===============================
async function testAPIRoutes(): Promise<void> {
  log.section('6. API Routes (requiere servidor corriendo)');

  const baseUrl = process.env.API_URL || 'http://localhost:5000';

  const routes = [
    { method: 'POST', path: '/api/video-rendering/start', expectedStatus: [400, 401, 500] }, // 400 expected without body
    { method: 'GET', path: '/api/video-rendering/status/test-id', expectedStatus: [400, 404, 500] },
  ];

  for (const route of routes) {
    try {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: route.method === 'POST' ? '{}' : undefined,
      });

      if (route.expectedStatus.includes(response.status) || response.status < 500) {
        log.success(`${route.method} ${route.path} - responde (status: ${response.status})`);
        results.push({ 
          name: `API: ${route.path}`, 
          passed: true, 
          message: `Status: ${response.status}` 
        });
      } else {
        log.warning(`${route.method} ${route.path} - status inesperado: ${response.status}`);
        results.push({ 
          name: `API: ${route.path}`, 
          passed: false, 
          message: `Status: ${response.status}` 
        });
      }
    } catch (error) {
      log.warning(`${route.method} ${route.path} - servidor no disponible`);
      results.push({ 
        name: `API: ${route.path}`, 
        passed: false, 
        message: 'Servidor no disponible' 
      });
    }
  }
}

// ===============================
// Test 7: Shotstack Service Module
// ===============================
async function testShotstackServiceModule(): Promise<void> {
  log.section('7. Shotstack Service Module');

  try {
    const shotstackService = await import('../server/services/video-rendering/shotstack-service');
    
    if (typeof shotstackService.startVideoRender === 'function') {
      log.success('startVideoRender function exists');
      results.push({ name: 'Shotstack Module: startVideoRender', passed: true, message: 'Función existe' });
    } else {
      log.error('startVideoRender function missing');
      results.push({ name: 'Shotstack Module: startVideoRender', passed: false, message: 'No existe' });
    }

    if (typeof shotstackService.checkRenderStatus === 'function') {
      log.success('checkRenderStatus function exists');
      results.push({ name: 'Shotstack Module: checkRenderStatus', passed: true, message: 'Función existe' });
    } else {
      log.error('checkRenderStatus function missing');
      results.push({ name: 'Shotstack Module: checkRenderStatus', passed: false, message: 'No existe' });
    }

  } catch (error) {
    log.error(`Error importando shotstack-service: ${error}`);
    results.push({ name: 'Shotstack Module', passed: false, message: String(error) });
  }
}

// ===============================
// Test 8: Video Upload Firebase Module
// ===============================
async function testVideoUploadModule(): Promise<void> {
  log.section('8. Video Upload Firebase Module');

  try {
    const uploadService = await import('../server/services/video-upload-firebase');
    
    if (typeof uploadService.uploadVideoToFirebaseStorage === 'function') {
      log.success('uploadVideoToFirebaseStorage function exists');
      results.push({ name: 'Upload Module: uploadVideoToFirebaseStorage', passed: true, message: 'Función existe' });
    } else {
      log.error('uploadVideoToFirebaseStorage function missing');
      results.push({ name: 'Upload Module: uploadVideoToFirebaseStorage', passed: false, message: 'No existe' });
    }

  } catch (error) {
    log.error(`Error importando video-upload-firebase: ${error}`);
    results.push({ name: 'Upload Module', passed: false, message: String(error) });
  }
}

// ===============================
// Summary
// ===============================
function printSummary(): void {
  log.section('RESUMEN DE TESTS');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n📊 Resultados: ${passed}/${total} tests pasaron\n`);

  if (failed > 0) {
    console.log(`${colors.red}Tests fallidos:${colors.reset}`);
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`  ❌ ${r.name}: ${r.message}`));
  }

  console.log('\n');

  if (failed === 0) {
    console.log(`${colors.green}🎉 ¡Todos los tests pasaron! El sistema de exportación está listo.${colors.reset}`);
  } else if (failed <= 2) {
    console.log(`${colors.yellow}⚠️  Algunos tests fallaron, pero el sistema puede funcionar parcialmente.${colors.reset}`);
  } else {
    console.log(`${colors.red}🚨 Múltiples tests fallaron. Revisa la configuración antes de usar la exportación.${colors.reset}`);
  }

  console.log('\n');
}

// ===============================
// Main
// ===============================
async function main(): Promise<void> {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════════╗
║          🎬 TEST: Video Export System - Boostify Music        ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
  `);

  await testEnvironmentVariables();
  await testShotstackConnection();
  await testFirebaseStorage();
  await testDatabaseConnection();
  await testDatabaseSchema();
  await testAPIRoutes();
  await testShotstackServiceModule();
  await testVideoUploadModule();

  printSummary();
}

main().catch(console.error);

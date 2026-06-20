#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('⚡ Iniciando servidor completo...');

// Forzar modo desarrollo
process.env.NODE_ENV = 'development';

// Ejecutar servidor con tsx directamente
const serverPath = join(__dirname, 'server', 'index.ts');
const server = spawn('tsx', ['watch', serverPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' }
});

server.on('error', (error) => {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Servidor terminado con código ${code}`);
  process.exit(code || 0);
});
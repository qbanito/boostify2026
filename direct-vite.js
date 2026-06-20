// Script para ejecutar directamente Vite sin otros servidores
import { spawn } from 'child_process';

// Ejecutar Vite directamente
console.log('⚡ Iniciando Vite para mostrar src/pages/home.tsx...');
const vite = spawn('vite', ['--host', '0.0.0.0', '--port', '5000', '--strictPort', 'false', '--cors'], {
  stdio: 'inherit',
  shell: true
});

vite.on('error', (error) => {
  console.error(`Error al iniciar Vite: ${error.message}`);
  process.exit(1);
});

vite.on('close', (code) => {
  console.log(`Vite process exited with code ${code}`);
  process.exit(code || 0);
});

// Manejar señales de terminación para cerrar Vite correctamente
process.on('SIGINT', () => {
  console.log('\nCerrando Vite...');
  vite.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nCerrando Vite...');
  vite.kill('SIGTERM');
});
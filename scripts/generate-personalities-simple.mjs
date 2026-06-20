/**
 * Script para generar personalidades para todos los artistas
 * Usa fetch a la API local
 */

import 'dotenv/config';

const API_URL = 'http://localhost:3000';

async function main() {
  console.log('🚀 Generando personalidades para todos los artistas...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/ai-social/generate-all-personalities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

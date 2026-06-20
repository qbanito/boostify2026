/**
 * 🎵 ENVIAR EMAILS DE PRUEBA - Todos los 10 templates
 * 
 * Envía los 10 emails de la secuencia a una dirección de prueba
 */

import { Resend } from 'resend';
import {
  ArtistLead,
  ARTIST_EMAIL_SEQUENCE,
  ARTIST_RESEND_API_KEY,
  ARTIST_FROM_EMAIL,
  ARTIST_FROM_NAME,
  personalizeSubject,
} from './artist-email-templates';

const resend = new Resend(ARTIST_RESEND_API_KEY);

// Lead de prueba
const testLead: ArtistLead = {
  id: 'test-lead-001',
  email: 'convoycubano@gmail.com',
  name: 'Artista Demo',
  artistName: 'DJ Convoy',
  genre: 'Electronic / House',
  platform: 'spotify',
  followers: 5000,
  source: 'test',
  status: 'new',
  currentSequence: 0,
  createdAt: new Date(),
};

async function sendTestEmails() {
  const targetEmail = 'convoycubano@gmail.com';
  
  console.log('\n🎵 BOOSTIFY MUSIC - Enviando Emails de Prueba');
  console.log('═'.repeat(50));
  console.log(`📧 Destinatario: ${targetEmail}`);
  console.log(`📤 Remitente: ${ARTIST_FROM_NAME} <${ARTIST_FROM_EMAIL}>`);
  console.log(`📋 Total de emails: ${ARTIST_EMAIL_SEQUENCE.length}`);
  console.log('═'.repeat(50));

  let sent = 0;
  let failed = 0;

  for (const template of ARTIST_EMAIL_SEQUENCE) {
    const subject = `[TEST ${template.sequenceNumber}/10] ${personalizeSubject(template, testLead)}`;
    const htmlContent = template.generateHTML(testLead);

    console.log(`\n📤 Enviando Email ${template.sequenceNumber}/10...`);
    console.log(`   Asunto: ${subject}`);

    try {
      const response = await resend.emails.send({
        from: `${ARTIST_FROM_NAME} <${ARTIST_FROM_EMAIL}>`,
        to: targetEmail,
        subject: subject,
        html: htmlContent,
        tags: [
          { name: 'type', value: 'test' },
          { name: 'sequence', value: String(template.sequenceNumber) },
        ],
      });

      if (response.data?.id) {
        console.log(`   ✅ Enviado! ID: ${response.data.id}`);
        sent++;
      } else {
        console.log(`   ❌ Error: ${JSON.stringify(response.error)}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }

    // Esperar 1 segundo entre emails para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(50));
  console.log(`   ✅ Enviados: ${sent}`);
  console.log(`   ❌ Fallidos: ${failed}`);
  console.log(`\n📬 Revisa tu bandeja de entrada en: ${targetEmail}`);
  console.log('   (También revisa la carpeta de spam/promociones)');
}

sendTestEmails().catch(console.error);

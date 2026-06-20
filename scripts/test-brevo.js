// Test Brevo Email
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const msg = {
  sender: { email: 'info@boostifymusic.com', name: 'Boostify Music' },
  to: [{ email: 'convoycubano@gmail.com' }],
  subject: '🧪 Test Email - Brevo Funcionando!',
  htmlContent: `
    <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8B5CF6; margin: 0 0 20px 0;">🎵 Boostify Music</h1>
      <p style="color: white; font-size: 16px; line-height: 1.6;">
        Este es un email de prueba. <strong style="color: #10B981;">Brevo está funcionando correctamente!</strong>
      </p>
      <p style="color: #EC4899; font-size: 14px; margin-top: 30px;">
        Enviado: ${new Date().toLocaleString()}
      </p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">© 2025 Boostify Music. All rights reserved.</p>
      </div>
    </div>
  `
};

fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'accept': 'application/json',
    'api-key': BREVO_API_KEY,
    'content-type': 'application/json'
  },
  body: JSON.stringify(msg)
})
  .then(res => res.json())
  .then((result) => {
    if (result.messageId) {
      console.log('✅ Email enviado exitosamente a convoycubano@gmail.com');
      console.log('Message ID:', result.messageId);
      process.exit(0);
    } else {
      console.error('❌ Error:', JSON.stringify(result, null, 2));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

import sgMail from '@sendgrid/mail';
import 'dotenv/config';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'convoycubano@gmail.com',
  from: { email: 'info@boostifymusic.com', name: 'Boostify Music' },
  subject: '🧪 Test Email - SendGrid Funcionando!',
  html: `
    <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8B5CF6; margin: 0 0 20px 0;">🎵 Boostify Music</h1>
      <p style="color: white; font-size: 16px; line-height: 1.6;">
        Este es un email de prueba. <strong style="color: #10B981;">SendGrid está funcionando correctamente!</strong>
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

sgMail.send(msg)
  .then((response) => {
    console.log('✅ Email enviado exitosamente a convoycubano@gmail.com');
    console.log('Status:', response[0].statusCode);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', JSON.stringify(error.response?.body || error, null, 2));
    process.exit(1);
  });

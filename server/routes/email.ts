import { Express, Request, Response } from 'express';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import { authenticate } from '../middleware/auth';

// Validación para los correos
const emailProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  recipientEmail: z.string().email(),
  subject: z.string(),
  message: z.string(),
  profileUrl: z.string().url().optional(),
  songUrl: z.string().url().optional(),
  contactType: z.enum(['radio', 'tv', 'movie', 'other'])
});

/**
 * Configura las rutas para envío de emails
 */
export function setupEmailRoutes(app: Express) {
  // Si hay una clave de API de SendGrid en las variables de entorno, inicializa el cliente
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  /**
   * Endpoint para enviar perfil de artista a contactos
   * Requiere autenticación
   */
  app.post('/api/email/send-profile', authenticate, async (req: Request, res: Response) => {
    try {
      // Verificamos que tengamos una API key de SendGrid
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'SendGrid API key not configured on server'
        });
      }

      // Validamos los datos del formulario
      const profileData = emailProfileSchema.parse(req.body);
      
      // Configuramos el email
      const msg = {
        to: profileData.recipientEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@boostifymusic.com', // Usar una dirección verificada en SendGrid
        subject: profileData.subject,
        text: `Mensaje de ${profileData.name} (${profileData.email}):\n\n${profileData.message}${
          profileData.profileUrl ? `\n\nPerfil del artista: ${profileData.profileUrl}` : ''
        }${
          profileData.songUrl ? `\n\nEscucha mi música: ${profileData.songUrl}` : ''
        }`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Perfil de Artista - Boostify Music</h2>
            <p><strong>De:</strong> ${profileData.name} (${profileData.email})</p>
            <p><strong>Tipo de contacto:</strong> ${
              profileData.contactType === 'radio' ? 'Radio' : 
              profileData.contactType === 'tv' ? 'Televisión' : 
              profileData.contactType === 'movie' ? 'Cine' : 'Otro'
            }</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
              ${profileData.message.replace(/\n/g, '<br>')}
            </div>
            ${profileData.profileUrl ? `
              <p style="margin-top: 20px;">
                <a href="${profileData.profileUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Ver Perfil del Artista</a>
              </p>
            ` : ''}
            ${profileData.songUrl ? `
              <p style="margin-top: 10px;">
                <a href="${profileData.songUrl}" style="display: inline-block; background-color: #7C3AED; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Escuchar Música</a>
              </p>
            ` : ''}
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #777; font-size: 12px;">
              Este email fue enviado a través de la plataforma Boostify Music para artistas.
            </p>
          </div>
        `
      };
      
      // Enviamos el email
      await sgMail.send(msg);
      
      // Respondemos éxito
      return res.json({
        success: true,
        message: 'Email enviado exitosamente'
      });
      
    } catch (error: any) {
      console.error('Error al enviar email:', error);
      
      // Determinamos el tipo de error
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Datos de perfil inválidos',
          details: error.errors
        });
      }
      
      // Error de SendGrid o cualquier otro
      return res.status(500).json({
        success: false,
        error: error.message || 'Error al enviar email'
      });
    }
  });

  /**
   * Endpoint para búsqueda simulada de contactos
   * Normalmente este endpoint se conectaría a una API externa o base de datos,
   * pero para demo generamos datos simulados
   */
  app.get('/api/contacts/search', async (req: Request, res: Response) => {
    try {
      const searchTerm = (req.query.q as string || '').toLowerCase();
      const type = req.query.type as string || 'all';
      
      // Simulamos un delay para la búsqueda
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generamos datos mock
      const mockContacts = [
        { id: 1, name: 'Juan Pérez', email: 'juan.perez@radioglobal.com', type: 'radio', region: 'España' },
        { id: 2, name: 'María Rodríguez', email: 'maria@tvnacional.com', type: 'tv', region: 'España' },
        { id: 3, name: 'Carlos Ramirez', email: 'carlos@productionfilms.com', type: 'movie', region: 'México' },
        { id: 4, name: 'Sofia Martinez', email: 'sofia@radiofm.mx', type: 'radio', region: 'México' },
        { id: 5, name: 'Alejandro Torres', email: 'alejandro@moviechannel.com', type: 'movie', region: 'Colombia' },
        { id: 6, name: 'Laura González', email: 'laura@tvnetwork.com', type: 'tv', region: 'Argentina' },
        { id: 7, name: 'Ricardo Alvarez', email: 'ricardo@radiostation.ar', type: 'radio', region: 'Argentina' },
        { id: 8, name: 'Ana Sánchez', email: 'ana@filmstudio.com', type: 'movie', region: 'Estados Unidos' },
        { id: 9, name: 'Miguel Fernández', email: 'miguel@radioonline.com', type: 'radio', region: 'Chile' },
        { id: 10, name: 'Carmen Ortiz', email: 'carmen@tvshows.cl', type: 'tv', region: 'Chile' }
      ];
      
      // Filtramos por término de búsqueda y tipo
      let results = mockContacts;
      
      if (searchTerm) {
        results = results.filter(contact => 
          contact.name.toLowerCase().includes(searchTerm) || 
          contact.email.toLowerCase().includes(searchTerm) || 
          contact.region.toLowerCase().includes(searchTerm)
        );
      }
      
      if (type !== 'all') {
        results = results.filter(contact => contact.type === type);
      }
      
      // Respondemos con los resultados
      return res.json(results);
      
    } catch (error: any) {
      console.error('Error en búsqueda de contactos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al buscar contactos'
      });
    }
  });
}
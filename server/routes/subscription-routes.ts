/**
 * Rutas protegidas por suscripción
 * 
 * Este módulo implementa rutas de ejemplo para diferentes niveles de suscripción
 * y funcionalidades específicas que requieren distintos niveles de acceso.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireSubscription } from '../middleware/auth';

// Crear un router para las rutas protegidas por suscripción
const router = Router();

/**
 * Ruta protegida - Requiere autenticación pero sin suscripción
 * Disponible para usuarios registrados incluso sin suscripción activa
 */
router.get('/authenticated', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Esta ruta requiere autenticación, pero no una suscripción específica',
    user: {
      uid: req.user?.uid,
      email: req.user?.email,
      role: req.user?.role,
      subscription: req.user?.subscription
    },
    access: 'authenticated'
  });
});

/**
 * Ruta básica - Requiere suscripción Basic o superior
 * Disponible para usuarios con suscripción Basic, Pro o Premium
 */
router.get('/basic', authenticate, requireSubscription('basic'), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Acceso a funcionalidades básicas. Tu suscripción Basic o superior te permite acceder a este contenido.',
    features: [
      'Cursos básicos de producción musical',
      'Análisis básico de canciones',
      'Generación básica de audio con IA',
      'Hasta 10 producciones mensuales'
    ],
    access: 'basic'
  });
});

/**
 * Ruta profesional - Requiere suscripción Pro o superior
 * Disponible para usuarios con suscripción Pro o Premium
 */
router.get('/pro', authenticate, requireSubscription('pro'), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Acceso a funcionalidades profesionales. Tu suscripción Pro o Premium te permite acceder a este contenido exclusivo.',
    features: [
      'Todas las funcionalidades Basic',
      'Cursos avanzados de producción musical',
      'Análisis detallado de canciones con IA',
      'Generación avanzada de audio con IA',
      'Hasta 30 producciones mensuales',
      'Acceso a herramientas de masterización'
    ],
    access: 'pro'
  });
});

/**
 * Ruta premium - Requiere suscripción Premium
 * Disponible sólo para usuarios con suscripción Premium
 */
router.get('/premium', authenticate, requireSubscription('premium'), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Acceso a funcionalidades premium. Tu suscripción Premium te permite acceder a nuestro contenido más exclusivo.',
    features: [
      'Todas las funcionalidades Pro',
      'Masterclasses exclusivas con artistas reconocidos',
      'Análisis predictivo de tendencias musicales',
      'Generación ilimitada de audio con IA',
      'Herramientas avanzadas de distribución musical',
      'Soporte personalizado 24/7',
      'Acceso temprano a nuevas funcionalidades'
    ],
    access: 'premium'
  });
});

/**
 * Ruta de información sobre niveles de suscripción
 * Proporciona detalles sobre los diferentes planes y sus características
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    plans: [
      {
        name: 'Free',
        price: 0,
        features: [
          'Acceso básico a la plataforma',
          'Visualización de tutoriales gratuitos',
          'Comunidad de artistas',
          'Funcionalidades limitadas'
        ]
      },
      {
        name: 'Basic',
        price: 59.99,
        features: [
          'Cursos básicos de producción musical',
          'Análisis básico de canciones',
          'Generación básica de audio con IA',
          'Hasta 10 producciones mensuales'
        ]
      },
      {
        name: 'Pro',
        price: 99.99,
        features: [
          'Todas las funcionalidades Basic',
          'Cursos avanzados de producción musical',
          'Análisis detallado de canciones con IA',
          'Generación avanzada de audio con IA',
          'Hasta 30 producciones mensuales',
          'Acceso a herramientas de masterización'
        ]
      },
      {
        name: 'Premium',
        price: 149.99,
        features: [
          'Todas las funcionalidades Pro',
          'Masterclasses exclusivas con artistas reconocidos',
          'Análisis predictivo de tendencias musicales',
          'Generación ilimitada de audio con IA',
          'Herramientas avanzadas de distribución musical',
          'Soporte personalizado 24/7',
          'Acceso temprano a nuevas funcionalidades'
        ]
      }
    ]
  });
});

export default router;
# Boostify Music Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Descripción
Boostify Music es una plataforma avanzada de música impulsada por IA que permite crear artistas virtuales con canciones generadas automáticamente usando FAL AI MiniMax, tokenización de música en blockchain, y herramientas de promoción para artistas.

**🚀 NUEVO: Sistema Automatizado de Investor Outreach**
Sistema inteligente de outreach a inversores en la industria musical con automatización completa via GitHub Actions.

## 🚀 Características Principales
- **Generación de Artistas con IA**: Crea artistas virtuales completos con biografía, imágenes y canciones
- **Música Generada por IA**: Canciones con voces reales usando FAL AI MiniMax Music V2
- **Tokenización de Música**: Sistema de tokens para canciones en blockchain
- **Perfiles de Artistas**: Páginas de perfil personalizables con múltiples secciones
- **Sistema de Suscripciones**: Planes con Stripe para acceso a funciones premium
- **Video Rendering**: Creación de videos musicales con Shotstack
- **🎯 Investor Outreach Automation**: Sistema automatizado para contactar inversores musicales

## 📊 Investor Outreach System

### Estadísticas Actuales
- **708 leads** en base de datos
- **700 leads nuevos** listos para outreach
- **8 emails enviados** exitosamente
- **Sistema operativo** 24/7 con GitHub Actions

### Características del Sistema
- **Automatización completa**: Extrae leads automáticamente cuando faltan (< 100)
- **Email templates profesionales**: Diseños atractivos con branding corporativo
- **Base de datos Firebase**: Almacenamiento seguro y escalable
- **Integración Apify**: Scraping desde Apollo, ZoomInfo, Lusha
- **GitHub Actions**: Automatización diaria para mantener leads frescos
- **Resend integration**: Servicio de email profesional

### Comandos del Sistema
```bash
# Ver estadísticas
npx tsx scripts/investor-outreach.ts stats

# Enviar emails (máximo 50 por defecto)
npx tsx scripts/investor-outreach.ts quick --force

# Importar leads desde Apify
npx tsx scripts/import-apify-leads.ts
```

## 🛠 Tecnologías Principales
- **Frontend**: React.js, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Express.js, Node.js
- **Base de Datos**: PostgreSQL (Neon), Firebase Firestore
- **Autenticación**: Clerk
- **Pagos**: Stripe
- **IA**: FAL AI (música/imágenes), OpenAI, Anthropic Claude
- **Storage**: Firebase Storage

## 📋 Requisitos
- Node.js 18+
- PostgreSQL (recomendado: Neon)
- Firebase proyecto configurado
- Cuentas: Clerk, Stripe, FAL AI

## 🔧 Instalación Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/Boostify.git
cd Boostify
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar base de datos
```bash
npm run db:migrate
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:5000`

## 🚀 Despliegue en Render

### Opción 1: Deploy Automático
1. Haz clic en el botón "Deploy to Render" arriba
2. Conecta tu cuenta de GitHub
3. Configura las variables de entorno en Render Dashboard

### Opción 2: Deploy Manual
1. Crea un nuevo **Web Service** en Render
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 18 o superior

### Variables de Entorno Requeridas en Render

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de PostgreSQL (Neon) |
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Service Account JSON (base64) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key |
| `CLERK_SECRET_KEY` | Clerk Secret Key |
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key |
| `FAL_KEY` | FAL AI API Key |
| `OPENAI_API_KEY` | OpenAI API Key |

> **Nota**: Para `FIREBASE_SERVICE_ACCOUNT_KEY`, codifica tu archivo JSON en base64:
> ```bash
> base64 -i your-firebase-adminsdk.json | tr -d '\n'
> ```

## 📁 Estructura del Proyecto
```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas de la aplicación
│   │   └── hooks/         # Custom hooks
├── server/                 # Backend Express
│   ├── routes/            # API routes
│   ├── services/          # Servicios (FAL, Stripe, etc)
│   └── index.ts           # Entry point
├── db/                     # Esquema de base de datos
├── shared/                 # Código compartido
└── public/                 # Assets estáticos
```

## 🔑 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo local |
| `npm run build` | Build para producción |
| `npm start` | Iniciar servidor de producción |
| `npm run db:migrate` | Aplicar migraciones |

## 📄 Licencia
MIT
|--------|-------------|
| `production-check.js` | Verifica la aplicación para detectar problemas de seguridad y rendimiento |
| `fix-typescript-errors.js` | Corrige errores comunes de TypeScript para permitir la compilación |
| `secure-build.js` | Construye la aplicación con medidas de seguridad adicionales |
| `performance-test.js` | Realiza pruebas de rendimiento en el entorno de producción |
| `production-build.sh` | Script automatizado que ejecuta todo el proceso de compilación segura |
| `startup.sh` | Script para iniciar la aplicación en producción con verificaciones |

### Opción recomendada: Proceso completo automatizado

La forma más sencilla de compilar para producción es usar el script automatizado que maneja todo el proceso:

```bash
./production-build.sh
```

Este script ejecutará automáticamente todos los pasos necesarios:
1. Verificar prerrequisitos (Node.js compatible)
2. Ejecutar verificaciones previas a la producción
3. Corregir errores de TypeScript
4. Ejecutar la compilación segura

### Pasos manuales (alternativa)

Si prefieres ejecutar los pasos manualmente, sigue esta secuencia:

#### 1. Verificación Pre-Producción

```bash
node production-check.js
```

Este script verificará:
- Variables de entorno necesarias
- Exposición de credenciales en el frontend
- Configuración de seguridad
- Optimizaciones de rendimiento

#### 2. Corregir errores de TypeScript (si es necesario)

```bash
node fix-typescript-errors.js
```

Este script corrige automáticamente:
- Módulos de tipos faltantes
- Errores de tipado en componentes específicos
- Dependencias faltantes con soluciones provisionales

#### 3. Construcción Segura para Producción

```bash
node secure-build.js
```

Este script realizará automáticamente:
- Creación de proxy seguro para APIs sensibles
- Optimización de la configuración de Vite
- Creación de archivo .env.production seguro
- Actualización del servidor con medidas de seguridad

#### 4. Iniciar en Producción

Para iniciar la aplicación en producción:

```bash
cd dist && node server.js
```

O utiliza el script de inicio automatizado:

```bash
./startup.sh
```

### 4. Pruebas de Rendimiento

Para evaluar el rendimiento de la aplicación en producción:

```bash
# Asegúrate de que la aplicación esté en ejecución
node performance-test.js
```

### Uso con PM2 (Recomendado para producción)

Para una gestión robusta de procesos en producción, recomendamos usar PM2:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar la aplicación con PM2
cd dist
pm2 start server.js --name "boostify-music"

# Configurar inicio automático en el arranque del servidor
pm2 startup
pm2 save

# Comandos útiles
pm2 logs boostify-music    # Ver logs en tiempo real
pm2 monit                  # Monitor de recursos
pm2 reload boostify-music  # Reiniciar sin tiempo de inactividad
pm2 stop boostify-music    # Detener la aplicación
```

### Variables de entorno para producción

El script `secure-build.js` generará automáticamente un archivo `.env.production` con las variables correctamente configuradas. Este archivo separará las variables que deben estar disponibles en el frontend (prefijadas con `VITE_`) de aquellas que deben mantenerse solo en el servidor.

Variables críticas para el servidor:
- `OPENAI_API_KEY` - Clave API de OpenAI
- `FAL_API_KEY` - Clave API de FAL AI
- `FIREBASE_ADMIN_CONFIG` - Configuración de Firebase Admin
- `NODE_ENV=production` - Define el entorno como producción
- `PORT=3000` - Puerto en el que se ejecutará la aplicación

Variables para el frontend (prefijadas con `VITE_`):
- `VITE_FIREBASE_API_KEY` - Clave API de Firebase (pública)
- `VITE_FIREBASE_AUTH_DOMAIN` - Dominio de autenticación de Firebase
- `VITE_FIREBASE_PROJECT_ID` - ID del proyecto de Firebase
- `VITE_API_URL` - URL base de la API (apuntará a los proxies seguros)

La aplicación en producción escuchará en el puerto 3000 (configurable con la variable `PORT`) y estará enlazada a `0.0.0.0` para garantizar accesibilidad externa.

## Estructura del proyecto

```
├── client/              # Frontend React con TypeScript
│   ├── public/          # Archivos estáticos
│   └── src/             # Código fuente del frontend
│       ├── components/  # Componentes de React
│       ├── hooks/       # Custom hooks
│       ├── lib/         # Utilidades y servicios
│       ├── pages/       # Componentes de página
│       ├── store/       # Estado global (Zustand)
│       └── types/       # Definiciones de tipos
├── server/              # Backend Express
│   ├── db/              # Configuración de base de datos
│   ├── middleware/      # Middleware Express
│   ├── routes/          # Rutas de API
│   └── services/        # Servicios de backend
├── db/                  # Esquemas y configuración de Drizzle
├── scripts/             # Scripts de utilidad
└── dist/                # Archivos de distribución (generados)
```

## API Endpoints

La API sigue la convención REST con el prefijo `/api/`. Principales endpoints:

### Endpoints de Monitoreo y Estado

- `/api/health` - Verificación rápida de salud del servidor (retorna 200 OK si el servidor está funcionando)
- `/api/status` - Estado detallado del servidor, que incluye:
  - Información del servidor (tiempo de actividad, entorno, versión)
  - Estado de la base de datos
  - Estado de configuración de servicios externos (Firebase, Stripe, OpenAI, etc.)
  - Métricas del sistema

### Endpoints Principales

- `/api/artist-generator/...` - Endpoints para generación de artistas
  - `/api/artist-generator/generate-artist` - Genera un nuevo artista aleatorio
  - `/api/artist-generator/regenerate-artist-field` - Regenera campos específicos de un artista
  - `/api/artist-generator/secure/...` - Endpoints protegidos que requieren autenticación
- `/api/firestore-social` - API para la red social
- `/api/contacts` - API para gestión de contactos de la industria

Consulta la documentación completa de la API en la carpeta `docs`.

## Seguridad en Producción

Para garantizar un entorno de producción seguro, se han implementado las siguientes medidas y recomendaciones adicionales:

### 1. Medidas de Seguridad Implementadas

- **Endpoints de Monitoreo**: `/api/health` y `/api/status` para monitoreo constante del sistema
- **Variables de Entorno Seguras**: Verificación de variables críticas al iniciar
- **Manejo de Errores Robusto**: Errores sanitizados para no exponer información sensible
- **Binding en 0.0.0.0**: Configuración adecuada para entornos de producción
- **Headers de Seguridad**: Implementados headers HTTP de seguridad
  ```javascript
  // Estos ya están implementados en el código de producción:
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  ```
- **PM2 Process Manager**: Gestión de procesos con reinicio automático y monitoreo

### 2. Recomendaciones Adicionales

#### HTTPS y Certificados SSL
Configura un certificado SSL/TLS válido para tu dominio de producción.
```bash
# Si usas Nginx como proxy, puedes configurar Let's Encrypt con Certbot
certbot --nginx -d tudominio.com
```

#### Cortafuegos y Restricciones de Red
Limita el acceso solo a los puertos necesarios.
```bash
# Ejemplo de configuración de firewall con ufw (Ubuntu)
ufw allow 80/tcp       # HTTP
ufw allow 443/tcp      # HTTPS
ufw allow 5000/tcp     # Puerto de la aplicación (si expones directamente)
```

#### Configuración de CORS
En producción, restringe CORS a dominios específicos:
```javascript
// En lugar de permitir todos los orígenes:
app.use(cors());

// Restringe a dominios específicos:
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://tudominio.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
```

#### Monitoreo y Alertas
Configura monitoreo de registros y alertas para detectar comportamientos anómalos.
```bash
# Monitoreo con PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5

# Para alertas, considera servicios como:
# - Datadog
# - New Relic
# - Sentry
```

#### Rotación de Secretos
Implementa un proceso regular de rotación para claves de API y tokens:
- Programa cambios regulares de credenciales (trimestral o semestral)
- Usa variables de entorno para facilitar la actualización
- Implementa un periodo de transición cuando cambies claves críticas

## Licencia
MIT
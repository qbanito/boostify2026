# Guía de Despliegue

Esta guía explica cómo desplegar la aplicación en diferentes entornos.

## Requisitos Previos

- Node.js (versión 18 o superior)
- NPM (versión 9 o superior)
- Acceso a las API Keys necesarias para las funcionalidades completas

## Despliegue en Replit (Actualizado)

1. Asegúrate de tener todos los secretos configurados en la sección "Secrets" del proyecto:
   - `OPENAI_API_KEY` (Para funcionalidades de IA)
   - `FAL_API_KEY` (Para generación de imágenes)
   - `FIREBASE_CONFIG` (Para autenticación y base de datos)
   - Otras claves según las funcionalidades que utilices

2. **Solución para errores de TypeScript y extensión de archivos**:
   Antes de desplegar, ejecuta estos comandos en orden:

   ```bash
   # Primero, construir el cliente (resuelve problemas de TypeScript)
   node build-client.js

   # Luego, iniciar el servidor de despliegue
   node start-deploy.js
   ```

3. **Para despliegue automático**:
   - Haz clic en el botón "Deploy" en la interfaz de Replit
   - Asegúrate de que el comando de ejecución en el panel de despliegue sea `node start-deploy.js`

4. **Importante**: El archivo `start-deploy.js` está optimizado para:
   - Iniciar rápidamente (necesario para que Replit reconozca el servidor)
   - Usar el puerto 3333 (requerido por Replit para despliegue)
   - Manejar errores de TypeScript y extensiones de archivo
   - Servir archivos estáticos desde múltiples ubicaciones posibles

5. Replit configurará automáticamente tu aplicación para producción y la hará accesible a través de una URL pública con formato `tu-proyecto.replit.app`.

## Despliegue Manual (Entorno de Producción)

1. Construye la aplicación para producción:
   ```
   node build-for-deploy.cjs
   ```

2. Ejecuta el servidor de producción:
   ```
   node deploy-start.cjs
   ```

3. La aplicación estará disponible en `http://localhost:3333` (o el puerto configurado en las variables de entorno).

## Variables de Entorno

Asegúrate de configurar las siguientes variables de entorno para el correcto funcionamiento de la aplicación:

- `PORT`: Puerto para el servidor (por defecto: 3000)
- `OPENAI_API_KEY`: Clave API de OpenAI
- `FAL_API_KEY`: Clave API de FAL AI
- `FIREBASE_CONFIG`: Configuración JSON de Firebase (escapada)

## Estructura de Archivos Importantes

### Desarrollo
- `direct-vite.js`: Script para ejecutar el servidor de desarrollo Vite
- `start.js`: Script principal que inicia la aplicación en desarrollo

### Despliegue
- `deploy.js`: **Script principal para despliegue en Replit** (recomendado)
- `build-for-deploy.cjs`: Script CommonJS para construir la aplicación para producción
- `deploy-start.cjs`: Script CommonJS para iniciar el servidor de producción
- `deploy-simple.cjs`: Script CommonJS para ejecutar construcción y despliegue en un solo paso
- `server-prod.js`: Servidor de producción con optimizaciones (compresión, caché)
- `production.js`: Script alternativo para construir y servir la aplicación

## Solución de Problemas

Si encuentras problemas durante el despliegue:

1. **Problemas con puertos**: Replit requiere que el servidor escuche en el puerto 3333. Si obtienes un error de "application failed to open a port in time", asegúrate de usar `deploy.js` que está optimizado para abrir el puerto rápidamente.

2. **Errores de módulo ESM/CommonJS**: Si recibes errores como `ERR_UNKNOWN_FILE_EXTENSION`, usa los archivos con extensión `.cjs` que están configurados para usar CommonJS.

3. **Problemas de construcción**:
   - Verifica que todas las variables de entorno estén correctamente configuradas
   - Asegúrate de que los archivos de construcción se han generado correctamente con `cd client && npx vite build` 
   - Revisa los logs del servidor para identificar posibles errores

4. **Si nada funciona**: Prueba estos pasos:
   - Ejecuta `node deploy.js` directamente antes de intentar el despliegue
   - Asegúrate de que el contenido de la carpeta `client/dist` exista y sea correcto
   - Verifica que no haya errores de sintaxis en los archivos de despliegue

## Seguridad

Nunca incluyas directamente las claves API en el código fuente. Siempre utiliza variables de entorno o el sistema de secretos de tu plataforma de despliegue.
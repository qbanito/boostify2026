# Guía de Construcción para Producción
# Production Build Guide

Esta guía explica cómo construir la aplicación para producción, asegurando que funcione correctamente como en desarrollo.

This guide explains how to build the application for production, ensuring it works correctly just like in development.

## Problema / Problem

El problema principal es que en producción no se resuelven correctamente los alias de rutas (`@/`), lo que causa que las importaciones fallen. En desarrollo todo funciona bien, pero al construir para producción, el proceso falla.

The main issue is that path aliases (`@/`) are not properly resolved in production, causing import failures. Everything works fine in development, but when building for production, the process fails.

## Soluciones / Solutions

Hemos implementado tres métodos diferentes para construir la aplicación:

We have implemented three different methods to build the application:

### 1. Método Optimizado / Optimized Method

Este método crea una configuración especial que preserva todos los alias y asegura que la aplicación funcione exactamente igual que en desarrollo.

This method creates a special configuration that preserves all aliases and ensures the application works exactly the same as in development.

```bash
# Ejecutar script optimizado / Run optimized script
./produccion.sh
```

Este script:
- Crea un vite.config.prod.ts con configuraciones optimizadas
- Usa un mecanismo de resolución de importaciones avanzado
- Genera un script de inicio optimizado para producción

This script:
- Creates a vite.config.prod.ts with optimized settings
- Uses an advanced import resolution mechanism
- Generates an optimized startup script for production

### 2. Método Simple / Simple Method

Un enfoque simplificado que funciona bien para la mayoría de los casos.

A simplified approach that works well for most cases.

```bash
# Ejecutar script simple / Run simple script
./construir.sh
```

Este script:
- Usa una configuración de Vite más simple pero funcional
- Mantiene los alias esenciales
- Es más rápido de ejecutar

This script:
- Uses a simpler but functional Vite configuration
- Maintains essential aliases
- Is faster to run

### 3. Método Manual / Manual Method

Para mayor control, puedes ejecutar los scripts directamente:

For more control, you can run the scripts directly:

```bash
# Método optimizado / Optimized method
node build-optimizado.js

# Método simple / Simple method
node build-simple.js
```

## Ejecutar la Aplicación / Running the Application

Después de construir, puedes ejecutar la aplicación con:

After building, you can run the application with:

```bash
cd dist
node start.js
```

## Resolución de Problemas / Troubleshooting

### Error: Alias de Importación / Import Alias Error

Si ves errores como `Failed to resolve import "@/components/..."`, significa que los alias no se están resolviendo correctamente. Usa el método optimizado para resolver esto.

If you see errors like `Failed to resolve import "@/components/..."`, it means aliases are not resolving correctly. Use the optimized method to solve this.

### Error: Módulos No Encontrados / Modules Not Found

Si faltan módulos de Node.js, asegúrate de que package.json se copió correctamente al directorio dist.

If Node.js modules are missing, make sure package.json was properly copied to the dist directory.

### Error: Archivos Estáticos / Static Files Error

Si faltan archivos estáticos, verifica que la construcción del frontend fue exitosa y que los archivos están en dist/public.

If static files are missing, verify that the frontend build was successful and files are in dist/public.

## Notas Técnicas / Technical Notes

- El proceso de construcción maneja aproximadamente 2,600+ archivos
- La transformación puede tomar entre 1-5 minutos dependiendo del hardware
- El alias `@/` se resuelve a `client/src/` en desarrollo y debe ser preservado en producción

- The build process handles approximately 2,600+ files
- Transformation may take 1-5 minutes depending on hardware
- The `@/` alias resolves to `client/src/` in development and must be preserved in production
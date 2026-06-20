# 🔥 CONFIGURACIÓN REQUERIDA: Firebase Rules

## ⚠️ PROBLEMA IDENTIFICADO

El error "Failed to fetch" es causado por **permisos faltantes** en Firebase Firestore y Storage.

## 🛠️ SOLUCIÓN: Configurar Reglas de Firebase

### 1️⃣ Firestore Security Rules

Ve a: **Firebase Console** → **Firestore Database** → **Rules**

Pega estas reglas:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reglas para image_galleries - PÚBLICO PARA LEER, AUTENTICADO PARA ESCRIBIR
    match /image_galleries/{galleryId} {
      // Cualquiera puede leer galerías públicas
      allow read: if true;
      
      // Solo usuarios autenticados pueden crear/actualizar galerías
      allow create, update: if request.auth != null;
      
      // Solo el dueño puede eliminar
      allow delete: if request.auth != null && 
                       resource.data.userId == request.auth.uid;
    }
    
    // Reglas para perfiles de artistas
    match /artist_profiles/{profileId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Reglas para usuarios
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para shows
    match /shows/{showId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Reglas para productos/merchandise
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Todas las demás colecciones - permisivo para desarrollo
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 2️⃣ Storage Security Rules

Ve a: **Firebase Console** → **Storage** → **Rules**

Pega estas reglas:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Carpeta de galerías - permite lectura pública y escritura autenticada
    match /galleries/{artistId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Carpeta de perfiles de artista
    match /artist-profiles/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Uploads generales
    match /uploads/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Todo lo demás - permisivo para desarrollo
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 3️⃣ Publicar las Reglas

1. Haz click en **"Publish"** en cada sección (Firestore y Storage)
2. Las reglas se aplicarán inmediatamente

## ✅ VERIFICAR

Después de configurar las reglas:

1. Refresca tu aplicación (F5)
2. Intenta crear una galería de imágenes
3. Abre la consola del navegador (F12) para ver los logs detallados:
   - 🔍 `[DEBUG]` te mostrará cada paso
   - ❌ `[STORAGE ERROR]` o `[FIRESTORE ERROR]` te dirá exactamente qué falló

## 🆘 SI SIGUE FALLANDO

Revisa los logs en la consola del navegador y compárteme el error específico que aparece.

/**
 * Firebase setup for the client
 * Initializes Firebase app, auth, Firestore, and storage
 * 
 * Updated with improved persistence configuration for production
 */
import { initializeApp, FirebaseApp, FirebaseOptions } from "firebase/app";
import { 
  getAuth, 
  Auth,
  setPersistence, 
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  signInAnonymously
} from "firebase/auth";
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

/**
 * Default Firebase configuration from environment variables
 */
const defaultConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBzkhBNdrQVU0gCUgI31CzlKbSkKG4_iG8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "artist-boost.firebaseapp.com", 
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "artist-boost",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "artist-boost.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "502955771825",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:502955771825:web:d6746677d851f9b1449f90",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ERCSSWTXCJ"
};

// Check for FIREBASE_CONFIG in environment
let enhancedConfig: FirebaseOptions;

try {
  // Check if we have a FIREBASE_CONFIG object defined
  const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (envConfig) {
    // Parse the configuration if it's a string
    const parsedConfig = typeof envConfig === 'string' 
      ? JSON.parse(envConfig)
      : envConfig;
    
    // Use the parsed config with fallbacks to default
    enhancedConfig = {
      ...defaultConfig,
      ...parsedConfig
    };
    console.log("Inicializando Firebase con configuración mejorada...");
  } else {
    enhancedConfig = defaultConfig;
  }
} catch (error) {
  console.error("Error parsing Firebase config:", error);
  enhancedConfig = defaultConfig;
}

// Initialize Firebase app
const app = initializeApp(enhancedConfig);

// App Check deshabilitado temporalmente para desarrollo
// Se reactivará en producción una vez configurado correctamente
console.log('⚠️ [APP CHECK] Disabled for development');

const auth = getAuth(app);

// Configurar persistencia de Auth para iOS
// iOS Safari puede tener problemas con persistencia, configuramos múltiples estrategias
// Autenticar anónimamente de forma automática
(async () => {
  try {
    // Intentar usar indexedDB primero (más robusto)
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log('✅ Auth persistence: indexedDB');
  } catch (error) {
    console.warn('⚠️ Could not set persistence, continuing anyway');
  }
  
  // Autenticar anónimamente si no hay usuario
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log('✅ Firebase: Autenticado anónimamente');
    }
  } catch (anonError: any) {
    console.error('❌ Error en autenticación anónima:', anonError.message);
    // Continuar de todas formas, las reglas están abiertas
  }
})();

// Initialize Firestore with more reliable settings to prevent "failed-precondition" errors
// We're using a simplified configuration that's more stable across browsers and environments
let db: Firestore;

// Auto-recovery for corrupted IndexedDB: if Firebase's persistence layer
// throws "refusing to open IndexedDB database due to potential corruption",
// we wipe the firestore IDB databases and reload once.
const FIRESTORE_RECOVERY_FLAG = '__firestore_idb_recovered__';
const tryRecoverCorruptIDB = async (reason: string) => {
  try {
    if (sessionStorage.getItem(FIRESTORE_RECOVERY_FLAG)) {
      // Already attempted recovery this session — don't loop
      console.warn('[firestore] Already attempted IDB recovery this session, skipping. Reason:', reason);
      return;
    }
    sessionStorage.setItem(FIRESTORE_RECOVERY_FLAG, '1');
    console.warn('[firestore] Detected potential IDB corruption, wiping firestore databases and reloading. Reason:', reason);

    // Try to enumerate and delete all firestore-related databases
    // @ts-ignore - indexedDB.databases() exists in modern browsers
    if (typeof indexedDB !== 'undefined' && typeof (indexedDB as any).databases === 'function') {
      try {
        const dbs: Array<{ name?: string }> = await (indexedDB as any).databases();
        await Promise.all(
          (dbs || [])
            .filter(d => d?.name && /firestore|firebase/i.test(d.name))
            .map(d => new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(d.name as string);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }))
        );
      } catch (e) {
        console.warn('[firestore] Could not enumerate IDB databases:', e);
      }
    }
    // Best-effort: also delete the well-known firestore DB names
    ['firestore/[DEFAULT]/main', 'firebaseLocalStorageDb'].forEach((name) => {
      try { indexedDB.deleteDatabase(name); } catch {}
    });

    // Give deletes a tick, then reload
    setTimeout(() => window.location.reload(), 200);
  } catch (e) {
    console.error('[firestore] IDB recovery failed:', e);
  }
};

// Listen for the specific corruption error globally so we can self-heal
const isIDBCorruptionError = (msg: unknown): boolean => {
  if (typeof msg !== 'string') return false;
  return msg.includes('refusing to open IndexedDB database') || msg.includes('lastClosedDbVersion');
};
window.addEventListener('error', (ev) => {
  if (isIDBCorruptionError(ev?.message) || isIDBCorruptionError((ev?.error as any)?.message)) {
    void tryRecoverCorruptIDB(String(ev?.message || (ev?.error as any)?.message));
  }
});
window.addEventListener('unhandledrejection', (ev) => {
  const reason: any = ev?.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message;
  if (isIDBCorruptionError(msg)) {
    void tryRecoverCorruptIDB(String(msg));
  }
});

try {
  // Detectar si estamos en un entorno con restricciones (iOS Safari, modo incógnito, etc.)
  const isRestrictedEnv = (() => {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return false;
    } catch {
      return true; // Safari privado, iOS restrictivo, etc.
    }
  })();

  if (isRestrictedEnv) {
    // En entornos restrictivos, usar Firestore sin persistencia
    console.log("🔒 Restricted environment detected (iOS Safari/Private mode) - Using Firestore without persistence");
    db = getFirestore(app);
  } else {
    // En entornos normales, usar persistencia avanzada
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        tabManager: persistentMultipleTabManager()
      })
    });
    console.log("✅ Firestore initialized with enhanced persistence");
  }
} catch (error: any) {
  // Fallback: Si falla cualquier cosa, usar Firestore estándar
  console.warn("⚠️ Enhanced persistence failed, using standard Firestore:", error);
  if (isIDBCorruptionError(error?.message)) {
    void tryRecoverCorruptIDB(error.message);
  }
  db = getFirestore(app);
}

const storage = getStorage(app);

// Log initialization success
console.log("Firebase initialized with enhanced network resilience and multi-tab support");

// Export the initialized services
export { app, auth, db, storage };
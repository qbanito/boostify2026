import { z } from "zod";

const envSchema = z.object({
  VITE_OPENROUTER_API_KEY: z.string().optional(),
  VITE_FAL_API_KEY: z.string().optional().default(''),
  VITE_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key is required"),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1, "Firebase Auth Domain is required"),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required"),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket is required"),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID is required"),
  VITE_FIREBASE_APP_ID: z.string().min(1, "Firebase App ID is required"),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

function getEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    // Fallback values for Firebase configuration
    const fallbackValues: Record<string, string> = {
      VITE_FIREBASE_API_KEY: "AIzaSyBzkhBNdrQVU0gCUgI31CzlKbSkKG4_iG8",
      VITE_FIREBASE_AUTH_DOMAIN: "artist-boost.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "artist-boost",
      VITE_FIREBASE_STORAGE_BUCKET: "artist-boost.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "502955771825",
      VITE_FIREBASE_APP_ID: "1:502955771825:web:d6746677d851f9b1449f90",
      VITE_FIREBASE_MEASUREMENT_ID: "G-ERCSSWTXCJ"
    };

    return fallbackValues[key] || '';
  }
  return value;
}

// Parse environment variables with fallback values
export const env = envSchema.parse({
  VITE_OPENROUTER_API_KEY: getEnvVar('VITE_OPENROUTER_API_KEY'),
  VITE_FAL_API_KEY: getEnvVar('VITE_FAL_API_KEY'),
  VITE_FIREBASE_API_KEY: getEnvVar('VITE_FIREBASE_API_KEY'),
  VITE_FIREBASE_AUTH_DOMAIN: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  VITE_FIREBASE_PROJECT_ID: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  VITE_FIREBASE_STORAGE_BUCKET: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  VITE_FIREBASE_APP_ID: getEnvVar('VITE_FIREBASE_APP_ID'),
  VITE_FIREBASE_MEASUREMENT_ID: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
});

// Log available environment variables for debugging
console.log('Environment variables loaded:', {
  OPENAI_API_KEY: !!getEnvVar('VITE_OPENAI_API_KEY'),
  FAL_API_KEY: !!getEnvVar('VITE_FAL_API_KEY'),
  // Log Firebase config without sensitive values
  FIREBASE_CONFIG: {
    apiKey: '[HIDDEN]'
  }
});

// Export Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  ...(env.VITE_FIREBASE_MEASUREMENT_ID && { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID }),
};
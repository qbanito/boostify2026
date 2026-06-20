-- Migración para agregar soporte de Replit Auth
-- Mantiene todos los datos existentes intactos

-- Crear tabla de sesiones para Replit Auth
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp NOT NULL
);

-- Crear índice para expiración de sesiones
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Agregar nuevas columnas a users para Replit Auth
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "replit_id" varchar UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url" text;

-- Hacer username y password opcionales (para nuevos usuarios de Replit Auth)
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Nota: Los datos existentes se mantienen sin cambios
-- Los usuarios existentes seguirán teniendo username y password
-- Los nuevos usuarios de Replit Auth tendrán replit_id

-- Script para arreglar los nombres de columnas entre snake_case y camelCase

-- Verificar la estructura de las tablas
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('social_users', 'social_posts', 'social_comments');

-- Añadir columnas temporales (si fuera necesario)
-- ALTER TABLE social_posts ADD COLUMN "user_id" INTEGER;
-- UPDATE social_posts SET "user_id" = "userId";

-- Lo ideal sería utilizar un enfoque con una sola convención de nombres,
-- pero como ya tenemos datos en la BD con camelCase, vamos a mantener ese formato.

-- Si necesitamos modificar tablas:
-- ALTER TABLE social_posts RENAME COLUMN user_id TO userId;
-- ALTER TABLE social_comments RENAME COLUMN post_id TO postId;
-- ALTER TABLE social_comments RENAME COLUMN user_id TO userId;
-- ALTER TABLE social_comments RENAME COLUMN parent_id TO parentId;
-- ALTER TABLE social_comments RENAME COLUMN is_reply TO isReply;
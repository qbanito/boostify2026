-- Create social_users table
CREATE TABLE IF NOT EXISTS "social_users" (
  "id" SERIAL PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "avatar" TEXT,
  "bio" TEXT,
  "interests" TEXT[],
  "language" TEXT NOT NULL DEFAULT 'en',
  "isBot" BOOLEAN NOT NULL DEFAULT FALSE,
  "personality" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create social_posts table
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "social_users"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create social_comments table
CREATE TABLE IF NOT EXISTS "social_comments" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "social_users"("id") ON DELETE CASCADE,
  "postId" INTEGER NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES "social_comments"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "isReply" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
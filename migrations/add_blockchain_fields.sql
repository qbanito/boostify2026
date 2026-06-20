-- Add blockchain NFT fields to users table
-- For BTF-2300 Artist Token integration with Polygon

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS blockchain_network TEXT,
ADD COLUMN IF NOT EXISTS blockchain_artist_id INTEGER,
ADD COLUMN IF NOT EXISTS blockchain_token_id TEXT,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS blockchain_contract TEXT,
ADD COLUMN IF NOT EXISTS blockchain_registered_at TIMESTAMP;

-- Create index for faster blockchain lookups
CREATE INDEX IF NOT EXISTS idx_users_blockchain_artist_id ON users(blockchain_artist_id);
CREATE INDEX IF NOT EXISTS idx_users_blockchain_token_id ON users(blockchain_token_id);

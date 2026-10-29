-- BTF Streaming Rewards: verified wallet ownership and reward-program consent.
-- The signatures authorize wallet linking only; they never authorize a token transfer.
ALTER TABLE artist_wallet
  ADD COLUMN IF NOT EXISTS reward_wallet_address VARCHAR(42);
ALTER TABLE artist_wallet
  ADD COLUMN IF NOT EXISTS reward_wallet_verified_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS streaming_reward_wallet_challenges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_streaming_reward_wallet_challenges_user
  ON streaming_reward_wallet_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_reward_wallet_challenges_expiry
  ON streaming_reward_wallet_challenges(expires_at);

CREATE TABLE IF NOT EXISTS streaming_reward_terms_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  wallet_address VARCHAR(42),
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, terms_version)
);

-- Credit purchases are not eligible activity. Their prior default reward could
-- encourage buying credits to earn tokens and is disabled for existing installs.
UPDATE reward_action_rules SET active = FALSE WHERE action_key = 'credit_purchase';

-- Only final, paid activity is eligible for BTF activity bonuses.
INSERT INTO reward_action_rules (action_key, label, btf_amount, max_per_epoch, active)
VALUES
  ('fan_content_purchase', 'Completed fan content purchase', 0, 100, FALSE),
  ('fan_tip', 'Completed fan tip', 0, 100, FALSE)
ON CONFLICT (action_key) DO NOTHING;

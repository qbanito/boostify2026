ALTER TABLE explicit_settings
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_ready boolean NOT NULL DEFAULT false;

ALTER TABLE explicit_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE explicit_purchases
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE explicit_tips
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_explicit_sub_checkout_session
  ON explicit_subscriptions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_explicit_purchase_checkout_session
  ON explicit_purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_explicit_tip_checkout_session
  ON explicit_tips (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS explicit_subscription_payments (
  id serial PRIMARY KEY,
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_subscription_id text NOT NULL,
  buyer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_explicit_subscription_payments_artist
  ON explicit_subscription_payments (artist_id);
CREATE INDEX IF NOT EXISTS idx_explicit_subscription_payments_buyer
  ON explicit_subscription_payments (buyer_id);

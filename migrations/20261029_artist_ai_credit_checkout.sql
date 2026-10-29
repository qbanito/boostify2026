-- Makes credit Checkout fulfillment idempotent across Stripe webhooks and the
-- browser return flow. Historical zero-value marker rows may be duplicated.
WITH duplicate_credit_checkout_markers AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY stripe_checkout_session_id
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM credit_transactions
  WHERE stripe_checkout_session_id IS NOT NULL
)
DELETE FROM credit_transactions
WHERE id IN (
  SELECT id FROM duplicate_credit_checkout_markers WHERE duplicate_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_checkout_session_unique
  ON credit_transactions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

WITH duplicate_credit_payment_intents AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY stripe_payment_intent_id
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM credit_transactions
  WHERE stripe_payment_intent_id IS NOT NULL
)
DELETE FROM credit_transactions
WHERE id IN (
  SELECT id FROM duplicate_credit_payment_intents WHERE duplicate_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_payment_intent_unique
  ON credit_transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

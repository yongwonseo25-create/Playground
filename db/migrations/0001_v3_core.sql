CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  credits INT NOT NULL DEFAULT 100 CHECK (credits >= 0),
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS payment_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount INT NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  credits_delta INT NOT NULL CHECK (credits_delta >= 0),
  request_id UUID UNIQUE NOT NULL,
  stripe_charge_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_request_id ON payment_log(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_user_id ON payment_log(user_id);

CREATE TABLE IF NOT EXISTS voice_processing_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_request_id UUID UNIQUE NOT NULL,
  s3_key VARCHAR(500),
  credits_used INT CHECK (credits_used IS NULL OR credits_used >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_user_id ON voice_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_request_id ON voice_processing_log(client_request_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  amount INT NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  credits_delta INT NOT NULL CHECK (credits_delta >= 0),
  stripe_object_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  source_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_event_id ON stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_event_user_id ON stripe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_event_request_id ON stripe_events(request_id);

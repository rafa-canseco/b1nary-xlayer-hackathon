-- XLayer hackathon schema compatibility.
-- Makes a migrated/staging-like database compatible with current XLayer code.

-- Analytics / faucet event tables used by /analytics and /faucet/xlayer.
CREATE TABLE IF NOT EXISTS slider_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  selected_price numeric NOT NULL,
  side text NOT NULL DEFAULT 'buy',
  shown_premium numeric,
  converted_to_signup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slider_interactions_session
  ON slider_interactions(session_id);

CREATE TABLE IF NOT EXISTS engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_events_user
  ON engagement_events(user_address);
CREATE INDEX IF NOT EXISTS idx_engagement_events_type
  ON engagement_events(event_type);

-- Chain/asset columns.
ALTER TABLE order_events
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'eth',
  ADD COLUMN IF NOT EXISTS collateral_usd float,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS bridge_job_id uuid,
  ADD COLUMN IF NOT EXISTS source_chain text;

ALTER TABLE mm_quotes
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'eth';

ALTER TABLE available_otokens
  ADD COLUMN IF NOT EXISTS underlying text,
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'base';

UPDATE available_otokens
  SET underlying = '0x4200000000000000000000000000000000000006'
  WHERE underlying IS NULL;

ALTER TABLE available_otokens
  ALTER COLUMN underlying SET NOT NULL;

ALTER TABLE mm_capacity
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'eth',
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'base';

-- Recreate chain constraints with xlayer included.
ALTER TABLE order_events DROP CONSTRAINT IF EXISTS chk_order_events_chain;
ALTER TABLE order_events
  ADD CONSTRAINT chk_order_events_chain
  CHECK (chain IN ('base', 'solana', 'xlayer'))
  NOT VALID;

ALTER TABLE mm_quotes DROP CONSTRAINT IF EXISTS chk_mm_quotes_chain;
ALTER TABLE mm_quotes
  ADD CONSTRAINT chk_mm_quotes_chain
  CHECK (chain IN ('base', 'solana', 'xlayer'))
  NOT VALID;

ALTER TABLE available_otokens DROP CONSTRAINT IF EXISTS chk_available_otokens_chain;
ALTER TABLE available_otokens
  ADD CONSTRAINT chk_available_otokens_chain
  CHECK (chain IN ('base', 'solana', 'xlayer'))
  NOT VALID;

ALTER TABLE mm_capacity DROP CONSTRAINT IF EXISTS chk_mm_capacity_chain;
ALTER TABLE mm_capacity
  ADD CONSTRAINT chk_mm_capacity_chain
  CHECK (chain IN ('base', 'solana', 'xlayer'))
  NOT VALID;

-- Indexes used by XLayer filters.
CREATE INDEX IF NOT EXISTS idx_order_events_chain
  ON order_events(chain);
CREATE INDEX IF NOT EXISTS idx_order_events_asset
  ON order_events(asset);
CREATE INDEX IF NOT EXISTS idx_mm_quotes_chain
  ON mm_quotes(chain);
CREATE INDEX IF NOT EXISTS idx_mm_quotes_asset
  ON mm_quotes(asset);
CREATE INDEX IF NOT EXISTS idx_available_otokens_chain
  ON available_otokens(chain);
CREATE INDEX IF NOT EXISTS idx_available_otokens_underlying
  ON available_otokens(underlying);
CREATE INDEX IF NOT EXISTS idx_mm_capacity_chain
  ON mm_capacity(chain);

-- Current code uses indexer_state.id=1 for Base and id=2 for XLayer.
-- Some older migrations converted indexer_state to chain primary key. Convert
-- back to an id primary key while keeping data if present.
ALTER TABLE indexer_state
  ADD COLUMN IF NOT EXISTS id integer,
  ADD COLUMN IF NOT EXISTS chain text;

UPDATE indexer_state SET id = 1 WHERE id IS NULL AND COALESCE(chain, 'base') = 'base';
UPDATE indexer_state SET id = 2 WHERE id IS NULL AND chain = 'xlayer';

DO $$
DECLARE
  pk_name text;
  check_name text;
BEGIN
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'indexer_state'
    AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE indexer_state DROP CONSTRAINT ' || quote_ident(pk_name);
  END IF;

  FOR check_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'indexer_state'
      AND c.contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE indexer_state DROP CONSTRAINT ' || quote_ident(check_name);
  END LOOP;
END $$;

ALTER TABLE indexer_state
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE indexer_state
  ADD PRIMARY KEY (id);

INSERT INTO indexer_state (id, last_indexed_block)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO indexer_state (id, last_indexed_block)
VALUES (2, 0)
ON CONFLICT (id) DO NOTHING;

-- mm_capacity is upserted by (mm_address, asset).
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'mm_capacity'
    AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE mm_capacity DROP CONSTRAINT ' || quote_ident(pk_name);
  END IF;
END $$;

ALTER TABLE mm_capacity
  ADD PRIMARY KEY (mm_address, asset);

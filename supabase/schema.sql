-- ── Auth.js required tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                TEXT      NOT NULL,
  name              TEXT,
  email             TEXT,
  "emailVerified"   TIMESTAMPTZ,
  image             TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS accounts (
  "userId"            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  PRIMARY KEY (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  "sessionToken" TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("sessionToken")
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT        NOT NULL,
  token      TEXT        NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ── AutoIQ custom tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS searches (
  id              SERIAL      PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vin             TEXT        NOT NULL,
  make            TEXT,
  model           TEXT,
  year            TEXT,
  trim            TEXT,
  mileage         INTEGER,
  condition       TEXT,
  zip             TEXT,
  trade_in        INTEGER,
  private_party   INTEGER,
  retail          INTEGER,
  profile_encoded TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS searches_user_id_idx ON searches(user_id);

CREATE TABLE IF NOT EXISTS garage (
  id              SERIAL      PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vin             TEXT        NOT NULL,
  make            TEXT,
  model           TEXT,
  year            TEXT,
  trim            TEXT,
  nickname        TEXT,
  mileage         INTEGER,
  condition       TEXT,
  trade_in        INTEGER,
  private_party   INTEGER,
  retail          INTEGER,
  profile_encoded TEXT,
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vin)
);

CREATE INDEX IF NOT EXISTS garage_user_id_idx ON garage(user_id);

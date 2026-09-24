-- 行政流程演示库结构。重叠生效等级在数据库层兜底。
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS residents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(64) NOT NULL,
  room_no        varchar(32) NOT NULL,
  admission_date date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS scale_versions (
  code       varchar(32) PRIMARY KEY,
  title      varchar(128) NOT NULL,
  items      jsonb NOT NULL,
  bands      jsonb NOT NULL,
  na_policy  varchar(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       uuid NOT NULL REFERENCES residents(id),
  scale_code        varchar(32) NOT NULL,
  family_contact    jsonb,
  status            varchar(24) NOT NULL,
  responses         jsonb NOT NULL,
  score_results     jsonb,
  missing_fields    jsonb,
  hold_reason       varchar(255),
  proposed_level    varchar(8),
  confirmed_level   varchar(8),
  confirmation_kind varchar(16),
  effective_date    date,
  confirmed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessments_resident ON assessments(resident_id);

CREATE TABLE IF NOT EXISTS review_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  reviewer_name   varchar(64) NOT NULL,
  decided_level   varchar(8) NOT NULL,
  basis_items     jsonb NOT NULL,
  rationale       text NOT NULL,
  reconciled_score jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id      uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  assessment_id    uuid NOT NULL,
  contact_name     varchar(64) NOT NULL,
  channel          varchar(64) NOT NULL,
  channel_address  varchar(64) NOT NULL,
  care_level       varchar(8) NOT NULL,
  effective_date   date NOT NULL,
  content          text NOT NULL,
  status           varchar(20) NOT NULL,
  attempt_count    int NOT NULL DEFAULT 0,
  last_error       text,
  delivered_at     timestamptz,
  acknowledged_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_resident ON family_notifications(resident_id);

CREATE TABLE IF NOT EXISTS fee_rate_cards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_level varchar(8) NOT NULL,
  valid_from date NOT NULL,
  valid_to   date,
  daily_rate numeric(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_cards_level ON fee_rate_cards(care_level);

CREATE TABLE IF NOT EXISTS fee_periods (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id          uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  valid_from           date NOT NULL,
  valid_to             date,
  care_level           varchar(8) NOT NULL,
  source_assessment_id uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- 同一天不能出现重叠生效等级（闭区间重叠即冲突）
  CONSTRAINT no_overlapping_level_periods EXCLUDE USING gist (
    resident_id WITH =,
    daterange(valid_from, COALESCE(valid_to, '9999-12-31'), '[]') WITH &&
  )
);
CREATE INDEX IF NOT EXISTS idx_fee_periods_resident ON fee_periods(resident_id);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key          varchar(128) PRIMARY KEY,
  resident_id  uuid,
  action       varchar(32) NOT NULL,
  status       int NOT NULL,
  response     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

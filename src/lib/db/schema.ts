// Postgres schema, as an ordered list of idempotent statements.
// Applied with `npm run db:migrate` (scripts/migrate.mts); safe to run any number of times.
// Column names match src/lib/car-rows.ts and src/lib/proposal-rows.ts.
//
// One car per anonymous visitor for now (unique visitor_id). Schedule items belong to the
// vehicle and are removed with it, and proposals with their vehicle and item.

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS vehicles (
    id            text PRIMARY KEY,
    visitor_id    text NOT NULL UNIQUE,
    year          integer NOT NULL,
    make          text NOT NULL,
    model         text NOT NULL,
    epa_mpg       double precision NOT NULL,
    mpg_override  double precision,
    odometer      integer NOT NULL,
    weekly_miles  integer NOT NULL,
    home_label    text NOT NULL,
    home_lat      double precision NOT NULL,
    home_lng      double precision NOT NULL,
    reading_at    timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_items (
    id                   text PRIMARY KEY,
    vehicle_id           text NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    kind                 text NOT NULL,
    interval_days        integer,
    interval_miles       integer,
    last_done_at         timestamptz,
    last_done_odometer   integer,
    due_at               timestamptz,
    due_odometer         integer,
    status               text NOT NULL,
    interval_source_kind text NOT NULL,
    interval_source_url  text,
    UNIQUE (vehicle_id, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS schedule_items_vehicle_id_idx ON schedule_items (vehicle_id)`,
  `CREATE TABLE IF NOT EXISTS proposals (
    id                 text PRIMARY KEY,
    vehicle_id         text NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    item_id            text NOT NULL REFERENCES schedule_items (id) ON DELETE CASCADE,
    from_due_at        timestamptz,
    from_due_odometer  integer,
    to_due_at          timestamptz,
    to_due_odometer    integer,
    reason             text NOT NULL,
    model              text NOT NULL,
    state              text NOT NULL,
    -- Set when the user hides an applied card; it stays applied.
    hidden_at          timestamptz,
    -- clock_timestamp, not now(): proposals saved in one transaction keep the order they were made in.
    created_at         timestamptz NOT NULL DEFAULT clock_timestamp()
  )`,
  // For a proposals table made before hidden_at was added.
  `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS hidden_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS proposals_vehicle_id_idx ON proposals (vehicle_id)`,
  // Weather and air-quality nudges, written by "Load demo car" and the daily job, shown on the
  // dashboard while fresh. Removed with the vehicle.
  `CREATE TABLE IF NOT EXISTS nudges (
    id          text PRIMARY KEY,
    vehicle_id  text NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    text        text NOT NULL,
    reason      text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS nudges_vehicle_id_created_at_idx ON nudges (vehicle_id, created_at DESC)`,
];

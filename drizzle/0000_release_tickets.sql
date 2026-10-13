CREATE TABLE release_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  expires INTEGER NOT NULL,
  state TEXT NOT NULL,
  payload TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX release_tickets_expiry ON release_tickets(expires);

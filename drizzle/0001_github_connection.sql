CREATE TABLE github_connection (
  owner TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  credentials TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE github_connect_flows (
  state TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  expires INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

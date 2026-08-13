import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  doublePrecision,
  integer,
  boolean,
  jsonb,
  char,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  municipality: text("municipality"),
  region: text("region"),
  countryCode: char("country_code", { length: 2 }).notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  geocodeQuery: text("geocode_query"),
  geocodeStatus: text("geocode_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  website: text("website"),
  audienceHint: text("audience_hint").notNull().default("mixed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  locationId: uuid("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  timezone: text("timezone").notNull().default("Europe/Prague"),
  disciplines: text("disciplines").array().notNull().default([]),
  audience: text("audience").notNull().default("mixed"),
  status: text("status").notNull().default("scheduled"),
  websiteUrl: text("website_url"),
  registrationUrl: text("registration_url"),
  registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
  registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
  fingerprint: text("fingerprint").notNull(),
  sourceKind: text("source_kind").notNull().default("scraped"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventCategories = pgTable("event_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  distanceKm: doublePrecision("distance_km"),
  elevationM: doublePrecision("elevation_m"),
  gender: text("gender"),
  audience: text("audience"),
});

export const extractionProfiles = pgTable("extraction_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  host: text("host").notNull(),
  urlPattern: text("url_pattern"),
  strategy: text("strategy").notNull(),
  recipe: jsonb("recipe").notNull().default({}),
  successCount: integer("success_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const watchedUrls = pgTable("watched_urls", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(),
  kind: text("kind").notNull(),
  parentId: uuid("parent_id"),
  status: text("status").notNull().default("active"),
  httpStatus: integer("http_status"),
  contentHash: text("content_hash"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
  nextPollAt: timestamp("next_poll_at", { withTimezone: true }).notNull().defaultNow(),
  extractionProfileId: uuid("extraction_profile_id").references(
    () => extractionProfiles.id,
    { onDelete: "set null" },
  ),
  lastError: text("last_error"),
  lastExtractStatus: text("last_extract_status"),
  addedBy: text("added_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventSources = pgTable(
  "event_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    watchedUrlId: uuid("watched_url_id").references(() => watchedUrls.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url").notNull(),
    externalId: text("external_id"),
    rawHash: text("raw_hash"),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_sources_watched_external").on(t.watchedUrlId, t.externalId)],
);

export const discoveredLinks = pgTable("discovered_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(),
  fromWatchedUrlId: uuid("from_watched_url_id").references(() => watchedUrls.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("pending"),
  hintKind: text("hint_kind"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventOverrides = pgTable("event_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .unique()
    .references(() => events.id, { onDelete: "cascade" }),
  fields: jsonb("fields").notNull().default({}),
  lockedFields: text("locked_fields").array().notNull().default([]),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestRuns = pgTable("ingest_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  watchedUrlId: uuid("watched_url_id").references(() => watchedUrls.id, {
    onDelete: "set null",
  }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  eventsUpserted: integer("events_upserted").notNull().default(0),
  linksDiscovered: integer("links_discovered").notNull().default(0),
  error: text("error"),
  strategy: text("strategy"),
  httpStatus: integer("http_status"),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Event = typeof events.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type WatchedUrl = typeof watchedUrls.$inferSelect;

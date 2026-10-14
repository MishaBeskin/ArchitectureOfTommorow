import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative on purpose: drizzle-kit loads this file outside Next.js and does not resolve "@/".
import { PROJECT_PHASES, PROJECT_STATUSES, PROJECT_TYPES, YEAR_RANGE } from "../../lib/types";

/*
 * Every table calls .enableRLS() with no policies: the app reaches Postgres only from the
 * server over a privileged connection, so the public Supabase API roles get no access at all.
 */

export const projectTypeEnum = pgEnum("project_type", PROJECT_TYPES);
export const projectPhaseEnum = pgEnum("project_phase", PROJECT_PHASES);
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const architects = pgTable(
  "architects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    bio: text("bio"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("architects_slug_key").on(t.slug)],
).enableRLS();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    type: projectTypeEnum("type").notNull(),
    phase: projectPhaseEnum("phase").notNull().default("completed"),
    year: integer("year").notNull(),
    city: text("city").notNull(),
    region: text("region"),
    countryCode: char("country_code", { length: 2 }).notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // projects and project_images reference each other, so the type is annotated explicitly.
    coverImageId: uuid("cover_image_id").references((): AnyPgColumn => projectImages.id, {
      onDelete: "set null",
    }),
    featured: boolean("featured").notNull().default(false),
    featuredOrder: integer("featured_order"),
    status: projectStatusEnum("status").notNull().default("draft"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("projects_slug_key").on(t.slug),
    // sql.raw: DDL cannot contain bind parameters, so the bounds must be inlined as literals.
    check(
      "projects_year_range",
      sql`${t.year} BETWEEN ${sql.raw(String(YEAR_RANGE.min))} AND ${sql.raw(String(YEAR_RANGE.max))}`,
    ),
    check("projects_summary_length", sql`char_length(${t.summary}) <= 300`),
    check("projects_country_code_upper", sql`${t.countryCode} = upper(${t.countryCode})`),
    index("projects_status_year_idx").on(t.status, t.year.desc()),
    index("projects_status_type_idx").on(t.status, t.type),
    index("projects_status_country_idx").on(t.status, t.countryCode),
    index("projects_featured_order_idx")
      .on(t.featuredOrder)
      .where(sql`${t.featured} AND ${t.status} = 'published'`),
  ],
).enableRLS();

export const projectImages = pgTable(
  "project_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull(),
    caption: text("caption"),
    credit: text("credit"),
    blurDataUrl: text("blur_data_url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("project_images_project_order_idx").on(t.projectId, t.sortOrder),
    check("project_images_dimensions_positive", sql`${t.width} > 0 AND ${t.height} > 0`),
  ],
).enableRLS();

export const projectArchitects = pgTable(
  "project_architects",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // restrict: an architect who still has projects cannot be deleted by accident.
    architectId: uuid("architect_id")
      .notNull()
      .references(() => architects.id, { onDelete: "restrict" }),
    role: text("role"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.architectId] })],
).enableRLS();

/** Old slugs stay resolvable after a rename so shared links keep working (308 redirect). */
export const projectSlugRedirects = pgTable("project_slug_redirects", {
  oldSlug: text("old_slug").primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}).enableRLS();

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [index("contact_messages_created_idx").on(t.createdAt.desc())],
).enableRLS();

/** Fixed-window counters, e.g. key `contact:ip:<hash>`. Written with an atomic upsert. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectImageRow = typeof projectImages.$inferSelect;
export type ArchitectRow = typeof architects.$inferSelect;

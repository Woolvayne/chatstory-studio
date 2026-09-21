import { pgTable, text, jsonb, timestamp, integer, serial } from "drizzle-orm/pg-core";

export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  batchId: text("batch_id").notNull().unique(),
  name: text("name").notNull(),
  titles: jsonb("titles").notNull().$type<string[]>(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  batchId: text("batch_id").notNull(),
  index: integer("index").notNull(),
  title: text("title").notNull(),
  variant: text("variant").notNull().default("emotional"),
  script: jsonb("script").$type<VideoScript>(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  blobUrl: text("blob_url"),
  bufferPostIds: jsonb("buffer_post_ids").$type<Record<string, string>>(),
  bufferStatus: jsonb("buffer_status").$type<Record<string, string>>(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VideoScript = {
  title: string;
  hook: string;
  variant: string;
  characters: Array<{
    name: string;
    role: string;
    voice: string;
    color: string;
    avatar: string;
  }>;
  messages: Array<{
    id: string;
    sender: string;
    text: string;
    timestamp: string;
    delay: number;
    duration: number;
  }>;
  scenes: Array<{
    id: string;
    description: string;
    imagePrompt: string;
    startTime: number;
    endTime: number;
    imageUrl?: string;
  }>;
  ending: string;
  voice_style: string;
  estimated_duration: number;
  caption: string;
  hashtags: string[];
};

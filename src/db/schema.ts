import { boolean, integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

// Таблица рекордов сервера («Зал славы»)
export const scores = pgTable('scores', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 32 }).notNull(),
  score: integer('score').notNull(),
  kills: integer('kills').notNull().default(0),
  botKills: integer('bot_kills').notNull().default(0),
  deaths: integer('deaths').notNull().default(0),
  correct: integer('correct').notNull().default(0),
  answered: integer('answered').notNull().default(0),
  mode: varchar('mode', { length: 16 }).notNull(),
  layout: varchar('layout', { length: 16 }).notNull(),
  online: boolean('online').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Пользовательские экзамены для обмена между игроками (по коду и QR)
export const customExams = pgTable('custom_exams', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 8 }).notNull().unique(),
  title: varchar('title', { length: 80 }).notNull(),
  author: varchar('author', { length: 32 }).notNull().default(''),
  payload: jsonb('payload').notNull(),
  downloads: integer('downloads').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

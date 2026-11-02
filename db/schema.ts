import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull(),owner:text('owner'),created:text('created').notNull()});
export const variants=sqliteTable('variants',{id:text('id').primaryKey(),product:text('product').notNull(),size:text('size').notNull(),colour:text('colour').notNull(),stock:integer('stock').notNull(),price:integer('price').notNull(),barcode:text('barcode').notNull()},(t)=>[check('stock_nonnegative',sql`${t.stock} >= 0`)]);
export const orderLines=sqliteTable('order_lines',{id:text('id').primaryKey(),orderId:text('order_id').notNull(),variant:text('variant').notNull(),quantity:integer('quantity').notNull()});

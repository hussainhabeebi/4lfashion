import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull(),owner:text('owner'),created:text('created').notNull()});
export const variants=sqliteTable('variants',{id:text('id').primaryKey(),product:text('product').notNull(),size:text('size').notNull(),colour:text('colour').notNull(),stock:integer('stock').notNull(),price:integer('price').notNull(),barcode:text('barcode').notNull()},(t)=>[check('stock_nonnegative',sql`${t.stock} >= 0`)]);
export const orderLines=sqliteTable('order_lines',{id:text('id').primaryKey(),orderId:text('order_id').notNull(),variant:text('variant').notNull(),quantity:integer('quantity').notNull()});

export const authUsers=sqliteTable('auth_users',{id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),created:integer('created').notNull()});
export const authSessions=sqliteTable('auth_sessions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),expires:integer('expires').notNull()});
export const authFlows=sqliteTable('auth_flows',{id:text('id').primaryKey(),verifier:text('verifier').notNull(),nonce:text('nonce').notNull(),returnTo:text('return_to').notNull(),expires:integer('expires').notNull()});

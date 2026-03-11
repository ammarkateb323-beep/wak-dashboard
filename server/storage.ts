import { db } from "./db";
import {
  messages,
  escalations,
  type Message,
  type InsertMessage,
  type Escalation,
  type InsertEscalation,
  type Conversation
} from "@shared/schema";
import { eq, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  getConversations(): Promise<Conversation[]>;
  getOpenEscalations(): Promise<Escalation[]>;
  getEscalation(phone: string): Promise<Escalation | undefined>;
  createEscalation(escalation: InsertEscalation): Promise<Escalation>;
  closeEscalation(phone: string): Promise<void>;
  getMessages(phone: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getConversations(): Promise<Conversation[]> {
    const result = await db.execute(sql`
      SELECT
        m.customer_phone,
        (SELECT message_text FROM messages WHERE customer_phone = m.customer_phone ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at  FROM messages WHERE customer_phone = m.customer_phone ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        e.status            AS escalation_status,
        e.escalation_reason
      FROM (SELECT DISTINCT customer_phone FROM messages) m
      LEFT JOIN escalations e ON e.customer_phone = m.customer_phone
      ORDER BY last_message_at DESC NULLS LAST
    `);
    return result.rows as unknown as Conversation[];
  }

  async getOpenEscalations(): Promise<Escalation[]> {
    return await db.select().from(escalations).where(eq(escalations.status, 'open')).orderBy(desc(escalations.created_at));
  }

  async getEscalation(phone: string): Promise<Escalation | undefined> {
    const [escalation] = await db.select().from(escalations).where(eq(escalations.customer_phone, phone));
    return escalation;
  }

  async createEscalation(escalation: InsertEscalation): Promise<Escalation> {
    const [newEscalation] = await db.insert(escalations).values(escalation).returning();
    return newEscalation;
  }

  async closeEscalation(phone: string): Promise<void> {
    await db.update(escalations).set({ status: 'closed' }).where(eq(escalations.customer_phone, phone));
  }

  async getMessages(phone: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.customer_phone, phone)).orderBy(asc(messages.created_at));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();

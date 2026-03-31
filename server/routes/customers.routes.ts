/**
 * customers.routes.ts — Customer journey and contacts management routes.
 *
 * Handles: paginated customer list, funnel analytics, full customer journey
 * timeline, and contacts CRUD (list, create, update, delete, bulk-delete, import).
 */

import type { Express } from 'express';
import { pool } from '../db';
import { requireAdmin } from '../middleware/auth';
import { createLogger, maskPhone } from '../lib/logger';

const logger = createLogger('customers');

export function registerCustomerRoutes(app: Express): void {

  // GET /api/customers — paginated list with search
  app.get('/api/customers', requireAdmin, async (req: any, res: any) => {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = 20;
    const offset = (page - 1) * limit;
    const search = ((req.query.search as string) || '').trim();

    try {
      const searchClause = search
        ? `AND (all_phones.phone ILIKE $3 OR c.name ILIKE $3)`
        : '';
      const params: any[] = search ? [limit, offset, `%${search}%`] : [limit, offset];

      const rows = await pool.query(`
        WITH all_phones AS (
          SELECT DISTINCT customer_phone AS phone FROM messages
          UNION SELECT DISTINCT customer_phone FROM escalations
          UNION SELECT DISTINCT customer_phone FROM meetings
        )
        SELECT
          all_phones.phone,
          c.name, c.source,
          MIN(m.created_at)  AS first_seen,
          MAX(m.created_at)  AS last_seen,
          (SELECT COUNT(*) FROM messages       WHERE customer_phone = all_phones.phone) +
          (SELECT COUNT(*) FROM escalations    WHERE customer_phone = all_phones.phone) +
          (SELECT COUNT(*) FROM meetings       WHERE customer_phone = all_phones.phone) +
          (SELECT COUNT(*) FROM survey_responses WHERE customer_phone = all_phones.phone) +
          (SELECT COUNT(*) FROM orders         WHERE customer_phone = all_phones.phone) AS touchpoints
        FROM all_phones
        LEFT JOIN contacts c ON c.phone_number = all_phones.phone
        LEFT JOIN messages m ON m.customer_phone = all_phones.phone
        ${searchClause}
        GROUP BY all_phones.phone, c.name, c.source
        ORDER BY first_seen DESC NULLS LAST
        LIMIT $1 OFFSET $2
      `, params);

      const totalParams: any[] = search ? [`%${search}%`] : [];
      const totalQ = search
        ? `SELECT COUNT(*) FROM (
             SELECT DISTINCT all_phones.phone
             FROM (
               SELECT DISTINCT customer_phone AS phone FROM messages
               UNION SELECT DISTINCT customer_phone FROM escalations
               UNION SELECT DISTINCT customer_phone FROM meetings
             ) all_phones
             LEFT JOIN contacts c ON c.phone_number = all_phones.phone
             WHERE all_phones.phone ILIKE $1 OR c.name ILIKE $1
           ) t`
        : `SELECT COUNT(*) FROM (
             SELECT customer_phone FROM messages
             UNION SELECT customer_phone FROM escalations
             UNION SELECT customer_phone FROM meetings
           ) t`;
      const totalRes = await pool.query(totalQ, totalParams);

      res.json({
        customers: rows.rows.map((r: any) => ({
          phone:       r.phone,
          name:        r.name || null,
          source:      r.source || null,
          firstSeen:   r.first_seen,
          lastSeen:    r.last_seen,
          touchpoints: Number(r.touchpoints),
        })),
        total: Number(totalRes.rows[0].count),
        page,
      });
    } catch (err: any) {
      logger.error('getCustomers failed', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/customers/funnel — conversion stage counts
  app.get('/api/customers/funnel', requireAdmin, async (_req: any, res: any) => {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(DISTINCT customer_phone) FROM messages)                                AS first_contact,
          (SELECT COUNT(DISTINCT customer_phone) FROM messages WHERE sender IN ('ai','agent')) AS bot_conversation,
          (SELECT COUNT(DISTINCT customer_phone) FROM escalations)                             AS escalated,
          (SELECT COUNT(DISTINCT customer_phone) FROM meetings)                                AS meeting_booked,
          (SELECT COUNT(DISTINCT customer_phone) FROM survey_responses WHERE submitted = true) AS survey_submitted
      `);
      const r = result.rows[0];
      res.json({
        stages: [
          { stage: 'First Contact',      count: Number(r.first_contact)    },
          { stage: 'Bot Conversation',   count: Number(r.bot_conversation) },
          { stage: 'Escalated to Agent', count: Number(r.escalated)        },
          { stage: 'Meeting Booked',     count: Number(r.meeting_booked)   },
          { stage: 'Survey Submitted',   count: Number(r.survey_submitted) },
        ],
      });
    } catch (err: any) {
      logger.error('getFunnel failed', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/customers/:phone/journey — full sorted timeline for one customer
  app.get('/api/customers/:phone/journey', requireAdmin, async (req: any, res: any) => {
    const phone = decodeURIComponent(req.params.phone);
    try {
      const [msgRes, escRes, meetRes, survRes, ordRes, contactRes] = await Promise.all([
        pool.query(
          `SELECT id, direction, sender, message_text, created_at
           FROM messages WHERE customer_phone = $1 ORDER BY created_at ASC`,
          [phone]
        ),
        pool.query(
          `SELECT id, escalation_reason, status, assigned_agent_id, created_at
           FROM escalations WHERE customer_phone = $1 ORDER BY created_at ASC`,
          [phone]
        ),
        pool.query(
          `SELECT id, status, meeting_link, meeting_token, created_at, scheduled_at
           FROM meetings WHERE customer_phone = $1 ORDER BY created_at ASC`,
          [phone]
        ),
        pool.query(
          `SELECT sr.id, sr.submitted, sr.created_at, sr.submitted_at, s.title
           FROM survey_responses sr
           LEFT JOIN surveys s ON s.id = sr.survey_id
           WHERE sr.customer_phone = $1 ORDER BY sr.created_at ASC`,
          [phone]
        ),
        pool.query(
          `SELECT id, order_number, status, details, created_at
           FROM orders WHERE customer_phone = $1 ORDER BY created_at ASC`,
          [phone]
        ),
        pool.query(
          `SELECT name, source FROM contacts WHERE phone_number = $1 LIMIT 1`,
          [phone]
        ),
      ]);

      const timeline: any[] = [];
      const msgs = msgRes.rows;

      if (msgs.length > 0) {
        timeline.push({
          type:      'first_contact',
          timestamp: msgs[0].created_at,
          summary:   'First contact via WhatsApp',
          meta:      { message: msgs[0].message_text?.slice(0, 120) },
        });

        let i = 1;
        while (i < msgs.length) {
          const sender  = msgs[i].sender;
          const isAgent = sender === 'agent';
          const type    = isAgent ? 'agent_message' : 'bot_message';
          let count     = 0;
          const start   = msgs[i].created_at;
          while (i < msgs.length && msgs[i].sender === sender) { count++; i++; }
          const end = msgs[i - 1].created_at;
          timeline.push({
            type,
            timestamp: start,
            summary:   `${count} ${isAgent ? 'agent' : 'bot'} message${count !== 1 ? 's' : ''}`,
            meta:      { count, from: start, to: end },
          });
        }
      }

      for (const e of escRes.rows) {
        timeline.push({
          type:      'escalation',
          timestamp: e.created_at,
          summary:   e.escalation_reason || 'Escalated to agent',
          meta:      { status: e.status, assigned_agent_id: e.assigned_agent_id, reason: e.escalation_reason },
        });
      }

      for (const m of meetRes.rows) {
        timeline.push({
          type:      'meeting_booked',
          timestamp: m.created_at,
          summary:   'Meeting booked',
          meta:      { meeting_token: m.meeting_token, status: m.status },
        });
        if (m.status === 'completed' && m.scheduled_at) {
          timeline.push({
            type:      'meeting_completed',
            timestamp: m.scheduled_at,
            summary:   'Meeting completed',
            meta:      { meeting_token: m.meeting_token },
          });
        }
      }

      for (const s of survRes.rows) {
        timeline.push({
          type:      'survey_sent',
          timestamp: s.created_at,
          summary:   `Survey sent${s.title ? ': ' + s.title : ''}`,
          meta:      { survey_title: s.title },
        });
        if (s.submitted && s.submitted_at) {
          timeline.push({
            type:      'survey_submitted',
            timestamp: s.submitted_at,
            summary:   `Survey submitted${s.title ? ': ' + s.title : ''}`,
            meta:      { survey_title: s.title },
          });
        }
      }

      for (const o of ordRes.rows) {
        timeline.push({
          type:      'order',
          timestamp: o.created_at,
          summary:   `Order ${o.order_number} — ${o.status}`,
          meta:      { order_number: o.order_number, status: o.status, details: o.details },
        });
      }

      timeline.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const contact = contactRes.rows[0];
      res.json({
        customer: {
          phone,
          name:      contact?.name || null,
          source:    contact?.source || null,
          firstSeen: msgs[0]?.created_at || null,
        },
        timeline,
      });
    } catch (err: any) {
      logger.error('getCustomerJourney failed', `phone: ${maskPhone(phone)}, error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Contacts CRUD ──────────────────────────────────────────────────────────

  app.get('/api/contacts', requireAdmin, async (_req: any, res: any) => {
    try {
      const result = await pool.query(
        `SELECT id, phone_number, name, source, created_at FROM contacts ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      logger.error('getContacts failed', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/contacts', requireAdmin, async (req: any, res: any) => {
    const { name, phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ message: 'Phone number is required' });
    const phone = String(phone_number).trim().replace(/[\s\-().]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone)) return res.status(400).json({ message: 'invalid_phone' });
    try {
      const result = await pool.query(
        `INSERT INTO contacts (phone_number, name, source) VALUES ($1, $2, 'manual')
         RETURNING id, phone_number, name, source, created_at`,
        [phone, (name || '').trim() || null]
      );
      logger.info('Contact created', `phone: ${maskPhone(phone)}`);
      res.json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ message: 'duplicate' });
      logger.error('createContact failed', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/contacts/:id', requireAdmin, async (req: any, res: any) => {
    const id = Number(req.params.id);
    const { name } = req.body;
    try {
      const result = await pool.query(
        `UPDATE contacts SET name = $1 WHERE id = $2
         RETURNING id, phone_number, name, source, created_at`,
        [(name || '').trim() || null, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      logger.error('updateContact failed', `contactId: ${id}, error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/contacts/:id', requireAdmin, async (req: any, res: any) => {
    try {
      await pool.query('DELETE FROM contacts WHERE id = $1', [Number(req.params.id)]);
      logger.info('Contact deleted', `contactId: ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('deleteContact failed', `contactId: ${req.params.id}, error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/contacts/bulk-delete', requireAdmin, async (req: any, res: any) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No ids provided' });
    }
    try {
      await pool.query('DELETE FROM contacts WHERE id = ANY($1::int[])', [ids]);
      logger.info('Contacts bulk deleted', `count: ${ids.length}`);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('bulkDeleteContacts failed', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/contacts/import', requireAdmin, async (req: any, res: any) => {
    const { contacts: rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: 'Invalid payload' });
    let added = 0, duplicates = 0, invalid = 0;
    for (const row of rows) {
      const phone = String(row.phone || '').trim().replace(/[\s\-().]/g, '');
      const name  = String(row.name  || '').trim() || null;
      if (!/^\+?\d{7,15}$/.test(phone)) { invalid++; continue; }
      try {
        const result = await pool.query(
          `INSERT INTO contacts (phone_number, name, source)
           VALUES ($1, $2, 'imported')
           ON CONFLICT (phone_number) DO NOTHING
           RETURNING id`,
          [phone, name]
        );
        if ((result.rowCount ?? 0) > 0) added++; else duplicates++;
      } catch (_) {
        invalid++;
      }
    }
    logger.info('Contacts import complete', `added: ${added}, duplicates: ${duplicates}, invalid: ${invalid}`);
    res.json({ added, duplicates, invalid });
  });
}

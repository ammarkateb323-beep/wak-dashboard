import crypto from 'crypto';
import { pool } from './db';
import { z } from 'zod';

// ── Migration (runs once on startup) ─────────────────────────────────────────

export async function ensureSurveyTables(): Promise<void> {
  // Run each statement separately to avoid multi-statement transaction issues
  const statements = [
    `CREATE TABLE IF NOT EXISTS surveys (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      is_active   BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS survey_questions (
      id            SERIAL PRIMARY KEY,
      survey_id     INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL,
      options       JSONB,
      order_index   INTEGER NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS survey_responses (
      id               SERIAL PRIMARY KEY,
      survey_id        INTEGER REFERENCES surveys(id),
      token            TEXT UNIQUE NOT NULL,
      customer_phone   TEXT NOT NULL,
      agent            TEXT,
      escalation_phone TEXT,
      submitted        BOOLEAN DEFAULT false,
      submitted_at     TIMESTAMPTZ,
      expires_at       TIMESTAMPTZ NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS survey_answers (
      id            SERIAL PRIMARY KEY,
      response_id   INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
      question_id   INTEGER REFERENCES survey_questions(id),
      answer_text   TEXT,
      answer_rating INTEGER,
      answer_choice TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS one_active_survey ON surveys (is_active) WHERE is_active = true`,
  ];
  for (const sql of statements) {
    await pool.query(sql);
  }
}

// ── Survey trigger helper ─────────────────────────────────────────────────────
// Called after escalation close or meeting complete.
// Checks for an active survey, creates a response token, and sends via WhatsApp.

export async function sendSurveyToCustomer(
  customerPhone: string,
  agent: string | null,
  escalationPhone: string | null
): Promise<void> {
  try {
    const surveyRes = await pool.query(
      `SELECT id, title FROM surveys WHERE is_active = true LIMIT 1`
    );
    if (surveyRes.rows.length === 0) return; // no active survey — skip silently

    const survey = surveyRes.rows[0];
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO survey_responses (survey_id, token, customer_phone, agent, escalation_phone, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [survey.id, token, customerPhone, agent, escalationPhone, expiresAt]
    );

    const baseUrl = process.env.RAILWAY_PUBLIC_URL || process.env.DASHBOARD_URL || '';
    const surveyLink = `${baseUrl}/survey/${token}`;
    const message =
      `Thank you for contacting WAK Solutions! 😊\n` +
      `We'd love to hear your feedback. Please take a moment to fill out our short survey (it only takes 1 minute):\n` +
      `${surveyLink}\n` +
      `The link expires in 24 hours.`;

    if (process.env.N8N_SEND_WEBHOOK) {
      fetch(process.env.N8N_SEND_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({ customer_phone: customerPhone, message }),
      }).catch((e: any) => console.error('[survey] WhatsApp send error:', e));
    }
  } catch (e: any) {
    console.error('[survey] sendSurveyToCustomer error:', e);
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerSurveyRoutes(app: any, requireAuth: any): void {

  // ── Admin: Survey CRUD ─────────────────────────────────────────────────────

  // IMPORTANT: /api/surveys/overview must come before /api/surveys/:id
  app.get('/api/surveys/overview', requireAuth, async (req: any, res: any) => {
    try {
      const activeSurveyRes = await pool.query(
        `SELECT id, title FROM surveys WHERE is_active = true LIMIT 1`
      );
      const activeSurvey = activeSurveyRes.rows[0] ?? null;

      if (!activeSurvey) {
        return res.json({ activeSurvey: null, weekResponses: 0, weekSubmitted: 0, weekAvgRating: null });
      }

      // Current week Mon 00:00 local → use simple 7-day lookback from Monday
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);

      const statsRes = await pool.query(
        `SELECT
           COUNT(*) AS total_responses,
           COUNT(*) FILTER (WHERE submitted = true) AS total_submitted,
           (SELECT AVG(sa.answer_rating)
            FROM survey_answers sa
            JOIN survey_responses sr ON sr.id = sa.response_id
            WHERE sr.survey_id = $1 AND sr.submitted = true AND sa.answer_rating IS NOT NULL
              AND sr.created_at >= $2) AS avg_rating
         FROM survey_responses
         WHERE survey_id = $1 AND created_at >= $2`,
        [activeSurvey.id, weekStart.toISOString()]
      );

      const row = statsRes.rows[0];
      res.json({
        activeSurvey,
        weekResponses: parseInt(row.total_responses) || 0,
        weekSubmitted: parseInt(row.total_submitted) || 0,
        weekAvgRating: row.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/surveys — list all surveys
  app.get('/api/surveys', requireAuth, async (_req: any, res: any) => {
    try {
      const result = await pool.query(
        `SELECT s.*,
           (SELECT COUNT(*) FROM survey_questions sq WHERE sq.survey_id = s.id)::int AS question_count,
           (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id = s.id)::int AS response_count,
           (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id = s.id AND sr.submitted = true)::int AS submitted_count
         FROM surveys s
         ORDER BY s.created_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/surveys — create survey
  app.post('/api/surveys', requireAuth, async (req: any, res: any) => {
    try {
      const { title, description } = z.object({
        title: z.string().min(1),
        description: z.string().optional().default(''),
      }).parse(req.body);
      const result = await pool.query(
        `INSERT INTO surveys (title, description) VALUES ($1, $2) RETURNING *`,
        [title, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // GET /api/surveys/:id — get survey with questions
  app.get('/api/surveys/:id', requireAuth, async (req: any, res: any) => {
    try {
      const surveyRes = await pool.query(`SELECT * FROM surveys WHERE id = $1`, [req.params.id]);
      if (surveyRes.rows.length === 0) return res.status(404).json({ message: 'Survey not found' });
      const questionsRes = await pool.query(
        `SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY order_index`,
        [req.params.id]
      );
      res.json({ ...surveyRes.rows[0], questions: questionsRes.rows });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/surveys/:id — update title/description
  app.put('/api/surveys/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { title, description } = z.object({
        title: z.string().min(1),
        description: z.string().optional().default(''),
      }).parse(req.body);
      const result = await pool.query(
        `UPDATE surveys SET title=$1, description=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [title, description, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Survey not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // DELETE /api/surveys/:id — delete (only if no submitted responses)
  app.delete('/api/surveys/:id', requireAuth, async (req: any, res: any) => {
    try {
      const check = await pool.query(
        `SELECT id FROM survey_responses WHERE survey_id=$1 AND submitted=true LIMIT 1`,
        [req.params.id]
      );
      if (check.rows.length > 0) {
        return res.status(409).json({ message: 'Cannot delete a survey that has submitted responses.' });
      }
      await pool.query(`DELETE FROM surveys WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/surveys/:id/activate
  app.post('/api/surveys/:id/activate', requireAuth, async (req: any, res: any) => {
    try {
      await pool.query(`UPDATE surveys SET is_active=false, updated_at=NOW()`);
      const result = await pool.query(
        `UPDATE surveys SET is_active=true, updated_at=NOW() WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Survey not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/surveys/:id/deactivate
  app.post('/api/surveys/:id/deactivate', requireAuth, async (req: any, res: any) => {
    try {
      const result = await pool.query(
        `UPDATE surveys SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Survey not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Question Management ─────────────────────────────────────────────

  // POST /api/surveys/:id/questions
  app.post('/api/surveys/:id/questions', requireAuth, async (req: any, res: any) => {
    try {
      const { question_text, question_type, options, order_index } = z.object({
        question_text: z.string().min(1),
        question_type: z.enum(['rating', 'multiple_choice', 'free_text']),
        options: z.array(z.string()).optional().nullable(),
        order_index: z.number().int(),
      }).parse(req.body);
      const result = await pool.query(
        `INSERT INTO survey_questions (survey_id, question_text, question_type, options, order_index)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.params.id, question_text, question_type, options ? JSON.stringify(options) : null, order_index]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // IMPORTANT: reorder must come BEFORE /:qid to avoid "reorder" being treated as a qid
  // PUT /api/surveys/:id/questions/reorder
  app.put('/api/surveys/:id/questions/reorder', requireAuth, async (req: any, res: any) => {
    try {
      const items = z.array(z.object({ id: z.number(), order_index: z.number() })).parse(req.body);
      for (const item of items) {
        await pool.query(
          `UPDATE survey_questions SET order_index=$1 WHERE id=$2 AND survey_id=$3`,
          [item.order_index, item.id, req.params.id]
        );
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // PUT /api/surveys/:id/questions/:qid
  app.put('/api/surveys/:id/questions/:qid', requireAuth, async (req: any, res: any) => {
    try {
      const { question_text, question_type, options, order_index } = z.object({
        question_text: z.string().min(1),
        question_type: z.enum(['rating', 'multiple_choice', 'free_text']),
        options: z.array(z.string()).optional().nullable(),
        order_index: z.number().int(),
      }).parse(req.body);
      const result = await pool.query(
        `UPDATE survey_questions
         SET question_text=$1, question_type=$2, options=$3, order_index=$4
         WHERE id=$5 AND survey_id=$6
         RETURNING *`,
        [question_text, question_type, options ? JSON.stringify(options) : null, order_index, req.params.qid, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Question not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // DELETE /api/surveys/:id/questions/:qid
  app.delete('/api/surveys/:id/questions/:qid', requireAuth, async (req: any, res: any) => {
    try {
      await pool.query(
        `DELETE FROM survey_questions WHERE id=$1 AND survey_id=$2`,
        [req.params.qid, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: Results ─────────────────────────────────────────────────────────

  app.get('/api/surveys/:id/results', requireAuth, async (req: any, res: any) => {
    try {
      const surveyRes = await pool.query(`SELECT * FROM surveys WHERE id=$1`, [req.params.id]);
      if (surveyRes.rows.length === 0) return res.status(404).json({ message: 'Survey not found' });

      const totalRes = await pool.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE submitted=true) AS submitted
         FROM survey_responses WHERE survey_id=$1`,
        [req.params.id]
      );
      const totalSent = parseInt(totalRes.rows[0].total) || 0;
      const totalSubmitted = parseInt(totalRes.rows[0].submitted) || 0;

      const questionsRes = await pool.query(
        `SELECT * FROM survey_questions WHERE survey_id=$1 ORDER BY order_index`,
        [req.params.id]
      );

      const answersRes = await pool.query(
        `SELECT sa.question_id, sa.answer_text, sa.answer_rating, sa.answer_choice
         FROM survey_answers sa
         JOIN survey_responses sr ON sr.id = sa.response_id
         WHERE sr.survey_id=$1 AND sr.submitted=true`,
        [req.params.id]
      );

      // Index answers by question_id
      const answerMap = new Map<number, any[]>();
      for (const a of answersRes.rows) {
        if (!answerMap.has(a.question_id)) answerMap.set(a.question_id, []);
        answerMap.get(a.question_id)!.push(a);
      }

      const questions = questionsRes.rows.map((q: any) => {
        const answers = answerMap.get(q.id) ?? [];
        if (q.question_type === 'rating') {
          const ratingAnswers = answers.filter((a: any) => a.answer_rating != null);
          const avg = ratingAnswers.length
            ? ratingAnswers.reduce((s: number, a: any) => s + a.answer_rating, 0) / ratingAnswers.length
            : null;
          const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
          for (const a of ratingAnswers) distribution[String(a.answer_rating)] = (distribution[String(a.answer_rating)] || 0) + 1;
          return { ...q, avgRating: avg ? parseFloat(avg.toFixed(1)) : null, distribution };
        }
        if (q.question_type === 'multiple_choice') {
          const optionCounts: Record<string, number> = {};
          for (const opt of (q.options ?? [])) optionCounts[opt] = 0;
          for (const a of answers) if (a.answer_choice) optionCounts[a.answer_choice] = (optionCounts[a.answer_choice] || 0) + 1;
          return { ...q, optionCounts };
        }
        // free_text
        return { ...q, answers: answers.map((a: any) => a.answer_text).filter(Boolean) };
      });

      // Per-agent breakdown: group by agent, compute avg rating across all rating answers
      const agentRes = await pool.query(
        `SELECT sr.agent,
           COUNT(DISTINCT sr.id)::int AS chats_handled,
           AVG(sa.answer_rating) AS avg_rating
         FROM survey_responses sr
         LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.answer_rating IS NOT NULL
         WHERE sr.survey_id=$1 AND sr.submitted=true
         GROUP BY sr.agent`,
        [req.params.id]
      );
      const agentBreakdown = agentRes.rows.map((r: any) => ({
        agent: r.agent || 'Unknown',
        chatsHandled: r.chats_handled,
        avgRating: r.avg_rating ? parseFloat(parseFloat(r.avg_rating).toFixed(1)) : null,
      }));

      res.json({
        survey: surveyRes.rows[0],
        totalSent,
        totalSubmitted,
        responseRate: totalSent > 0 ? Math.round((totalSubmitted / totalSent) * 100) : 0,
        questions,
        agentBreakdown,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Public: Survey submission ──────────────────────────────────────────────

  // GET /api/survey/:token — fetch survey for public (no auth)
  app.get('/api/survey/:token', async (req: any, res: any) => {
    try {
      const responseRes = await pool.query(
        `SELECT sr.*, s.title, s.description
         FROM survey_responses sr
         JOIN surveys s ON s.id = sr.survey_id
         WHERE sr.token = $1`,
        [req.params.token]
      );
      if (responseRes.rows.length === 0) return res.status(404).json({ message: 'Invalid or expired survey link.' });
      const response = responseRes.rows[0];
      if (response.submitted) return res.status(410).json({ message: 'This survey has already been submitted.' });
      if (new Date(response.expires_at) < new Date()) return res.status(410).json({ message: 'This survey link has expired.' });

      const questionsRes = await pool.query(
        `SELECT id, question_text, question_type, options, order_index
         FROM survey_questions WHERE survey_id=$1 ORDER BY order_index`,
        [response.survey_id]
      );
      res.json({
        surveyId: response.survey_id,
        title: response.title,
        description: response.description,
        questions: questionsRes.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/survey/:token/submit — submit answers
  app.post('/api/survey/:token/submit', async (req: any, res: any) => {
    try {
      const responseRes = await pool.query(
        `SELECT * FROM survey_responses WHERE token=$1`,
        [req.params.token]
      );
      if (responseRes.rows.length === 0) return res.status(404).json({ message: 'Invalid survey link.' });
      const response = responseRes.rows[0];
      if (response.submitted) return res.status(410).json({ message: 'Already submitted.' });
      if (new Date(response.expires_at) < new Date()) return res.status(410).json({ message: 'Link expired.' });

      const answers = z.array(z.object({
        question_id: z.number(),
        answer_text: z.string().optional().nullable(),
        answer_rating: z.number().int().min(1).max(5).optional().nullable(),
        answer_choice: z.string().optional().nullable(),
      })).parse(req.body.answers ?? []);

      for (const a of answers) {
        await pool.query(
          `INSERT INTO survey_answers (response_id, question_id, answer_text, answer_rating, answer_choice)
           VALUES ($1, $2, $3, $4, $5)`,
          [response.id, a.question_id, a.answer_text ?? null, a.answer_rating ?? null, a.answer_choice ?? null]
        );
      }

      await pool.query(
        `UPDATE survey_responses SET submitted=true, submitted_at=NOW() WHERE id=$1`,
        [response.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });
}

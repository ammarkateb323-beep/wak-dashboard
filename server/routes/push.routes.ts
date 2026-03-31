/**
 * push.routes.ts — Web Push subscription management routes.
 */

import type { Express } from 'express';
import { pushSubscriptions, VAPID_PUBLIC_KEY } from '../push';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../lib/logger';
import { api } from '@shared/routes';

const logger = createLogger('push');

export function registerPushRoutes(app: Express): void {

  app.get(api.push.vapidPublicKey.path, requireAuth, (_req: any, res: any) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post(api.push.subscribe.path, requireAuth, (req: any, res: any) => {
    const subscription = req.body;
    const agentId = req.session.agentId as number;
    pushSubscriptions.set(subscription.endpoint, { subscription, agentId });
    logger.info('Push subscription registered', `agentId: ${agentId}`);
    res.json({ success: true });
  });

  app.post(api.push.unsubscribe.path, requireAuth, (req: any, res: any) => {
    const subscription = req.body;
    pushSubscriptions.delete(subscription.endpoint);
    logger.info('Push subscription removed', `agentId: ${req.session.agentId}`);
    res.json({ success: true });
  });
}

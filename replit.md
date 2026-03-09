# WAK Solutions Agent Dashboard

A professional WhatsApp escalation management dashboard for WAK Solutions customer service agents. Built as a PWA with real-time updates.

## Overview

This is an internal tool for a single customer service agent to manage escalated WhatsApp conversations routed from an AI system via n8n.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS (Vite), routed with Wouter
- **Backend**: Node.js + Express
- **Database**: Neon Postgres (existing tables — read/write only, no migrations)
- **Auth**: Session-based (express-session + memorystore), single password
- **Push Notifications**: Web Push API (VAPID)
- **PWA**: Service worker, manifest.json, installable on Chrome/Android/iOS

## Key Files

```
client/src/
  pages/
    login.tsx         - Password login page (WAK Solutions branded)
    dashboard.tsx     - Main dashboard page
  components/
    sidebar.tsx       - Escalation list panel (left, 320px)
    chat-area.tsx     - Chat panel with message bubbles (right)
    ui-elements.tsx   - Reusable Button, Input, Card components
  hooks/
    use-auth.ts       - Login/logout/session state
    use-escalations.ts - Escalation list (polls every 5s)
    use-messages.ts   - Message history (polls every 3s)
    use-push.ts       - Push notification setup
  lib/
    utils.ts          - cn() utility + urlBase64ToUint8Array for VAPID

server/
  index.ts            - Express entry point
  routes.ts           - All API routes + session + push notification logic
  storage.ts          - DatabaseStorage class (Drizzle ORM)
  db.ts               - Drizzle + pg Pool connection

shared/
  schema.ts           - Drizzle table definitions for `messages` and `escalations`
  routes.ts           - API contract with Zod schemas

client/public/
  sw.js               - Service worker (push events, offline fallback)
  manifest.json       - PWA manifest
```

## Database Tables (Existing — Do NOT Recreate)

```sql
-- messages: id, customer_phone, direction, message_text, created_at, sender
-- escalations: customer_phone, escalation_reason, status, created_at
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/login | Public | Password login |
| POST | /api/logout | Session | Destroy session |
| GET | /api/me | Session | Auth check |
| GET | /api/escalations | Session | List open escalations |
| POST | /api/escalate | Webhook secret | n8n creates new escalation |
| POST | /api/close | Session | Close escalation |
| GET | /api/messages/:phone | Session | Message history |
| POST | /api/send | Session | Agent sends message |
| POST | /api/incoming | Webhook secret | n8n delivers customer message |
| GET | /api/push/vapid-public-key | Session | VAPID public key |
| POST | /api/push/subscribe | Session | Register push subscription |
| POST | /api/push/unsubscribe | Session | Remove push subscription |

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| DATABASE_URL | Neon Postgres connection string |
| DASHBOARD_PASSWORD | Agent login password |
| SESSION_SECRET | Express session secret |
| N8N_SEND_WEBHOOK | n8n webhook for outbound WhatsApp messages |
| N8N_CLOSE_WEBHOOK | n8n webhook for conversation close |
| WEBHOOK_SECRET | Shared secret for `x-webhook-secret` header |
| VAPID_PUBLIC_KEY | Web push VAPID public key |
| VAPID_PRIVATE_KEY | Web push VAPID private key |
| VAPID_EMAIL | Contact email for VAPID (mailto:...) |

## Branding

- Primary green: `#0F510F` (HSL: 120 68% 19%)
- Secondary green: `#408440` (HSL: 120 35% 38%)
- Background: `#F7F9F7` (HSL: 120 14% 97%)
- Font: Inter (Google Fonts)

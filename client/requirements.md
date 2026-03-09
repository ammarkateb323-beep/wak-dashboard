## Packages
date-fns | Formatting message timestamps
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes safely
lucide-react | Beautiful, consistent icons

## Notes
- PWA Support: The app registers a Service Worker (`/sw.js`) for Push Notifications.
- State: Selected conversation (escalation) is stored in local component state.
- Polling: Escalations list polls every 5 seconds, Messages list polls every 3 seconds when a conversation is open.
- The UI follows a modern SaaS inbox aesthetic (Intercom-like) with custom green primary colors.

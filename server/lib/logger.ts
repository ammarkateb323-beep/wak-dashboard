/**
 * Structured logger for the Express backend.
 *
 * Format: [LEVEL] [MODULE] message — context
 * Example: [ERROR] [auth] Session destroy failed — sid: abc123
 *
 * Usage:
 *   const logger = createLogger('auth');
 *   logger.info('Login success', `agent: ${agentId}`);
 *   logger.error('DB query failed', `query: getMessages, error: ${err.message}`);
 */

export interface Logger {
  info(message: string, context?: string): void;
  warn(message: string, context?: string): void;
  error(message: string, context?: string): void;
}

function formatLine(level: string, module: string, message: string, context?: string): string {
  const line = context ? `${message} — ${context}` : message;
  return `[${level}] [${module}] ${line}`;
}

export function createLogger(module: string): Logger {
  return {
    info(message: string, context?: string) {
      console.log(formatLine('INFO', module, message, context));
    },
    warn(message: string, context?: string) {
      console.warn(formatLine('WARN', module, message, context));
    },
    error(message: string, context?: string) {
      console.error(formatLine('ERROR', module, message, context));
    },
  };
}

/**
 * Mask all but the last 4 digits of a phone number for safe logging.
 * maskPhone("971501234567") → "****4567"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return `****${phone.slice(-4)}`;
}

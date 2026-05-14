/**
 * Structured Logger
 * 
 * Provides structured logging with context and automatic Sentry integration.
 * Logs are JSON-formatted in production for easy parsing by log aggregators.
 */

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  scanId?: string;
  requestId?: string;
  ip?: string;
  tier?: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private write(entry: LogEntry) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // JSON logs for production (parseable by log aggregators)
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable logs for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const level = entry.level.toUpperCase().padEnd(5);
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const errorStr = entry.error ? `\n  ${entry.error.name}: ${entry.error.message}` : '';
      
      console.log(`[${timestamp}] ${level} ${entry.message}${contextStr}${errorStr}`);
      
      if (entry.error?.stack) {
        console.log(`  ${entry.error.stack}`);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    const entry = this.formatLog('debug', message, context);
    this.write(entry);
  }

  info(message: string, context?: LogContext) {
    const entry = this.formatLog('info', message, context);
    this.write(entry);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    const entry = this.formatLog('warn', message, context, error);
    this.write(entry);
    
    // Send warnings to Sentry with 'warning' level
    if (error) {
      Sentry.captureException(error, {
        level: 'warning',
        contexts: { custom: context },
      });
    }
  }

  error(message: string, context?: LogContext, error?: Error) {
    const entry = this.formatLog('error', message, context, error);
    this.write(entry);
    
    // Send errors to Sentry
    if (error) {
      Sentry.captureException(error, {
        level: 'error',
        contexts: { custom: context },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: { custom: context },
      });
    }
  }

  /**
   * Set user context for Sentry
   */
  setUser(user: { id: string; email?: string; tier?: string }) {
    Sentry.setUser(user);
  }

  /**
   * Clear user context
   */
  clearUser() {
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  breadcrumb(message: string, data?: Record<string, unknown>) {
    Sentry.addBreadcrumb({
      message,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Tag the current Sentry scope with a scan ID so transactions and
   * errors emitted by this request are filterable by scan in Sentry.
   * Safe to call from any route handler — no-op when Sentry is disabled.
   */
  setScanScope(scanId: string) {
    Sentry.setTag('scan_id', scanId);
  }
}

// Export singleton instance
export const logger = new Logger();

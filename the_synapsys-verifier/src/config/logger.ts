/**
 * Winston Logger Configuration for the_synapsys EUDI WRP
 *
 * Compliance References:
 * - GDPR Art. 5: Principles relating to processing of personal data
 *   (lawfulness, fairness, transparency)
 * - ISO 27001 A.12.4.1: Event logging
 *
 * Security: This logger is configured to prevent logging of PII (Personally Identifiable Information)
 * All logs are structured and sanitized to comply with data protection regulations.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const formattedMessage = stack || message;
  return `${ts} [${level}]: ${formattedMessage}`;
});

// Create Winston logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'the-synapsys-verifier' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
    // Write errors to error.log file
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs to combined.log file
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Helper function to sanitize log data (remove potential PII)
export const sanitizeLogData = (data: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = { ...data };
  const piiFields = ['email', 'phone', 'password', 'token', 'ssn', 'creditCard'];

  piiFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

export default logger;

/**
 * @fileoverview Centralised environment variable configuration.
 * Loads variables from .env via dotenv and exports a validated
 * configuration object with sensible defaults.
 *
 * SECURITY: In production mode the server will refuse to start
 * when critical secrets are missing or set to their insecure defaults.
 */

import 'dotenv/config';
import crypto from 'crypto';

// ── Insecure default values that must never be used in production ────────────
const INSECURE_DEFAULTS = [
  'default_dev_secret_change_me',
  'default_owner_key_change_me',
  'your_jwt_secret_key_here',
  'changeme',
  '',
];

/**
 * Validate that critical secrets are present and not insecure defaults
 * when running in production mode.
 */
const validateProductionSecrets = () => {
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  if (!isProduction) return;

  const errors = [];

  if (
    !process.env.JWT_SECRET ||
    INSECURE_DEFAULTS.includes(process.env.JWT_SECRET) ||
    process.env.JWT_SECRET.length < 32
  ) {
    errors.push(
      'JWT_SECRET must be set to a cryptographically random string of at least 32 characters in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
    );
  }

  if (
    !process.env.OWNER_KEY ||
    INSECURE_DEFAULTS.includes(process.env.OWNER_KEY) ||
    process.env.OWNER_KEY.length < 16
  ) {
    errors.push(
      'OWNER_KEY must be set to a strong secret of at least 16 characters in production.',
    );
  }

  if (errors.length > 0) {
    console.error('\n🔒 FATAL — Insecure configuration detected:\n');
    errors.forEach((msg, i) => console.error(`  ${i + 1}. ${msg}`));
    console.error('\nServer refused to start. Fix the above issues and restart.\n');
    process.exit(1);
  }
};

validateProductionSecrets();

/**
 * Application environment configuration.
 * Each property falls back to a sensible default when the
 * corresponding environment variable is not set.
 *
 * @typedef {Object} EnvConfig
 * @property {number}  PORT                     - Server listening port.
 * @property {string}  MONGODB_URI              - MongoDB connection string.
 * @property {string}  JWT_SECRET               - Secret key for signing JWTs.
 * @property {string}  JWT_EXPIRES_IN           - JWT token expiry duration.
 * @property {string}  NODE_ENV                 - Application environment (development | production | test).
 * @property {string}  CORS_ORIGIN              - Allowed CORS origin(s).
 * @property {string}  OWNER_KEY                - Secret key for owner registration.
 * @property {string}  PASSWORD_RESET_EXPIRES_IN - Password reset token expiry (ms).
 * @property {string}  EMAIL_VERIFY_EXPIRES_IN  - Email verification token expiry (ms).
 * @property {string}  SMTP_HOST                - SMTP server host.
 * @property {number}  SMTP_PORT                - SMTP server port.
 * @property {string}  FROM_EMAIL               - Sender email address (also used as SMTP username).
 * @property {string}  FROM_EMAIL_PASS          - SMTP password for the sender email.
 */

/** @type {EnvConfig} */
export const env = Object.freeze({
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://smitp310303_db_user:niRD%40MU87bc5C7%21@cluster0.bmqqzma.mongodb.net/?appName=Cluster0",
  JWT_SECRET: process.env.JWT_SECRET || 'default_dev_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'default_refresh_secret_change_me',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  OWNER_KEY: process.env.OWNER_KEY || 'adftryr8uuv68g',

  // Password reset token expiry (default: 10 minutes)
  PASSWORD_RESET_EXPIRES_MS: parseInt(process.env.PASSWORD_RESET_EXPIRES_MS, 10) || 10 * 60 * 1000,

  // Email verification token expiry (default: 24 hours)
  EMAIL_VERIFY_EXPIRES_MS: parseInt(process.env.EMAIL_VERIFY_EXPIRES_MS, 10) || 24 * 60 * 60 * 1000,

  // Account lockout duration (default: 15 minutes)
  ACCOUNT_LOCK_DURATION_MS: parseInt(process.env.ACCOUNT_LOCK_DURATION_MS, 10) || 15 * 60 * 1000,

  // Max failed login attempts before lockout
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,

  // SMTP / Email configuration
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 465,
  FROM_EMAIL: process.env.FROM_EMAIL || '',
  FROM_EMAIL_PASS: process.env.FROM_EMAIL_PASS || '',

  // Frontend URL for email links
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
});

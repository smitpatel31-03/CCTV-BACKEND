/**
 * @fileoverview Server entry point for the CCTV Service Dashboard API.
 * Configures Express with security middleware, rate limiting, body parsing,
 * route registration, error handling, and starts the HTTP server after
 * establishing a database connection and initialising cron jobs.
 * @module server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import registerRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { startCronJobs } from './utils/cronJobs.js';

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate Limiting ────────────────────────────────────────────────────────────

// Strict rate limiter for authentication endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);

// Global rate limiter for all API endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use('/api', globalLimiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'CCTV Service Dashboard API is running',
    path: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'CCTV Service Dashboard API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Route Registration ───────────────────────────────────────────────────────
registerRoutes(app);

// ── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Server Bootstrap ─────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    startCronJobs();

    app.listen(env.PORT, () => {
      console.log(
        `🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`
      );
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

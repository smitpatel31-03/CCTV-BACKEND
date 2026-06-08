/**
 * @fileoverview Task log routes for viewing completion logs and revenue reports.
 * All routes require authentication via verifyToken.
 *
 * IMPORTANT: Specific named routes (/daily, /monthly-revenue) are registered
 * BEFORE parameterized routes (/:id) to prevent Express from treating path
 * segments like "daily" as an :id parameter.
 *
 * @module routes/taskLogRoutes
 */

import { Router } from 'express';
import {
  getDailyCompletionLogs,
  getMonthlyRevenue,
  getTaskLogs,
  getTaskLogById,
} from '../controllers/taskLogController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/rbac.js';

const router = Router();

// All task log routes require authentication
router.use(verifyToken);

// ── Specific named routes MUST come before /:id ──────────────────────────────

/**
 * @route   GET /api/task-logs/daily
 * @desc    Get daily task completion logs
 * @access  Private - All authenticated roles
 */
router.get('/daily', getDailyCompletionLogs);

/**
 * @route   GET /api/task-logs/monthly-revenue
 * @desc    Get monthly revenue breakdown from completed tasks
 * @access  Private - Owner, Manager
 */
router.get('/monthly-revenue', checkRole([ROLES.OWNER, ROLES.MANAGER]), getMonthlyRevenue);

// ── General and parameterized routes ─────────────────────────────────────────

/**
 * @route   GET /api/task-logs
 * @desc    Get all task logs with pagination
 * @access  Private - All authenticated roles
 */
router.get('/', getTaskLogs);

/**
 * @route   GET /api/task-logs/:id
 * @desc    Get a specific task log by ID
 * @access  Private - All authenticated roles
 */
router.get('/:id', getTaskLogById);

export default router;

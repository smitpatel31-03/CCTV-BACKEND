/**
 * @fileoverview Task management routes with role-based access control.
 * All routes require authentication via verifyToken.
 *
 * IMPORTANT: Specific named routes (/today, /by-date) are registered BEFORE
 * parameterized routes (/:id) to prevent Express from treating path segments
 * like "today" as an :id parameter.
 *
 * @module routes/taskRoutes
 */

import { Router } from 'express';
import {
  getTodayTasks,
  getTasksByDate,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '../controllers/taskController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/rbac.js';
import { validate, validateTask } from '../middleware/validate.js';

const router = Router();

// All task routes require authentication
router.use(verifyToken);

// ── Specific named routes MUST come before /:id ──────────────────────────────

/**
 * @route   GET /api/tasks/today
 * @desc    Get tasks scheduled for today
 * @access  Private - All roles (employees see only their assigned tasks)
 */
router.get('/today', getTodayTasks);

/**
 * @route   GET /api/tasks/by-date
 * @desc    Get tasks filtered by a specific date or date range
 * @access  Private - Owner, Manager, Admin
 */
router.get('/by-date', checkRole([ROLES.OWNER, ROLES.MANAGER, ROLES.ADMIN]), getTasksByDate);

// ── General and parameterized routes ─────────────────────────────────────────

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks (employees see only their assigned tasks)
 * @access  Private - All roles
 */
router.get('/', getTasks);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private - All authenticated roles
 */
router.get('/:id', getTaskById);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private - Owner, Manager, Admin
 */
router.post('/', checkRole([ROLES.OWNER, ROLES.MANAGER, ROLES.ADMIN]), validate(validateTask), createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update an existing task
 * @access  Private - Owner, Manager, Admin
 */
router.put('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER, ROLES.ADMIN]), updateTask);

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    Update only the status of a task
 * @access  Private - All roles (controller enforces per-role logic)
 */
router.patch('/:id/status', updateTaskStatus);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private - Owner, Manager, Admin
 */
router.delete('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER, ROLES.ADMIN]), deleteTask);

export default router;

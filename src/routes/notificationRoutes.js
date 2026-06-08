/**
 * @fileoverview Notification routes for managing user notifications.
 * All routes require authentication via verifyToken.
 *
 * IMPORTANT: Specific named routes (/unread-count, /read-all) are registered
 * BEFORE parameterized routes (/:id) to prevent Express from treating path
 * segments like "unread-count" as an :id parameter.
 *
 * @module routes/notificationRoutes
 */

import { Router } from 'express';
import {
  getUnreadCount,
  markAllAsRead,
  getNotifications,
  markAsRead,
} from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(verifyToken);

// ── Specific named routes MUST come before /:id ──────────────────────────────

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get the count of unread notifications for the authenticated user
 * @access  Private
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for the authenticated user
 * @access  Private
 */
router.patch('/read-all', markAllAsRead);

// ── General and parameterized routes ─────────────────────────────────────────

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the authenticated user with pagination
 * @access  Private
 */
router.get('/', getNotifications);

/**
 * @route   PATCH /api/notifications/:id
 * @desc    Mark a specific notification as read
 * @access  Private
 */
router.patch('/:id', markAsRead);

export default router;

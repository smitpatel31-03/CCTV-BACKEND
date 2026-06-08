/**
 * @fileoverview User management routes with role-based access control.
 * All routes require authentication via verifyToken.
 * @module routes/userRoutes
 */

import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
} from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/rbac.js';
import { validate, validateRegister } from '../middleware/validate.js';

const router = Router();

// All user routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/users
 * @desc    Get all users in the company
 * @access  Private - Owner, Manager
 */
router.get('/', checkRole([ROLES.OWNER, ROLES.MANAGER]), getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get a specific user by ID
 * @access  Private - Owner, Manager
 */
router.get('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER]), getUserById);

/**
 * @route   POST /api/users
 * @desc    Create a new user within the company
 * @access  Private - Owner, Manager
 */
router.post('/', checkRole([ROLES.OWNER, ROLES.MANAGER]), validate(validateRegister), createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update an existing user's information
 * @access  Private - Owner, Manager
 */
router.put('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER]), updateUser);

/**
 * @route   PATCH /api/users/:id/deactivate
 * @desc    Deactivate a user account (soft delete)
 * @access  Private - Owner only
 */
router.patch('/:id/deactivate', checkRole([ROLES.OWNER]), deactivateUser);

export default router;

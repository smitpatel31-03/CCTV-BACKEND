/**
 * @fileoverview Client management routes with role-based access control.
 * All routes require authentication via verifyToken.
 * @module routes/clientRoutes
 */

import { Router } from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory,
} from '../controllers/clientController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/rbac.js';
import { validate, validateClient } from '../middleware/validate.js';

const router = Router();

// All client routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/clients
 * @desc    Get all clients for the company
 * @access  Private - Owner, Manager
 */
router.get('/', checkRole([ROLES.OWNER, ROLES.MANAGER]), getClients);

/**
 * @route   GET /api/clients/:id
 * @desc    Get a specific client by ID
 * @access  Private - All authenticated roles
 */
router.get('/:id', getClientById);

/**
 * @route   POST /api/clients
 * @desc    Create a new client record
 * @access  Private - Owner, Manager
 */
router.post('/', checkRole([ROLES.OWNER, ROLES.MANAGER]), validate(validateClient), createClient);

/**
 * @route   PUT /api/clients/:id
 * @desc    Update an existing client's information
 * @access  Private - Owner, Manager
 */
router.put('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER]), updateClient);

/**
 * @route   DELETE /api/clients/:id
 * @desc    Delete a client record
 * @access  Private - Owner, Manager
 */
router.delete('/:id', checkRole([ROLES.OWNER, ROLES.MANAGER]), deleteClient);

/**
 * @route   GET /api/clients/:id/history
 * @desc    Get task/service history for a specific client
 * @access  Private - All authenticated users
 */
router.get('/:id/history', getClientHistory);

export default router;

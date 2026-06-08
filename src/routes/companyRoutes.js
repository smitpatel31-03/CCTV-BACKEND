/**
 * @fileoverview Company management routes with role-based access control.
 * All routes require authentication via verifyToken.
 * @module routes/companyRoutes
 */

import { Router } from 'express';
import {
  getCompany,
  updateCompany,
  deactivateCompany,
} from '../controllers/companyController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/rbac.js';
import { validate, validateCompany } from '../middleware/validate.js';

const router = Router();

// All company routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/companies
 * @desc    Get the authenticated user's company details
 * @access  Private - All authenticated roles
 */
router.get('/', getCompany);

/**
 * @route   PUT /api/companies
 * @desc    Update company information
 * @access  Private - Owner only
 */
router.put('/', checkRole([ROLES.OWNER]), validate(validateCompany), updateCompany);

/**
 * @route   PATCH /api/companies/deactivate
 * @desc    Deactivate the company account
 * @access  Private - Owner only
 */
router.patch('/deactivate', checkRole([ROLES.OWNER]), deactivateCompany);

export default router;

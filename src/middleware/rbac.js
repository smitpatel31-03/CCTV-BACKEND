/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Provides role constants, a role hierarchy for cascading permissions,
 * and a factory function that returns Express middleware to gate routes
 * by one or more allowed roles.
 *
 * @module middleware/rbac
 */

/** @enum {string} Available user roles */
export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
};

/**
 * Hierarchical permissions map.
 * Each role implicitly includes the permissions of every role below it.
 *
 * @type {Record<string, string[]>}
 */
export const ROLE_HIERARCHY = {
  owner: ['owner', 'manager', 'admin', 'employee'],
  manager: ['manager', 'admin', 'employee'],
  admin: ['admin', 'employee'],
  employee: ['employee'],
};

/**
 * Factory that creates role-checking middleware.
 *
 * @param {string[]} allowedRoles - Roles permitted to access the route.
 * @returns {import('express').RequestHandler} Express middleware function.
 *
 * @example
 * // Only owners and managers may access this route
 * router.get('/reports', verifyToken, checkRole([ROLES.OWNER, ROLES.MANAGER]), getReports);
 */
export const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in first.',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}. Your current role is '${userRole}'.`,
      });
    }

    next();
  };
};

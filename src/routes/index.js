/**
 * @fileoverview Central route aggregator. Imports all route modules and mounts
 * them on the Express application under their respective API base paths.
 * @module routes/index
 */

import authRoutes from './authRoutes.js';
import companyRoutes from './companyRoutes.js';
import userRoutes from './userRoutes.js';
import clientRoutes from './clientRoutes.js';
import taskRoutes from './taskRoutes.js';
import taskLogRoutes from './taskLogRoutes.js';
import notificationRoutes from './notificationRoutes.js';

/**
 * Registers all application route modules on the Express app instance.
 * @param {import('express').Application} app - The Express application instance
 */
const registerRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/task-logs', taskLogRoutes);
  app.use('/api/notifications', notificationRoutes);
};

export default registerRoutes;

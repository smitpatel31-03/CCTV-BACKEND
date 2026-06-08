/**
 * @fileoverview JWT Authentication Middleware.
 *
 * Extracts and verifies a Bearer token from the Authorization header,
 * looks up the associated user, and attaches it to `req.user`.
 *
 * Security checks:
 * - Token validity and expiration
 * - User existence
 * - User active status (rejects deactivated accounts)
 * - Email verification status (rejects unverified accounts)
 *
 * @module middleware/auth
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

/**
 * JWT Authentication Middleware
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Malformed authorization header.',
      });
    }

    /** @type {{ id: string, role: string, type: string, iat: number, exp: number }} */
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Ensure this is an access token, not a refresh token
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token type.',
      });
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User associated with this token no longer exists.',
      });
    }

    // Block deactivated accounts
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact your administrator.',
      });
    }

    // Block unverified email accounts
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email address before accessing this resource.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token has expired.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Access denied. Token verification failed.',
    });
  }
};

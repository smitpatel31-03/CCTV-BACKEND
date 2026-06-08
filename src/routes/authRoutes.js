/**
 * @fileoverview Authentication routes for user registration, login,
 * email verification, password reset, token refresh, logout, and profile retrieval.
 * @module routes/authRoutes
 */

import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  logout,
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';
import {
  validate,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateResendVerification,
} from '../middleware/validate.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', validate(validateRegister), register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return access + refresh tokens
 * @access  Public
 */
router.post('/login', validate(validateLogin), login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Get a new access token using a valid refresh token
 * @access  Public
 */
router.post('/refresh-token', refreshTokenHandler);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', verifyToken, logout);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify a user's email address using a token
 * @access  Public
 */
router.get('/verify-email', verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend the email verification token
 * @access  Public
 */
router.post('/resend-verification', validate(validateResendVerification), resendVerification);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset email
 * @access  Public
 */
router.post('/forgot-password', validate(validateForgotPassword), forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using a valid, non-expired token
 * @access  Public
 */
router.post('/reset-password/:token', validate(validateResetPassword), resetPassword);

/**
 * @route   GET /api/auth/profile
 * @desc    Get the authenticated user's profile
 * @access  Private
 */
router.get('/profile', verifyToken, getProfile);

export default router;

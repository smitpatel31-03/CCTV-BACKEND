/**
 * @fileoverview Authentication controller handling registration, login,
 * email verification, password reset, token refresh, logout, and profile retrieval.
 *
 * Security controls implemented:
 * - Access token (short-lived) + Refresh token (long-lived, stored in DB)
 * - Account lockout after repeated failed logins
 * - Deactivated-user blocking
 * - Email verification requirement
 * - Expiring password-reset tokens (hashed storage)
 * - Generic error messages to prevent information leakage
 *
 * @module controllers/authController
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { env } from '../config/env.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a short-lived JWT access token.
 * @param {string} userId - The user's MongoDB _id.
 * @param {string} role - The user's role.
 * @returns {string} Signed JWT access token.
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN || '15m',
  });
};

/**
 * Generate a long-lived JWT refresh token.
 * @param {string} userId - The user's MongoDB _id.
 * @returns {string} Signed JWT refresh token.
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });
};

/**
 * Parse a duration string (e.g. '7d', '15m', '1h') into milliseconds.
 * @param {string} duration
 * @returns {number}
 */
const parseDuration = (duration) => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * (multipliers[unit] || multipliers.d);
};

/**
 * Generate both tokens and store refresh token in DB.
 * @param {import('mongoose').Document} user
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
const generateAndStoreTokens = async (user) => {
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Hash the refresh token before storing in DB
  const hashedRefreshToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  const refreshExpiresMs = parseDuration(env.REFRESH_TOKEN_EXPIRES_IN || '7d');

  await User.findByIdAndUpdate(user._id, {
    refreshToken: hashedRefreshToken,
    refreshTokenExpires: new Date(Date.now() + refreshExpiresMs),
  });

  return { accessToken, refreshToken };
};

// ── Registration ───────────────────────────────────────────────────────────

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 *
 * If role is 'owner', company details (companyName, companyAddress, companyEmail)
 * are required and a new Company document is created first.
 * For non-owner roles, an existing companyId must be provided.
 *
 * A verification email is sent after successful registration.
 * The user must verify their email before they can log in.
 */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      companyId,
      companyName,
      companyAddress,
      companyEmail,
      ownerKey,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    let assignedCompanyId = companyId;

    // Owner registration — create a new company
    if (role === 'owner') {
      // Verify owner secret key using timing-safe comparison
      if (
        !ownerKey ||
        ownerKey.length !== env.OWNER_KEY.length ||
        !crypto.timingSafeEqual(Buffer.from(ownerKey), Buffer.from(env.OWNER_KEY))
      ) {
        return res.status(403).json({
          success: false,
          error: 'Invalid owner key',
        });
      }

      if (!companyName || !companyAddress || !companyEmail) {
        return res.status(400).json({
          success: false,
          error:
            'Company details (companyName, companyAddress, companyEmail) are required for owner registration',
        });
      }

      const company = await Company.create({
        name: companyName,
        address: companyAddress,
        contactEmail: companyEmail,
      });

      assignedCompanyId = company._id;
    } else {
      // Non-owner roles must supply an existing companyId
      if (!assignedCompanyId) {
        return res.status(400).json({
          success: false,
          error: 'companyId is required for non-owner registration',
        });
      }

      const companyExists = await Company.findById(assignedCompanyId);
      if (!companyExists) {
        return res.status(404).json({
          success: false,
          error: 'Company not found',
        });
      }
    }

    // Create user — password hashing is handled by the pre-save hook
    const user = await User.create({
      name,
      email,
      password,
      role,
      companyId: assignedCompanyId,
      isEmailVerified: false,
    });

    // Generate and send email verification token
    const verificationToken = await user.createEmailVerificationToken();

    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
      // Don't fail registration if email fails — user can resend later
    }

    // Generate tokens so the frontend can store them (access is limited until email is verified)
    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    // Build response payload without sensitive fields
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.failedLoginAttempts;
    delete userResponse.lockUntil;
    delete userResponse.refreshToken;
    delete userResponse.refreshTokenExpires;

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
};

// ── Login ──────────────────────────────────────────────────────────────────

/**
 * @desc    Login user & return access + refresh tokens
 * @route   POST /api/auth/login
 * @access  Public
 *
 * Security checks performed:
 * 1. Account existence (generic "Invalid credentials" to prevent enumeration)
 * 2. Account active status
 * 3. Account lockout status
 * 4. Email verification status
 * 5. Password comparison
 * 6. Failed attempt tracking & lockout
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    // Explicitly select security fields needed for login checks
    const user = await User.findOne({ email }).select(
      '+password +failedLoginAttempts +lockUntil',
    );

    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if the account has been deactivated
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated. Please contact your administrator.',
      });
    }

    // Check if the account is currently locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email address before logging in. Check your inbox or request a new verification email.',
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts (may trigger lockout)
      await user.incrementLoginAttempts();

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Successful login — reset failed attempt counter
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await user.resetLoginAttempts();
    }

    // Generate access + refresh tokens and store refresh in DB
    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.failedLoginAttempts;
    delete userResponse.lockUntil;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;
    delete userResponse.refreshToken;
    delete userResponse.refreshTokenExpires;

    return res.status(200).json({
      success: true,
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during login',
    });
  }
};

// ── Refresh Token ──────────────────────────────────────────────────────────

/**
 * @desc    Get a new access token using a valid refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public (requires valid refresh token in body)
 */
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Verify the refresh token JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please log in again.',
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
      });
    }

    // Hash the incoming refresh token to compare against stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Find user with matching refresh token that hasn't expired
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: hashedToken,
      refreshTokenExpires: { $gt: Date.now() },
    }).select('+refreshToken +refreshTokenExpires');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please log in again.',
      });
    }

    // Check if user is still active
    if (!user.isActive) {
      // Clear the refresh token
      await User.findByIdAndUpdate(user._id, {
        $unset: { refreshToken: 1, refreshTokenExpires: 1 },
      });

      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated.',
      });
    }

    // Rotate tokens — generate new pair for security
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateAndStoreTokens(user);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error('RefreshToken error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during token refresh',
    });
  }
};

// ── Logout ─────────────────────────────────────────────────────────────────

/**
 * @desc    Logout user — invalidate refresh token
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Clear the refresh token from DB
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { refreshToken: 1, refreshTokenExpires: 1 },
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during logout',
    });
  }
};

// ── Email Verification ─────────────────────────────────────────────────────

/**
 * @desc    Verify user's email address using a token
 * @route   GET /api/auth/verify-email?token=xxx
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token. Please request a new one.',
      });
    }

    // Mark email as verified and clear token fields
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('VerifyEmail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during email verification',
    });
  }
};

/**
 * @desc    Resend email verification token
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const user = await User.findOne({ email });

    // Always return success to prevent user enumeration
    if (!user || user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'If an unverified account with that email exists, a verification email has been sent.',
      });
    }

    const verificationToken = await user.createEmailVerificationToken();

    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'If an unverified account with that email exists, a verification email has been sent.',
    });
  } catch (error) {
    console.error('ResendVerification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during verification resend',
    });
  }
};

// ── Password Reset ─────────────────────────────────────────────────────────

/**
 * @desc    Request a password reset — sends reset email with expiring token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const user = await User.findOne({ email });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    if (!user.isActive) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const resetToken = await user.createPasswordResetToken();

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError.message);
      // Clear the reset token since the email failed
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        error: 'Failed to send password reset email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during password reset request',
    });
  }
};

/**
 * @desc    Reset password using a valid, non-expired token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'New password is required',
      });
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    // Update password and clear reset token fields
    user.password = password; // Will be hashed by pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Also reset any account lockout from failed attempts
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    // Invalidate any existing refresh token (force re-login)
    await User.findByIdAndUpdate(user._id, {
      $unset: { refreshToken: 1, refreshTokenExpires: 1 },
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('ResetPassword error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during password reset',
    });
  }
};

// ── Profile ────────────────────────────────────────────────────────────────

/**
 * @desc    Get current logged-in user's profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('companyId');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GetProfile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error fetching profile',
    });
  }
};

export {
  register,
  login,
  getProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  logout,
};

/**
 * @fileoverview Mongoose model for the User entity.
 * Handles user authentication concerns (password hashing & comparison),
 * account lockout, email verification, and password reset tokens.
 * Enforces role-based access via an enum.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env.js';

/** Number of salt rounds used by bcryptjs for password hashing. */
const SALT_ROUNDS = 12;

/**
 * @typedef {Object} UserDocument
 * @property {mongoose.Types.ObjectId} companyId - Owning company reference.
 * @property {string}  name      - Full name.
 * @property {string}  email     - Unique login email.
 * @property {string}  password  - Hashed password (excluded from queries by default).
 * @property {string}  role      - One of owner | manager | admin | employee.
 * @property {boolean} isActive  - Whether the user account is active.
 * @property {boolean} isEmailVerified - Whether the user's email has been verified.
 * @property {number}  failedLoginAttempts - Consecutive failed login count.
 * @property {Date}    lockUntil - Account is locked until this timestamp.
 * @property {string}  emailVerificationToken - Hashed email verification token.
 * @property {Date}    emailVerificationExpires - Verification token expiry.
 * @property {string}  passwordResetToken - Hashed password reset token.
 * @property {Date}    passwordResetExpires - Reset token expiry.
 */

const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
    },

    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries unless explicitly selected
    },

    role: {
      type: String,
      enum: {
        values: ['owner', 'manager', 'admin', 'employee'],
        message: '{VALUE} is not a valid role',
      },
      default: 'employee',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Email Verification ─────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // ── Password Reset ─────────────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ── Account Lockout ────────────────────────────────────────────────────
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },

    // ── Refresh Token ──────────────────────────────────────────────────────
    refreshToken: {
      type: String,
      select: false,
    },

    refreshTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────
userSchema.index({ companyId: 1 });
userSchema.index({ companyId: 1, email: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ refreshToken: 1 });

// ── Pre-save Hook: Hash password ───────────────────────────────────────
/**
 * Hash the user's password before saving, but only when the
 * password field has been created or modified.
 */
userSchema.pre('save', async function preSaveHashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

// ── Instance Methods ───────────────────────────────────────────────────

/**
 * Compare a plain-text candidate password against the stored hash.
 *
 * @param {string} candidatePassword - The plain-text password to verify.
 * @returns {Promise<boolean>} Resolves to true when the passwords match.
 */
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if the account is currently locked due to too many failed login attempts.
 *
 * @returns {boolean} True if the account is locked.
 */
userSchema.methods.isLocked = function isLocked() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment the failed login attempt counter. If the counter reaches the
 * maximum allowed attempts, lock the account for the configured duration.
 *
 * @returns {Promise<void>}
 */
userSchema.methods.incrementLoginAttempts = async function incrementLoginAttempts() {
  // If a previous lock has expired, reset the counter
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  // Lock the account if we've reached the max attempts
  if (this.failedLoginAttempts + 1 >= env.MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + env.ACCOUNT_LOCK_DURATION_MS) };
  }

  return this.updateOne(updates);
};

/**
 * Reset the failed login attempt counter and clear any lockout.
 * Should be called on successful authentication.
 *
 * @returns {Promise<void>}
 */
userSchema.methods.resetLoginAttempts = async function resetLoginAttempts() {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

/**
 * Generate a cryptographically secure email verification token.
 * Stores a SHA-256 hash of the token in the database and returns
 * the plain-text token for inclusion in the verification URL.
 *
 * @returns {Promise<string>} The plain-text verification token.
 */
userSchema.methods.createEmailVerificationToken = async function createEmailVerificationToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(plainToken)
    .digest('hex');
  this.emailVerificationExpires = new Date(Date.now() + env.EMAIL_VERIFY_EXPIRES_MS);

  await this.save({ validateBeforeSave: false });

  return plainToken;
};

/**
 * Generate a cryptographically secure password reset token.
 * Stores a SHA-256 hash of the token in the database and returns
 * the plain-text token for inclusion in the reset URL.
 *
 * @returns {Promise<string>} The plain-text reset token.
 */
userSchema.methods.createPasswordResetToken = async function createPasswordResetToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(plainToken)
    .digest('hex');
  this.passwordResetExpires = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MS);

  await this.save({ validateBeforeSave: false });

  return plainToken;
};

const User = mongoose.model('User', userSchema);

export default User;

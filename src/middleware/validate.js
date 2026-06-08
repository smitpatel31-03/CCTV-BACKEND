import { body, validationResult } from 'express-validator';
import { ROLES } from './rbac.js';

/**
 * Validation Middleware Factory
 *
 * Wraps an array of express-validator validation chains with a final
 * handler that inspects results and returns formatted 400 errors.
 *
 * @param {import('express-validator').ValidationChain[]} rules - Validation chains to run.
 * @returns {Array<import('express').RequestHandler>} Middleware array ready for route use.
 *
 * @example
 * router.post('/register', validate(validateRegister), registerUser);
 */
export const validate = (rules) => {
  return [
    ...rules,
    /**
     * Result handler – collects validation errors and responds with 400
     * if any exist, otherwise passes control to the next middleware.
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     */
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
          })),
        });
      }

      next();
    },
  ];
};

// ---------------------------------------------------------------------------
// Reusable Validation Chains
// ---------------------------------------------------------------------------

/**
 * Validation rules for user registration.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one digit.')
    .matches(/[!@#$%^&*(),.?":{}|<>\[\]\\\-_+=~`]/) 
    .withMessage('Password must contain at least one special character.'),

  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage(
      `Role must be one of: ${Object.values(ROLES).join(', ')}.`,
    ),
];

/**
 * Validation rules for user login.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

/**
 * Validation rules for forgot-password request.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
];

/**
 * Validation rules for password reset.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateResetPassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one digit.')
    .matches(/[!@#$%^&*(),.?":{}|<>\[\]\\\-_+=~`]/)
    .withMessage('Password must contain at least one special character.'),
];

/**
 * Validation rules for resend verification request.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateResendVerification = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
];

/**
 * Validation rules for company creation / update.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateCompany = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Company name is required.')
    .isLength({ max: 200 })
    .withMessage('Company name must not exceed 200 characters.'),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Company address is required.'),

  body('contactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid contact email address.')
    .normalizeEmail(),
];

/**
 * Validation rules for client creation / update.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateClient = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Client name is required.')
    .isLength({ max: 200 })
    .withMessage('Client name must not exceed 200 characters.'),

  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required.')
    .isLength({ max: 200 })
    .withMessage('Company name must not exceed 200 characters.'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Client phone number is required.'),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Client address is required.'),
];

/**
 * Validation rules for task creation / update.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateTask = [
  body('clientId')
    .notEmpty()
    .withMessage('Client ID is required.')
    .isMongoId()
    .withMessage('Client ID must be a valid MongoDB ObjectId.'),

  body('assignedTo')
    .notEmpty()
    .withMessage('Assigned user ID is required.')
    .isMongoId()
    .withMessage('Assigned user ID must be a valid MongoDB ObjectId.'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required.')
    .isLength({ max: 300 })
    .withMessage('Task title must not exceed 300 characters.'),

  body('scheduledDate')
    .notEmpty()
    .withMessage('Scheduled date is required.')
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date string.'),

  body('estimatedAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated amount must be a non-negative number.'),
];

/**
 * Validation rules for task completion.
 * @type {import('express-validator').ValidationChain[]}
 */
export const validateTaskCompletion = [
  body('actionSummary')
    .trim()
    .notEmpty()
    .withMessage('Action summary is required.'),

  body('amountCollected')
    .notEmpty()
    .withMessage('Amount collected is required.')
    .isFloat({ min: 0 })
    .withMessage('Amount collected must be a non-negative number.'),
];

/**
 * @fileoverview Shared helper utilities used across the application.
 * Provides date manipulation, pagination, and response formatting helpers.
 * @module utils/helpers
 */

/**
 * Returns a new Date set to the very start of the given day (00:00:00.000).
 * @param {Date|string} date - The reference date
 * @returns {Date} Start-of-day Date object
 */
export const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Returns a new Date set to the very end of the given day (23:59:59.999).
 * @param {Date|string} date - The reference date
 * @returns {Date} End-of-day Date object
 */
export const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Extracts pagination parameters from an Express query object and returns
 * computed values for use with Mongoose's `.skip()` and `.limit()`.
 *
 * Defaults: page = 1, limit = 10 (capped at 100).
 *
 * @param {object} query - Express `req.query` object
 * @param {string|number} [query.page=1] - Requested page number (1-indexed)
 * @param {string|number} [query.limit=10] - Items per page
 * @returns {{ skip: number, limit: number, page: number }}
 */
export const buildPaginationQuery = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  return { skip, limit, page };
};

/**
 * Builds a standardised API response envelope.
 *
 * @param {boolean} success - Whether the operation succeeded
 * @param {*} data - Payload to include in the response (may be null)
 * @param {string} [message=''] - Optional human-readable message
 * @returns {{ success: boolean, data: *, message: string }}
 */
export const formatResponse = (success, data, message = '') => ({
  success,
  data,
  message,
});

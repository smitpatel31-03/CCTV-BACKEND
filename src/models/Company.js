/**
 * @fileoverview Mongoose model for the Company entity.
 * Represents a CCTV service agency / organisation that owns
 * users, clients, tasks, and related resources.
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} CompanyDocument
 * @property {string}  name         - Company name.
 * @property {string}  address      - Physical address.
 * @property {string}  contactEmail - Primary contact email (unique).
 * @property {boolean} isActive     - Whether the company account is active.
 */

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },

    address: {
      type: String,
      required: [true, 'Company address is required'],
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },

    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────

const Company = mongoose.model('Company', companySchema);

export default Company;

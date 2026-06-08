/**
 * @fileoverview Mongoose model for the Client entity.
 * Represents a customer / site owner that a service company
 * provides CCTV installation and maintenance services to.
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} ClientDocument
 * @property {mongoose.Types.ObjectId} companyId - Owning company reference.
 * @property {string}  name    - Client's full name.
 * @property {string}  companyName - Client's company name.
 * @property {string}  phone   - Contact phone number.
 * @property {string}  address - Site / billing address.
 * @property {string}  status  - active | inactive.
 */

const clientSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
    },

    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: [200, 'Client name cannot exceed 200 characters'],
    },

    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },

    address: {
      type: String,
      required: [true, 'Address is required'],
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },

    addressMapLink:{
      type: String,
      trim: true,
      maxlength: [500, 'Address map link cannot exceed 500 characters'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} is not a valid status',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────
clientSchema.index({ companyId: 1 });

const Client = mongoose.model('Client', clientSchema);

export default Client;

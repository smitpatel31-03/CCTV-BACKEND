/**
 * @fileoverview Mongoose model for the Task entity.
 * Represents a service job (installation, maintenance, repair, etc.)
 * assigned to an employee for a specific client and scheduled date.
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} TaskDocument
 * @property {mongoose.Types.ObjectId} companyId      - Owning company.
 * @property {mongoose.Types.ObjectId} clientId       - Target client / site.
 * @property {mongoose.Types.ObjectId} assignedTo     - Employee assigned.
 * @property {mongoose.Types.ObjectId} createdBy      - User who created the task.
 * @property {string}  title           - Short task title.
 * @property {string}  [description]   - Detailed description.
 * @property {Date}    scheduledDate   - When the task is scheduled.
 * @property {string}  status          - pending | in-progress | completed | canceled.
 * @property {number}  estimatedAmount - Estimated cost / charge for the job.
 */

const taskSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client ID is required'],
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user is required'],
    },

    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },

    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },

    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'hold', 'in-progress', 'completed', 'canceled'],
        message: '{VALUE} is not a valid task status',
      },
      default: 'pending',
    },

    estimatedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Estimated amount cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────
taskSchema.index({ companyId: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ scheduledDate: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ companyId: 1, status: 1, scheduledDate: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;

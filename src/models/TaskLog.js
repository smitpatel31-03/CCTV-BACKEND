/**
 * @fileoverview Mongoose model for the TaskLog entity.
 * Records an immutable audit entry whenever a task is completed,
 * capturing who finished it, the summary, and the amount collected.
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} TaskLogDocument
 * @property {mongoose.Types.ObjectId} taskId         - Reference to the parent task.
 * @property {mongoose.Types.ObjectId} clientId       - Reference to the client.
 * @property {mongoose.Types.ObjectId} completedBy    - User who completed the task.
 * @property {string}  actionSummary   - Free-text summary of work performed.
 * @property {number}  amountCollected - Payment collected on site.
 * @property {Date}    completionDate  - When the task was completed.
 */

const taskLogSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
    },

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

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Completed-by user is required'],
    },

    actionSummary: {
      type: String,
      required: [true, 'Action summary is required'],
      maxlength: [2000, 'Action summary cannot exceed 2000 characters'],
    },

    amountCollected: {
      type: Number,
      required: [true, 'Amount collected is required'],
      min: [0, 'Amount collected cannot be negative'],
    },

    completionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────
taskLogSchema.index({ taskId: 1 });
taskLogSchema.index({ completedBy: 1 });
taskLogSchema.index({ completionDate: 1 });
taskLogSchema.index({ companyId: 1 });
taskLogSchema.index({ taskId: 1, completedBy: 1, completionDate: 1 });

const TaskLog = mongoose.model('TaskLog', taskLogSchema);

export default TaskLog;

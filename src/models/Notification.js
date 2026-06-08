/**
 * @fileoverview Mongoose model for the Notification entity.
 * Represents a time-triggered notification linked to a task
 * and delivered to a specific user.
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} NotificationDocument
 * @property {mongoose.Types.ObjectId} userId      - Target user to notify.
 * @property {mongoose.Types.ObjectId} taskId      - Related task.
 * @property {string}  message     - Notification body text.
 * @property {boolean} isRead      - Whether the user has read it.
 * @property {Date}    triggerTime - When the notification should fire.
 */

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    triggerTime: {
      type: Date,
      required: [true, 'Trigger time is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────
notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ triggerTime: 1 });
notificationSchema.index({ userId: 1, isRead: 1, triggerTime: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

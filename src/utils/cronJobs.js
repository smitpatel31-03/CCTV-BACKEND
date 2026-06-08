/**
 * @fileoverview Cron job utilities for scheduled background tasks.
 * Runs a per-minute job to generate 30-minute advance reminder notifications
 * for upcoming tasks, with duplicate detection to prevent repeated alerts.
 * @module utils/cronJobs
 */

import cron from 'node-cron';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';

/**
 * Starts all scheduled cron jobs for the application.
 *
 * Currently registers a single job that runs every minute to:
 * 1. Calculate a 29.5–30.5 minute lookahead window from the current time.
 * 2. Find tasks whose scheduledDate falls within that window and whose
 *    status is either 'pending' or 'in-progress'.
 * 3. For each matching task, check whether a notification already exists
 *    for the same user, task, and triggerTime (to avoid duplicates).
 * 4. If no duplicate exists, create a new reminder Notification document.
 * 5. Log the total number of notifications created per run.
 */
export const startCronJobs = () => {
  // ── Task Reminder Cron — runs every minute ───────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Define the lookahead window: 29.5 to 30.5 minutes from now
      const windowStart = new Date(now.getTime() + 29.5 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30.5 * 60 * 1000);

      // Find tasks scheduled within the window that are still actionable
      const upcomingTasks = await Task.find({
        scheduledDate: { $gte: windowStart, $lte: windowEnd },
        status: { $in: ['pending', 'in-progress'] },
      });

      if (upcomingTasks.length === 0) {
        return;
      }

      let notificationsCreated = 0;

      for (const task of upcomingTasks) {
        // Check for an existing notification to prevent duplicates
        const existingNotification = await Notification.findOne({
          userId: task.assignedTo,
          taskId: task._id,
          triggerTime: task.scheduledDate,
        });

        if (!existingNotification) {
          await Notification.create({
            userId: task.assignedTo,
            taskId: task._id,
            message: `Reminder: Task "${task.title}" is scheduled in 30 minutes.`,
            isRead: false,
            triggerTime: task.scheduledDate,
          });

          notificationsCreated++;
        }
      }

      if (notificationsCreated > 0) {
        console.log(
          `📢 Cron: Created ${notificationsCreated} task reminder notification(s).`
        );
      }
    } catch (error) {
      console.error('❌ Cron job error (task reminders):', error.message);
    }
  });

  console.log('⏰ Cron jobs started successfully.');
};

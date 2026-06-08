import Notification from '../models/Notification.js';

/**
 * @desc    Get the logged-in user's notifications, sorted by triggerTime descending
 * @route   GET /api/notifications
 * @access  Private
 * @query   isRead (true/false)
 */
const getNotifications = async (req, res) => {
  try {
    const filter = { userId: req.user._id };

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    const notifications = await Notification.find(filter).sort({
      triggerTime: -1,
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('GetNotifications error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching notifications',
    });
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error marking notification as read',
    });
  }
};

/**
 * @desc    Mark all of the user's notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (error) {
    console.error('MarkAllAsRead error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error marking all notifications as read',
    });
  }
};

/**
 * @desc    Get the count of unread notifications for the logged-in user
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    console.error('GetUnreadCount error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching unread count',
    });
  }
};

export { getNotifications, markAsRead, markAllAsRead, getUnreadCount };

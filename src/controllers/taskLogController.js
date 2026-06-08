import mongoose from 'mongoose';
import TaskLog from '../models/TaskLog.js';

/**
 * @desc    List task logs for the user's company.
 *          Populates task and completedBy fields.
 * @route   GET /api/task-logs
 * @access  Private
 * @query   completedBy, taskId, startDate, endDate
 */
const getTaskLogs = async (req, res) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.query.completedBy) {
      filter.completedBy = req.query.completedBy;
    }

    if (req.query.taskId) {
      filter.taskId = req.query.taskId;
    }

    // Date range filter on completionDate
    if (req.query.startDate || req.query.endDate) {
      filter.completionDate = {};
      if (req.query.startDate) {
        filter.completionDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.completionDate.$lte = new Date(req.query.endDate);
      }
    }

    const logs = await TaskLog.find(filter)
      .populate('taskId')
      .populate('completedBy', 'name email')
      .populate('clientId', 'name phone companyName')
      .sort({ completionDate: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('GetTaskLogs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching task logs',
    });
  }
};

/**
 * @desc    Get a single task log by ID
 * @route   GET /api/task-logs/:id
 * @access  Private
 */
const getTaskLogById = async (req, res) => {
  try {
    const log = await TaskLog.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .populate('taskId')
      .populate('completedBy', 'name email')
      .populate('clientId', 'name phone companyName');

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Task log not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('GetTaskLogById error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching task log',
    });
  }
};

/**
 * @desc    Get count of task logs created today
 * @route   GET /api/task-logs/daily
 * @access  Private
 */
const getDailyCompletionLogs = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const count = await TaskLog.countDocuments({
      companyId: req.user.companyId,
      completionDate: { $gte: startOfDay, $lt: endOfDay },
    });

    return res.status(200).json({
      success: true,
      data: { date: startOfDay.toISOString().split('T')[0], count },
    });
  } catch (error) {
    console.error('GetDailyCompletionLogs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching daily completion logs',
    });
  }
};

/**
 * @desc    Get monthly revenue from task logs using aggregation.
 *          Groups by year/month and sums amountCollected.
 *          Accepts optional query param 'year' to filter.
 * @route   GET /api/task-logs/monthly-revenue
 * @access  Private
 */
const getMonthlyRevenue = async (req, res) => {
  try {
    const companyId =
      typeof req.user.companyId === 'string'
        ? new mongoose.Types.ObjectId(req.user.companyId)
        : req.user.companyId;

    const matchStage = { companyId };

    // Optional year filter
    if (req.query.year) {
      const year = parseInt(req.query.year, 10);
      matchStage.completionDate = {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      };
    }

    const revenue = await TaskLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$completionDate' },
            month: { $month: '$completionDate' },
            monthLabel: {
              $dateToString: { format: '%Y-%m', date: '$completionDate' },
            },
          },
          totalRevenue: { $sum: '$amountCollected' },
          totalTasks: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          monthLabel: '$_id.monthLabel',
          totalRevenue: 1,
          totalTasks: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: revenue.length,
      data: revenue,
    });
  } catch (error) {
    console.error('GetMonthlyRevenue error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching monthly revenue',
    });
  }
};

export { getTaskLogs, getTaskLogById, getDailyCompletionLogs, getMonthlyRevenue };

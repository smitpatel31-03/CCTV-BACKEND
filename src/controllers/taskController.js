import mongoose from 'mongoose';
import Task from '../models/Task.js';
import TaskLog from '../models/TaskLog.js';

/**
 * @desc    List tasks in the user's company
 * @route   GET /api/tasks
 * @access  Private
 * @query   status, assignedTo, clientId, startDate, endDate
 */
const getTasks = async (req, res) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

    if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    // Date range filtering on scheduledDate
    if (req.query.startDate || req.query.endDate) {
      filter.scheduledDate = {};
      if (req.query.startDate) {
        filter.scheduledDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.scheduledDate.$lte = new Date(req.query.endDate);
      }
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('clientId', 'name phone companyName addressMapLink')
      .populate('createdBy', 'name email')
      .sort({ scheduledDate: 1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error('GetTasks error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching tasks',
    });
  }
};

/**
 * @desc    Get a single task with populated fields
 * @route   GET /api/tasks/:id
 * @access  Private
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .populate('assignedTo', 'name email')
      .populate('clientId', 'name phone companyName address addressMapLink')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('GetTaskById error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching task',
    });
  }
};

/**
 * @desc    Create a new task (admin+ only). Sets createdBy to req.user._id.
 * @route   POST /api/tasks
 * @access  Private — Owner, Manager, Admin
 */
const createTask = async (req, res) => {
  try {
    if (!['owner', 'manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create tasks',
      });
    }

    const task = await Task.create({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('CreateTask error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error creating task',
    });
  }
};

/**
 * @desc    Update task fields (admin+ only)
 * @route   PUT /api/tasks/:id
 * @access  Private — Owner, Manager, Admin
 */
const updateTask = async (req, res) => {
  try {
    if (!['owner', 'manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update tasks',
      });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('UpdateTask error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error updating task',
    });
  }
};

/**
 * @desc    Update task status.
 *          Employees can only update tasks assigned to them.
 *          When status becomes 'completed', actionSummary and amountCollected
 *          are required — a TaskLog record is auto-created.
 * @route   PATCH /api/tasks/:id/status
 * @access  Private
 */
const updateTaskStatus = async (req, res) => {
  try {
    const { status, actionSummary, amountCollected } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Employees can only update their own assigned tasks
    if (
      req.user.role === 'employee' &&
      task.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: 'You can only update tasks assigned to you',
      });
    }

    // Completion requires actionSummary and amountCollected
    if (status === 'completed') {
      if (!actionSummary || amountCollected === undefined || amountCollected === null) {
        return res.status(400).json({
          success: false,
          error: 'actionSummary and amountCollected are required when marking a task as completed',
        });
      }

      task.status = 'completed';
      await task.save();

      // Auto-create a TaskLog record
      const taskLog = await TaskLog.create({
        taskId: task._id,
        clientId: task.clientId,
        companyId: req.user.companyId,
        completedBy: req.user._id,
        actionSummary,
        amountCollected,
        completionDate: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: 'Task completed successfully',
        data: { task, taskLog },
      });
    }

    // For any other status change
    task.status = status;
    await task.save();

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('UpdateTaskStatus error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error updating task status',
    });
  }
};

/**
 * @desc    Cancel a task — set status to 'canceled' (admin+ only)
 * @route   DELETE /api/tasks/:id
 * @access  Private — Owner, Manager, Admin
 */
const deleteTask = async (req, res) => {
  try {
    if (!['owner', 'manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to cancel tasks',
      });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { status: 'canceled' },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task canceled successfully',
      data: task,
    });
  } catch (error) {
    console.error('DeleteTask error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error canceling task',
    });
  }
};

/**
 * @desc    Get tasks scheduled for today.
 *          For employees, only returns their assigned tasks.
 * @route   GET /api/tasks/today
 * @access  Private
 */
const getTodayTasks = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const filter = {
      companyId: req.user.companyId,
      scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    };

    // Employees only see their own tasks
    if (req.user.role === 'employee') {
      filter.assignedTo = req.user._id;
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('clientId', 'name phone companyName address')
      .sort({ scheduledDate: 1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error('GetTodayTasks error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching today tasks',
    });
  }
};

/**
 * @desc    Group tasks by scheduledDate using MongoDB aggregation.
 *          Accepts startDate and endDate query params.
 * @route   GET /api/tasks/by-date
 * @access  Private
 */
const getTasksByDate = async (req, res) => {
  try {
    const matchStage = {
      companyId: req.user.companyId,
    };

    if (req.query.startDate || req.query.endDate) {
      matchStage.scheduledDate = {};
      if (req.query.startDate) {
        matchStage.scheduledDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        matchStage.scheduledDate.$lte = new Date(req.query.endDate);
      }
    }

    // We need to convert companyId to ObjectId for aggregation
    if (typeof matchStage.companyId === 'string') {
      matchStage.companyId = new mongoose.Types.ObjectId(matchStage.companyId);
    }

    const grouped = await Task.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' },
          },
          tasks: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      count: grouped.length,
      data: grouped,
    });
  } catch (error) {
    console.error('GetTasksByDate error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error grouping tasks by date',
    });
  }
};

export { getTasks, getTaskById, createTask, updateTask, updateTaskStatus, deleteTask, getTodayTasks, getTasksByDate };

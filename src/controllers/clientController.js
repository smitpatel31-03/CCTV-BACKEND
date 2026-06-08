import Client from '../models/Client.js';
import Task from '../models/Task.js';

/**
 * @desc    List all clients in the user's company
 * @route   GET /api/clients
 * @access  Private
 * @query   status, search (matches name or phone)
 */
const getClients = async (req, res) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    const clients = await Client.find(filter);

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    console.error('GetClients error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching clients',
    });
  }
};

/**
 * @desc    Get a single client in the user's company
 * @route   GET /api/clients/:id
 * @access  Private
 */
const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error('GetClientById error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching client',
    });
  }
};

/**
 * @desc    Create a new client (manager+ only)
 * @route   POST /api/clients
 * @access  Private — Owner, Manager
 */
const createClient = async (req, res) => {
  try {
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create clients',
      });
    }

    const client = await Client.create({
      ...req.body,
      companyId: req.user.companyId,
    });

    return res.status(201).json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error('CreateClient error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error creating client',
    });
  }
};

/**
 * @desc    Update a client (manager+ only)
 * @route   PUT /api/clients/:id
 * @access  Private — Owner, Manager
 */
const updateClient = async (req, res) => {
  try {
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update clients',
      });
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error('UpdateClient error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error updating client',
    });
  }
};

/**
 * @desc    Soft-delete a client — set status to 'inactive' (manager+ only)
 * @route   DELETE /api/clients/:id
 * @access  Private — Owner, Manager
 */
const deleteClient = async (req, res) => {
  try {
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete clients',
      });
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { status: 'inactive' },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Client deleted (deactivated) successfully',
      data: client,
    });
  } catch (error) {
    console.error('DeleteClient error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error deleting client',
    });
  }
};

/**
 * @desc    Get a client's task history grouped into past, present, and future
 * @route   GET /api/clients/:id/history
 * @access  Private
 *
 * - past:    completed or canceled tasks
 * - present: pending/in-progress tasks where scheduledDate is today
 * - future:  pending tasks where scheduledDate is after today
 */
const getClientHistory = async (req, res) => {
  try {
    // Verify the client belongs to the user's company
    const client = await Client.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
      });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Fetch all tasks for this client
    const allTasks = await Task.find({
      clientId: req.params.id,
      companyId: req.user.companyId,
    })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ scheduledDate: -1 });

    const past = [];
    const present = [];
    const future = [];

    for (const task of allTasks) {
      if (['completed', 'canceled'].includes(task.status)) {
        past.push(task);
      } else if (
        ['pending', 'in-progress'].includes(task.status) &&
        task.scheduledDate >= startOfDay &&
        task.scheduledDate < endOfDay
      ) {
        present.push(task);
      } else if (
        task.status === 'pending' &&
        task.scheduledDate >= endOfDay
      ) {
        future.push(task);
      } else {
        // Tasks that don't fit neatly (e.g. in-progress but scheduled in the future)
        // fall into present for visibility
        present.push(task);
      }
    }

    return res.status(200).json({
      success: true,
      data: { past, present, future },
    });
  } catch (error) {
    console.error('GetClientHistory error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching client history',
    });
  }
};

export { getClients, getClientById, createClient, updateClient, deleteClient, getClientHistory };

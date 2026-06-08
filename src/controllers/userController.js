import User from '../models/User.js';

/**
 * Role hierarchy — lower index = higher privilege.
 * Used to prevent users from creating / updating users with a higher role.
 */
const ROLE_HIERARCHY = ['owner', 'manager', 'admin', 'employee'];

/**
 * Check if the acting role outranks the target role.
 * @param {string} actingRole
 * @param {string} targetRole
 * @returns {boolean}
 */
const outranks = (actingRole, targetRole) => {
  return ROLE_HIERARCHY.indexOf(actingRole) < ROLE_HIERARCHY.indexOf(targetRole);
};

/**
 * @desc    List all users in the same company
 * @route   GET /api/users
 * @access  Private
 * @query   role, isActive
 */
const getUsers = async (req, res) => {
  try {
    const filter = { companyId: req.user.companyId };

    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const users = await User.find(filter).select('-password');

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('GetUsers error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching users',
    });
  }
};

/**
 * @desc    Get a single user in the same company
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    }).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GetUserById error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching user',
    });
  }
};

/**
 * @desc    Create a new user in the same company (owner/manager only).
 *          Cannot create a user with a role equal to or higher than the acting user.
 * @route   POST /api/users
 * @access  Private — Owner, Manager
 */
const createUser = async (req, res) => {
  try {
    const actingRole = req.user.role;

    // Only owner and manager may create users
    if (!['owner', 'manager'].includes(actingRole)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create users',
      });
    }

    const { name, email, password, role } = req.body;

    // Prevent creating a user with equal or higher role
    if (!outranks(actingRole, role)) {
      return res.status(403).json({
        success: false,
        error: `Cannot create a user with the role '${role}'. You can only create users with a lower role than your own.`,
      });
    }

    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      companyId: req.user.companyId,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    console.error('CreateUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error creating user',
    });
  }
};

/**
 * @desc    Update user fields (not password).
 *          Owner can update any user. Manager can update admin/employee.
 * @route   PUT /api/users/:id
 * @access  Private — Owner, Manager
 */
const updateUser = async (req, res) => {
  try {
    const actingRole = req.user.role;

    // Find the target user in the same company
    const targetUser = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Owner can update anyone. Manager can only update admin/employee.
    if (actingRole === 'manager' && !['admin', 'employee'].includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        error: 'Managers can only update admin and employee users',
      });
    }

    if (!['owner', 'manager'].includes(actingRole)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update users',
      });
    }

    // Strip password from update payload
    const updates = { ...req.body };
    delete updates.password;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('UpdateUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error updating user',
    });
  }
};

/**
 * @desc    Deactivate a user — sets isActive to false
 * @route   PATCH /api/users/:id/deactivate
 * @access  Private — Owner, Manager
 */
const deactivateUser = async (req, res) => {
  try {
    const actingRole = req.user.role;

    if (!['owner', 'manager'].includes(actingRole)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to deactivate users',
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user,
    });
  } catch (error) {
    console.error('DeactivateUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error deactivating user',
    });
  }
};

export { getUsers, getUserById, createUser, updateUser, deactivateUser };

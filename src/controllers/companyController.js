import Company from '../models/Company.js';

/**
 * @desc    Get the company associated with the logged-in user
 * @route   GET /api/companies
 * @access  Private
 */
const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('GetCompany error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error fetching company',
    });
  }
};

/**
 * @desc    Update company details (owner only)
 * @route   PUT /api/companies
 * @access  Private — Owner
 */
const updateCompany = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Only owners can update company details',
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('UpdateCompany error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error updating company',
    });
  }
};

/**
 * @desc    Deactivate company (owner only) — sets isActive to false
 * @route   PATCH /api/companies/deactivate
 * @access  Private — Owner
 */
const deactivateCompany = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Only owners can deactivate the company',
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { isActive: false },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company deactivated successfully',
      data: company,
    });
  } catch (error) {
    console.error('DeactivateCompany error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error deactivating company',
    });
  }
};

export { getCompany, updateCompany, deactivateCompany };

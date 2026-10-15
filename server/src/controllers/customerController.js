const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');

exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
    if (req.query.search) filter.customerId = { $regex: req.query.search, $options: 'i' };
    const [customers, total, nonINRTransactionCount] = await Promise.all([
      Customer.find(filter).sort({ riskScore: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter),
      Transaction.countDocuments({ currency: { $ne: 'INR' } }),
    ]);
    const safeCustomers = customers.map(customer => {
      const record = customer.toObject();
      if (nonINRTransactionCount) record.currency = null;
      return record;
    });
    return success(res, safeCustomers, 'Customers retrieved', 200, {
      ...paginationMeta(total, page, limit),
      currency: 'INR',
      currencyMigrationRequired: nonINRTransactionCount > 0,
      nonINRTransactionCount,
    });
  } catch (err) { return error(res, 'Failed to retrieve customers', 500); }
};

exports.getCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({ customerId });
    if (!customer) return error(res, 'Customer not found', 404);
    const [recentTransactions, nonINRTransactionCount] = await Promise.all([
      Transaction.find({ customerId }).sort({ timestamp: -1 }).limit(20),
      Transaction.countDocuments({ currency: { $ne: 'INR' } }),
    ]);
    const customerRecord = customer.toObject();
    if (nonINRTransactionCount) customerRecord.currency = null;
    const txIds = recentTransactions.map(t => t._id);
    const alerts = await Alert.find({ transactionId: { $in: txIds } }).sort({ createdAt: -1 }).limit(10).populate('transactionId', 'transactionId amount currency');
    const amounts = recentTransactions.filter(t => t.currency === 'INR').map(t => t.amount);
    const avgAmount = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
    return success(res, {
      currency: 'INR',
      currencyMigrationRequired: nonINRTransactionCount > 0,
      nonINRTransactionCount,
      customer: customerRecord,
      recentTransactions,
      alerts,
      behavioralStats: {
        currency: 'INR',
        avgAmount,
        maxAmount: amounts.length ? Math.max(...amounts) : 0,
        minAmount: amounts.length ? Math.min(...amounts) : 0,
        transactionCount: amounts.length,
      },
    }, 'Customer profile retrieved');
  } catch (err) { return error(res, 'Failed to retrieve customer', 500); }
};

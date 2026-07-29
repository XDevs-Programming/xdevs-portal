const Commission = require("../models/Commission");

async function createCommission(req, res) {
  const { title, description, category, budget, deadline } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({
      success: false,
      message: "Title, description and category are required."
    });
  }

  const commission = await Commission.create({
    client: req.user._id,
    title,
    description,
    category,
    budget: budget || "Not specified",
    deadline: deadline || null
  });

  res.status(201).json({
    success: true,
    commission
  });
}

async function getMyCommissions(req, res) {
  const commissions = await Commission.find({
    client: req.user._id
  }).sort({ createdAt: -1 });

  res.json({ success: true, commissions });
}

async function getAllCommissions(req, res) {
  const commissions = await Commission.find()
    .populate("client", "username email avatar")
    .sort({ createdAt: -1 });

  res.json({ success: true, commissions });
}

async function getCommission(req, res) {
  const commission = await Commission.findById(req.params.id).populate(
    "client",
    "username email avatar"
  );

  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission not found."
    });
  }

  const ownsCommission =
    commission.client._id.toString() === req.user._id.toString();

  if (req.user.role !== "admin" && !ownsCommission) {
    return res.status(403).json({
      success: false,
      message: "You cannot view this commission."
    });
  }

  res.json({ success: true, commission });
}

async function updateCommission(req, res) {
  const commission = await Commission.findById(req.params.id);

  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission not found."
    });
  }

  const allowedStatuses = [
    "Pending",
    "Reviewing",
    "Accepted",
    "In Progress",
    "Testing",
    "Completed",
    "Rejected"
  ];

  if (req.body.status) {
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission status."
      });
    }

    commission.status = req.body.status;
  }

  if (typeof req.body.adminNotes === "string") {
    commission.adminNotes = req.body.adminNotes;
  }

  await commission.save();

  res.json({ success: true, commission });
}

async function deleteCommission(req, res) {
  const commission = await Commission.findById(req.params.id);

  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission not found."
    });
  }

  await commission.deleteOne();

  res.json({
    success: true,
    message: "Commission deleted."
  });
}

module.exports = {
  createCommission,
  getMyCommissions,
  getAllCommissions,
  getCommission,
  updateCommission,
  deleteCommission
};

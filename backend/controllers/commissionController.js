const Commission = require("../models/Commission");
const User = require("../models/User");
const Notification = require("../models/Notification");

function youtubeId(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || "";
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || "";
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

async function notifyAdmins(payload) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (!admins.length) return;

  await Notification.insertMany(
    admins.map((admin) => ({ recipient: admin._id, ...payload }))
  );
}

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

  await notifyAdmins({
    type: "commission_new",
    title: "New commission received",
    message: `${req.user.username} submitted “${commission.title}”.`,
    link: "/pages/dashboard/admin.html#commissions",
    metadata: { commissionId: commission._id.toString() }
  });

  res.status(201).json({ success: true, commission });
}

async function getMyCommissions(req, res) {
  const commissions = await Commission.find({ client: req.user._id })
    .sort({ createdAt: -1 });
  res.json({ success: true, commissions });
}

async function getMyPastWorks(req, res) {
  const commissions = await Commission.find({
    client: req.user._id,
    status: "Completed",
    "completion.clientVisible": { $ne: false }
  }).sort({ "completion.completedAt": -1, updatedAt: -1 });

  res.json({ success: true, commissions });
}

async function getPublicPastWorks(req, res) {
  const commissions = await Commission.find({
    status: "Completed",
    "completion.publicPortfolio": true
  })
    .select("title category completion updatedAt")
    .sort({ "completion.completedAt": -1, updatedAt: -1 });

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
    return res.status(404).json({ success: false, message: "Commission not found." });
  }

  const ownsCommission =
    commission.client._id.toString() === req.user._id.toString();

  if (req.user.role !== "admin" && !ownsCommission) {
    return res.status(403).json({ success: false, message: "You cannot view this commission." });
  }

  res.json({ success: true, commission });
}

async function updateCommission(req, res) {
  const commission = await Commission.findById(req.params.id);

  if (!commission) {
    return res.status(404).json({ success: false, message: "Commission not found." });
  }

  const allowedStatuses = [
    "Pending", "Reviewing", "Accepted", "In Progress",
    "Testing", "Completed", "Rejected"
  ];

  const previousStatus = commission.status;

  if (req.body.status) {
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: "Invalid commission status." });
    }
    commission.status = req.body.status;
  }

  if (typeof req.body.adminNotes === "string") {
    commission.adminNotes = req.body.adminNotes;
  }

  if (req.body.completion && typeof req.body.completion === "object") {
    const completion = req.body.completion;
    if (typeof completion.summary === "string") commission.completion.summary = completion.summary;
    if (typeof completion.clientNotes === "string") commission.completion.clientNotes = completion.clientNotes;
    if (typeof completion.youtubeUrl === "string") {
      commission.completion.youtubeUrl = completion.youtubeUrl;
      commission.completion.youtubeVideoId = youtubeId(completion.youtubeUrl);
    }
    if (Array.isArray(completion.technologies)) {
      commission.completion.technologies = completion.technologies
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    if (typeof completion.publicPortfolio === "boolean") {
      commission.completion.publicPortfolio = completion.publicPortfolio;
    }
    if (typeof completion.clientVisible === "boolean") {
      commission.completion.clientVisible = completion.clientVisible;
    }
    if (typeof completion.thumbnailUrl === "string") {
      commission.completion.thumbnailUrl = completion.thumbnailUrl;
    }
  }

  if (commission.status === "Completed" && !commission.completion.completedAt) {
    commission.completion.completedAt = new Date();
  }

  await commission.save();

  if (previousStatus !== "Completed" && commission.status === "Completed") {
    await Notification.create({
      recipient: commission.client,
      type: "commission_completed",
      title: "Commission completed",
      message: `Your commission “${commission.title}” is now in Past Works.`,
      link: "/pages/dashboard/client.html#past-works",
      metadata: { commissionId: commission._id.toString() }
    });
  }

  res.json({ success: true, commission });
}

async function deleteCommission(req, res) {
  const commission = await Commission.findById(req.params.id);
  if (!commission) {
    return res.status(404).json({ success: false, message: "Commission not found." });
  }
  await commission.deleteOne();
  res.json({ success: true, message: "Commission deleted." });
}

module.exports = {
  createCommission,
  getMyCommissions,
  getMyPastWorks,
  getPublicPastWorks,
  getAllCommissions,
  getCommission,
  updateCommission,
  deleteCommission
};

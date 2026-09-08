const Notification = require("../models/Notification");

async function getMine(req, res) {
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit);

  const unread = await Notification.countDocuments({
    recipient: req.user._id,
    read: false
  });

  res.json({ success: true, notifications, unread });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found." });
  }

  res.json({ success: true, notification });
}

async function markAllRead(req, res) {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true }
  );

  res.json({ success: true });
}

module.exports = { getMine, markRead, markAllRead };

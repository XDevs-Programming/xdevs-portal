const mongoose = require("mongoose");
const Commission = require("../models/Commission");
const ChatMessage = require("../models/ChatMessage");

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function getCommissionForUser(id, user) {
  if (!isValidId(id)) return null;

  const query = user.role === "admin"
    ? { _id: id }
    : { _id: id, client: user._id };

  return Commission.findOne(query).populate("client", "username email avatar");
}

async function getConversations(req, res) {
  const query = req.user.role === "admin" ? {} : { client: req.user._id };

  const commissions = await Commission.find(query)
    .populate("client", "username email avatar")
    .sort({ updatedAt: -1 });

  const conversations = await Promise.all(
    commissions.map(async (commission) => {
      const latest = await ChatMessage.findOne({ commission: commission._id })
        .sort({ createdAt: -1 })
        .populate("sender", "username avatar");

      const unreadCount = await ChatMessage.countDocuments({
        commission: commission._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      });

      return {
        commission,
        client: commission.client,
        lastMessage: latest,
        unreadCount
      };
    })
  );

  conversations.sort((a, b) => {
    const aDate = a.lastMessage?.createdAt || a.commission.updatedAt || a.commission.createdAt;
    const bDate = b.lastMessage?.createdAt || b.commission.updatedAt || b.commission.createdAt;
    return new Date(bDate) - new Date(aDate);
  });

  res.json({ success: true, conversations });
}

async function getMessages(req, res) {
  const commission = await getCommissionForUser(req.params.commissionId, req.user);

  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission chat not found."
    });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);

  const messages = await ChatMessage.find({ commission: commission._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "username avatar");

  messages.reverse();

  await ChatMessage.updateMany(
    {
      commission: commission._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    },
    { $addToSet: { readBy: req.user._id } }
  );

  res.json({ success: true, commission, messages });
}

async function postMessage(req, res) {
  const commission = await getCommissionForUser(req.params.commissionId, req.user);

  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission chat not found."
    });
  }

  const body = String(req.body.body || "").trim();

  if (!body || body.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Message must contain between 1 and 2000 characters."
    });
  }

  const message = await ChatMessage.create({
    commission: commission._id,
    sender: req.user._id,
    body,
    readBy: [req.user._id]
  });

  await message.populate("sender", "username avatar");

  res.status(201).json({ success: true, message });
}

module.exports = {
  getConversations,
  getMessages,
  postMessage,
  getCommissionForUser
};

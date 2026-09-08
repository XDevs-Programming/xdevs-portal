const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Commission = require("../models/Commission");
const ChatMessage = require("../models/ChatMessage");
const Notification = require("../models/Notification");

function roomFor(commissionId) {
  return `commission-chat:${commissionId}`;
}

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function getCommissionAccess(commissionId, user) {
  if (!validId(commissionId)) return null;

  const query = user.role === "admin"
    ? { _id: commissionId }
    : { _id: commissionId, client: user._id };

  return Commission.findOne(query).populate("client", "username email avatar");
}

function installChatSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required."));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "xdevs-portal-api",
        audience: "xdevs-portal"
      });

      const user = await User.findById(payload.sub);

      if (!user) {
        return next(new Error("Account not found."));
      }

      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid authentication token."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_commission", async (commissionId, callback = () => {}) => {
      try {
        const commission = await getCommissionAccess(commissionId, socket.user);

        if (!commission) {
          return callback({ success: false, message: "You cannot access this chat." });
        }

        socket.join(roomFor(commissionId));

        await ChatMessage.updateMany(
          {
            commission: commission._id,
            sender: { $ne: socket.user._id },
            readBy: { $ne: socket.user._id }
          },
          { $addToSet: { readBy: socket.user._id } }
        );

        callback({ success: true, commission });
      } catch (error) {
        callback({ success: false, message: error.message });
      }
    });

    socket.on("leave_commission", (commissionId) => {
      if (validId(commissionId)) {
        socket.leave(roomFor(commissionId));
      }
    });

    socket.on("send_message", async ({ commissionId, body } = {}, callback = () => {}) => {
      try {
        const commission = await getCommissionAccess(commissionId, socket.user);

        if (!commission) {
          return callback({ success: false, message: "You cannot access this chat." });
        }

        const cleanBody = String(body || "").trim();

        if (!cleanBody || cleanBody.length > 2000) {
          return callback({
            success: false,
            message: "Message must contain between 1 and 2000 characters."
          });
        }

        const message = await ChatMessage.create({
          commission: commission._id,
          sender: socket.user._id,
          body: cleanBody,
          readBy: [socket.user._id]
        });

        await message.populate("sender", "username avatar");

        io.to(roomFor(commissionId)).emit("chat_message", message);

        if (socket.user.role === "client") {
          const admins = await User.find({ role: "admin" }).select("_id");

          if (admins.length) {
            await Notification.insertMany(
              admins.map((admin) => ({
                recipient: admin._id,
                type: "chat_message",
                title: `New message: ${commission.title}`,
                message: `${socket.user.username}: ${cleanBody.slice(0, 140)}`,
                link: "/pages/dashboard/admin.html#chat",
                metadata: { commissionId: commission._id.toString() }
              }))
            );
          }
        } else {
          await Notification.create({
            recipient: commission.client._id,
            type: "chat_message",
            title: `New message: ${commission.title}`,
            message: `${socket.user.username}: ${cleanBody.slice(0, 140)}`,
            link: "/pages/dashboard/client.html#chat",
            metadata: { commissionId: commission._id.toString() }
          });
        }

        callback({ success: true, message });
      } catch {
        callback({ success: false, message: "Could not send message." });
      }
    });

    socket.on("typing", async ({ commissionId, active } = {}) => {
      try {
        const commission = await getCommissionAccess(commissionId, socket.user);
        if (!commission) return;

        socket.to(roomFor(commissionId)).emit("typing", {
          commissionId,
          active: Boolean(active),
          user: {
            id: socket.user._id.toString(),
            username: socket.user.username
          }
        });
      } catch {
        // Typing indicators are intentionally best-effort.
      }
    });

    socket.on("mark_read", async (commissionId, callback = () => {}) => {
      try {
        const commission = await getCommissionAccess(commissionId, socket.user);

        if (!commission) {
          return callback({ success: false, message: "You cannot access this chat." });
        }

        await ChatMessage.updateMany(
          {
            commission: commission._id,
            sender: { $ne: socket.user._id },
            readBy: { $ne: socket.user._id }
          },
          { $addToSet: { readBy: socket.user._id } }
        );

        callback({ success: true });
      } catch {
        callback({ success: false, message: "Could not mark messages as read." });
      }
    });
  });
}

module.exports = { installChatSocket };

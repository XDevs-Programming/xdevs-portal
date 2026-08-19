const express = require("express");
const controller = require("../controllers/chatController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/conversations", controller.getConversations);
router.get("/:commissionId/messages", controller.getMessages);
router.post("/:commissionId/messages", controller.postMessage);

module.exports = router;

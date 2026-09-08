const express = require("express");
const controller = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", protect, controller.getMine);
router.patch("/read-all", protect, controller.markAllRead);
router.patch("/:id/read", protect, controller.markRead);

module.exports = router;

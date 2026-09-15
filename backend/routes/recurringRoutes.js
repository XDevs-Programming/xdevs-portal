const express = require("express");
const controller = require("../controllers/recurringController");
const { protect, requireRole } = require("../middleware/auth");
const router = express.Router();

router.get("/mine", protect, controller.getMine);
router.get("/", protect, requireRole("admin"), controller.getAll);
router.post("/", protect, requireRole("admin"), controller.createContract);
router.post("/:id/setup", protect, controller.startSetup);
router.post("/:id/request-cancellation", protect, controller.requestCancellation);
router.patch("/:id/cancel", protect, requireRole("admin"), controller.cancelContract);
router.patch("/:id/decline-cancellation", protect, requireRole("admin"), controller.declineCancellation);

module.exports = router;

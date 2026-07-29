const express = require("express");
const controller = require("../controllers/paymentController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", protect, controller.getMyPayments);
router.get("/", protect, requireRole("admin"), controller.getAllPayments);
router.post("/", protect, requireRole("admin"), controller.createPaymentRequest);
router.post("/:id/checkout", protect, controller.createCheckoutSession);
router.patch("/:id/cancel", protect, requireRole("admin"), controller.cancelPaymentRequest);

module.exports = router;

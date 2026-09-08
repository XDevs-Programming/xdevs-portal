const express = require("express");
const controller = require("../controllers/reviewController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/public", controller.getPublicReviews);
router.post("/", protect, controller.createReview);
router.get("/", protect, requireRole("admin"), controller.getAllReviews);
router.patch(
  "/:id",
  protect,
  requireRole("admin"),
  controller.moderateReview
);

module.exports = router;

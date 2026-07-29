const express = require("express");
const controller = require("../controllers/commissionController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, controller.createCommission);
router.get("/mine", protect, controller.getMyCommissions);
router.get("/", protect, requireRole("admin"), controller.getAllCommissions);
router.get("/:id", protect, controller.getCommission);
router.patch(
  "/:id",
  protect,
  requireRole("admin"),
  controller.updateCommission
);
router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  controller.deleteCommission
);

module.exports = router;

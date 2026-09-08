const express = require("express");
const controller = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/discord", controller.startDiscord);
router.get("/discord/callback", controller.finishDiscord);
router.get("/google", controller.startGoogle);
router.get("/google/callback", controller.finishGoogle);
router.get("/me", protect, controller.currentUser);
router.post("/logout", controller.logout);

module.exports = router;

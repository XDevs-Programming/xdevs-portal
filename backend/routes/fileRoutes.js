const express = require("express");
const controller = require("../controllers/fileController");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);
router.post("/request-upload", controller.requestUpload);
router.post("/:id/complete", controller.completeUpload);
router.get("/commission/:commissionId", controller.listFiles);
router.get("/:id/download", controller.getDownload);
router.delete("/:id", controller.removeFile);
module.exports = router;

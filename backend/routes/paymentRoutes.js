const express = require("express");
const controller = require("../controllers/paymentController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", protect, controller.getMyPayments);
router.get("/invoices/mine", protect, controller.getMyInvoiceArchive);
router.get("/invoices/archive", protect, requireRole("admin"), controller.getInvoiceArchive);
router.get("/invoices/export.csv", protect, controller.exportInvoiceCsv);
router.get("/invoices/export.zip", protect, controller.exportInvoiceZip);
router.get("/", protect, requireRole("admin"), controller.getAllPayments);
router.post("/", protect, requireRole("admin"), controller.createPaymentRequest);
router.post("/pro-bono", protect, requireRole("admin"), controller.createProBonoInvoice);
router.get("/:id/invoice", protect, controller.downloadInvoice);
router.post("/:id/checkout", protect, controller.createCheckoutSession);
router.patch("/:id/cancel", protect, requireRole("admin"), controller.cancelPaymentRequest);

module.exports = router;

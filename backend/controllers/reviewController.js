const Review = require("../models/Review");
const Commission = require("../models/Commission");

async function createReview(req, res) {
  const { commissionId, rating, content } = req.body;

  const commission = await Commission.findOne({
    _id: commissionId,
    client: req.user._id,
    status: "Completed"
  });

  if (!commission) {
    return res.status(400).json({
      success: false,
      message: "Only completed commissions belonging to you can be reviewed."
    });
  }

  const existing = await Review.exists({ commission: commission._id });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: "This commission has already been reviewed."
    });
  }

  const review = await Review.create({
    client: req.user._id,
    commission: commission._id,
    rating,
    content
  });

  res.status(201).json({ success: true, review });
}

async function getPublicReviews(req, res) {
  const reviews = await Review.find({
    approved: true,
    hidden: false
  })
    .populate("client", "username avatar")
    .populate("commission", "title category")
    .sort({ featured: -1, createdAt: -1 })
    .limit(12);

  res.json({ success: true, reviews });
}

async function getAllReviews(req, res) {
  const reviews = await Review.find()
    .populate("client", "username email avatar")
    .populate("commission", "title category")
    .sort({ createdAt: -1 });

  res.json({ success: true, reviews });
}

async function moderateReview(req, res) {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Review not found."
    });
  }

  for (const field of ["approved", "featured", "hidden"]) {
    if (typeof req.body[field] === "boolean") {
      review[field] = req.body[field];
    }
  }

  await review.save();

  res.json({ success: true, review });
}

module.exports = {
  createReview,
  getPublicReviews,
  getAllReviews,
  moderateReview
};

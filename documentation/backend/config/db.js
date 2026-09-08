const mongoose = require("mongoose");

async function connectDatabase() {
  mongoose.set("strictQuery", true);

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000
  });

  console.log("MongoDB connected");
}

module.exports = connectDatabase;

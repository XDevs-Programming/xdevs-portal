require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");
const packageInfo = require("./package.json");

const connectDatabase = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const commissionRoutes = require("./routes/commissionRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const fileRoutes = require("./routes/fileRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { installChatSocket } = require("./sockets/chatSocket");
const { stripeWebhook } = require("./controllers/paymentController");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const required = [
  "MONGO_URI",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "FRONTEND_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY"
];

const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === "production";

if (production) app.set("trust proxy", 1);

const allowedOrigins = process.env.FRONTEND_URL
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

installChatSocket(io);

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan(production ? "combined" : "dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "XDevs Programming API is running."
  });
});


app.get("/api/version", (req, res) => {
  res.status(200).json({
    success: true,
    name: "XDevs Portal",
    version: packageInfo.version,
    environment: process.env.NODE_ENV || "development"
  });
});

app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    success: connected,
    service: "xdevs-portal-api",
    version: packageInfo.version,
    database: connected ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/chat", chatRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();

    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`API listening on port ${port}`);
      console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

start();

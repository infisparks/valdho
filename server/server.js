const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

// Load Environment Variables from server/.env if file exists
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Mount WhatsApp Evolution API Routes & Stage Automations Worker
const whatsappRoutes = require("./whatsapp");
const whatsappStageAutomationsRoutes = require("./whatsapp_pipeline_stage_configuration");
const { router: googleCalendarRoutes } = require("./google_calendar");

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/whatsapp", whatsappStageAutomationsRoutes);
app.use("/api/google", googleCalendarRoutes);
app.use("/api/evolution/webhook", whatsappRoutes); // Alias for Webhook URL

// Coolify & Server Health Check Endpoints
app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "Valdho WhatsApp Evolution Server",
    healthCheck: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "Valdho WhatsApp Evolution API Server",
    timestamp: new Date().toISOString(),
    env: {
      apiUrl: process.env.WHATSAPP_API_URL || "https://evo.infispark.in",
      hasApiKey: !!process.env.WHATSAPP_API_KEY,
    },
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Valdho WhatsApp Server running on port ${PORT}`);
  console.log(`📁 Coolify Environment Ready`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api/whatsapp`);
  console.log(`🔔 Webhook URL: http://localhost:${PORT}/api/evolution/webhook`);
  console.log(`=======================================================`);
});

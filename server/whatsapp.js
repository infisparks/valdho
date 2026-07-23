const express = require("express");
const router = express.Router();

// Configuration
const API_KEY = process.env.WHATSAPP_API_KEY || "vR39h6avY69g7kAU3YQbS6V6XEvudson";
const BASE_URL = (process.env.WHATSAPP_API_URL || "https://evo.infispark.in").replace(/\/$/, "");
const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://firstoption-8da25-default-rtdb.firebaseio.com").replace(/\/$/, "");

/**
 * Firebase Realtime Database REST API Helper
 */
async function firebaseDb(path, method = "GET", body = null) {
  try {
    const url = `${FIREBASE_DB_URL}/${path}.json`;
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`Firebase DB Error (${res.status}):`, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Firebase DB Helper Exception:", err);
    return null;
  }
}

/**
 * Evolution API Helper
 */
async function evoApiCall(endpoint, method = "GET", body = null, customHeaders = {}) {
  try {
    const url = `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const headers = {
      apikey: API_KEY,
      "Content-Type": "application/json",
      ...customHeaders,
    };
    const options = { method, headers };
    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    console.error(`Evolution API Error (${endpoint}):`, err);
    return { status: 500, ok: false, data: { error: err.message } };
  }
}

/**
 * Sanitize phone numbers to international standard format (e.g. 919876543210)
 */
function sanitizePhoneNumber(number) {
  if (!number) return "";
  let clean = String(number).replace(/\D/g, "");
  // Default to India prefix (91) if 10 digits provided
  if (clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
}

/* ==========================================================================
   ROUTES FOR WHATSAPP MANAGEMENT
   ========================================================================== */

/**
 * 1. Create Instance
 * POST /api/whatsapp/instance/create
 * Body: { instanceName: "customer1" }
 */
router.post("/instance/create", async (req, res) => {
  try {
    const { instanceName } = req.body;
    if (!instanceName || typeof instanceName !== "string" || !instanceName.trim()) {
      return res.status(400).json({ success: false, error: "Valid instanceName is required" });
    }

    const cleanInstanceName = instanceName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

    // Call Evolution API
    const evoRes = await evoApiCall("/instance/create", "POST", {
      instanceName: cleanInstanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    });

    if (!evoRes.ok) {
      return res.status(evoRes.status).json({
        success: false,
        error: evoRes.data.error || evoRes.data.message || "Failed to create instance on Evolution API",
      });
    }

    const instanceId = evoRes.data.instanceId || evoRes.data.id || evoRes.data.instance?.instanceId || cleanInstanceName;
    const token = evoRes.data.token || evoRes.data.hash || "";

    const instanceRecord = {
      instanceId,
      instanceName: cleanInstanceName,
      token,
      status: "created",
      qrCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firebase RTDB under /whatsapp_unofficial_instances
    await firebaseDb(`whatsapp_unofficial_instances/${cleanInstanceName}`, "PUT", instanceRecord);

    return res.status(200).json({
      success: true,
      message: "Instance created successfully",
      data: instanceRecord,
      raw: evoRes.data,
    });
  } catch (err) {
    console.error("Create Instance Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Connect Instance (Generate QR Code)
 * POST /api/whatsapp/instance/connect
 * Body: { instanceName: "customer1", instanceId: "..." }
 */
router.post("/instance/connect", async (req, res) => {
  try {
    const { instanceName, instanceId } = req.body;
    if (!instanceName && !instanceId) {
      return res.status(400).json({ success: false, error: "instanceName or instanceId is required" });
    }

    let targetInstanceName = instanceName;
    let targetInstanceId = instanceId;

    // Fetch existing record from Firebase if needed
    if (targetInstanceName && !targetInstanceId) {
      const fbRecord = await firebaseDb(`whatsapp_unofficial_instances/${targetInstanceName}`);
      if (fbRecord && fbRecord.instanceId) {
        targetInstanceId = fbRecord.instanceId;
      }
    }

    // Call Connect endpoint on Evolution API
    const evoRes = await evoApiCall(
      "/instance/connect",
      "POST",
      { subscribe: ["ALL"], immediate: true },
      targetInstanceId ? { instanceId: targetInstanceId } : {}
    );

    let qrCodeBase64 = null;
    if (evoRes.data) {
      qrCodeBase64 =
        evoRes.data.qrcode ||
        evoRes.data.base64 ||
        evoRes.data.data?.qrcode ||
        evoRes.data.code ||
        null;
    }

    const updateData = {
      status: "connecting",
      updatedAt: new Date().toISOString(),
    };
    if (qrCodeBase64) {
      updateData.qrCode = qrCodeBase64.startsWith("data:")
        ? qrCodeBase64
        : `data:image/png;base64,${qrCodeBase64}`;
    }

    if (targetInstanceName) {
      await firebaseDb(`whatsapp_unofficial_instances/${targetInstanceName}`, "PATCH", updateData);
    }

    return res.status(200).json({
      success: true,
      message: "Connect request initiated",
      qrCode: updateData.qrCode || null,
      data: evoRes.data,
    });
  } catch (err) {
    console.error("Connect Instance Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Get Instance Status / List All Instances
 * GET /api/whatsapp/instance/list
 */
router.get("/instance/list", async (req, res) => {
  try {
    // Call Evolution API list
    const evoRes = await evoApiCall("/instance/list", "GET");
    const evoInstances = Array.isArray(evoRes.data) ? evoRes.data : [];

    // Fetch Firebase Instances
    const fbInstances = (await firebaseDb("whatsapp_unofficial_instances")) || {};

    const mergedList = [];

    // Iterate through Firebase records
    for (const [key, record] of Object.entries(fbInstances)) {
      if (!record) continue;
      const match = evoInstances.find(
        (e) => e.instanceName === record.instanceName || e.instanceId === record.instanceId
      );

      const status = match ? match.status || match.connectionStatus || record.status : record.status;

      mergedList.push({
        ...record,
        status,
        liveMatch: !!match,
      });
    }

    // Include any Evolution API instances not yet in Firebase
    for (const evoInst of evoInstances) {
      const exists = mergedList.some((m) => m.instanceName === evoInst.instanceName);
      if (!exists) {
        mergedList.push({
          instanceId: evoInst.instanceId || evoInst.id || evoInst.instanceName,
          instanceName: evoInst.instanceName,
          status: evoInst.status || "created",
          qrCode: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: mergedList.length,
      data: mergedList,
    });
  } catch (err) {
    console.error("List Instances Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Send Text Message
 * POST /api/whatsapp/message/send-text
 * Body: { instanceName: "customer1", number: "919876543210", text: "Hello" }
 */
router.post("/message/send-text", async (req, res) => {
  try {
    const { instanceName, number, text } = req.body;
    if (!instanceName || !number || !text) {
      return res.status(400).json({
        success: false,
        error: "instanceName, number, and text are required fields",
      });
    }

    const cleanNumber = sanitizePhoneNumber(number);

    // Call Evolution API sendText endpoint
    const evoRes = await evoApiCall(`/message/sendText/${instanceName}`, "POST", {
      number: cleanNumber,
      text,
    });

    if (!evoRes.ok) {
      return res.status(evoRes.status).json({
        success: false,
        error: evoRes.data.error || evoRes.data.message || "Failed to send text message",
      });
    }

    // Log to Firebase /whatsapp_logs
    const logId = `log_${Date.now()}`;
    await firebaseDb(`whatsapp_logs/${instanceName}/${logId}`, "PUT", {
      id: logId,
      type: "text",
      number: cleanNumber,
      text,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Text message sent successfully",
      data: evoRes.data,
    });
  } catch (err) {
    console.error("Send Text Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Send Media (Image or PDF)
 * POST /api/whatsapp/message/send-media
 * Body: { instanceName: "customer1", number: "919876543210", media: "https://...", caption: "Invoice" }
 */
router.post("/message/send-media", async (req, res) => {
  try {
    const { instanceName, number, media, caption } = req.body;
    if (!instanceName || !number || !media) {
      return res.status(400).json({
        success: false,
        error: "instanceName, number, and media URL are required fields",
      });
    }

    const cleanNumber = sanitizePhoneNumber(number);

    // Call Evolution API sendMedia endpoint
    const evoRes = await evoApiCall(`/message/sendMedia/${instanceName}`, "POST", {
      number: cleanNumber,
      media,
      caption: caption || "",
    });

    if (!evoRes.ok) {
      return res.status(evoRes.status).json({
        success: false,
        error: evoRes.data.error || evoRes.data.message || "Failed to send media message",
      });
    }

    // Log to Firebase /whatsapp_logs
    const logId = `log_${Date.now()}`;
    await firebaseDb(`whatsapp_logs/${instanceName}/${logId}`, "PUT", {
      id: logId,
      type: "media",
      number: cleanNumber,
      mediaUrl: media,
      caption: caption || "",
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Media message sent successfully",
      data: evoRes.data,
    });
  } catch (err) {
    console.error("Send Media Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Logout Instance
 * DELETE /api/whatsapp/instance/logout/:instanceId
 */
router.delete("/instance/logout/:instanceId", async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { instanceName } = req.query;

    const evoRes = await evoApiCall(`/instance/logout/${instanceId}`, "DELETE");

    // Update Firebase status
    const targetName = instanceName || instanceId;
    await firebaseDb(`whatsapp_unofficial_instances/${targetName}`, "PATCH", {
      status: "close",
      qrCode: null,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Instance logged out successfully",
      data: evoRes.data,
    });
  } catch (err) {
    console.error("Logout Instance Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Delete Instance
 * DELETE /api/whatsapp/instance/delete/:instanceId
 */
router.delete("/instance/delete/:instanceId", async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { instanceName } = req.query;

    const evoRes = await evoApiCall(`/instance/delete/${instanceId}`, "DELETE");

    // Remove from Firebase RTDB
    const targetName = instanceName || instanceId;
    await firebaseDb(`whatsapp_unofficial_instances/${targetName}`, "DELETE");

    return res.status(200).json({
      success: true,
      message: "Instance deleted successfully",
      data: evoRes.data,
    });
  } catch (err) {
    console.error("Delete Instance Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Webhook Receiver for Evolution API Events
 * POST /api/evolution/webhook
 */
router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const event = payload.event || payload.type || payload.event_type;
    const instanceName = payload.instanceName || payload.instance || payload.data?.instanceName;

    console.log(`[WhatsApp Webhook] Event: ${event} | Instance: ${instanceName}`);

    if (instanceName) {
      if (event === "QRCode" || event === "qrcode") {
        const rawQr = payload.data?.qrcode || payload.data?.base64 || payload.qrcode;
        if (rawQr) {
          const qrCode = rawQr.startsWith("data:") ? rawQr : `data:image/png;base64,${rawQr}`;
          await firebaseDb(`whatsapp_unofficial_instances/${instanceName}`, "PATCH", {
            qrCode,
            status: "connecting",
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (event === "Connected" || event === "PairSuccess" || event === "open") {
        await firebaseDb(`whatsapp_unofficial_instances/${instanceName}`, "PATCH", {
          status: "open",
          qrCode: null,
          updatedAt: new Date().toISOString(),
        });
      } else if (event === "LoggedOut" || event === "Disconnected" || event === "close") {
        await firebaseDb(`whatsapp_unofficial_instances/${instanceName}`, "PATCH", {
          status: "close",
          qrCode: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({ received: true, event });
  } catch (err) {
    console.error("Webhook Processing Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

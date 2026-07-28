const express = require("express");
const crypto = require("crypto");
const router = express.Router();

// Fallback Meta Pixel ID & Access Token
const META_PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1307016724814793";
const META_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "EAAcwP3ozPkIBSNZB1j8HtxYhBjwbOan1DXmN9eY8rfmczjMQtzOgcvJMkSX0ZCPfjrVyD8ycvVjudkLcIx7KnzMpKPlR43ESAWBG6j5ElykzE3rSjuYQPPTkuZB0EikpkRTAkxG0ZAvljy9HTekAgQilZBWWZBr3dAiBe8pkhYn0MrPclMaVGXxiQcqibnOgZDZD";

/**
 * SHA-256 Hashing helper required by Meta Conversions API (CAPI) for user_data
 */
function hashMetaUserData(val) {
  if (!val || typeof val !== "string") return undefined;
  const clean = val.trim().toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * SHA-256 Phone Hashing helper (digits only with country code)
 */
function hashMetaPhone(phone) {
  if (!phone) return undefined;
  let clean = String(phone).replace(/\D/g, "");
  if (!clean) return undefined;
  // If 10 digits India number, prepend 91 for Meta standard formatting
  if (clean.length === 10) clean = "91" + clean;
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * Node.js Server-Side Meta Conversions API (CAPI) Dispatcher
 */
async function sendMetaCapiEvent({
  eventName = "PageView",
  eventSourceUrl = "https://firstoptionagency.in/",
  email = "",
  phone = "",
  fullName = "",
  customData = {},
  clientIp = "",
  userAgent = "",
  testEventCode = "",
}) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const eventId = `capi_${eventName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const hashedEmail = hashMetaUserData(email);
    const hashedPhone = hashMetaPhone(phone);
    const hashedName = hashMetaUserData(fullName);

    const userDataNode = {};
    if (hashedEmail) userDataNode.em = [hashedEmail];
    if (hashedPhone) userDataNode.ph = [hashedPhone];
    if (hashedName) userDataNode.fn = [hashedName];

    let cleanIp = Array.isArray(clientIp) ? clientIp[0] : (clientIp || "").split(",")[0].trim();
    if (cleanIp.startsWith("::ffff:")) cleanIp = cleanIp.replace("::ffff:", "");
    if (cleanIp && cleanIp !== "::1" && cleanIp !== "127.0.0.1") {
      userDataNode.client_ip_address = cleanIp;
    }
    if (userAgent && typeof userAgent === "string" && userAgent.length > 0) {
      userDataNode.client_user_agent = userAgent;
    }

    const eventPayload = {
      event_name: eventName,
      event_time: timestamp,
      event_id: eventId,
      action_source: "website",
      event_source_url: eventSourceUrl || "https://firstoptionagency.in/",
      user_data: userDataNode,
    };

    if (customData && Object.keys(customData).length > 0) {
      eventPayload.custom_data = customData;
    }

    const requestBody = {
      data: [eventPayload],
    };

    if (testEventCode) {
      requestBody.test_event_code = testEventCode;
    }

    const apiUrl = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseData = await res.json();
    if (responseData && responseData.events_received) {
      console.log(`✅ [Node.js Meta CAPI Success] Fired ${eventName} to Meta! (Events Received: ${responseData.events_received})`);
    } else {
      console.warn(`⚠️ [Node.js Meta CAPI Response]:`, JSON.stringify(responseData));
    }

    return { success: true, response: responseData, eventId };
  } catch (err) {
    console.error("🔥 [Node.js Meta CAPI Exception]:", err.message || err);
    return { success: false, error: err.message };
  }
}

/**
 * POST /api/whatsapp/capi-event (or /api/meta-capi)
 * Node.js Express Endpoint for Client-Side Frontend CAPI Triggering
 */
router.post("/capi-event", async (req, res) => {
  try {
    const {
      eventName,
      eventSourceUrl,
      email,
      phone,
      fullName,
      customData,
      testEventCode,
    } = req.body || {};

    const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    const result = await sendMetaCapiEvent({
      eventName: eventName || "PageView",
      eventSourceUrl: eventSourceUrl || "https://firstoptionagency.in/",
      email,
      phone,
      fullName,
      customData,
      clientIp: Array.isArray(clientIp) ? clientIp[0] : clientIp.split(",")[0],
      userAgent,
      testEventCode,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("CAPI Endpoint Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.sendMetaCapiEvent = sendMetaCapiEvent;

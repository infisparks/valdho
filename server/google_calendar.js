const express = require("express");
const router = express.Router();

const FIREBASE_DB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://firstoption-8da25-default-rtdb.firebaseio.com"
).replace(/\/$/, "");

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
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("[Google Calendar] Firebase DB Exception:", err);
    return null;
  }
}

/**
 * Get Valid Google Access Token (Refreshes using refresh_token if needed)
 */
async function getGoogleAccessToken(account) {
  if (!account || (!account.refreshToken && !account.accessToken)) return null;

  // Check if current accessToken is still valid (with 5 min buffer)
  if (account.accessToken && account.expiresAt && new Date(account.expiresAt).getTime() > Date.now() + 300000) {
    return account.accessToken;
  }

  if (!account.refreshToken) return account.accessToken || null;

  // Refresh Access Token using Refresh Token & Client Credentials
  const clientId = account.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = account.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return account.accessToken || null;

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.access_token) {
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await firebaseDb(`google_meet_integrations/firstoptionagency/${account.id}`, "PATCH", {
        accessToken: data.access_token,
        expiresAt,
        updatedAt: new Date().toISOString(),
      });
      return data.access_token;
    }
  } catch (err) {
    console.error("[Google OAuth] Refresh Token Exception:", err);
  }

  return account.accessToken || null;
}

/**
 * Helper to Create Unique Google Meet Meeting Event on Google Calendar
 */
async function createUniqueGoogleMeetEvent({ fullName, email, dateStr, timeStr }) {
  try {
    const integrationsObj = (await firebaseDb("google_meet_integrations/firstoptionagency")) || {};
    const accounts = Object.values(integrationsObj).filter(Boolean);
    const activeOAuthAcc = accounts.find((a) => a.refreshToken || a.accessToken) || accounts[0];

    if (!activeOAuthAcc) {
      return null; // No OAuth account connected
    }

    const accessToken = await getGoogleAccessToken(activeOAuthAcc);
    if (!accessToken) return null;

    // Parse start datetime
    let startIso = new Date().toISOString();
    if (dateStr) {
      let hour = 12;
      let minute = 0;
      if (timeStr) {
        const cleanTime = timeStr.trim();
        if (cleanTime.includes("AM") || cleanTime.includes("PM")) {
          const isPm = cleanTime.includes("PM");
          const timePart = cleanTime.replace("AM", "").replace("PM", "").trim();
          const parts = timePart.split(":");
          hour = parseInt(parts[0], 10);
          if (isPm && hour < 12) hour += 12;
          if (!isPm && hour === 12) hour = 0;
          if (parts[1]) minute = parseInt(parts[1], 10);
        }
      }
      const dt = new Date(`${dateStr.trim()}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`);
      if (!isNaN(dt.getTime())) startIso = dt.toISOString();
    }

    const endDt = new Date(new Date(startIso).getTime() + 45 * 60 * 1000); // 45 minute duration
    const endIso = endDt.toISOString();

    const eventPayload = {
      summary: `Strategy Session with ${fullName || "Client"}`,
      description: `Strategy Session booked via First Option Agency CRM. Client Email: ${email || "N/A"}`,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees: email ? [{ email }] : [],
      conferenceData: {
        createRequest: {
          requestId: `valdho_meet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    const data = await res.json();
    if (data.hangoutLink) {
      console.log(`[Google Meet 🎥] Generated Unique Link for ${fullName}: ${data.hangoutLink}`);
      return data.hangoutLink;
    } else if (data.conferenceData?.entryPoints?.[0]?.uri) {
      return data.conferenceData.entryPoints[0].uri;
    }
  } catch (err) {
    console.error("[Google Calendar API Exception]:", err);
  }

  return null;
}

/**
 * REST Endpoint: Connect / Save Google OAuth Token or Credentials
 * POST /api/google/connect-oauth
 */
router.post("/connect-oauth", async (req, res) => {
  try {
    const { name, email, clientId, clientSecret, refreshToken, accessToken, meetingUrl } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const accId = `meet_oauth_${Date.now()}`;
    const payload = {
      id: accId,
      name: name.trim(),
      email: email.trim(),
      type: "google_oauth",
      clientId: clientId || "",
      clientSecret: clientSecret || "",
      refreshToken: refreshToken || "",
      accessToken: accessToken || "",
      meetingUrl: meetingUrl || "https://meet.google.com/firstoption-strategy-call",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await firebaseDb(`google_meet_integrations/firstoptionagency/${accId}`, "PUT", payload);
    await firebaseDb(`whatsapp_configuration/firstoptionagency/defaultMeetingUrl`, "PUT", payload.meetingUrl);

    return res.status(200).json({ success: true, message: "Google OAuth account connected", data: payload });
  } catch (err) {
    console.error("Connect OAuth Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * REST Endpoint: Create Dynamic Unique Meeting Link
 * POST /api/google/generate-meet-link
 */
router.post("/generate-meet-link", async (req, res) => {
  try {
    const { fullName, email, dateStr, timeStr } = req.body;
    const uniqueUrl = await createUniqueGoogleMeetEvent({ fullName, email, dateStr, timeStr });

    if (uniqueUrl) {
      return res.status(200).json({ success: true, meetingUrl: uniqueUrl });
    }

    // Fallback if OAuth is not active
    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    const fallbackUrl = config.defaultMeetingUrl || "https://meet.google.com/firstoption-strategy-call";

    return res.status(200).json({ success: true, isFallback: true, meetingUrl: fallbackUrl });
  } catch (err) {
    console.error("Generate Meet Link Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { router, createUniqueGoogleMeetEvent };

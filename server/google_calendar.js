const express = require("express");
const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://first.infiplus.in/api/google/callback";

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
  if (!account) return null;

  // Check if current accessToken is still valid (with 5 min buffer)
  if (account.accessToken && account.expiresAt && new Date(account.expiresAt).getTime() > Date.now() + 300000) {
    return account.accessToken;
  }

  if (!account.refreshToken) return account.accessToken || null;

  const clientId = account.clientId || GOOGLE_CLIENT_ID;
  const clientSecret = account.clientSecret || GOOGLE_CLIENT_SECRET;

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
      await firebaseDb(`google_meet_integrations/global/${account.id}`, "PATCH", {
        accessToken: data.access_token,
        expiresAt,
        updatedAt: new Date().toISOString(),
      });
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
    const globalObj = (await firebaseDb("google_meet_integrations/global")) || {};
    const agencyObj = (await firebaseDb("google_meet_integrations/firstoptionagency")) || {};
    const integrationsObj = { ...agencyObj, ...globalObj };

    const accounts = Object.values(integrationsObj).filter(Boolean);
    const activeOAuthAcc = accounts.find((a) => a.refreshToken || a.accessToken) || accounts[0];

    if (!activeOAuthAcc) {
      console.warn("[Google Meet ⚠️] No Google OAuth account connected. Unable to create dynamic Meet link.");
      return null;
    }

    const accessToken = await getGoogleAccessToken(activeOAuthAcc);
    if (!accessToken) return null;

    // Parse start date & time robustly for IST (+05:30) timezone
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();

    if (dateStr && dateStr.trim()) {
      const cleanDate = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        const [y, m, d] = cleanDate.split("-").map(Number);
        year = y;
        month = m;
        day = d;
      } else {
        const dObj = new Date(cleanDate);
        if (!isNaN(dObj.getTime())) {
          year = dObj.getFullYear();
          month = dObj.getMonth() + 1;
          day = dObj.getDate();
        }
      }
    }

    let hour = 12;
    let minute = 0;
    if (timeStr && timeStr.trim()) {
      const cleanTime = timeStr.trim();
      if (cleanTime.toUpperCase().includes("AM") || cleanTime.toUpperCase().includes("PM")) {
        const isPm = cleanTime.toUpperCase().includes("PM");
        const timePart = cleanTime.replace(/AM|PM/gi, "").trim();
        const parts = timePart.split(":");
        hour = parseInt(parts[0], 10);
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        if (parts[1]) minute = parseInt(parts[1], 10);
      } else if (cleanTime.includes(":")) {
        const parts = cleanTime.split(":");
        hour = parseInt(parts[0], 10);
        minute = parseInt(parts[1], 10);
      }
    }

    const pad = (n) => String(n).padStart(2, "0");
    const startIso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`;

    const startDateObj = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`);
    const endDateObj = new Date(startDateObj.getTime() + 45 * 60 * 1000);
    const endIso = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}T${pad(endDateObj.getHours())}:${pad(endDateObj.getMinutes())}:00+05:30`;

    const eventPayload = {
      summary: `Strategy Session with ${fullName || "Client"}`,
      description: `Strategy Session booked via CRM. Client Email: ${email || "N/A"}`,
      start: {
        dateTime: startIso,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endIso,
        timeZone: "Asia/Kolkata",
      },
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
      console.log(`[Google Meet 🎥] Generated Dynamic Unique Meet Link for ${fullName}: ${data.hangoutLink}`);
      return data.hangoutLink;
    } else if (data.conferenceData?.entryPoints?.[0]?.uri) {
      return data.conferenceData.entryPoints[0].uri;
    } else {
      console.error("[Google Meet API Response]:", data);
    }
  } catch (err) {
    console.error("[Google Calendar API Exception]:", err);
  }

  return null;
}

/* ==========================================================================
   REST ENDPOINTS FOR GOOGLE OAUTH 2.0 CONNECTIVITY
   ========================================================================== */

/**
 * GET /api/google/auth-url
 * Returns Google Sign-In authorization URL
 */
router.get("/auth-url", (req, res) => {
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
  );
  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    GOOGLE_REDIRECT_URI
  )}&scope=${scope}&access_type=offline&prompt=consent`;

  return res.status(200).json({ success: true, url });
});

/**
 * GET /api/google/callback
 * Handles OAuth callback code from Google Sign-In
 */
router.get("/callback", async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error("Google OAuth Access Denied Error:", error);
      return res.status(400).send(`Google OAuth error: ${error}`);
    }

    if (!code) {
      return res.status(400).send("Authorization code missing from Google callback.");
    }

    const params = new URLSearchParams({
      code: String(code),
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Google Token Exchange Failed:", tokenData);
      return res.status(400).send(`Google OAuth Token Error: ${JSON.stringify(tokenData)}`);
    }

    // Fetch user profile (Email, Name) from Google userinfo API
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const accId = `meet_oauth_${Date.now()}`;
    const payload = {
      id: accId,
      name: userData.name || userData.email || "Google Workspace Account",
      email: userData.email || "google@workspace.com",
      type: "google_oauth",
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: tokenData.refresh_token || "",
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      meetingUrl: "https://meet.google.com",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // Save to Firebase RTDB for global usage across all campaigns
    await firebaseDb(`google_meet_integrations/global/${accId}`, "PUT", payload);
    await firebaseDb(`google_meet_integrations/firstoptionagency/${accId}`, "PUT", payload);

    console.log(`[Google OAuth Success 🚀] Connected Google Account: ${payload.email}`);

    // Return HTML success response that notifies opener window and redirects cleanly
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Google Meet Integration Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body class="bg-slate-900 text-white min-h-screen flex items-center justify-center font-sans p-4">
        <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div class="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-3xl font-extrabold flex items-center justify-center mx-auto">
            ✓
          </div>
          <h2 class="text-xl font-black text-white">Google Meet Connected!</h2>
          <p class="text-xs text-slate-300">
            Connected Account: <strong class="text-emerald-400 font-mono">${payload.email}</strong>
          </p>
          <p class="text-[11px] text-slate-400">
            Google Calendar API is now active globally for all your campaigns to auto-generate unique Google Meet links for every booking!
          </p>
          <div class="pt-2">
            <button onclick="window.close(); if(window.opener) window.opener.location.reload();" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-6 py-2.5 rounded-xl shadow-lg cursor-pointer">
              Return to CRM Dashboard
            </button>
          </div>
        </div>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.location.href = window.opener.location.origin + '/crms/whatsapp?oauth=success';
              window.close();
            } else if (document.referrer) {
              window.location.href = document.referrer;
            }
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth Callback Exception:", err);
    return res.status(500).send(`Google OAuth Exception: ${err.message}`);
  }
});

/**
 * POST /api/google/connect-oauth
 */
router.post("/connect-oauth", async (req, res) => {
  try {
    const { name, email, clientId, clientSecret, refreshToken, accessToken } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const accId = `meet_oauth_${Date.now()}`;
    const payload = {
      id: accId,
      name: name.trim(),
      email: email.trim(),
      type: "google_oauth",
      clientId: clientId || GOOGLE_CLIENT_ID,
      clientSecret: clientSecret || GOOGLE_CLIENT_SECRET,
      refreshToken: refreshToken || "",
      accessToken: accessToken || "",
      meetingUrl: "https://meet.google.com",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await firebaseDb(`google_meet_integrations/global/${accId}`, "PUT", payload);
    await firebaseDb(`google_meet_integrations/firstoptionagency/${accId}`, "PUT", payload);

    return res.status(200).json({ success: true, message: "Google OAuth account connected", data: payload });
  } catch (err) {
    console.error("Connect OAuth Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/google/generate-meet-link
 */
router.post("/generate-meet-link", async (req, res) => {
  try {
    const { fullName, email, dateStr, timeStr } = req.body;
    const uniqueUrl = await createUniqueGoogleMeetEvent({ fullName, email, dateStr, timeStr });

    if (uniqueUrl) {
      return res.status(200).json({ success: true, meetingUrl: uniqueUrl });
    }

    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    const fallbackUrl = config.defaultMeetingUrl || "https://meet.google.com/firstoption-strategy-call";

    return res.status(200).json({ success: true, isFallback: true, meetingUrl: fallbackUrl });
  } catch (err) {
    console.error("Generate Meet Link Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { router, createUniqueGoogleMeetEvent };

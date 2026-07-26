const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

// Register embedded TTF font family for server-side Canvas rendering (fixes blank text on Linux/Docker servers)
try {
  const poppinsPath = path.join(__dirname, "fonts/Poppins-Bold.ttf");
  const robotoPath = path.join(__dirname, "fonts/Roboto-Bold.ttf");
  if (fs.existsSync(poppinsPath)) {
    GlobalFonts.registerFromPath(poppinsPath, "Poppins");
  }
  if (fs.existsSync(robotoPath)) {
    GlobalFonts.registerFromPath(robotoPath, "Roboto");
  }
} catch (fontErr) {
  console.error("GlobalFonts registration exception:", fontErr);
}

/**
 * Server-Side ID / Confirmation Card Image Generator
 * Overlay lead details onto template card image (server/image/card.png)
 */
const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://firstoption-8da25-default-rtdb.firebaseio.com").replace(/\/$/, "");
const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_DATABASE_SECRET || "";

/**
 * Fetch lead details from Firebase RTDB if missing from request payload
 */
async function fetchLeadFromFirebase(lookupKey) {
  try {
    if (!lookupKey) return null;
    const authQuery = FIREBASE_DB_SECRET ? `?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}` : "";
    const res = await fetch(`${FIREBASE_DB_URL}/campaigns/firstoptionagency/leads.json${authQuery}`);
    if (!res.ok) return null;
    const leadsDateObj = await res.json();
    if (!leadsDateObj) return null;

    const cleanNum = String(lookupKey).replace(/\D/g, "");
    const cleanEmail = String(lookupKey).toLowerCase().trim();

    for (const [dateKey, leadsMap] of Object.entries(leadsDateObj)) {
      if (!leadsMap || typeof leadsMap !== "object") continue;
      for (const [leadId, lead] of Object.entries(leadsMap)) {
        if (!lead || typeof lead !== "object") continue;
        const pNum = lead.phone ? String(lead.phone).replace(/\D/g, "") : "";
        const eAddr = lead.email ? String(lead.email).toLowerCase().trim() : "";

        if (
          (cleanNum && cleanNum.length >= 5 && pNum && (pNum.endsWith(cleanNum) || cleanNum.endsWith(pNum))) ||
          (cleanEmail && eAddr === cleanEmail) ||
          (cleanEmail && leadId && leadId.includes(cleanEmail.replace(/[^a-z0-9]/g, "_")))
        ) {
          return lead;
        }
      }
    }
  } catch (err) {
    console.error("fetchLeadFromFirebase Exception:", err);
  }
  return null;
}

/**
 * Server-Side ID / Confirmation Card Image Generator
 * Overlay lead details onto template card image (server/image/card.png)
 */
async function generateConfirmationCardBuffer(data = {}) {
  let fullName = (data.fullName || data.name || "").trim();
  let phone = (data.phone || "").trim();
  let email = (data.email || "").trim();
  let dateStr = (data.date || data.meetingDate || "").trim();
  let timeStr = (data.time || data.meetingTime || "").trim();

  // Automatic Firebase Lookup Fallback if details are missing or empty
  if (!fullName || fullName === "-" || !email || email === "-") {
    const targetLookup = phone || email || fullName;
    if (targetLookup) {
      const fbLead = await fetchLeadFromFirebase(targetLookup);
      if (fbLead) {
        if (!fullName || fullName === "-") fullName = fbLead.fullName || "";
        if (!email || email === "-") email = fbLead.email || "";
        if (!phone || phone === "-") phone = fbLead.phone || "";
        if (!dateStr && fbLead.meeting?.meetingDate) dateStr = fbLead.meeting.meetingDate;
        if (!timeStr && fbLead.meeting?.meetingTime) timeStr = fbLead.meeting.meetingTime;
      }
    }
  }

  // Final Fallback values if still empty
  fullName = fullName || "Valued Client";
  email = email || "N/A";
  phone = phone || "N/A";
  const today = new Date();
  dateStr =
    dateStr ||
    today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  timeStr =
    timeStr ||
    today.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const cleanPhone = String(phone).replace(/\D/g, "");
  const formattedPhone =
    cleanPhone.length === 10 ? `+91 ${cleanPhone}` : phone.startsWith("+") ? phone : `+${phone}`;

  let templatePath = path.join(__dirname, "image/card.png");
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(__dirname, "../public/firstoption/whatsapp_thumbanil.png");
  }

  const imgBuffer = fs.readFileSync(templatePath);
  const img = await loadImage(imgBuffer);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // 1. Draw template background image (1536 x 1024)
  ctx.drawImage(img, 0, 0, img.width, img.height);

  // 2. Configure bold, crisp professional typography
  ctx.fillStyle = "#0f172a"; // Deep slate text
  ctx.font = "bold 40px Poppins, Roboto, Arial, sans-serif";

  // 3. Draw text fields perfectly centered vertically inside white rows
  const startX = 185;
  ctx.fillText(fullName, startX, 513);
  ctx.fillText(formattedPhone, startX, 576);
  ctx.fillText(email, startX, 640);
  ctx.fillText(dateStr, startX, 704);
  ctx.fillText(timeStr, startX, 768);

  return canvas.toBuffer("image/png");
}

/**
 * Generate Card & Send via WhatsApp Evolution API
 */
async function generateAndSendWhatsAppCard({
  phone,
  fullName,
  email,
  date,
  time,
  meetingUrl,
  instanceName,
  sendWithCard = true,
}) {
  try {
    const cleanPhone = String(phone).replace(/\D/g, "");
    const recipientPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const evoApiUrl = (process.env.WHATSAPP_API_URL || "https://evo.infispark.in").replace(/\/$/, "");
    const evoApiKey = process.env.WHATSAPP_API_KEY || "4296B0A7B0A9-4E64-A821-65775B345474";
    const activeInstance = instanceName || process.env.WHATSAPP_INSTANCE_NAME || "FirstOptionSales";

    const meetUrl = meetingUrl || "https://meet.google.com/firstoption-strategy-call";
    const captionText =
      `🎉 *Appointment Confirmed!*\n\n` +
      `Hi *${fullName || "Valued Client"}*,\n` +
      `Your 1-on-1 Business Growth Consultation has been booked successfully.\n\n` +
      `📅 *Date:* ${date}\n` +
      `⏰ *Time:* ${time}\n` +
      `📧 *Email:* ${email}\n` +
      `🎥 *Google Meet Link:* ${meetUrl}\n\n` +
      `We're excited to help you scale your business revenue!`;

    if (sendWithCard) {
      console.log(`🎨 [ID CARD SERVER]: Rendering PNG image for ${fullName} (${recipientPhone})...`);
      const cardBuffer = await generateConfirmationCardBuffer({
        fullName,
        phone: recipientPhone,
        email,
        date,
        time,
      });

      const base64Image = cardBuffer.toString("base64");

      console.log(`📤 [ID CARD SERVER]: Sending WhatsApp Media Card via Evolution API (${activeInstance})...`);
      const mediaResponse = await fetch(`${evoApiUrl}/message/sendMedia/${activeInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evoApiKey,
        },
        body: JSON.stringify({
          number: recipientPhone,
          mediatype: "image",
          mimetype: "image/png",
          caption: captionText,
          media: base64Image,
          fileName: `Confirmation_Card_${(fullName || "Client").replace(/\s+/g, "_")}.png`,
        }),
      });

      const resData = await mediaResponse.json();
      console.log(`✅ [ID CARD SERVER]: WhatsApp Media Card Dispatch Result:`, resData);
      const isSuccess = mediaResponse.ok && !resData.error;
      return { success: isSuccess, sendWithCard: true, result: resData };
    } else {
      console.log(`💬 [ID CARD SERVER]: Sending WhatsApp Text Notification (without card) to ${recipientPhone}...`);
      const textResponse = await fetch(`${evoApiUrl}/message/sendText/${activeInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evoApiKey,
        },
        body: JSON.stringify({
          number: recipientPhone,
          text: captionText,
        }),
      });

      const resData = await textResponse.json();
      console.log(`✅ [ID CARD SERVER]: WhatsApp Text Dispatch Result:`, resData);
      return { success: true, sendWithCard: false, result: resData };
    }
  } catch (err) {
    console.error("🔥 [ID CARD SERVER ERROR]: Failed to generate/send WhatsApp card:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateConfirmationCardBuffer,
  generateAndSendWhatsAppCard,
};

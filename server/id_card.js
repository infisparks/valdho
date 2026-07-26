const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

/**
 * Server-Side ID / Confirmation Card Image Generator
 * Overlay lead details onto template card image (server/image/card.png)
 */
async function generateConfirmationCardBuffer(data = {}) {
  const fullName = data.fullName || data.name || " - ";
  const phone = data.phone || " - ";
  const email = data.email || " - ";

  const today = new Date();
  const dateStr =
    data.date ||
    data.meetingDate ||
    today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const timeStr =
    data.time ||
    data.meetingTime ||
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
  ctx.font = "bold 26px sans-serif";

  // 3. Draw text fields perfectly centered vertically inside white rows
  const startX = 185;
  ctx.fillText(fullName, startX, 485);
  ctx.fillText(formattedPhone, startX, 548);
  ctx.fillText(email, startX, 612);
  ctx.fillText(dateStr, startX, 676);
  ctx.fillText(timeStr, startX, 740);

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

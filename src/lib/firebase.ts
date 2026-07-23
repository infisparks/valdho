import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, update, push } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);

export interface LeadData {
  id?: string;
  campaign?: string;
  createdAt?: string;
  updatedAt?: string;
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  appointmentDate?: string;
  appointmentTime?: string;
  status: "partial" | "completed";
  survey?: {
    industry?: string;
    role?: string;
    revenue?: string;
    investmentReady?: string;
  };
}

/**
 * Save or Update lead entry in Realtime Database under:
 * campaigns/[campaignName]/[appointmentDate]/[leadId]
 */
export async function saveOrUpdateLead(
  lead: LeadData,
  existingLeadId?: string | null,
  campaignName: string = "firstoptionagency"
): Promise<string | null> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = lead.appointmentDate || todayStr;
    const timestamp = new Date().toISOString();

    let leadId = existingLeadId;
    
    // If no existing ID, generate a new unique push key under date ref
    if (!leadId) {
      const dateRef = ref(db, `campaigns/${campaignName}/${targetDate}`);
      const newRef = push(dateRef);
      leadId = newRef.key;
    }

    if (!leadId) return null;

    const leadRef = ref(db, `campaigns/${campaignName}/${targetDate}/${leadId}`);

    const payload = {
      id: leadId,
      campaign: campaignName,
      createdAt: lead.createdAt || timestamp,
      updatedAt: timestamp,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      countryCode: lead.countryCode || "+91",
      status: lead.status,
      appointmentDate: targetDate,
      appointmentTime: lead.appointmentTime || "",
      survey: lead.survey || {},
    };

    await set(leadRef, payload);
    return leadId;
  } catch (error) {
    console.error("Firebase Database Save Error:", error);
    return null;
  }
}

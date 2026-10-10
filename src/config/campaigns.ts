export interface QuestionOption {
  label: string;
  key: string;
}

export interface QualificationQuestion {
  num: number;
  question: string;
  field: string;
  options: QuestionOption[];
}

export interface CampaignConfig {
  id: string;
  title: string;
  subtitle: string;
  questions: QualificationQuestion[];
}

export const CAMPAIGNS: Record<string, CampaignConfig> = {
  firstoptionagency: {
    id: "firstoptionagency",
    title: "First Option Agency",
    subtitle: "Let's Understand Your Business Before We Grow It",
    questions: [
      {
        num: 1,
        question: "What type of business do you run?",
        field: "businessType",
        options: [
          { label: "Doctor / Clinic / Healthcare", key: "A" },
          { label: "IT Company / Agency / B2B Services", key: "B" },
          { label: "Manufacturer / Wholesaler / Distributor", key: "C" },
          { label: "Education / Coaching / Consultant", key: "D" },
          { label: "Real Estate", key: "E" },
          { label: "Other", key: "F" },
        ],
      },
      {
        num: 2,
        question: "What is the biggest challenge in getting more customers right now?",
        field: "mainChallenge",
        options: [
          { label: "We need more enquiries or leads.", key: "A" },
          { label: "We get leads, but they are not the right fit.", key: "B" },
          { label: "We get leads, but follow-up is inconsistent.", key: "C" },
          { label: "We book appointments, but people don't attend.", key: "D" },
          { label: "We get appointments, but too few become paying customers.", key: "E" },
          { label: "We don't have a consistent client acquisition system.", key: "F" },
          { label: "Other", key: "G" },
        ],
      },
      {
        num: 3,
        question: "What is your business's approximate monthly revenue?",
        field: "monthlyRevenue",
        options: [
          { label: "Not generating revenue yet", key: "A" },
          { label: "Below ₹2 lakh per month", key: "B" },
          { label: "₹2 lakh–₹5 lakh per month", key: "C" },
          { label: "₹5 lakh–₹15 lakh per month", key: "D" },
          { label: "₹15 lakh–₹50 lakh per month", key: "E" },
          { label: "Above ₹50 lakh per month", key: "F" },
        ],
      },
      {
        num: 4,
        question: "If we identify a suitable growth opportunity, are you prepared to invest ₹50,000 or more per month in building your client acquisition system, if the strategy makes sense for your business?",
        field: "investmentCapacity",
        options: [
          { label: "Yes, I can invest ₹50,000+ per month.", key: "A" },
          { label: "Possibly, depending on the strategy, scope and expected return.", key: "B" },
          { label: "Not at the moment.", key: "C" },
        ],
      },
      {
        num: 5,
        question: "If you book a Growth Strategy Call with Faiz, can you attend at the selected time, from a quiet place, with around 30 minutes available to discuss your business?",
        field: "attendanceCommitment",
        options: [
          { label: "Yes, I can attend at the selected time.", key: "A" },
          { label: "I need to check my availability first.", key: "B" },
        ],
      },
    ],
  },
  doctors_growth: {
    id: "doctors_growth",
    title: "Doctors & Clinic Growth Campaign",
    subtitle: "Help Us Tailor Your Patient Acquisition Strategy",
    questions: [
      {
        num: 2,
        question: "What type of practice do you run? *",
        field: "practiceType",
        options: [
          { label: "Dental Clinic", key: "A" },
          { label: "Dermatology / Cosmetology", key: "B" },
          { label: "Multispecialty Hospital", key: "C" },
          { label: "Ayurveda / Wellness", key: "D" },
          { label: "Solo Practitioner", key: "E" },
        ],
      },
      {
        num: 3,
        question: "How many new patients do you want per month? *",
        field: "targetPatients",
        options: [
          { label: "15 – 30 new patients", key: "A" },
          { label: "30 – 60 new patients", key: "B" },
          { label: "60+ high-value surgeries/treatments", key: "C" },
        ],
      },
      {
        num: 4,
        question: "Are you currently running Google or Meta Ads? *",
        field: "currentAdsStatus",
        options: [
          { label: "Yes, in-house", key: "A" },
          { label: "Yes, with another agency", key: "B" },
          { label: "No, never tried before", key: "C" },
        ],
      },
    ],
  },
};

export const DEFAULT_CAMPAIGN_ID = "firstoptionagency";

export function getCampaignConfig(campaignId?: string | null): CampaignConfig {
  if (campaignId && CAMPAIGNS[campaignId]) {
    return CAMPAIGNS[campaignId];
  }
  return CAMPAIGNS[DEFAULT_CAMPAIGN_ID];
}

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UrgencyBar } from "@/components/UrgencyBar";
import { HeaderBadge } from "@/components/HeaderBadge";
import { HeroSection } from "@/components/HeroSection";
import { CycleSection } from "@/components/CycleSection";
import { ProblemSection } from "@/components/ProblemSection";
import { SolutionSection } from "@/components/SolutionSection";
import { WhyDifferentSection } from "@/components/WhyDifferentSection";
import { FounderSection } from "@/components/FounderSection";
import { ClientResultsSection } from "@/components/ClientResultsSection";
import { GrowthCalculator } from "@/components/GrowthCalculator";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { IndustriesSection } from "@/components/IndustriesSection";
import { FAQSection } from "@/components/FAQSection";
import { VideoModal } from "@/components/VideoModal";
import { BookingModal } from "@/components/BookingModal";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { SocialProofToast } from "@/components/SocialProofToast";

function URLParamsHandler({
  onConfigureBooking,
}: {
  onConfigureBooking: (config: {
    isOpen: boolean;
    step: 1 | 2 | 3 | 4;
    leadId: string | null;
    createdDate: string | null;
    campaignName: string | null;
  }) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const leadIdParam = searchParams.get("leadId");
    const createdDateParam = searchParams.get("createdDate");
    const campaignParam = searchParams.get("campaign");

    if (stepParam || campaignParam) {
      let targetStep: 1 | 2 | 3 | 4 = 1;
      if (stepParam === "survey" || stepParam === "2") targetStep = 2;
      else if (stepParam === "meeting" || stepParam === "3") targetStep = 3;
      else if (stepParam === "4" || stepParam === "success") targetStep = 4;

      onConfigureBooking({
        isOpen: true,
        step: targetStep,
        leadId: leadIdParam,
        createdDate: createdDateParam,
        campaignName: campaignParam,
      });
    }
  }, [searchParams]);

  return null;
}

export default function Home() {
  const [bookingConfig, setBookingConfig] = useState<{
    isOpen: boolean;
    step: 1 | 2 | 3 | 4;
    leadId: string | null;
    createdDate: string | null;
    campaignName: string | null;
  }>({
    isOpen: false,
    step: 1,
    leadId: null,
    createdDate: null,
    campaignName: null,
  });

  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    title: string;
    author: string;
    embedId?: string;
  }>({
    isOpen: false,
    title: "",
    author: "",
    embedId: undefined,
  });

  const handleOpenBooking = useCallback(() => {
    setBookingConfig({
      isOpen: true,
      step: 1,
      leadId: null,
      createdDate: null,
      campaignName: null,
    });
  }, []);

  const handleCloseBooking = useCallback(() => {
    setBookingConfig({
      isOpen: false,
      step: 1,
      leadId: null,
      createdDate: null,
      campaignName: null,
    });
  }, []);

  const handleConfigureBooking = useCallback(
    (config: {
      isOpen: boolean;
      step: 1 | 2 | 3 | 4;
      leadId: string | null;
      createdDate: string | null;
      campaignName: string | null;
    }) => {
      setBookingConfig((prev) => {
        if (
          prev.isOpen === config.isOpen &&
          prev.step === config.step &&
          prev.leadId === config.leadId &&
          prev.createdDate === config.createdDate &&
          prev.campaignName === config.campaignName
        ) {
          return prev;
        }
        return config;
      });
    },
    []
  );

  const handleOpenVideo = useCallback((title: string, author: string, embedId?: string) => {
    setVideoModal({
      isOpen: true,
      title,
      author,
      embedId,
    });
  }, []);

  const handleCloseVideo = useCallback(() => {
    setVideoModal({
      isOpen: false,
      title: "",
      author: "",
      embedId: undefined,
    });
  }, []);

  return (
    <div className="w-full pb-32 text-slate-100 flex flex-col items-center justify-start min-h-screen antialiased">
      {/* URL Parameter Direct Link Handler */}
      <Suspense fallback={null}>
        <URLParamsHandler onConfigureBooking={handleConfigureBooking} />
      </Suspense>

      {/* Top Urgency Ticker Bar */}
      <UrgencyBar />

      {/* Top Announcement Badge Header */}
      <HeaderBadge onBookClick={handleOpenBooking} />

      {/* Main Container */}
      <main className="w-full max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl px-3 sm:px-4 space-y-9 sm:space-y-12">
        {/* 1. Hero Card */}
        <HeroSection
          onBookClick={handleOpenBooking}
          onVideoClick={handleOpenVideo}
        />

        {/* 2. Client Results & Proof */}
        <ClientResultsSection onVideoClick={handleOpenVideo} />

        {/* 3. Cycle Section ("Most businesses are stuck in this cycle") */}
        <CycleSection />

        {/* 4. Problem Diagnosis Section */}
        <ProblemSection />

        {/* 5. Solution Section ("We Don't Run Ads. We Build Revenue Systems.") */}
        <SolutionSection onBookClick={handleOpenBooking} />

        {/* 6. How It Works Section (Placed right after SolutionSection) */}
        <HowItWorksSection onBookClick={handleOpenBooking} />

        {/* 7. Why We Are Different Section */}
        <WhyDifferentSection />

        {/* 8. Meet The Founder Section */}
        <FounderSection onBookClick={handleOpenBooking} />

        {/* 9. Interactive Revenue Calculator Widget */}
        <GrowthCalculator onBookClick={handleOpenBooking} />

        {/* 10. Industries We Have Worked With Grid */}
        <IndustriesSection />

        {/* 11. Frequently Asked Questions */}
        <FAQSection />

        {/* Final Bottom High-Conversion CTA Banner */}
        <section className="hero-border-card rounded-3xl p-6 sm:p-10 text-center space-y-4 my-8">
          <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full text-amber-400 text-xs sm:text-sm font-bold">
            <i className="fa-solid fa-lock text-xs"></i>
            <span>100% Risk-Free Growth Consultation</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">
            Ready to Stop Chasing Leads & Start Booking Real Buyers?
          </h2>

          <p className="text-slate-300 text-sm sm:text-base md:text-lg font-medium max-w-2xl mx-auto">
            Book your 1-on-1 Growth Session now. We will map out your exact customer acquisition pipeline step-by-step.
          </p>

          <button
            onClick={handleOpenBooking}
            className="w-full cta-gold-btn shimmer rounded-2xl p-4 sm:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all shadow-2xl"
          >
            <div className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wide flex items-center justify-center space-x-2">
              <span>CLAIM YOUR GROWTH SESSION</span>
              <i className="fa-solid fa-arrow-right"></i>
            </div>
            <div className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 mt-1">
              Only 3 spots left for this month. 100% Free Strategy Blueprint.
            </div>
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-xs sm:text-sm py-6 space-y-2 border-t border-zinc-900">
          <p className="font-bold text-slate-400">
            First Option Agency • Performance Marketing & Revenue Systems
          </p>
          <p>© {new Date().getFullYear()} First Option Agency. All Rights Reserved.</p>
          <p className="text-[11px] sm:text-xs text-slate-600">
            Results may vary based on business category, market offer, and fulfillment capabilities.
          </p>
        </footer>
      </main>

      {/* Video Modal */}
      <VideoModal
        isOpen={videoModal.isOpen}
        onClose={handleCloseVideo}
        title={videoModal.title}
        author={videoModal.author}
        embedId={videoModal.embedId}
        onBookClick={handleOpenBooking}
      />

      {/* Booking Modal */}
      <BookingModal
        isOpen={bookingConfig.isOpen}
        onClose={handleCloseBooking}
        initialStep={bookingConfig.step}
        initialLeadId={bookingConfig.leadId}
        initialCreatedDate={bookingConfig.createdDate}
        campaignName={bookingConfig.campaignName || "firstoptionagency"}
      />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA onBookClick={handleOpenBooking} />

      {/* Live Social Proof Toast */}
      <SocialProofToast />
    </div>
  );
}

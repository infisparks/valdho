"use client";

import React, { useState } from "react";
import { UrgencyBar } from "@/components/UrgencyBar";
import { HeaderBadge } from "@/components/HeaderBadge";
import { HeroSection } from "@/components/HeroSection";
import { CycleSection } from "@/components/CycleSection";
import { ProblemSection } from "@/components/ProblemSection";
import { SolutionSection } from "@/components/SolutionSection";
import { WhyDifferentSection } from "@/components/WhyDifferentSection";
import { ClientResultsSection } from "@/components/ClientResultsSection";
import { GrowthCalculator } from "@/components/GrowthCalculator";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { IndustriesSection } from "@/components/IndustriesSection";
import { FAQSection } from "@/components/FAQSection";
import { VideoModal } from "@/components/VideoModal";
import { BookingModal } from "@/components/BookingModal";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { SocialProofToast } from "@/components/SocialProofToast";

export default function Home() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
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

  const handleOpenBooking = () => setIsBookingOpen(true);
  const handleCloseBooking = () => setIsBookingOpen(false);

  const handleOpenVideo = (title: string, author: string, embedId?: string) => {
    setVideoModal({
      isOpen: true,
      title,
      author,
      embedId,
    });
  };

  const handleCloseVideo = () => {
    setVideoModal({
      isOpen: false,
      title: "",
      author: "",
      embedId: undefined,
    });
  };

  return (
    <div className="w-full pb-32 text-slate-100 flex flex-col items-center justify-start min-h-screen antialiased">
      {/* Top Urgency Ticker Bar */}
      <UrgencyBar />

      {/* Top Announcement Badge Header */}
      <HeaderBadge onBookClick={handleOpenBooking} />

      {/* Main Container */}
      <main className="w-full max-w-md md:max-w-xl lg:max-w-2xl px-3 space-y-9">
        {/* 1. Hero Card */}
        <HeroSection
          onBookClick={handleOpenBooking}
          onVideoClick={handleOpenVideo}
        />

        {/* 2. Cycle Section */}
        <CycleSection />

        {/* 3. Problem Diagnosis Section */}
        <ProblemSection />

        {/* 4. Solution Section */}
        <SolutionSection onBookClick={handleOpenBooking} />

        {/* 5. Why We Are Different Section */}
        <WhyDifferentSection />

        {/* 6. Client Results & Proof */}
        <ClientResultsSection onVideoClick={handleOpenVideo} />

        {/* 7. Interactive Revenue Calculator Widget */}
        <GrowthCalculator onBookClick={handleOpenBooking} />

        {/* 8. How It Works Step-by-Step */}
        <HowItWorksSection onBookClick={handleOpenBooking} />

        {/* 9. Industries We Have Worked With Grid */}
        <IndustriesSection />

        {/* 10. Frequently Asked Questions */}
        <FAQSection />

        {/* Final Bottom High-Conversion CTA Banner */}
        <section className="hero-border-card rounded-3xl p-6 text-center space-y-4 my-8">
          <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-amber-400 text-xs font-bold">
            <i className="fa-solid fa-lock text-xs"></i>
            <span>100% Risk-Free Growth Consultation</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            Ready to Stop Chasing Leads & Start Booking Real Buyers?
          </h2>

          <p className="text-slate-300 text-sm font-medium">
            Book your 1-on-1 Growth Session now. We will map out your exact customer acquisition pipeline step-by-step.
          </p>

          <button
            onClick={handleOpenBooking}
            className="w-full cta-gold-btn shimmer rounded-2xl p-4 sm:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all shadow-2xl"
          >
            <div className="text-xl sm:text-2xl font-black uppercase tracking-wide flex items-center justify-center space-x-2">
              <span>CLAIM YOUR GROWTH SESSION</span>
              <i className="fa-solid fa-arrow-right"></i>
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
              Only 3 spots left for this month. 100% Free Strategy Blueprint.
            </div>
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-xs py-6 space-y-2 border-t border-zinc-900">
          <p className="font-bold text-slate-400">
            First Option Agency • Performance Marketing & Revenue Systems
          </p>
          <p>© {new Date().getFullYear()} First Option Agency. All Rights Reserved.</p>
          <p className="text-[11px] text-slate-600">
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
        isOpen={isBookingOpen}
        onClose={handleCloseBooking}
      />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA onBookClick={handleOpenBooking} />

      {/* Live Social Proof Toast */}
      <SocialProofToast />
    </div>
  );
}

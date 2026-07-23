"use client";

import React from "react";

interface HeroSectionProps {
  onBookClick: () => void;
  onVideoClick: (title: string, author: string, embedId?: string) => void;
}

export function HeroSection({ onBookClick, onVideoClick }: HeroSectionProps) {
  const youtubeVideoId = "yC2-mbXI_ZE";
  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;

  return (
    <section className="hero-border-card rounded-3xl p-4 sm:p-7 my-2 text-center relative overflow-hidden">
      {/* Trust Pill */}
      <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full text-amber-400 text-xs font-bold mb-4">
        <i className="fa-solid fa-bolt text-xs"></i>
        <span>Direct Response Revenue System</span>
      </div>

      {/* Hero Heading */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight mb-4">
        Turn Clicks into Real Appointments & Sales — On Autopilot
      </h1>

      {/* Hero Subtext */}
      <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-medium">
        We help{" "}
        <span className="font-extrabold text-white underline decoration-amber-400">
          Doctors
        </span>
        ,{" "}
        <span className="font-extrabold text-white underline decoration-amber-400">
          Manufacturers
        </span>
        ,{" "}
        <span className="font-extrabold text-white underline decoration-amber-400">
          IT Companies & Growing Businesses
        </span>{" "}
        generate <span className="font-extrabold text-amber-400">real buyers</span>, not just leads.
      </p>

      {/* Embedded Video Mockup with Clean Single Thumbnail */}
      <div
        className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl mb-6 cursor-pointer group"
        onClick={() => onVideoClick("Why We Are Different", "First Option Agency", youtubeVideoId)}
      >
        <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
          <img
            src={thumbnailUrl}
            alt="Why We Are Different - YouTube Video"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity scale-[1.01] group-hover:scale-105 transition-transform duration-300"
          />

          {/* Top YouTube Overlay Header */}
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center space-x-3 text-left">
            <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center font-black text-white text-base shadow-md">
              F
            </div>
            <div>
              <p className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow">
                Why We Are Different
              </p>
              <p className="text-zinc-300 text-xs">
                First Option Agency • Official YouTube Strategy
              </p>
            </div>
          </div>

          {/* Bottom Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between text-xs text-white">
            <div className="flex items-center space-x-3 text-slate-300">
              <i className="fa-solid fa-share hover:text-white"></i>
              <i className="fa-regular fa-clock hover:text-white"></i>
            </div>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-black/80 hover:bg-black px-2.5 py-1 rounded-md flex items-center space-x-1.5 text-xs font-semibold backdrop-blur-sm border border-white/20 transition-colors"
            >
              <span>Watch on</span>
              <span className="text-white font-black tracking-tighter flex items-center">
                <i className="fa-brands fa-youtube text-red-500 mr-1 text-sm"></i>
                YouTube
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Value Proposition Subtext */}
      <p className="text-white font-bold text-base sm:text-lg mb-6 tracking-wide">
        Predictable growth. Serious inquiries. Real revenue.
      </p>

      {/* CTA Gold Button Block */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-3.5 sm:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden"
      >
        <div className="text-[13px] min-[360px]:text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight sm:tracking-wide flex items-center justify-center space-x-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
          <span>BOOK YOUR GROWTH SESSION</span>
          <i className="fa-solid fa-arrow-right text-xs sm:text-lg flex-shrink-0"></i>
        </div>
        <div className="text-[11px] sm:text-sm font-extrabold text-slate-900 mt-1">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}

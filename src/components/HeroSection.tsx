"use client";

import React from "react";

interface HeroSectionProps {
  onBookClick: () => void;
  onVideoClick: (title: string, author: string, embedId?: string) => void;
}

export function HeroSection({ onBookClick, onVideoClick }: HeroSectionProps) {
  const youtubeVideoId = "yC2-mbXI_ZE";
  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  const thumbnailUrl = "/hero.png";

  return (
    <section className="hero-border-card rounded-3xl p-3 sm:p-6 md:p-8 lg:p-10 my-1 text-center relative overflow-hidden">
      {/* Trust Pill */}
      <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-amber-400 text-xs sm:text-sm font-bold mb-2.5 sm:mb-5">
        <i className="fa-solid fa-bolt text-xs sm:text-sm"></i>
        <span>System That Sell While You Sleep</span>
      </div>

      {/* Hero Heading */}
      <h1 className="text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-2.5 sm:mb-5">
        Turn Clicks into Real Appointments & Sales — On Autopilot
      </h1>

      {/* Hero Subtext */}
      <p className="text-slate-300 text-xs sm:text-base md:text-lg lg:text-xl leading-relaxed mb-3.5 sm:mb-6 font-medium max-w-3xl mx-auto">
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
        className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl mb-3.5 sm:mb-6 cursor-pointer group"
        onClick={() => onVideoClick("Why We Are Different", "First Option Agency", youtubeVideoId)}
      >
        <div className="relative w-full bg-slate-950 flex items-center justify-center">
          <img
            src={thumbnailUrl}
            alt="Why We Are Different - YouTube Video"
            className="w-full h-auto object-contain block transition-opacity duration-300"
          />

          {/* Center Red YouTube Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative flex items-center justify-center">
              {/* Pulsing Red Outer Glow */}
              <div className="absolute w-16 h-11 sm:w-24 sm:h-16 md:w-28 md:h-20 bg-red-600/50 rounded-2xl sm:rounded-3xl blur-md group-hover:scale-125 transition-all duration-300 animate-pulse"></div>

              {/* Red YouTube Play Button Badge */}
              <div className="relative w-14 h-10 sm:w-20 sm:h-14 md:w-24 md:h-16 bg-red-600 group-hover:bg-red-700 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/70 border border-white/20 group-hover:scale-110 transition-all duration-300">
                <i className="fa-solid fa-play text-white text-base sm:text-2xl md:text-3xl ml-1 drop-shadow-md"></i>
              </div>
            </div>
          </div>

          {/* Top YouTube Overlay Header */}
          <div className="absolute top-0 left-0 right-0 p-2.5 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center space-x-2.5 sm:space-x-3 text-left">
            <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-amber-400 shadow-md flex-shrink-0">
              <img
                src="/founder.png"
                alt="Founder - First Option Agency"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-white font-bold text-xs sm:text-base md:text-lg leading-tight drop-shadow">
                Why We Are Different
              </p>
              <p className="text-zinc-300 text-[10px] sm:text-sm">
                First Option Agency • Official YouTube Strategy
              </p>
            </div>
          </div>

          {/* Bottom Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between text-xs sm:text-sm text-white">
            <div className="flex items-center space-x-2.5 sm:space-x-3 text-slate-300 text-xs sm:text-sm">
              <i className="fa-solid fa-share hover:text-white"></i>
              <i className="fa-regular fa-clock hover:text-white"></i>
            </div>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-black/80 hover:bg-black px-2 sm:px-3 py-1 sm:py-1.5 rounded-md flex items-center space-x-1 sm:space-x-1.5 text-[10px] sm:text-sm font-semibold backdrop-blur-sm border border-white/20 transition-colors"
            >
              <span>Watch on</span>
              <span className="text-white font-black tracking-tighter flex items-center">
                <i className="fa-brands fa-youtube text-red-500 mr-1 text-xs sm:text-base"></i>
                YouTube
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* 3 Pillars Feature Grid (Predictable Growth | Serious Inquiries | Real Revenue) */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800/80 my-3 sm:my-6 py-1.5 max-w-2xl mx-auto">
        {/* Pillar 1 */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-3 text-center space-y-0.5 sm:space-y-1">
          <svg className="w-6 h-6 sm:w-9 sm:h-9 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" stroke="#FACC15" />
            <circle cx="12" cy="12" r="5" stroke="#FACC15" />
            <circle cx="12" cy="12" r="2" fill="#FACC15" stroke="#FACC15" />
            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="#FACC15" />
          </svg>
          <div className="leading-tight">
            <div className="text-white font-extrabold text-[11px] sm:text-base md:text-lg tracking-tight">Predictable</div>
            <div className="text-amber-400 font-black text-[11px] sm:text-base md:text-lg tracking-tight">Growth</div>
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-3 text-center space-y-0.5 sm:space-y-1">
          <svg className="w-6 h-6 sm:w-9 sm:h-9 mx-auto" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17L9 11L13 15L21 7" />
            <path d="M15 7H21V13" />
          </svg>
          <div className="leading-tight">
            <div className="text-white font-extrabold text-[11px] sm:text-base md:text-lg tracking-tight">Serious</div>
            <div className="text-amber-400 font-black text-[11px] sm:text-base md:text-lg tracking-tight">Inquiries</div>
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-3 text-center space-y-0.5 sm:space-y-1">
          <svg className="w-6 h-6 sm:w-9 sm:h-9 mx-auto" viewBox="0 0 24 24">
            <path
              d="M12 2C10.8954 2 10 2.89543 10 4C10 4.38 10.11 4.73 10.3 5.03L6.8 6.55C5.7 7.04 5 8.14 5 9.35V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V9.35C19 8.14 18.3 7.04 17.2 6.55L13.7 5.03C13.89 4.73 14 4.38 14 4C14 2.89543 13.1046 2 12 2Z"
              fill="#FACC15"
            />
            <path d="M9.5 5.5H14.5" stroke="#713F12" strokeWidth="1.2" strokeLinecap="round" />
            <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#18181B" fontFamily="sans-serif">₹</text>
          </svg>
          <div className="leading-tight">
            <div className="text-white font-extrabold text-[11px] sm:text-base md:text-lg tracking-tight">Real</div>
            <div className="text-amber-400 font-black text-[11px] sm:text-base md:text-lg tracking-tight">Revenue</div>
          </div>
        </div>
      </div>

      {/* Trusted Pill Badge */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl sm:rounded-full py-1.5 sm:py-2 px-3 sm:px-5 flex items-center justify-center space-x-2.5 sm:space-x-3.5 max-w-[320px] sm:max-w-md mx-auto mb-3.5 sm:mb-6 shadow-inner">
        {/* Avatars Stack */}
        <div className="flex -space-x-2 overflow-hidden flex-shrink-0">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="Client"
            className="inline-block h-6 w-6 sm:h-8 sm:w-8 rounded-full ring-2 ring-zinc-900 object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
            alt="Client"
            className="inline-block h-6 w-6 sm:h-8 sm:w-8 rounded-full ring-2 ring-zinc-900 object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
            alt="Client"
            className="inline-block h-6 w-6 sm:h-8 sm:w-8 rounded-full ring-2 ring-zinc-900 object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
            alt="Client"
            className="inline-block h-6 w-6 sm:h-8 sm:w-8 rounded-full ring-2 ring-zinc-900 object-cover"
          />
        </div>

        {/* Text & Rating */}
        <div className="text-left leading-tight">
          <div className="text-slate-200 text-[11px] sm:text-xs font-semibold tracking-tight">
            Trusted by 100+ Businesses
          </div>
          <div className="flex items-center space-x-1 mt-0.5">
            <div className="flex text-amber-400 text-[9px] sm:text-[11px]">
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
            </div>
            <span className="text-slate-400 text-[9px] sm:text-[11px] font-normal">
              4.9/5 Average Rating
            </span>
          </div>
        </div>
      </div>

      {/* CTA Gold Button Block */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-2.5 sm:p-4 md:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden"
      >
        <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tight sm:tracking-wide flex items-center justify-center space-x-1.5 sm:space-x-2 whitespace-nowrap overflow-hidden text-ellipsis">
          <span>BOOK YOUR GROWTH SESSION</span>
          <i className="fa-solid fa-arrow-right text-[10px] sm:text-lg md:text-xl flex-shrink-0"></i>
        </div>
        <div className="text-[10px] sm:text-xs md:text-sm font-extrabold text-slate-900 mt-0.5 sm:mt-1">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}

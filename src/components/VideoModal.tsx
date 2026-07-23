"use client";

import React from "react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  author: string;
  onBookClick: () => void;
}

export function VideoModal({ isOpen, onClose, title, author, onBookClick }: VideoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-toast-in">
      <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        {/* Video Player Simulation Container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          <img
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80"
            alt={title}
            className="w-full h-full object-cover opacity-80"
          />

          {/* Play Overlay Simulation */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl mb-3 animate-pulse cursor-pointer">
              <i className="fa-solid fa-play text-2xl ml-1"></i>
            </div>
            <p className="text-white font-black text-lg sm:text-xl drop-shadow">{title}</p>
            <p className="text-amber-400 text-xs font-bold mt-1">{author} • Verified Case Study</p>
          </div>
        </div>

        {/* Details & Action */}
        <div className="p-5 space-y-4 text-center">
          <p className="text-slate-300 text-xs sm:text-sm">
            Learn how First Option Agency built an automated appointment engine for this campaign.
          </p>

          <button
            onClick={() => {
              onClose();
              onBookClick();
            }}
            className="w-full cta-gold-btn shimmer py-3.5 px-4 rounded-xl text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center space-x-2"
          >
            <span>Get Similar Results For Your Business</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import socialUsersData from "@/data/socialProofUsers.json";

interface ToastUser {
  name: string;
  location: string;
  action: string;
  time: string;
}

export function SocialProofToast() {
  const [currentUser, setCurrentUser] = useState<ToastUser | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const showRandomToast = () => {
      // Pick a random user from 100 users list
      const randomIndex = Math.floor(Math.random() * socialUsersData.length);
      const user = socialUsersData[randomIndex];
      
      setCurrentUser(user);
      setIsVisible(true);

      // Hide strictly after 1.5 seconds (1500ms)
      setTimeout(() => {
        setIsVisible(false);
      }, 1500);
    };

    // Initial first toast after 3 seconds
    const initialTimer = setTimeout(() => {
      showRandomToast();
    }, 3000);

    // Schedule subsequent random toasts every 7 - 12 seconds
    const scheduleNext = () => {
      const randomInterval = Math.floor(Math.random() * 5000) + 7000; // 7s to 12s
      return setTimeout(() => {
        showRandomToast();
        timerId = scheduleNext();
      }, randomInterval);
    };

    let timerId = scheduleNext();

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(timerId);
    };
  }, []);

  if (!currentUser || !isVisible) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-3 sm:left-6 z-40 max-w-[290px] sm:max-w-xs transition-all duration-300 animate-toast-in pointer-events-none">
      <div className="bg-[#0f0f12]/95 border border-amber-500/40 text-white rounded-2xl p-3 sm:p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(245,166,35,0.15)] backdrop-blur-xl flex items-center space-x-3">
        {/* Verified Gold Avatar Circle */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center flex-shrink-0 text-sm sm:text-base font-black shadow-md border border-amber-300/40">
          <i className="fa-solid fa-check"></i>
        </div>

        {/* Content */}
        <div className="text-xs overflow-hidden leading-tight space-y-0.5">
          <div className="flex items-center justify-between space-x-1">
            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
              {currentUser.name}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
              Verified
            </span>
          </div>
          
          <p className="text-amber-400 font-bold text-xs truncate">
            {currentUser.action}
          </p>

          <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-0.5 font-mono">
            <span>📍 {currentUser.location}</span>
            <span>•</span>
            <span>{currentUser.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

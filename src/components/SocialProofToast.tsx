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
    let hideTimer: NodeJS.Timeout;
    let nextTimer: NodeJS.Timeout;

    const showRandomToast = () => {
      // Pick a random user from 100 users list
      const randomIndex = Math.floor(Math.random() * socialUsersData.length);
      const user = socialUsersData[randomIndex];
      
      setCurrentUser(user);
      setIsVisible(true);

      // Hide strictly after 1.5 seconds (1500ms)
      hideTimer = setTimeout(() => {
        setIsVisible(false);
        scheduleNext();
      }, 1500);
    };

    // Schedule next toast after 20 to 30 seconds interval
    const scheduleNext = () => {
      const randomInterval = Math.floor(Math.random() * 10000) + 20000; // 20s to 30s
      nextTimer = setTimeout(() => {
        showRandomToast();
      }, randomInterval);
    };

    // Show once 1 second after page load
    const initialTimer = setTimeout(() => {
      showRandomToast();
    }, 1000);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  if (!currentUser || !isVisible) return null;

  return (
    <div className="fixed bottom-14 sm:bottom-6 left-2.5 sm:left-6 z-40 max-w-[210px] min-[360px]:max-w-[230px] sm:max-w-[250px] transition-all duration-300 animate-toast-in pointer-events-none">
      <div className="bg-[#0f0f12]/95 border border-amber-500/40 text-white rounded-xl p-2 sm:p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center space-x-2">
        {/* Verified Gold Avatar Circle */}
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center flex-shrink-0 text-[10px] sm:text-xs font-black shadow border border-amber-300/40">
          <i className="fa-solid fa-check"></i>
        </div>

        {/* Compact Content */}
        <div className="text-[10px] sm:text-[11px] overflow-hidden leading-tight space-y-0.5">
          <div className="flex items-center space-x-1">
            <span className="font-extrabold text-white truncate max-w-[120px] sm:max-w-[140px]">
              {currentUser.name}
            </span>
            <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/30 flex-shrink-0">
              ✓
            </span>
          </div>
          
          <p className="text-amber-400 font-bold truncate max-w-[150px] sm:max-w-[170px]">
            {currentUser.action}
          </p>

          <div className="flex items-center space-x-1 text-[9px] text-slate-400 font-mono truncate">
            <span className="truncate max-w-[90px]">{currentUser.location}</span>
            <span>•</span>
            <span>{currentUser.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

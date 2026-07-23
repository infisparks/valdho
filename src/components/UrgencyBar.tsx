"use client";

import React, { useState, useEffect } from "react";

export function UrgencyBar() {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 42, seconds: 18 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 2, minutes: 30, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white text-[11px] sm:text-xs md:text-sm font-bold py-1.5 px-2 text-center flex items-center justify-center space-x-2 shadow-md z-40 whitespace-nowrap overflow-hidden">
      <div className="flex items-center space-x-1.5 whitespace-nowrap">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping flex-shrink-0"></span>
        <span className="whitespace-nowrap truncate">
          ⚡ LIMITED CAPACITY: Only <span id="spotsCount" className="underline text-yellow-200 font-black">3 Client Spots</span> Remaining For This Month
        </span>
      </div>
      <div className="hidden md:flex items-center space-x-1 bg-black/30 px-2 py-0.5 rounded font-mono text-xs flex-shrink-0">
        <i className="fa-regular fa-clock text-yellow-300"></i>
        <span>
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

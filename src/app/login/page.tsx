"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/crms";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Role-based auth redirect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const { syncAndGetUser, MASTER_ADMIN_UID } = await import("@/lib/firebase");
        const userData = await syncAndGetUser(user.uid, user.email || "");
        const isAdmin = user.uid === MASTER_ADMIN_UID || userData.roleId === "role_admin" || user.email?.toLowerCase().startsWith("firstoption");

        if (isAdmin) {
          router.replace(redirectTarget || "/crms");
        } else {
          router.replace("/management");
        }
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router, redirectTarget]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      const { syncAndGetUser, MASTER_ADMIN_UID } = await import("@/lib/firebase");
      const userData = await syncAndGetUser(res.user.uid, res.user.email || "");
      const isAdmin = res.user.uid === MASTER_ADMIN_UID || userData.roleId === "role_admin" || res.user.email?.toLowerCase().startsWith("firstoption");

      if (isAdmin) {
        router.replace(redirectTarget || "/crms");
      } else {
        router.replace("/management");
      }
    } catch (err: any) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setErrorMessage("Invalid email address or password. Please check your credentials and try again.");
      } else {
        console.error("Firebase Login Exception:", err);
        setErrorMessage(err.message || "Failed to authenticate into Executive Portal.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Checking Admin Authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-900 font-sans flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16">
      {/* Container - Highly responsive across mobile, laptop, and 4K desktop */}
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 shadow-xl space-y-6 sm:space-y-8 my-auto">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-500 text-white flex items-center justify-center text-xl sm:text-2xl font-black mx-auto shadow-lg shadow-indigo-200">
            FO
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            First Option CRM Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
            Authorized Executive Access Only. Enter your admin credentials to manage lead pipelines and calendar appointments.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
              Admin Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="admin@firstoptionagency.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-sm"
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 pointer-events-none text-sm">
                <i className="fa-solid fa-envelope"></i>
              </div>
            </div>
          </div>

          {/* Password Input with Show/Hide Toggle */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 text-sm transition-colors"
              >
                <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
          </div>

          {/* Error Message Badge */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium p-3.5 rounded-xl flex items-center space-x-2.5 animate-pulse">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0 text-base"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 sm:py-4 rounded-xl text-sm sm:text-base transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin text-base"></i>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to CRM Portal</span>
                <i className="fa-solid fa-arrow-right text-sm"></i>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-500">
            First Option Agency • Performance Marketing Systems
          </p>
          <p className="text-[10px] text-slate-400">
            Protected by Firebase Security Rules & Enterprise Encryption
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
          <div className="text-indigo-600 font-bold text-sm">Loading Login...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

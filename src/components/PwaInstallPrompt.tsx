"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker on HTTPS or localhost
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const isSecure =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      if (isSecure) {
        navigator.serviceWorker
          .register("/database/sw.js", { scope: "/database/" })
          .then((reg) => {
            // Check for updates periodically
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("New PWA content available; please refresh.");
                  }
                };
              }
            };
          })
          .catch((err) => console.log("SW registration notice:", err));
      }
    }

    // 2. Check if already running standalone
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    // 3. Check dismissal timestamp in localStorage
    try {
      const dismissedUntil = localStorage.getItem("pwa_dismissed_until");
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return;
      }
    } catch {
      // Ignore localStorage errors
    }

    // 4. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 5. Handle Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If on iOS and not standalone, show prompt after a brief polite delay (3s)
    let iosTimer: NodeJS.Timeout;
    if (isIosDevice && !isStandaloneMode) {
      iosTimer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
    }

    // Detect if app was installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions((prev) => !prev);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Hide for 7 days
    try {
      localStorage.setItem("pwa_dismissed_until", (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    } catch {
      // Ignore localStorage errors
    }
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-blue-200/60 dark:border-blue-900/40 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-100 ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-start gap-3">
          {/* App Icon */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-slate-200/80 dark:border-slate-700 bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/database/pad.png"
              alt="Imperial IT"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                Imperial IT App
              </h4>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg transition-colors"
                aria-label="Dismiss install banner"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              মোবাইলে দ্রুত ও সহজে ব্যবহার করতে অ্যাপটি হোম স্ক্রিনে ইন্সটল করুন।
            </p>

            {/* iOS Instructions helper */}
            {isIos && showIosInstructions && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                <p className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  আইফোনে ইন্সটল করার নিয়ম:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  <li>সাফারি ব্রাউজারের নিচে <strong>Share বাটনে</strong> ট্যাপ করুন</li>
                  <li>নিচে স্ক্রল করে <strong>&apos;Add to Home Screen&apos;</strong> চাপুন</li>
                  <li>উপরে ডানপাশে <strong>&apos;Add&apos;</strong> এ ক্লিক করুন</li>
                </ol>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isIos ? (showIosInstructions ? "নির্দেশনা লুকান" : "ইন্সটল করার নিয়ম") : "ইন্সটল করুন"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                পরে
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

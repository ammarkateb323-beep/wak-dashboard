import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const steps = [
  { img: "/guide/01.png", label: "Open the dashboard in Safari and tap the Share button at the bottom" },
  { img: "/guide/02.png", label: "Scroll down and tap Add to Home Screen" },
  { img: "/guide/03.png", label: "Tap Add in the top right corner to confirm" },
  { img: "/guide/04.png", label: "The WAK Agent app will now appear on your home screen — tap it to open" },
  { img: "/guide/05.png", label: "Sign in using your password or Face ID / Fingerprint" },
  { img: "/guide/06.png", label: "Once inside, tap Enable Notifications so you get alerted when customers message you" },
  { img: "/guide/07.png", label: "Tap Allow when your phone asks for permission — you are now fully set up" },
];

export default function Guide() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header — matches dashboard exactly */}
      <header className="h-14 bg-[#0F510F] text-white flex items-center justify-between px-5 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="WAK Solutions" className="h-[36px] shrink-0" />
          <div className="hidden sm:block">
            <span className="font-semibold text-sm text-white/90">WAK Solutions</span>
            <span className="text-white/40 mx-2">—</span>
            <span className="text-sm text-white/70">Setup Guide</span>
          </div>
        </div>
        <Link href="/">
          <a className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/10">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Inbox</span>
            <span className="sm:hidden">Back</span>
          </a>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-foreground mb-2">
          How to Install the App &amp; Enable Notifications
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Follow these steps to install WAK Agent on your phone and turn on push notifications.
        </p>

        <ol className="space-y-10">
          {steps.map((step, i) => (
            <li key={i} className="flex flex-col items-center gap-3">
              {/* Step number + label */}
              <div className="w-full flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0F510F] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-snug pt-1">{step.label}</p>
              </div>
              {/* Screenshot */}
              <button
                onClick={() => setLightbox(step.img)}
                className="block rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[#0F510F]"
                aria-label={`View step ${i + 1} fullscreen`}
              >
                <img
                  src={step.img}
                  alt={`Step ${i + 1}`}
                  className="w-[220px] object-contain"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ol>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox}
            alt="Step fullscreen"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

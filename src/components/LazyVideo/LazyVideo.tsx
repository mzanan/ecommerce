"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
  playbackRate?: number;
  autoPlay?: boolean;
  eager?: boolean;
};

export const LazyVideo = ({
  src,
  poster,
  className,
  playbackRate = 1,
  autoPlay = true,
  eager = false,
}: Props) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.loaded = "false";

    const load = () => {
      if (el.dataset.loaded === "true") return;
      el.dataset.loaded = "true";
      el.src = src;
      el.load();
      if (autoPlay) el.play().catch(() => {});
    };

    const handleVisibility = () => {
      if (document.hidden) el.pause();
      else if (autoPlay && el.dataset.loaded === "true") el.play().catch(() => {});
    };

    if (eager || !("IntersectionObserver" in window)) {
      load();
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            load();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "50% 0px" },
    );

    io.observe(el);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [src, autoPlay, eager]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      poster={poster}
      className={className}
      suppressHydrationWarning
    />
  );
};

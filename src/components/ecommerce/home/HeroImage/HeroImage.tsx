'use client';

import React, { forwardRef, useRef, useEffect } from 'react';
import Image from 'next/image';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  isLoading?: boolean;
}

const HeroImage = forwardRef<HTMLDivElement, HeroImageProps>(({ imageUrl, isLoading }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoUrl = (url: string) => /\.(mp4|webm|ogg)$/i.test(url);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => { });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!document.hidden) {
              video.play().catch(() => { });
            }
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [imageUrl]);

  if (isLoading && !imageUrl) {
    return (
      <div className="h-dvh w-full bg-gray-200 animate-pulse snap-start"></div>
    );
  }
  return (
    <div ref={ref} className="h-dvh bg-black snap-start">
      <section className='relative h-full w-full'>
        {imageUrl && (isVideoUrl(imageUrl) ? (
          <video
            ref={videoRef}
            src={imageUrl}
            className='h-full w-full object-cover'
            autoPlay
            muted
            loop
            playsInline
            controls={false}
          />
        ) : (
          <Image
            src={imageUrl}
            alt='Hero background image'
            fill
            priority
            className='object-cover'
          />
        ))}
      </section>
    </div>
  );
});

HeroImage.displayName = 'HeroImage';

export default HeroImage;
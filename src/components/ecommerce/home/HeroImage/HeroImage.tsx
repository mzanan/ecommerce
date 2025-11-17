'use client';

import React, { forwardRef, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSnapClasses } from '@/hooks/useSnapClasses';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  isLoading?: boolean;
  isIosDevice?: boolean;
}

const HeroImage = forwardRef<HTMLDivElement, HeroImageProps>(({ imageUrl, isLoading, isIosDevice = false }, ref) => {
  const { getSnapClasses } = useSnapClasses({ isIosDevice });
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoUrl = (url: string) => /\.(mp4|webm|ogg)$/i.test(url);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!document.hidden) {
              video.play().catch(() => {});
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
      <div className={`h-[calc(100vh-var(--header-height))] w-full bg-gray-200 animate-pulse ${getSnapClasses()}`}></div>
    );
  }
  return (
    <div ref={ref} className={`h-[calc(100vh-var(--header-height))] bg-black ${getSnapClasses()}`}>
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
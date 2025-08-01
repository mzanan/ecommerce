'use client';

import React, { forwardRef } from 'react';
import Image from 'next/image';
import { useSnapClasses } from '@/hooks/useSnapClasses';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  isLoading?: boolean;
  isIosDevice?: boolean;
}

const HeroImage = forwardRef<HTMLDivElement, HeroImageProps>(({ imageUrl, isLoading, isIosDevice = false }, ref) => {
  const { getSnapClasses } = useSnapClasses({ isIosDevice });
  
  if (isLoading && !imageUrl) {
    return (
      <div className={`h-[calc(100vh-var(--header-height))] w-full bg-gray-200 animate-pulse ${getSnapClasses()}`}></div>
    );
  }
  return (
    <div ref={ref} className={`h-[calc(100vh-var(--header-height))] bg-black ${getSnapClasses()}`}>
      <section className='relative h-full w-full'>
        {imageUrl && (
          <Image 
            src={imageUrl}
            alt='Hero background image'
            fill
            priority
            className='object-cover'
          />
        )}
      </section>
    </div>
  );
});

HeroImage.displayName = 'HeroImage';

export default HeroImage;
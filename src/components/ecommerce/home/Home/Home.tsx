'use client';

import React, { useRef } from 'react';
import PathSelector from '@/components/ecommerce/home/InteractiveSplitScreen/InteractiveSplitScreen';
import AboutSection from '@/components/ecommerce/home/AboutSection/AboutSection';
import HeroImage from '@/components/ecommerce/home/HeroImage/HeroImage';
import DisplaySets from '@/components/ecommerce/home/DisplaySets/DisplaySets';
import Footer from '@/components/ecommerce/layout/Footer/Footer';
import { useHome } from './useHome';
import { useImagePreloader, extractImageUrls } from '@/hooks/useImagePreloader';
import { useSnapClasses } from '@/hooks/useSnapClasses';
import type { HomeProps } from '@/types/home';

export default function Home({
  homepageItemsData,
  aboutContentData,
  heroContentData,
  isIosDevice = false
}: HomeProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { getSnapClasses, getScrollContainerClasses } = useSnapClasses({ isIosDevice });
  
  const {
    selectedType,
    whiteSectionRef,
    blackSectionRef,
    handlePathSelect,
    handleDiagonalAnimationComplete,
    processedHomepageItems,
    effectiveSelectedType,
    isRestoringScroll,
  } = useHome(homepageItemsData, scrollContainerRef);

  const heroImageUrl = heroContentData?.image_url;

  const allImageUrls = React.useMemo(() => {
    const urls: string[] = [];
    
    if (heroImageUrl) urls.push(heroImageUrl);
    
    urls.push(...extractImageUrls(homepageItemsData));
    urls.push(...extractImageUrls(aboutContentData));
    
    return urls;
  }, [heroImageUrl, homepageItemsData, aboutContentData]);

  useImagePreloader(allImageUrls, { enabled: true, priority: true });

  const getContainerClasses = () => {
    const baseClasses = "overflow-y-auto overflow-x-hidden h-screen w-full max-w-[100vw]";
    if (isRestoringScroll) {
      return baseClasses;
    }
    return getScrollContainerClasses(baseClasses);
  };

  const renderContentSections = () => {
    const whiteSection = (
      <div ref={whiteSectionRef} className={getSnapClasses()}>
        <DisplaySets 
          homepageItems={processedHomepageItems}
          primaryType="FIDELI"
          secondaryType="INFIDELI"
          setsAnimationProgress={{ get: () => 1, set: () => {}, on: () => () => {} } as any}
          titleVisibilityProgress={{ get: () => 1, set: () => {}, on: () => () => {} } as any}
          isIosDevice={isIosDevice}
        />
      </div>
    );

    const blackSection = (
      <div ref={blackSectionRef} className={getSnapClasses()}>
        <DisplaySets 
          homepageItems={processedHomepageItems}
          primaryType="INFIDELI"
          secondaryType="FIDELI"
          setsAnimationProgress={{ get: () => 1, set: () => {}, on: () => () => {} } as any}
          titleVisibilityProgress={{ get: () => 1, set: () => {}, on: () => () => {} } as any}
          isIosDevice={isIosDevice}
        />
      </div>
    );

    return effectiveSelectedType === "FIDELI" ? (
      <>{whiteSection}{blackSection}</>
    ) : (
      <>{blackSection}{whiteSection}</>
    );
  };

  return (
    <div ref={scrollContainerRef} className={getContainerClasses()}>
      <HeroImage imageUrl={heroImageUrl} isIosDevice={isIosDevice} />

      <PathSelector
        selectedType={selectedType}
        onSelectType={handlePathSelect}
        onDiagonalAnimationComplete={handleDiagonalAnimationComplete}
        isIosDevice={isIosDevice}
      />

      {renderContentSections()}

      {aboutContentData && aboutContentData.text_content && (
        <div className={getSnapClasses()}>
          <AboutSection 
            text={aboutContentData.text_content}
            images={aboutContentData.image_urls}
            aspectRatio={aboutContentData.image_aspect_ratio || 'square'}
          />
        </div>
      )}

      <div className={getSnapClasses()}>
        <Footer />
      </div>
    </div>
  );
} 
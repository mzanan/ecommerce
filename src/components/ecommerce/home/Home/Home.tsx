'use client';

import React from 'react';
import PathSelector from '@/components/ecommerce/home/InteractiveSplitScreen/InteractiveSplitScreen';
import AboutSection from '@/components/ecommerce/home/AboutSection/AboutSection';
import HeroImage from '@/components/ecommerce/home/HeroImage/HeroImage';
import DisplaySets from '@/components/ecommerce/home/DisplaySets/DisplaySets';
import { useHome } from './useHome';
import type { HomeProps } from '@/types/home';

export default function Home({
  homepageItemsData,
  aboutContentData,
  heroContentData
}: HomeProps) {
  const {
    selectedType,
    whiteSectionRef,
    blackSectionRef,
    handlePathSelect,
    handleDiagonalAnimationComplete,
    processedHomepageItems,
    effectiveSelectedType
  } = useHome(homepageItemsData);

  const heroImageUrl = heroContentData?.image_url;

  const renderContentSections = () => {
    const whiteSection = (
      <div ref={whiteSectionRef}>
        <DisplaySets
          homepageItems={processedHomepageItems}
          primaryType="DAY"
        />
      </div>
    );

    const blackSection = (
      <div ref={blackSectionRef}>
        <DisplaySets
          homepageItems={processedHomepageItems}
          primaryType="NIGHT"
        />
      </div>
    );

    return effectiveSelectedType === "DAY" ? (
      <>{whiteSection}{blackSection}</>
    ) : (
      <>{blackSection}{whiteSection}</>
    );
  };

  return (
    <div className="overflow-x-hidden overflow-y-scroll w-full max-w-[100vw] snap-y snap-mandatory" style={{ height: '100vh' }}>
      <HeroImage imageUrl={heroImageUrl} />

      <PathSelector
        selectedType={selectedType}
        onSelectType={handlePathSelect}
        onDiagonalAnimationComplete={handleDiagonalAnimationComplete}
      />

      {renderContentSections()}

      {aboutContentData && aboutContentData.text_content && (
        <div className="snap-start sm:min-h-dvh-header md:h-dvh-header">
          <AboutSection
            text={aboutContentData.text_content}
            images={aboutContentData.image_urls}
            aspectRatio={aboutContentData.image_aspect_ratio || 'square'}
          />
        </div>
      )}
    </div>
  );
} 
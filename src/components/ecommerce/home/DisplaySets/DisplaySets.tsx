'use client';

import React, { useMemo } from 'react';
import type { MotionValue } from 'framer-motion';
import type { SetRow, PageComponent, PageComponentContent } from '@/types/db';
import SingleColumnLayout from '@/components/ecommerce/sets/SetLayouts/SingleColumnLayout';
import SplitSmallLeftLayout from '@/components/ecommerce/sets/SetLayouts/SplitSmallLeftLayout';
import SplitSmallRightLayout from '@/components/ecommerce/sets/SetLayouts/SplitSmallRightLayout';
import StaggeredThreeLayout from '@/components/ecommerce/sets/SetLayouts/StaggeredThreeLayout';
import TwoHorizontalLayout from '@/components/ecommerce/sets/SetLayouts/TwoHorizontalLayout';
import { useFadeInAnimation } from '@/hooks/useFadeInAnimation';
import { useSnapClasses } from '@/hooks/useSnapClasses';

interface DisplaySetsProps {
  homepageItems: (PageComponent & { item_type: 'page_component' } | SetRow & { item_type: 'set' })[];
  primaryType: 'FIDELI' | 'INFIDELI' | null;
  secondaryType: 'FIDELI' | 'INFIDELI';
  setsAnimationProgress: MotionValue<number>;
  titleVisibilityProgress: MotionValue<number>;
  isIosDevice?: boolean;
}

const AnimatedSetRenderer: React.FC<{ 
  set: SetRow; 
  isHomepageContext: boolean; 
  type: 'FIDELI' | 'INFIDELI';
  index: number;
}> = ({ set, isHomepageContext }) => {
  
  return (
    <div
      style={{
        opacity: 1,
        transform: 'translateX(0px)'
      }}
    >
      {(() => {
        switch (set.layout_type) {
          case 'SPLIT_SMALL_LEFT':
            return <SplitSmallLeftLayout set={set} isHomepageContext={isHomepageContext} />;
          case 'SPLIT_SMALL_RIGHT':
            return <SplitSmallRightLayout set={set} isHomepageContext={isHomepageContext} />;
          case 'STAGGERED_THREE':
            return <StaggeredThreeLayout set={set} isHomepageContext={isHomepageContext} />;
          case 'TWO_HORIZONTAL':
            return <TwoHorizontalLayout set={set} isHomepageContext={isHomepageContext} />;
          case 'SINGLE_COLUMN':
          default:
            return <SingleColumnLayout set={set} isHomepageContext={isHomepageContext} />;
        }
      })()}
    </div>
  );
};

const AnimatedTextComponent: React.FC<{ 
  pageComponent: PageComponent; 
  index: number; 
}> = ({ pageComponent, index }) => {
  const content = pageComponent.content as PageComponentContent;
  
  const { elementRef, animationStyles } = useFadeInAnimation<HTMLDivElement>({
    delay: index * 300,
    duration: 800,
    translateY: 30,
    translateX: 0,
  });

  return (
    <div 
      ref={elementRef}
      style={animationStyles}
      className='flex flex-col gap-2'
    >
      {content?.title && <h2 className='text-2xl font-bold'>{content.title}</h2>}
      <p>{content?.text ?? ''}</p>
    </div>
  );
};

export default function DisplaySets({
  homepageItems,
  primaryType,
  isIosDevice = false
}: DisplaySetsProps) {
  const { getSnapClasses } = useSnapClasses({ isIosDevice });

  const getTypeSpecificClasses = (type: 'FIDELI' | 'INFIDELI', _isPrimary: boolean) => {
    const classes = type === 'FIDELI' ? 'text-black' : 'bg-black text-white';
    return classes;
  };

  const primaryItems = useMemo(() => {
    if (!primaryType) return [];
    
    const items: React.JSX.Element[] = [];

    homepageItems.forEach((item) => {
      if (item.item_type === 'page_component') {
        const pageComponent = item as PageComponent;
        if (pageComponent.affiliation === primaryType) {
          items.push(
            <AnimatedTextComponent 
              key={pageComponent.id} 
              pageComponent={pageComponent}
              index={items.length}
            />
          );
        }
      } else if (item.item_type === 'set') {
        const set = item as SetRow;
        if (set.type === primaryType && set.is_active) {
          items.push(
            <div key={set.id}>
              <AnimatedSetRenderer set={set} isHomepageContext={true} type={primaryType} index={items.length} />
            </div>
          );
        }
      }
    });

    return items;
  }, [homepageItems, primaryType]);

  return (
    <>
      {primaryType && (
        <div className={`w-full max-w-[100vw] relative min-h-screen overflow-x-hidden ${getSnapClasses()}`} data-primary-section="true">
          <div className={`${getTypeSpecificClasses(primaryType, true)} p-8 md:p-12`}>
            <div className="text-center w-full mb-8">
              <h2 className="text-3xl font-bold tracking-tight mb-2">
                {primaryType === 'FIDELI' ? 'White' : 'Black'} Sets
              </h2>
              <p className="text-lg text-muted-foreground mx-auto">
                {primaryType === 'FIDELI'
                  ? 'Discover comfort and elegance for every day.'
                  : 'Explore seductive designs for special moments.'
                }
              </p>
            </div>
            
            <div className="flex flex-col gap-8">
              {primaryItems}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
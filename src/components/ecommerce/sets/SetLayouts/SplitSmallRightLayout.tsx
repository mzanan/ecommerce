'use client';

import React from 'react';
import type { SetRow, SetImageRow } from '@/types/db';
import SetCard from '@/components/ecommerce/sets/SetCard/SetCard';
import SetLayoutHeader from './SetLayoutHeader';

interface SplitSmallRightLayoutProps {
  set: SetRow & { set_images?: SetImageRow[] };
  isHomepageContext?: boolean;
}

const SplitSmallRightLayout: React.FC<SplitSmallRightLayoutProps> = ({ set, isHomepageContext }) => {
  const sortedImages = set.set_images?.slice().sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  
  const imageUrl1 = sortedImages?.[0]?.image_url;
  const imageUrl2 = sortedImages?.[1]?.image_url;

  return (
    <div className='flex flex-col h-full gap-8 px-4 max-w-[1880px] mx-auto overflow-hidden'>
      {!isHomepageContext && <SetLayoutHeader set={set} isHomepageContext={isHomepageContext} />}
      
      <div className="grid grid-cols-1 md:grid-cols-[5fr_4fr] gap-8 flex-grow min-h-0 w-full md:max-w-[932px] mx-auto">
        <SetCard
          set={set}
          imageUrl={imageUrl1}
          altText={`${set.name ?? 'Set'} image 1`}
          imageClassName='w-full'
          containerClassName='flex flex-col md:justify-end'
          animationDelay={0}
        />
      
        <SetCard
          set={set}
          imageUrl={imageUrl2}
          altText={`${set.name ?? 'Set'} image 2`}
          imageClassName='w-full'
          containerClassName='flex flex-col'
          animationDelay={400}
        />
      </div>
    </div>
  );
};

export default SplitSmallRightLayout; 
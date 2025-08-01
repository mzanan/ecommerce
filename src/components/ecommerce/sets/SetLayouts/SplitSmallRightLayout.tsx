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
    <div className='flex flex-col min-h-[calc(100vh-var(--header-height))] gap-8 p-4 md:p-0 max-w-[1880px] mx-auto'>
      <SetLayoutHeader set={set} isHomepageContext={isHomepageContext} />
      
      <div className="flex flex-col md:flex-row gap-8 flex-grow">
        <SetCard
          set={set}
          imageUrl={imageUrl1}
          altText={`${set.name ?? 'Set'} image 1`}
          imageClassName='w-full md:max-w-[500px]'
          containerClassName='flex flex-col items-center md:items-end md:justify-end'
          animationDelay={0}
        />
      
        <SetCard
          set={set}
          imageUrl={imageUrl2}
          altText={`${set.name ?? 'Set'} image 2`}
          imageClassName='w-full md:max-w-[400px]'
          containerClassName='flex flex-col items-center md:items-start'
          animationDelay={400}
        />
      </div>
    </div>
  );
};

export default SplitSmallRightLayout; 
'use client';

import React from 'react';
import type { SetRow } from '@/types/db';
import SetCard from '@/components/ecommerce/sets/SetCard/SetCard';
import SetLayoutHeader from './SetLayoutHeader';

type SetImageRow = {
  id: string;
  image_url: string;
  alt_text?: string | null;
  position?: number | null;
  set_id: string;
};

interface SingleColumnLayoutProps {
  set: SetRow & {
    set_images?: SetImageRow[];
  };
  isHomepageContext?: boolean;
}

const SingleColumnLayout: React.FC<SingleColumnLayoutProps> = ({ set, isHomepageContext }) => {
  const imageUrl = set.set_images?.[0]?.image_url;
  const shouldShowHeader = !(isHomepageContext && !set.show_title_on_home) && set.name;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1880px] mx-auto px-4 md:px-0">
      {shouldShowHeader && (
      <div className="block lg:hidden">
        <SetLayoutHeader set={set} isHomepageContext={isHomepageContext} />
      </div>
      )}

      <div className="relative w-full flex justify-center">
        <SetCard 
          set={set} 
          imageUrl={imageUrl} 
          altText={`${set.name ?? 'Set'} image`}
          imageClassName="w-full object-cover"
          containerClassName="w-full h-full flex"
          animationDelay={0}
        />
      </div>
    </div>
  );
};

export default SingleColumnLayout;
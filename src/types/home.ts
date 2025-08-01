import React from 'react';
import type { SetRow, PageComponent } from './db';
import type { HeroDbRow } from './hero';
import type { MotionValue } from 'framer-motion';

export interface AboutContentData {
  text_content: string | null;
  image_urls: (string | null)[] | null;
  image_aspect_ratio?: 'square' | 'portrait' | 'video' | null;
}

export type HomePageItemOrchestrator = 
    | (PageComponent & { item_type: 'page_component' }) 
    | (SetRow & { item_type: 'set'; set_images?: any[]; set_products?: any[] });

export interface HomeProps {
  homepageItemsData: HomePageItemOrchestrator[];
  aboutContentData: AboutContentData | null;
  heroContentData: HeroDbRow | null;
  isIosDevice?: boolean;
}

export interface UseHomeProps {
  initialSets: SetRow[] | null;
  containerDimensions?: { width: number; height: number };
}

export interface AnimatedWordProps {
  word: string;
  className?: string;
  hoverColor?: string;
  onClick: () => void;
}

export interface DisplaySetsProps {
  homepageItems: (PageComponent & { item_type: 'page_component' } | SetRow & { item_type: 'set' })[];
  primaryType: 'FIDELI' | 'INFIDELI' | null;
  secondaryType: 'FIDELI' | 'INFIDELI';
  setsAnimationProgress: MotionValue<number>;
  titleVisibilityProgress: MotionValue<number>;
  isIosDevice?: boolean;
}

export interface SectionTitleComponentProps {
  type: 'FIDELI' | 'INFIDELI';
  titleVisibilityProgress: MotionValue<number>;
  isPrimary: boolean;
}

export interface AnimatedSetRendererProps {
  set: SetRow;
  isHomepageContext: boolean;
  type: 'FIDELI' | 'INFIDELI';
  index: number;
}

export interface AnimatedSectionProps {
  type: 'FIDELI' | 'INFIDELI';
  isPrimary: boolean;
  items: React.JSX.Element[];
  getTypeSpecificClasses: (type: 'FIDELI' | 'INFIDELI', isPrimary: boolean) => string;
  setsAnimationProgress: MotionValue<number>;
  titleVisibilityProgress: MotionValue<number>;
  shouldControlAnimation?: boolean;
}

export interface AnimatedTextComponentProps {
  pageComponent: PageComponent;
  index: number;
}
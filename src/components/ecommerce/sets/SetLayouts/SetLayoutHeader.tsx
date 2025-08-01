'use client';

import React from 'react';
import type { SetRow } from '@/types/db'; 

interface SetLayoutHeaderProps {
  set: SetRow;
  isHomepageContext?: boolean; 
}

const SetLayoutHeader: React.FC<SetLayoutHeaderProps> = ({ set, isHomepageContext = false }) => {
  const { name, description, show_title_on_home } = set;

  if (isHomepageContext && !show_title_on_home) {
    return null; 
  }

  if (!name) return null; 
  

  return (
    <div className="text-center">
      <h3 className="text-3xl font-bold">{name}</h3>
      {description && (
        <p className="text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

export default SetLayoutHeader; 
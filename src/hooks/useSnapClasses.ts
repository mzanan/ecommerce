'use client';

import { useMemo } from 'react';

interface UseSnapClassesProps {
  isIosDevice?: boolean;
}

export function useSnapClasses({ isIosDevice = false }: UseSnapClassesProps = {}) {
  return useMemo(() => {
    const getSnapClasses = (snapClass: string = 'snap-start') => {
      // Don't add snap classes on iOS due to performance issues
      return isIosDevice ? '' : snapClass;
    };

    const getScrollContainerClasses = (baseClasses: string) => {
      if (isIosDevice) {
        // iOS: only smooth scroll, no snap
        return `${baseClasses} scroll-smooth`;
      }
      // Other devices: full snap functionality
      return `${baseClasses} snap-y snap-proximity scroll-smooth`;
    };

    return {
      getSnapClasses,
      getScrollContainerClasses,
      isIosDevice
    };
  }, [isIosDevice]);
}
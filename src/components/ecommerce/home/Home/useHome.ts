import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SetType } from '@/lib/schemas/setSchema';
import type { HomePageItemOrchestrator } from '@/types/home';
import { useScrollRestorationContext } from '@/components/providers/ScrollRestorationProvider';

export function useHome(homepageItemsData: HomePageItemOrchestrator[], scrollContainerRef: React.RefObject<HTMLDivElement | null>) {
  const [selectedType, setSelectedType] = useState<SetType | null>(null);
  const [hasScrolledPastSelector, setHasScrolledPastSelector] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const autoScrollEnabledRef = useRef(false);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  const whiteSectionRef = useRef<HTMLDivElement>(null);
  const blackSectionRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);
  const hasRestoredScrollRef = useRef(false);
  const hasManuallyScrolledAfterRestore = useRef(false);
  const { isInitialLoadInSession } = useScrollRestorationContext();

  useEffect(() => {
    if (hasRestoredScrollRef.current || !scrollContainerRef.current) return;

    const restoreScrollPosition = () => {
      const navigationEntries = typeof window !== 'undefined' ? performance.getEntriesByType("navigation") : [];
      const navigationType = navigationEntries.length > 0 ? (navigationEntries[0] as PerformanceNavigationTiming).type : null;

      let shouldRestore = false;
      if (navigationType === 'reload') {
        shouldRestore = true;
      } else if (navigationType === 'back_forward') {
        shouldRestore = true;
      } else if (!isInitialLoadInSession) {
        shouldRestore = true;
      }

      if (shouldRestore && scrollContainerRef.current) {
        const savedScrollPos = localStorage.getItem('homeScrollPos');
        if (savedScrollPos) {
          const scrollPos = parseInt(savedScrollPos, 10);
          if (!isNaN(scrollPos) && scrollPos > 0) {
            setIsRestoringScroll(true);
            setTimeout(() => {
              if (scrollContainerRef.current) {
                isScrollingProgrammatically.current = true;
                scrollContainerRef.current.scrollTo({ top: scrollPos, behavior: 'smooth' });
                hasRestoredScrollRef.current = true;
                
                setTimeout(() => {
                  isScrollingProgrammatically.current = false;
                  setIsRestoringScroll(false);
                }, 1000);
              }
            }, 200);
          } else {
            hasRestoredScrollRef.current = true;
          }
        } else {
          hasRestoredScrollRef.current = true;
        }
      } else {
        hasRestoredScrollRef.current = true;
      }
    };

    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        restoreScrollPosition();
      } else {
        window.addEventListener('load', restoreScrollPosition, { once: true });
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', restoreScrollPosition);
      }
    };
  }, [isInitialLoadInSession, scrollContainerRef]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (isScrollingProgrammatically.current || !hasRestoredScrollRef.current) return;

      if (hasRestoredScrollRef.current && !hasManuallyScrolledAfterRestore.current) {
        hasManuallyScrolledAfterRestore.current = true;
      }

      const pathSelectorElement = document.getElementById("path-selector");
      if (pathSelectorElement && selectedType === null) {
        const rect = pathSelectorElement.getBoundingClientRect();
        if (rect.bottom < window.innerHeight * 0.2) {
          setSelectedType("FIDELI");
          setHasScrolledPastSelector(true);
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('homeScrollPos', String(scrollContainer.scrollTop));
      }
    };

    const handleBeforeUnload = () => {
      if (scrollContainer && typeof window !== 'undefined') {
        localStorage.setItem('homeScrollPos', String(scrollContainer.scrollTop));
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [selectedType, scrollContainerRef]);

  useEffect(() => {
    if (shouldAutoScroll && scrollContainerRef.current && (whiteSectionRef.current || blackSectionRef.current)) {
      const timeoutId = setTimeout(() => {
        isScrollingProgrammatically.current = true;

        const effectiveSelectedType = selectedType || "FIDELI";
        const targetSection = effectiveSelectedType === "FIDELI" ? whiteSectionRef.current : blackSectionRef.current;

        if (targetSection && scrollContainerRef.current) {
          const containerRect = scrollContainerRef.current.getBoundingClientRect();
          const targetRect = targetSection.getBoundingClientRect();
          
          const scrollTop = scrollContainerRef.current.scrollTop + (targetRect.top - containerRect.top);

          scrollContainerRef.current.scrollTo({
            top: scrollTop,
            behavior: "smooth",
          });

          setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 1000);
        }

        setShouldAutoScroll(false);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [shouldAutoScroll, selectedType, scrollContainerRef]);

  const handlePathSelect = (type: SetType) => {
    isScrollingProgrammatically.current = false;
    const wasAlreadySelected = selectedType === type;
    setSelectedType(type);
    setHasScrolledPastSelector(true);
    autoScrollEnabledRef.current = true;
    
    if (wasAlreadySelected) {
      setShouldAutoScroll(true);
    }
  };

  const handleDiagonalAnimationComplete = () => {
    if (autoScrollEnabledRef.current) {
    setShouldAutoScroll(true);
    }
  };

  const processedHomepageItems = useMemo(() => 
    homepageItemsData?.map(item => {
      if (item.item_type === 'set') {
        return {
          ...item,
          set_images: item.set_images || [],
          set_products: item.set_products || []
        };
      }
      return item;
    }) || [],
    [homepageItemsData]
  );

  const effectiveSelectedType = selectedType || "FIDELI";

  return {
    selectedType,
    hasScrolledPastSelector,
    whiteSectionRef,
    blackSectionRef,
    handlePathSelect,
    handleDiagonalAnimationComplete,
    processedHomepageItems,
    effectiveSelectedType,
    isRestoringScroll,
  };
} 
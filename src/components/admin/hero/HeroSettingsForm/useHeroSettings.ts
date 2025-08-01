import { useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEntityForm, type InitialImage } from '@/components/admin/layout/EntityFormLayout/useEntityForm';
import { heroContentFormSchema, type HeroContentFormData, HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import { useHeroContent } from '@/lib/queries/heroQueries';
import { wrappedUpsertHeroContentAction } from '@/lib/helpers/heroHelpers';
import type { HeroDbRow } from '@/types/hero';

export function useHeroSettings(initialDataFromProps: HeroDbRow | null) {
  const queryClient = useQueryClient();
  const {
    data: heroDataFromQuery,
    error: heroError,
  } = useHeroContent(); 

  const initialEntityImages: InitialImage[] = useMemo(() => {
    const imageUrl = heroDataFromQuery?.image_url ?? initialDataFromProps?.image_url;
    return imageUrl
      ? [{ id: `hero-image-${HERO_CONTENT_ID}`, image_url: imageUrl, position: 0 }]
      : [];
  }, [heroDataFromQuery?.image_url, initialDataFromProps?.image_url]);

  const currentHeroData = heroDataFromQuery ?? initialDataFromProps;

  const initialData = useMemo(() => {
    return currentHeroData
      ? { 
          id: String(currentHeroData.id),
          image_url: currentHeroData.image_url,
          updated_at: currentHeroData.updated_at,
          title: currentHeroData.title || '',
          subtitle: currentHeroData.subtitle || '',
        } 
      : { 
          id: String(HERO_CONTENT_ID), 
          image_url: null,
          updated_at: '',
          title: '',
          subtitle: '',
        };
  }, [currentHeroData]);

  const formHookResult = useEntityForm<HeroContentFormData, Omit<HeroDbRow, 'id'> & { id: string }, Omit<HeroDbRow, 'id'> & { id: string }>({
    schema: heroContentFormSchema,
    serverAction: wrappedUpsertHeroContentAction, 
    initialData,
    initialImages: initialEntityImages,
    config: {
      maxImages: 1,
    },
  });

  const { 
    register,
    handleSubmit,
    onSubmit,
    isPending, 
    state: formActionState, 
    displayImages, 
    imageIds, 
    sensors, 
    handleDragEnd, 
    handleImageChange, 
    handleMarkDelete, 
    handleRemoveStaged,
    fileInputRef,
  } = formHookResult;

  const submittedFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (formActionState?.success) {
      queryClient.invalidateQueries({ queryKey: ['heroContent', HERO_CONTENT_ID] });
    }
  }, [formActionState, queryClient]);

  useEffect(() => {
    if (isPending || !displayImages || displayImages.length !== 1) {
      return;
    }

    const currentImage = displayImages[0];

    if (currentImage.file && currentImage.file !== submittedFileRef.current) {
      handleSubmit(onSubmit)();
      submittedFileRef.current = currentImage.file;
    }
  }, [displayImages, handleSubmit, onSubmit, isPending]);

  return {
    formHookResult,
    currentHeroData,
    register,
    handleSubmit,
    onSubmit,
    isPending,
    formActionState,
    displayImages,
    imageIds,
    sensors,
    handleDragEnd,
    handleImageChange,
    handleMarkDelete,
    handleRemoveStaged,
    fileInputRef,
    heroError
  };
} 
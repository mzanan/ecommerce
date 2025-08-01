import React from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { useAboutSection } from './useAboutSection';
import type { AboutSectionProps } from '@/types/about';

const AboutSection: React.FC<AboutSectionProps> = ({
  text,
  images,
  aspectRatio = 'square',
}) => {
  const {
    validImages,
    itemAspectClass,
    titleAnimation,
    textAnimation,
    carouselAnimation
  } = useAboutSection({ images, aspectRatio });

  return (
    <section className="bg-gray-100 flex flex-col" data-about-section="true">
      {(text || validImages.length > 0) && (
        <div className="pt-12 px-8">
          <h2 
            ref={titleAnimation.elementRef}
            style={titleAnimation.animationStyles}
            className="text-3xl font-bold text-center text-black"
          >
            About Us
          </h2>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center px-8 pb-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {text && (
              <p 
                ref={textAnimation.elementRef}
                style={textAnimation.animationStyles}
                className="text-gray-700 whitespace-pre-wrap text-2xl lg:text-3xl"
              >
                {text}
              </p>
            )}

            {validImages.length > 0 && (
              <div 
                ref={carouselAnimation.elementRef}
                style={carouselAnimation.animationStyles}
                className="w-full"
              >
                <Carousel
                  opts={{
                    loop: true,
                  }}
                  className="w-full max-w-[400px] mx-auto"
                >
                  <CarouselContent>
                    {validImages.map((imageUrl, index) => (
                      <CarouselItem key={imageUrl || index}>
                        <div
                          className={`relative ${itemAspectClass} w-full rounded-xl overflow-hidden`}
                        >
                          <Image
                            src={imageUrl}
                            alt={`About us image ${index + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
                            className="object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {validImages.length > 1 && (
                    <>
                      <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
                      <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
                    </>
                  )}
                </Carousel>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
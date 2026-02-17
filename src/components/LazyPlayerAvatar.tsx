import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPlayerAvatarUrl, getPlayerInitials } from "@/lib/player-utils";
import { cn } from '@/lib/utils';

interface LazyPlayerAvatarProps {
  name: string;
  imageId?: number;
  cachedUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * A lazy-loading player avatar that:
 * 1. Shows initials by default (no network request)
 * 2. Only loads the actual image when scrolled into view
 * 3. Uses native lazy loading as an additional optimization
 */
export function LazyPlayerAvatar({
  name,
  imageId,
  cachedUrl,
  className,
  fallbackClassName,
}: LazyPlayerAvatarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Use Intersection Observer to detect when avatar is in viewport
  useEffect(() => {
    if (!imageId || cachedUrl) return; // No image to load OR already cached (eager load)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect(); // Stop observing once visible
          }
        });
      },
      {
        rootMargin: '100px', // Start loading slightly before entering viewport
        threshold: 0,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [imageId, cachedUrl]);

  const initials = getPlayerInitials(name);

  const imageUrl = (imageId || cachedUrl) ? getPlayerAvatarUrl(imageId, 'de', cachedUrl) : null;

  // Only attempt to load image if:
  // 1. We have a cachedUrl (eager load)
  // 2. OR we have an imageId AND the avatar is visible in viewport
  // 3. No previous error loading this image
  const shouldLoadImage = (cachedUrl || (imageId && isVisible)) && !imageError;

  return (
    <Avatar ref={containerRef} className={className}>
      {shouldLoadImage && (
        <AvatarImage
          src={imageUrl!}
          alt={name}
          className="object-cover"
          loading={cachedUrl ? "eager" : "lazy"}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
      {/* Always render fallback - it will show until image loads */}
      <AvatarFallback
        className={cn(
          "font-bold text-xs",
          fallbackClassName,
          // Hide fallback smoothly once image loads
          imageLoaded && "opacity-0 transition-opacity duration-200"
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

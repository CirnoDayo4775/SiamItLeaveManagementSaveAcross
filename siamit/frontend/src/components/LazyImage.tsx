import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    fallback?: string;
    className?: string;
}

export const LazyImage = ({ src, alt, className, fallback = '/placeholder.svg', ...props }: LazyImageProps) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
        };
        img.onerror = () => {
            setError(true);
            setIsLoading(false);
        };
    }, [src]);

    if (error && fallback) {
        return (
            <img
                src={fallback}
                alt={alt}
                className={cn("object-cover", className)}
                {...props}
            />
        );
    }

    return (
        <div className={cn("relative overflow-hidden", className)}>
            {isLoading && (
                <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                    <span className="sr-only">Loading...</span>
                </div>
            )}
            <img
                src={imageSrc || fallback}
                alt={alt}
                loading="lazy"
                className={cn(
                    "transition-opacity duration-300 object-cover w-full h-full",
                    isLoading ? "opacity-0" : "opacity-100"
                )}
                {...props}
            />
        </div>
    );
};

export default LazyImage;

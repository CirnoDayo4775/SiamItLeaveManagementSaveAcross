import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "@/config";
import { logger } from '@/lib/logger';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility function to construct proper image URLs
 * @param imageName - The image name or path from the database
 * @param apiBaseUrl - The API base URL
 * @returns Properly formatted image URL
 */
export function getImageUrl(imageName: string, apiBaseUrl: string): string {
  if (!imageName) return '';

  // If imageName starts with /, it's already a path, just combine with API_BASE_URL
  if (imageName.startsWith('/')) {
    return `${apiBaseUrl}${imageName}`;
  }

  // If imageName doesn't start with /, assume it's just a filename
  return `${apiBaseUrl}${config.upload.uploadPath}/announcements/${imageName}`;
}

/**
 * Utility function to handle image loading errors with fallback paths
 * @param e - The error event
 * @param imageName - The image name or path
 * @param apiBaseUrl - The API base URL
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, imageName: string, apiBaseUrl: string): void {
  const target = e.target as HTMLImageElement;
  if (import.meta.env.DEV) {
    logger.error('Image load error for:', imageName);
    logger.error('Current URL:', target.src);
    logger.error('API_BASE_URL:', apiBaseUrl);
  }

  // Try alternative paths
  const possiblePaths = [
    // If imageName starts with /, use API_BASE_URL + imageName
    imageName.startsWith('/') ? `${apiBaseUrl}${imageName}` : `${apiBaseUrl}${config.upload.uploadPath}/announcements/${imageName}`,
    // Try other possible paths
    `${apiBaseUrl}${config.upload.uploadPath}/${imageName}`,
    `${apiBaseUrl}${config.upload.publicPath}/uploads/announcements/${imageName}`,
    `${apiBaseUrl}${config.upload.publicPath}/uploads/${imageName}`,
    // Try relative paths
    imageName.startsWith('/') ? imageName : `${config.upload.uploadPath}/announcements/${imageName}`,
    `${config.upload.uploadPath}/${imageName}`,
    `${config.upload.publicPath}/uploads/announcements/${imageName}`,
    `${config.upload.publicPath}/uploads/${imageName}`
  ];

  const currentIndex = possiblePaths.findIndex(path => target.src.includes(path));
  const nextIndex = currentIndex + 1;

  if (nextIndex < possiblePaths.length) {
    if (import.meta.env.DEV) {
      logger.debug('Trying next path:', possiblePaths[nextIndex]);
    }
    target.src = possiblePaths[nextIndex];
  } else {
    if (import.meta.env.DEV) {
      logger.debug('All paths failed, using placeholder');
    }
    target.src = '/placeholder.svg';
  }
}

/**
 * Utility function to format date with localization
 * @param dateStr - The date string to format
 * @param language - The language code ('th' or 'en')
 * @param showTime - Whether to show time
 * @returns Formatted date string
 */
export function formatDate(dateStr: string, language: string, showTime: boolean = false): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(showTime && {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', options);
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.error('Error formatting date:', error);
    }
    return dateStr;
  }
}

/**
 * Utility function to format date only (without time)
 * @param dateStr - The date string to format
 * @param language - The language code ('th' or 'en')
 * @returns Formatted date string
 */
export function formatDateOnly(dateStr: string, language: string): string {
  return formatDate(dateStr, language, false);
}

/**
 * Utility function to format date with localization and time
 * @param dateStr - The date string to format
 * @param language - The language code ('th' or 'en')
 * @param showTime - Whether to show time
 * @returns Formatted date string
 */
export function formatDateLocalized(dateStr: string, language: string, showTime: boolean = false): string {
  return formatDate(dateStr, language, showTime);
}

/**
 * Utility function to handle image click for preview
 * @param file - The image file to preview
 * @param setPreviewImage - Function to set preview image state
 * @param setImageDialogOpen - Function to set dialog open state
 * @returns Cleanup function to revoke object URL (call when dialog closes)
 */
export function handleImageClick(
  file: File,
  setPreviewImage: (preview: { url: string; name: string } | null) => void,
  setImageDialogOpen: (open: boolean) => void
): (() => void) | void {
  // Check if file has custom url property (for view mode)
  let url: string;
  let isObjectUrl = false;

  const fileWithUrl = file as File & { url?: string };
  if (fileWithUrl.url) {
    url = fileWithUrl.url;
  } else {
    // For normal File objects, use URL.createObjectURL
    url = URL.createObjectURL(file);
    isObjectUrl = true;
  }

  setPreviewImage({ url, name: file.name });
  setImageDialogOpen(true);

  // Return cleanup function to revoke object URL when dialog closes
  if (isObjectUrl) {
    return () => {
      URL.revokeObjectURL(url);
    };
  }
}

/**
 * Utility function to handle file selection with validation
 * @param e - The file input change event
 * @param setFile - Function to set selected file
 * @param setPreview - Function to set preview URL
 * @param setError - Function to set error message
 * @param setIsValidFile - Function to set file validation status
 * @param t - Optional translation function for error messages
 * @returns Cleanup function to revoke object URL (IMPORTANT: call this in useEffect cleanup)
 * 
 * @example
 * // In your component:
 * const cleanupRef = useRef<(() => void) | null>(null);
 * 
 * const handleChange = (e) => {
 *   // Clean up previous object URL if it exists
 *   if (cleanupRef.current) {
 *     cleanupRef.current();
 *   }
 *   // Store new cleanup function
 *   cleanupRef.current = handleFileSelect(e, setFile, setPreview);
 * };
 * 
 * // In component cleanup:
 * useEffect(() => {
 *   return () => {
 *     if (cleanupRef.current) {
 *       cleanupRef.current();
 *     }
 *   };
 * }, []);
 */
export function handleFileSelect(
  e: React.ChangeEvent<HTMLInputElement>,
  setFile: (file: File | null) => void,
  setPreview: (url: string | null) => void,
  setError?: (error: string | null) => void,
  setIsValidFile?: (isValid: boolean) => void,
  t?: (key: string) => string
): (() => void) | void {
  const file = e.target.files?.[0];

  if (!file) return;

  // Validate file type
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
  if (!validImageTypes.includes(file.type)) {
    setFile(null);
    setPreview(null);
    if (setError) setError(t ? t('leave.invalidFileType') : 'กรุณาอัปโหลดไฟล์ภาพ (.jpg, .png, .gif, .webp)');
    if (setIsValidFile) setIsValidFile(false);
    return;
  }

  // Validate file size (10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    setFile(null);
    setPreview(null);
    if (setError) setError(t ? t('leave.fileTooLarge') : 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)');
    if (setIsValidFile) setIsValidFile(false);
    return;
  }

  setFile(file);
  const previewUrl = URL.createObjectURL(file);
  setPreview(previewUrl);
  if (setError) setError(null);
  if (setIsValidFile) setIsValidFile(true);

  // Return cleanup function to revoke object URL
  // IMPORTANT: Caller must call this function when component unmounts or when changing files
  return () => {
    URL.revokeObjectURL(previewUrl);
  };
}

/**
 * Utility function to remove selected file
 * @param setFile - Function to set selected file to null
 * @param setPreview - Function to set preview URL to null
 * @param setError - Function to clear error message
 * @param setIsValidFile - Function to set file validation status
 * @param fileInputRef - Reference to file input element
 */
export function removeSelectedFile(
  setFile: (file: File | null) => void,
  setPreview: (url: string | null) => void,
  setError?: (error: string | null) => void,
  setIsValidFile?: (isValid: boolean) => void,
  fileInputRef?: React.RefObject<HTMLInputElement>
): void {
  setFile(null);
  setPreview(null);
  setError?.(null);
  setIsValidFile?.(false);

  // รีเซ็ต file input
  if (fileInputRef?.current) {
    fileInputRef.current.value = '';
  }
}

// NOTE: fetchWithAuth has been removed from here.
// Use the version from '@/lib/api' instead which is properly maintained.

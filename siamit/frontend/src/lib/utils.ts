import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "@/config";

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
    console.error('Image load error for:', imageName);
    console.error('Current URL:', target.src);
    console.error('API_BASE_URL:', apiBaseUrl);
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
      console.log('Trying next path:', possiblePaths[nextIndex]);
    }
    target.src = possiblePaths[nextIndex];
  } else {
    if (import.meta.env.DEV) {
      console.log('All paths failed, using placeholder');
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
      console.error('Error formatting date:', error);
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
 */
export function handleImageClick(
  file: File,
  setPreviewImage: (preview: { url: string; name: string } | null) => void,
  setImageDialogOpen: (open: boolean) => void
): void {
  // ตรวจสอบว่ามี custom url property หรือไม่ (สำหรับโหมด view)
  let url: string;
  if ((file as any).url) {
    url = (file as any).url;
  } else {
    // ถ้าเป็น File object ปกติ ใช้ URL.createObjectURL
    url = URL.createObjectURL(file);
  }

  setPreviewImage({ url, name: file.name });
  setImageDialogOpen(true);
}

/**
 * Utility function to handle file selection with validation
 * @param e - The file input change event
 * @param setFile - Function to set selected file
 * @param setPreview - Function to set preview URL
 * @param setError - Function to set error message
 * @param setIsValidFile - Function to set file validation status
 */
export function handleFileSelect(
  e: React.ChangeEvent<HTMLInputElement>,
  setFile: (file: File | null) => void,
  setPreview: (url: string | null) => void,
  setError?: (error: string | null) => void,
  setIsValidFile?: (isValid: boolean) => void
): void {
  const file = e.target.files?.[0];
  if (file) {
    // ตรวจสอบประเภทไฟล์ - อนุญาตเฉพาะไฟล์รูปภาพ
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedImageTypes.includes(file.type)) {
      setError?.('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF, WebP)');
      setIsValidFile?.(false);
      setFile(null);
      setPreview(null);
      // รีเซ็ต input file
      e.target.value = '';
      return;
    }

    // ตรวจสอบขนาดไฟล์ (จำกัดที่ 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError?.('ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 10MB');
      setIsValidFile?.(false);
      setFile(null);
      setPreview(null);
      e.target.value = '';
      return;
    }

    // ไฟล์ผ่านการตรวจสอบ
    setError?.(null);
    setIsValidFile?.(true);
    setFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  }
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

export async function fetchWithAuth(input: RequestInfo, init?: RequestInit, logoutFn?: () => void, sessionExpiredFn?: () => void) {
  const token = localStorage.getItem("token");
  const headers = {
    ...(init?.headers || {}),
    Authorization: token ? `Bearer ${token}` : undefined,
  };
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    if (sessionExpiredFn) {
      sessionExpiredFn();
    } else if (logoutFn) {
      logoutFn();
    }
    return null;
  }
  return response;
}

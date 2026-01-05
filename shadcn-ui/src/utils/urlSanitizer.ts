/**
 * Resolve media URL - returns relative URLs as-is
 * Backend returns relative URLs, frontend should use them directly
 * 
 * @param url - The URL to resolve (can be absolute or relative)
 * @returns Relative URL (sanitized if absolute)
 */
export const resolveMediaUrl = (url: string | undefined | null): string => {
  if (!url) {
    return '';
  }

  // If it's a data URL or blob URL, return as-is
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // If already relative URL, return as-is
  if (url.startsWith('/')) {
    return url;
  }

  // If absolute URL, sanitize it to relative
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return sanitizeUrl(url);
  }

  // Otherwise return as-is
  return url;
};

/**
 * URL Sanitizer Utility
 * 
 * Strips protocol and host from URLs to ensure relative paths.
 * This is a safety fallback - backend should already return relative URLs.
 * 
 * @param url - The URL to sanitize (can be absolute or relative)
 * @returns Relative URL path
 */
export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url) {
    return '';
  }

  // If already relative, return as-is
  if (url.startsWith('/')) {
    return url;
  }

  // If it's a data URL or blob URL, return as-is
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  try {
    // Parse the URL to extract path
    const urlObj = new URL(url);
    
    // Return pathname + search (query params) + hash
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch (error) {
    // If URL parsing fails, try to extract path manually
    // Remove protocol and host
    const withoutProtocol = url.replace(/^https?:\/\//, '');
    const pathMatch = withoutProtocol.match(/\/.*$/);
    
    if (pathMatch) {
      return pathMatch[0];
    }
    
    // If all else fails, return as relative path
    return url.startsWith('/') ? url : `/${url}`;
  }
};

/**
 * Sanitize multiple URLs (for arrays of media items)
 */
export const sanitizeUrls = (urls: (string | undefined | null)[]): string[] => {
  return urls.map(sanitizeUrl).filter(url => url.length > 0);
};

/**
 * Sanitize URLs in a media item object
 */
export const sanitizeMediaItemUrls = (item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  thumbnailUrl?: string | null;
  streamUrl?: string | null;
  [key: string]: any;
}): typeof item => {
  return {
    ...item,
    posterUrl: sanitizeUrl(item.posterUrl),
    backdropUrl: sanitizeUrl(item.backdropUrl),
    thumbnailUrl: sanitizeUrl(item.thumbnailUrl),
    streamUrl: sanitizeUrl(item.streamUrl),
  };
};

/**
 * Resolve URLs in a media item object - converts relative URLs to absolute for media resources
 */
export const resolveMediaItemUrls = (item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  thumbnailUrl?: string | null;
  streamUrl?: string | null;
  [key: string]: any;
}): typeof item => {
  return {
    ...item,
    posterUrl: resolveMediaUrl(item.posterUrl),
    backdropUrl: resolveMediaUrl(item.backdropUrl),
    thumbnailUrl: resolveMediaUrl(item.thumbnailUrl),
    streamUrl: resolveMediaUrl(item.streamUrl),
  };
};

/**
 * Get a placeholder image data URI
 * Returns a simple SVG placeholder image as a data URI
 */
export const getPlaceholderImage = (width: number = 300, height: number = 450): string => {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#2A2A2A"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#666" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>`;
  // Use encodeURIComponent instead of base64 for better compatibility
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};


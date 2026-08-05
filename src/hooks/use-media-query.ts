import { useState, useEffect } from 'react';

/**
 * Hook to check if a media query matches
 * 
 * @param query The media query string to evaluate
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } 
    else if (typeof (media as any).addListener === 'function') {
      (media as any).addListener(listener);
      return () => (media as any).removeListener(listener);
    }
  }, [matches, query]);

  return matches;
}

import { useEffect, useRef, useState } from 'react';

// Simplified auto-scroll with better performance
export const useAutoScroll = (dependencies: any[]) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const lastScrollTopRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve the actual scrollable viewport element
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const vp = (root.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement) || root;
    viewportRef.current = vp;

    const handleScroll = () => {
      // Debounce scroll events for performance
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        const el = viewportRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
        const threshold = 100; // Show button when 100px from bottom

        // If user scrolled up beyond threshold, mark it
        if (scrollTop < lastScrollTopRef.current && distanceFromBottom > threshold) {
          setIsUserScrolled(true);
        }

        // If user scrolled near bottom, mark it
        if (distanceFromBottom < threshold) {
          setIsUserScrolled(false);
        }

        lastScrollTopRef.current = scrollTop;
      }, 50);
    };

    vp.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      vp.removeEventListener('scroll', handleScroll as EventListener);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom when content changes (unless user scrolled up)
  useEffect(() => {
    if (!isUserScrolled && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const scrollToBottom = () => {
    setIsUserScrolled(false);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  return {
    scrollRef: rootRef,
    endRef,
    isUserScrolled,
    scrollToBottom,
  };
};

import { useEffect, useRef, useState } from 'react';

// Auto-scroll helper tailored for Radix ScrollArea (listens on Viewport)
export const useAutoScroll = (dependencies: any[]) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const lastScrollTopRef = useRef(0);

  // Resolve the actual scrollable viewport element
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Radix adds a data attribute on the Viewport
    const vp = (root.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement) || root;
    viewportRef.current = vp;

    const handleScroll = () => {
      const el = viewportRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 48;

      // If user scrolled up, mark it
      if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
        setIsUserScrolled(true);
      }

      // If user scrolled to bottom, mark it
      if (isAtBottom) {
        setIsUserScrolled(false);
      }

      lastScrollTopRef.current = scrollTop;
    };

    vp.addEventListener('scroll', handleScroll, { passive: true });
    return () => vp.removeEventListener('scroll', handleScroll as EventListener);
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

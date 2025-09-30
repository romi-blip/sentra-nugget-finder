import { useEffect, useRef, useState } from 'react';

export const useAutoScroll = (dependencies: any[]) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const lastScrollTopRef = useRef(0);

  // Detect if user has scrolled up
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      
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

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when content changes (unless user scrolled up)
  useEffect(() => {
    if (!isUserScrolled && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, dependencies);

  const scrollToBottom = () => {
    setIsUserScrolled(false);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  return {
    scrollRef,
    endRef,
    isUserScrolled,
    scrollToBottom,
  };
};

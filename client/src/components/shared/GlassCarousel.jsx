import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GlassCarousel({ children, className = '', title, headerAction }) {
  const containerRef = useRef(null);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(true);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= 5) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }

    if (isRtl) {
      const absLeft = Math.abs(scrollLeft);
      setCanScrollStart(absLeft > 5);
      setCanScrollEnd(absLeft < maxScroll - 5);
    } else {
      setCanScrollStart(scrollLeft > 5);
      setCanScrollEnd(scrollLeft < maxScroll - 5);
    }
  }, [isRtl]);

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => checkScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    const t1 = setTimeout(checkScroll, 100);
    const t2 = setTimeout(checkScroll, 500);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkScroll);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [checkScroll, children]);

  const scroll = (direction) => {
    const el = containerRef.current;
    if (!el) return;

    const distance = Math.max(280, el.clientWidth * 0.75);
    
    let delta = 0;
    if (direction === 'next') {
      delta = isRtl ? -distance : distance;
    } else {
      delta = isRtl ? distance : -distance;
    }

    el.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  return (
    <div className={`relative group/carousel ${className}`}>
      {/* Optional Header */}
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-3 px-1">
          {title && <h2 className="text-lg md:text-xl font-bold tracking-tight text-text">{title}</h2>}
          {headerAction}
        </div>
      )}

      {/* Carousel Wrapper */}
      <div className="relative">
        {/* Left Arrow Button */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 transition-all duration-300 ${
            (isRtl ? canScrollEnd : canScrollStart)
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <button
            onClick={() => scroll(isRtl ? 'next' : 'prev')}
            aria-label="Previous"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center -ms-2 sm:-ms-4 backdrop-blur-xl bg-white/90 dark:bg-surface/85 hover:bg-white dark:hover:bg-surface text-text/90 hover:text-text border border-slate-200/80 dark:border-white/15 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
          >
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Right Arrow Button */}
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 transition-all duration-300 ${
            (isRtl ? canScrollStart : canScrollEnd)
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <button
            onClick={() => scroll(isRtl ? 'prev' : 'next')}
            aria-label="Next"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center -me-2 sm:-me-4 backdrop-blur-xl bg-white/90 dark:bg-surface/85 hover:bg-white dark:hover:bg-surface text-text/90 hover:text-text border border-slate-200/80 dark:border-white/15 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
          >
            <ChevronRight size={22} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Soft edge ambient fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-bg to-transparent z-10 opacity-60" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-bg to-transparent z-10 opacity-60" />

        {/* Scrollable container with completely hidden scrollbar */}
        <div
          ref={containerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 px-1 snap-x scroll-smooth scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

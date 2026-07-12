import React, { useState, useEffect } from 'react';
import { watchSiteSettings } from '../lib/settings';
import { SiteSettings, HeroBannerItem } from '../types';
import { Sparkles, ChevronLeft, ChevronRight, Youtube, Facebook, ExternalLink, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const HeroBanner: React.FC = () => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  useEffect(() => {
    const unsub = watchSiteSettings((data) => {
      setSiteSettings(data);
      // Reset active index with a sliding back transition when settings/banners list updates
      setDirection(-1);
      setActiveIndex(0);
    });
    return () => unsub();
  }, []);

  // Consolidate list of banners, falling back to old single banner properties if array is empty/not present
  const banners: HeroBannerItem[] = siteSettings.heroBanners && siteSettings.heroBanners.length > 0
    ? siteSettings.heroBanners
    : [
        {
          id: 'default',
          imageUrl: siteSettings.heroImageUrl || '',
          title: siteSettings.heroTitle || 'LWE ESPORTS COMMAND CENTER',
          linkUrl: ''
        }
      ];

  // Auto-play interval for sliding
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % banners.length);
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : dir < 0 ? '-100%' : '0%',
      opacity: 0,
    }),
    center: {
      x: '0%',
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? '100%' : dir > 0 ? '-100%' : '0%',
      opacity: 0,
    },),
  };

  const getLinkIcon = (url?: string) => {
    if (!url) return <ExternalLink className="w-4 h-4" />;
    const lowered = url.toLowerCase();
    if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) {
      return <Youtube className="w-5 h-5 text-red-500 fill-red-500" />;
    }
    if (lowered.includes('facebook.com') || lowered.includes('fb.watch')) {
      return <Facebook className="w-5 h-5 text-blue-500 fill-blue-500" />;
    }
    if (lowered.includes('video') || lowered.includes('clip') || lowered.includes('stream')) {
      return <Video className="w-5 h-5 text-purple-400" />;
    }
    return <ExternalLink className="w-4 h-4 text-purple-400" />;
  };

  const getLinkButtonText = (url?: string) => {
    if (!url) return 'Visit Link';
    const lowered = url.toLowerCase();
    if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) {
      return 'Watch on YouTube';
    }
    if (lowered.includes('facebook.com') || lowered.includes('fb.watch')) {
      return 'View on Facebook';
    }
    return 'Visit Link';
  };

  const currentBanner = banners[activeIndex];
  const isClickable = !!currentBanner.linkUrl;

  const contentElement = (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {currentBanner.imageUrl ? (
          <motion.div
            key={currentBanner.id || activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 220, damping: 26 },
              opacity: { duration: 0.4 }
            }}
            className="absolute inset-0 w-full h-full"
          >
            <img 
              src={currentBanner.imageUrl} 
              alt={currentBanner.title} 
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            {/* Subtle bottom gradient to make indicator dots visible */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </motion.div>
        ) : (
          <motion.div
            key="fallback-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-[#0c0c14] to-[#05050a] flex items-center justify-center"
          >
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="text-center p-6 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 block">LWE Esports Active Division</span>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white">{currentBanner.title}</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="relative border border-purple-500/15 rounded-3xl mb-8 overflow-hidden shadow-[0_0_35px_rgba(147,51,234,0.07)] h-[160px] sm:h-[220px] md:h-[280px] lg:h-[320px] w-full flex items-center group">
      
      {/* Clickable Area or Static View */}
      {isClickable ? (
        <a 
          href={currentBanner.linkUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="absolute inset-0 z-0 block cursor-pointer"
          title={`Click to view: ${currentBanner.title}`}
        >
          {contentElement}
          
          {/* Subtle Hover Action Badge */}
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/75 backdrop-blur-md border border-purple-500/30 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-mono text-purple-300 font-bold uppercase tracking-wider shadow-lg">
            {getLinkIcon(currentBanner.linkUrl)}
            <span>View Link</span>
          </div>
        </a>
      ) : (
        <div className="absolute inset-0 z-0">
          {contentElement}
        </div>
      )}

      {/* Slider Controls (Chevron Arrows) - Only show if there are multiple slides */}
      {banners.length > 1 && (
        <>
          {/* Left Arrow */}
          <button
            onClick={handlePrev}
            className="absolute left-4 z-20 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-purple-600/90 text-gray-300 hover:text-white border border-white/10 hover:border-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md focus:outline-none cursor-pointer"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={handleNext}
            className="absolute right-4 z-20 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-purple-600/90 text-gray-300 hover:text-white border border-white/10 hover:border-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md focus:outline-none cursor-pointer"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Slide Indicator Dots at Bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                className="h-1.5 rounded-full transition-all duration-300 focus:outline-none cursor-pointer w-2 bg-gray-500/50 hover:bg-gray-400"
                style={{ width: activeIndex === idx ? '18px' : '6px', backgroundColor: activeIndex === idx ? '#a855f7' : '' }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
};

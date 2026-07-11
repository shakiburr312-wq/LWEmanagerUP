import React, { useState, useEffect } from 'react';
import { watchSiteSettings } from '../lib/settings';
import { SiteSettings, HeroBannerItem } from '../types';
import { Sparkles, ChevronLeft, ChevronRight, Youtube, Facebook, ExternalLink, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const HeroBanner: React.FC = () => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const unsub = watchSiteSettings((data) => {
      setSiteSettings(data);
      // Reset active index if the banners list changes to avoid out-of-bounds
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
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % banners.length);
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

  return (
    <div className="relative border border-purple-500/15 rounded-3xl mb-8 overflow-hidden shadow-[0_0_35px_rgba(147,51,234,0.07)] bg-gradient-to-br from-[#0c0c14] to-[#05050a] min-h-[220px] md:min-h-[300px] flex items-center group">
      
      {/* Background Slides */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {currentBanner.imageUrl ? (
            <motion.div
              key={currentBanner.id}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <img 
                src={currentBanner.imageUrl} 
                alt={currentBanner.title} 
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              {/* Premium cinematic vignette overlay for high contrast and text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/95 via-[#050508]/80 to-[#050508]/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508]/20" />
            </motion.div>
          ) : (
            <motion.div
              key="fallback-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* Dynamic Purple Glow for Gradient Background */}
              <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Elements / Particles if no banner image */}
      {!currentBanner.imageUrl && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10 hidden md:block">
          <div className="w-24 h-24 bg-purple-500/10 border border-purple-500/20 rounded-2xl rotate-45 animate-pulse" />
        </div>
      )}

      {/* Slide Content Overlay */}
      <div className="w-full p-6 sm:p-8 md:p-12 relative z-10">
        <div className="max-w-4xl text-left space-y-4">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 backdrop-blur-md border border-purple-500/30 rounded-full text-[10px] font-mono text-purple-300 uppercase tracking-wider shadow-lg select-none">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" style={{ animationDuration: '4s' }} />
            <span>Active Esports Operations</span>
          </div>

          {/* Slide Title with gorgeous premium typography */}
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentBanner.id + '_title'}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="text-2xl sm:text-3.5xl md:text-5xl font-display font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-lg"
            >
              {currentBanner.title.split(' ').map((word, idx) => (
                <span key={idx} className={idx % 2 === 1 ? 'text-purple-400 mr-2' : 'text-white mr-2'}>
                  {word}
                </span>
              ))}
            </motion.h2>
          </AnimatePresence>

          {/* Action Link (YouTube / Facebook / Website Linking) */}
          {currentBanner.linkUrl && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentBanner.id + '_link'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="pt-2"
              >
                <a
                  href={currentBanner.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-sans text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300 hover:-translate-y-0.5"
                >
                  {getLinkIcon(currentBanner.linkUrl)}
                  <span>{getLinkButtonText(currentBanner.linkUrl)}</span>
                </a>
              </motion.div>
            </AnimatePresence>
          )}

        </div>
      </div>

      {/* Slider Controls (Chevron Arrows) - Only show if there are multiple slides */}
      {banners.length > 1 && (
        <>
          {/* Left Arrow */}
          <button
            onClick={handlePrev}
            className="absolute left-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-purple-600/90 text-gray-300 hover:text-white border border-white/10 hover:border-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md focus:outline-none"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={handleNext}
            className="absolute right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-purple-600/90 text-gray-300 hover:text-white border border-white/10 hover:border-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md focus:outline-none"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Slide Indicator Dots at Bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                className={`h-2 rounded-full transition-all duration-300 focus:outline-none ${
                  activeIndex === idx ? 'w-6 bg-purple-500' : 'w-2 bg-gray-500/50 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchSiteSettings, watchMVPSettings, watchLineups } from '../lib/settings';
import { watchAnnouncements } from '../lib/announcements';
import { watchPlayers } from '../lib/players';
import { watchPerformanceLogs } from '../lib/performanceLogs';
import { getSeasonRankedPlayers } from '../utils/mvp';
import { getSeasonCode } from '../utils/season';
import { Announcement, PlayerProfile, PerformanceLog, MVPSettings, SiteSettings, Lineup } from '../types';
import { Sparkles, ChevronLeft, ChevronRight, Youtube, Facebook, ExternalLink, Video, Megaphone, Crown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const HeroBanner: React.FC = () => {
  const navigate = useNavigate();
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLog[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [mvpSettings, setMvpSettings] = useState<MVPSettings>({
    kdWeight: 10,
    killsWeight: 1,
    damageWeight: 0.1,
    seasonStartDate: '2026-07-01T00:00:00.000Z'
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  useEffect(() => {
    // Watch site settings
    const unsubSite = watchSiteSettings((data) => {
      setSiteSettings(data);
    });

    // Real-time listener for announcements (ordered desc inside watchAnnouncements query)
    const unsubAnnounce = watchAnnouncements((data) => {
      setAnnouncements(data);
    });

    // Real-time listener for players roster
    const unsubPlayers = watchPlayers((data) => {
      setPlayers(data);
    });

    // Real-time listener for performance logs
    const unsubLogs = watchPerformanceLogs((data) => {
      setPerformanceLogs(data);
    });

    // Real-time listener for lineups
    const unsubLineups = watchLineups((data) => {
      setLineups(data);
    });

    // Real-time listener for MVP weight settings
    const unsubMvpSettings = watchMVPSettings((data) => {
      setMvpSettings(data);
    });

    return () => {
      unsubSite();
      unsubAnnounce();
      unsubPlayers();
      unsubLogs();
      unsubLineups();
      unsubMvpSettings();
    };
  }, []);

  // Helper to get link icons for manual slides
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

  // Helper to get button text for manual slides
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

  // Compute final list of slides
  // 1. Get raw manually set banners
  const manualSlides: any[] = [];
  if (siteSettings.heroBanners && siteSettings.heroBanners.length > 0) {
    siteSettings.heroBanners.forEach((b) => {
      manualSlides.push({
        id: b.id || Math.random().toString(),
        type: 'manual' as const,
        imageUrl: b.imageUrl || '',
        title: b.title || '',
        linkUrl: b.linkUrl || '',
      });
    });
  } else if (siteSettings.heroImageUrl) {
    manualSlides.push({
      id: 'default-manual',
      type: 'manual' as const,
      imageUrl: siteSettings.heroImageUrl,
      title: siteSettings.heroTitle || 'LWE ESPORTS COMMAND CENTER',
      linkUrl: '',
    });
  }

  // 2. Map announcements to slides (already ordered descending by date in Firestore query inside watchAnnouncements)
  const announcementSlides = announcements.map((ann) => ({
    id: ann.id,
    type: 'announcement' as const,
    title: ann.title,
    content: ann.content,
    createdBy: ann.createdBy,
    createdAt: ann.createdAt,
    linkUrl: '',
  }));

  // 3. Compute current MVP in real-time
  const rankedPlayers = getSeasonRankedPlayers(players, performanceLogs, mvpSettings);
  const hasLogs = performanceLogs.some(log => log.date >= (mvpSettings.seasonStartDate || ''));
  const currentMvp = hasLogs && rankedPlayers.length > 0 ? rankedPlayers[0] : null;

  // 4. Construct virtual Seasonal MVP slide
  const mvpSlide = currentMvp ? {
    id: 'mvp-virtual-slide',
    type: 'mvp' as const,
    title: 'Season MVP',
    mvpData: {
      name: currentMvp.name,
      role: currentMvp.role || 'Fragger',
      lineup: currentMvp.lineup || '1st Lineup',
      score: currentMvp.score,
      mvpPhotoUrl: currentMvp.mvpPhotoUrl,
      photoUrl: currentMvp.photoUrl,
    }
  } : null;

  // 4b. Compute Team Leaderboard Standings and Most Valuable Team (MVT) for banner
  const teamStats = (lineups.length > 0 ? lineups : [
    { id: '1st Lineup', name: '1st Lineup', logoUrl: '' },
    { id: 'second lineup', name: 'second lineup', logoUrl: '' }
  ]).map(lineup => {
    const teamPlayers = rankedPlayers.filter(p => {
      const pLineup = p.lineup || '1st Lineup';
      return pLineup.toLowerCase() === lineup.id.toLowerCase() || pLineup.toLowerCase() === lineup.name.toLowerCase();
    });

    const totalScore = teamPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
    const totalKills = teamPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);
    const totalDamage = teamPlayers.reduce((sum, p) => sum + (p.damage || 0), 0);
    const teamMatches = teamPlayers.length > 0 ? Math.max(...teamPlayers.map(p => p.matches || 0)) : 0;

    const displayName = lineup.name === 'second lineup' ? '2nd Lineup' : lineup.name;

    return {
      id: lineup.id,
      name: lineup.name,
      displayName,
      logoUrl: lineup.logoUrl,
      playersCount: teamPlayers.length,
      score: Number(totalScore.toFixed(1)),
      kills: totalKills,
      damage: totalDamage,
      matches: teamMatches
    };
  });

  const sortedTeams = [...teamStats].sort((a, b) => b.score - a.score);
  const leadingTeam = hasLogs && sortedTeams.length > 0 ? sortedTeams[0] : null;

  // 4c. Construct virtual Seasonal MVT slide
  const mvtSlide = leadingTeam ? {
    id: 'mvt-virtual-slide',
    type: 'mvt' as const,
    title: 'Season MVT',
    mvtData: {
      name: leadingTeam.displayName,
      playersCount: leadingTeam.playersCount,
      score: leadingTeam.score,
      kills: leadingTeam.kills,
      damage: leadingTeam.damage,
      matches: leadingTeam.matches,
      logoUrl: leadingTeam.logoUrl
    }
  } : null;

  // 5. Combine: announcements first, then MVP, then MVT, then manual slides
  const slides = [...announcementSlides];
  if (mvpSlide) {
    slides.push(mvpSlide as any);
  }
  if (mvtSlide) {
    slides.push(mvtSlide as any);
  }
  slides.push(...manualSlides);

  // 6. Fallback in case there's absolutely no slides (database loading or completely empty)
  const finalSlides = slides.length > 0 ? slides : [
    {
      id: 'default',
      type: 'manual' as const,
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070',
      title: siteSettings.heroTitle || 'LWE ESPORTS COMMAND CENTER',
      linkUrl: ''
    }
  ];

  // Adjust activeIndex if slides count changes to avoid out-of-bounds index
  useEffect(() => {
    setActiveIndex((prev) => {
      if (prev >= finalSlides.length) {
        return 0;
      }
      return prev;
    });
  }, [finalSlides.length]);

  // Auto-play interval for sliding
  useEffect(() => {
    if (finalSlides.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % finalSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [finalSlides.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + finalSlides.length) % finalSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % finalSlides.length);
  };

  const fadeVariants = {
    enter: {
      opacity: 0,
      scale: 1.04,
      filter: 'blur(8px)',
    },
    center: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      filter: 'blur(8px)',
    },
  };

  const bgImage = siteSettings.announcementBgUrl || siteSettings.heroImageUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070';
  const currentSlide = finalSlides[activeIndex];

  return (
    <div className="relative border border-purple-500/15 rounded-3xl mb-8 overflow-hidden shadow-[0_0_35px_rgba(147,51,234,0.07)] h-[160px] sm:h-[220px] md:h-[280px] lg:h-[320px] w-full flex items-center group">
      
      {/* Content Rendering Container */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {currentSlide.type === 'mvp' && currentSlide.mvpData ? (
            // Custom Seasonal MVP Slide Render
            <motion.div
              key={currentSlide.id || activeIndex}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 w-full h-full bg-[#0d0a05] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.18)_0%,transparent_70%)] flex items-center justify-between px-6 sm:px-10 md:px-14 relative overflow-hidden cursor-pointer"
              onClick={() => navigate('/stats', { state: { tab: 'mvp' } })}
            >
              {/* Background Decorative Glow Elements */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Left Column Content */}
              <div className="relative z-10 flex-1 text-left space-y-2 sm:space-y-3 pr-4">
                {/* ♛ SEASON MVP Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[9px] sm:text-[10px] tracking-widest font-black uppercase font-mono shadow-md shadow-amber-500/10">
                  <Crown className="w-3.5 h-3.5 text-black" />
                  <span>♛ MVP {getSeasonCode(mvpSettings.seasonStartDate)}</span>
                </div>

                {/* Player Name */}
                <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md">
                  {currentSlide.mvpData.name}
                </h2>

                {/* Role and Lineup */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-mono text-amber-400 uppercase tracking-widest font-bold">
                  <span>{currentSlide.mvpData.role}</span>
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  <span className="text-gray-400">{currentSlide.mvpData.lineup}</span>
                </div>

                {/* Real-time score ticker */}
                <div className="text-xs sm:text-sm font-mono text-gray-400 flex items-center gap-2 mt-1">
                  <span>MVP SCORE:</span>
                  <strong className="text-amber-400 font-black text-sm sm:text-lg md:text-xl font-mono">
                    {currentSlide.mvpData.score}
                  </strong>
                </div>
              </div>

              {/* Right Column Spinning Frame */}
              <div className="relative z-10 shrink-0 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 flex items-center justify-center">
                {/* Rotating gold/orange gradient ring */}
                <div 
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300 animate-spin"
                  style={{ animationDuration: '6s' }}
                />
                {/* Inner dark circle mask */}
                <div className="absolute inset-[3px] bg-[#0c0c14] rounded-full" />
                
                {/* Image or crown fallback */}
                {currentSlide.mvpData.mvpPhotoUrl || currentSlide.mvpData.photoUrl ? (
                  <img 
                    src={currentSlide.mvpData.mvpPhotoUrl || currentSlide.mvpData.photoUrl} 
                    alt={currentSlide.mvpData.name}
                    className="absolute inset-[6px] rounded-full object-cover w-[calc(100%-12px)] h-[calc(100%-12px)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-[6px] rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Crown className="w-8 h-8 text-amber-400" />
                  </div>
                )}
              </div>

              {/* Bottom subtle gradient */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </motion.div>
          ) : currentSlide.type === 'mvt' && currentSlide.mvtData ? (
            // Custom Seasonal MVT Slide Render
            <motion.div
              key={currentSlide.id || activeIndex}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 w-full h-full bg-[#08050d] bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.18)_0%,transparent_70%)] flex items-center justify-between px-6 sm:px-10 md:px-14 relative overflow-hidden cursor-pointer"
              onClick={() => navigate('/stats', { state: { tab: 'leaderboard' } })}
            >
              {/* Background Decorative Glow Elements */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Left Column Content */}
              <div className="relative z-10 flex-1 text-left space-y-2 sm:space-y-3 pr-4">
                {/* 🛡️ SEASON MVT Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] sm:text-[10px] tracking-widest font-black uppercase font-mono shadow-md shadow-purple-500/10 border border-purple-400/20">
                  <Shield className="w-3.5 h-3.5 text-white" />
                  <span>🛡️ MVT {getSeasonCode(mvpSettings.seasonStartDate)}</span>
                </div>

                {/* Team Name */}
                <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md">
                  {currentSlide.mvtData.name}
                </h2>

                {/* Info and Matches */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-mono text-purple-400 uppercase tracking-widest font-bold">
                  <span>{currentSlide.mvtData.playersCount} ACTIVE PLAYERS</span>
                  <span className="w-1 h-1 rounded-full bg-purple-500" />
                  <span className="text-gray-400">{currentSlide.mvtData.matches} MATCHES</span>
                </div>

                {/* Real-time score ticker */}
                <div className="text-xs sm:text-sm font-mono text-gray-400 flex items-center gap-2 mt-1">
                  <span>TEAM SCORE:</span>
                  <strong className="text-purple-400 font-black text-sm sm:text-lg md:text-xl font-mono">
                    {currentSlide.mvtData.score} PTS
                  </strong>
                </div>
              </div>

              {/* Right Column Spinning Frame */}
              <div className="relative z-10 shrink-0 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 flex items-center justify-center">
                {/* Rotating purple gradient ring */}
                <div 
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-spin"
                  style={{ animationDuration: '6s' }}
                />
                {/* Inner dark circle mask */}
                <div className="absolute inset-[3px] bg-[#0c0c14] rounded-full" />
                
                {/* Image or shield fallback */}
                {currentSlide.mvtData.logoUrl ? (
                  <img 
                    src={currentSlide.mvtData.logoUrl} 
                    alt={currentSlide.mvtData.name}
                    className="absolute inset-[10px] object-contain w-[calc(100%-20px)] h-[calc(100%-20px)] p-1 filter drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-[6px] rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-purple-400" />
                  </div>
                )}
              </div>

              {/* Bottom subtle gradient */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </motion.div>
          ) : currentSlide.type === 'announcement' ? (
            // Standard Announcement Slide Render - Beautiful Creative Free Fire / Gaming UI
            <motion.div
              key={currentSlide.id || activeIndex}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 w-full h-full flex items-center px-4 sm:px-10 md:px-14 relative overflow-hidden"
            >
              {/* Background Image with a dark, high-contrast gaming vignette and hot orange overlay */}
              <img 
                src={bgImage} 
                alt={currentSlide.title} 
                className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter brightness-85 contrast-110"
                referrerPolicy="no-referrer"
              />
              
              {/* Free Fire inspired diagonal stripe and warm orange neon ambient glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent z-0" />
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_left,rgba(249,115,22,0.12)_0%,transparent_60%)] z-0" />
              
              {/* Left Column - Glowing Gaming noticeboard Container */}
              <div className="relative z-10 max-w-xl md:max-w-2xl text-left bg-black/75 backdrop-blur-md border-l-4 border-l-orange-500 border border-white/5 rounded-r-2xl p-4 sm:p-5 md:p-6 shadow-[0_0_30px_rgba(249,115,22,0.12)] space-y-2 sm:space-y-3">
                {/* Announcement Badge - Free Fire tactical theme */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-md bg-gradient-to-r from-orange-600 to-yellow-500 text-[#0c0c14] text-[8px] sm:text-[9px] tracking-[0.15em] font-black uppercase font-mono shadow-md shadow-orange-500/10">
                  <Megaphone className="w-3.5 h-3.5 text-black animate-bounce" />
                  <span>📢 BATTLE ALERT</span>
                </div>
                
                {/* Title - Epic glowing typography */}
                <h2 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-extrabold text-white uppercase tracking-wide leading-snug line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] border-b border-white/10 pb-1.5 sm:pb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-white">
                    {currentSlide.title}
                  </span>
                </h2>
                
                {/* Body Content */}
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-200 font-sans leading-relaxed line-clamp-2 md:line-clamp-3 drop-shadow-sm font-medium">
                  {currentSlide.content}
                </p>
                
                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 text-[8px] sm:text-[10px] font-mono text-orange-400/90 font-bold uppercase tracking-wider pt-1">
                  <span className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    By {currentSlide.createdBy || 'LWE Admin'}
                  </span>
                  {currentSlide.createdAt && (
                    <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                      {new Date(currentSlide.createdAt).toLocaleDateString('bn-BD', { dateStyle: 'medium' })}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Decorative Hologram crosshair details on right side for advanced gaming UI feel */}
              <div className="absolute right-12 md:right-20 lg:right-32 z-10 hidden sm:flex items-center justify-center pointer-events-none opacity-20 sm:opacity-30">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-orange-500/40 flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-dashed border-orange-500/20 flex items-center justify-center animate-spin" style={{ animationDuration: '10s' }} />
                  <div className="absolute w-6 h-0.5 bg-orange-500/40" />
                  <div className="absolute h-6 w-0.5 bg-orange-500/40" />
                </div>
              </div>
            </motion.div>
          ) : (
            // Raw Custom Manual Slide Render (Clickable/Static exactly as original)
            <motion.div
              key={currentSlide.id || activeIndex}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 w-full h-full"
            >
              {currentSlide.imageUrl ? (
                currentSlide.linkUrl ? (
                  <a
                    href={currentSlide.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0 block cursor-pointer"
                    title={`Click to view: ${currentSlide.title}`}
                  >
                    <img 
                      src={currentSlide.imageUrl} 
                      alt={currentSlide.title} 
                      className="w-full h-full object-cover object-center"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Hover Action Badge */}
                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/75 backdrop-blur-md border border-purple-500/30 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-mono text-purple-300 font-bold uppercase tracking-wider shadow-lg">
                      {getLinkIcon(currentSlide.linkUrl)}
                      <span>{getLinkButtonText(currentSlide.linkUrl)}</span>
                    </div>
                  </a>
                ) : (
                  <img 
                    src={currentSlide.imageUrl} 
                    alt={currentSlide.title} 
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c14] to-[#05050a] flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="text-center p-6 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 block">LWE Esports Active Division</span>
                    <h2 className="text-xl font-bold uppercase tracking-tight text-white">{currentSlide.title}</h2>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Slider Controls (Chevron Arrows) - Only show if there are multiple slides */}
      {finalSlides.length > 1 && (
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
            {finalSlides.map((_, idx) => (
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

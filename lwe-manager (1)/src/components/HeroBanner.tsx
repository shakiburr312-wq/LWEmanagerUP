// New file: /src/components/HeroBanner.tsx
import React, { useState, useEffect } from 'react';
import { watchSiteSettings } from '../lib/settings';
import { SiteSettings } from '../types';
import { Sparkles } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});

  useEffect(() => {
    const unsub = watchSiteSettings((data) => {
      setSiteSettings(data);
    });
    return () => unsub();
  }, []);

  const title = siteSettings.heroTitle || 'LWE ESPORTS COMMAND CENTER';
  const subtitle = siteSettings.heroSubtitle || 'Real-time roster synchronization, automated monthly stipends, and tactical campaign investments.';
  const imageUrl = siteSettings.heroImageUrl || '';

  return (
    <div className="relative bg-gradient-to-br from-[#0c0c14] to-[#06060c] border border-purple-500/10 rounded-3xl p-6 md:p-8 mb-8 overflow-hidden shadow-[0_0_30px_rgba(147,51,234,0.05)]">
      {/* Dynamic Purple Glow */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none z-0"></div>

      <style>{`
        @keyframes float-hexagon {
          0% { transform: translateY(0px) rotate(0deg); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.2)); }
          50% { transform: translateY(-12px) rotate(3deg); filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.4)); }
          100% { transform: translateY(0px) rotate(0deg); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.2)); }
        }
        .animate-float-shape {
          animation: float-hexagon 6s ease-in-out infinite;
        }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        {/* Left Text Credentials */}
        <div className="md:col-span-7 space-y-4 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-mono text-purple-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Active Esports Operations</span>
          </div>

          <h2 className="text-2xl md:text-4xl font-display font-black text-white italic uppercase tracking-tighter leading-none">
            {title.split(' ').map((word, idx) => (
              <span key={idx} className={idx % 2 === 1 ? 'text-purple-500 mr-2' : 'text-white mr-2'}>
                {word}
              </span>
            ))}
          </h2>

          <p className="text-gray-400 text-xs md:text-sm font-sans leading-relaxed max-w-xl">
            {subtitle}
          </p>
        </div>

        {/* Right Media / Graphic Showcase */}
        <div className="md:col-span-5 flex justify-center md:justify-end">
          {imageUrl ? (
            <div className="w-full max-w-[280px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
              <img 
                src={imageUrl} 
                alt="Branding Banner" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          ) : (
            /* Animated Hexagon CSS Graphic */
            <div className="relative w-44 h-44 animate-float-shape flex items-center justify-center">
              {/* Outer Hexagon with radial glow */}
              <div 
                className="w-36 h-36 bg-gradient-to-tr from-purple-600/20 to-indigo-600/10 border border-purple-500/30 flex items-center justify-center relative"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                }}
              >
                {/* Inner smaller hexagon */}
                <div 
                  className="w-28 h-28 bg-gradient-to-tr from-[#0c0c14] to-[#050507] border border-purple-500/20 flex flex-col items-center justify-center"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}
                >
                  <span className="text-amber-500 font-mono text-[9px] font-black uppercase tracking-widest">
                    LWE
                  </span>
                  <span className="text-purple-400 font-display font-black text-2xl tracking-tighter">
                    HQ
                  </span>
                </div>
              </div>
              
              {/* Spinning orbiting ring */}
              <div className="absolute inset-0 border border-dashed border-purple-500/20 rounded-full animate-spin" style={{ animationDuration: '12s' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

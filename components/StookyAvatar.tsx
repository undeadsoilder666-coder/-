
import React, { useMemo } from 'react';

interface StookyAvatarProps {
  isSpeaking: boolean;
  isConnecting: boolean;
  isThinking?: boolean;
  volume: number; // 0 to 255
}

const StookyAvatar: React.FC<StookyAvatarProps> = ({ isSpeaking, isConnecting, isThinking, volume }) => {
  // موازنة حركة الفم بناءً على مستوى الصوت
  const mouthScaleY = useMemo(() => {
    if (!isSpeaking) return 0.1;
    // تحويل مستوى الصوت (0-255) إلى مقياس طولي (0.1 - 1.5)
    return 0.1 + (volume / 255) * 1.4;
  }, [volume, isSpeaking]);

  const glowIntensity = useMemo(() => {
    if (!isSpeaking) return 0.3;
    return 0.5 + (volume / 255) * 0.5;
  }, [volume, isSpeaking]);

  return (
    <div className="relative flex flex-col items-center justify-center" dir="rtl">
      {/* هالة إشراق خلفية (Aura) */}
      <div className={`absolute w-[120%] h-[120%] rounded-full blur-[100px] transition-all duration-1000 ${
        isSpeaking ? 'bg-pink-500/20 scale-110' : isThinking ? 'bg-cyan-500/20 scale-105' : 'bg-blue-500/10 scale-100'
      }`}></div>

      {/* إطار الأفاتار الرئيسي */}
      <div className={`relative w-80 h-80 md:w-[450px] md:h-[450px] transition-all duration-700 ${isSpeaking ? 'scale-[1.03]' : 'scale-100'}`}>
        
        {/* مؤشر التفكير (حلقة سحرية حول الشخصية) */}
        <div 
          className={`absolute inset-[-20px] border-[3px] border-dashed border-cyan-400/30 rounded-full pointer-events-none transition-opacity duration-500 ${isThinking ? 'opacity-100 animate-spin-slow' : 'opacity-0'}`}
        />

        {/* جسم الأفاتار مع حركات الجسد (Gestures) */}
        <div className={`w-full h-full relative z-10 flex items-center justify-center transition-transform duration-300 ${isSpeaking ? 'animate-gestures' : 'animate-float'}`}>
          {/* صورة الأفاتار الأنثوية (ستوكي) */}
          <img 
            src="https://img.freepik.com/premium-photo/cute-smiling-girl-3d-character-design-style_1101414-257.jpg" 
            alt="أفاتار ستوكي" 
            className="w-full h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.4)] rounded-[40px]"
          />

          {/* مزامنة حركة الشفاه (Lip-Sync Overlay) */}
          <div 
            className="absolute top-[58%] left-[50.5%] -translate-x-1/2 flex items-center justify-center pointer-events-none transition-opacity duration-150"
            style={{ opacity: isSpeaking ? glowIntensity : 0 }}
          >
             <div 
               className="w-8 h-4 bg-pink-500/60 rounded-full blur-[2px] border border-white/30"
               style={{ 
                 transform: `scaleY(${mouthScaleY})`,
                 boxShadow: `0 0 ${20 * glowIntensity}px rgba(236, 72, 153, 0.8)`
               }}
             />
          </div>

          {/* أيقونة الاتصال الوردية المتوهجة */}
          <div className={`absolute top-[10%] left-[10%] p-4 bg-pink-500/20 rounded-2xl border border-pink-400/40 backdrop-blur-md shadow-2xl transition-all duration-500 ${isSpeaking ? 'animate-pulse scale-110' : 'scale-100'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-pink-400">
               <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.81 12.81 0 0 0 .62 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.62A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
        </div>
      </div>

      {/* تسمية الشخصية */}
      <div className="mt-8 flex flex-col items-center">
        <h2 className="text-6xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(236,72,153,0.4)] bg-clip-text text-transparent bg-gradient-to-b from-white via-pink-100 to-pink-400">
          Stooky
        </h2>
        <div className="flex flex-col items-center mt-3">
           {isThinking && !isSpeaking && (
             <span className="text-cyan-400 font-bold text-xs uppercase tracking-[0.5em] mb-3 animate-pulse">
               جاري التفكير...
             </span>
           )}
           <div className="flex items-center space-x-2 space-x-reverse bg-white/5 px-8 py-2.5 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl transition-all hover:bg-white/10 group">
              <span className={`w-3 h-3 rounded-full shadow-[0_0_15px_rgba(236,72,153,1)] ${isSpeaking ? 'bg-pink-500 animate-ping' : 'bg-pink-400'}`}></span>
              <span className="text-pink-200 font-bold text-xs tracking-[0.2em] group-hover:text-white transition-colors">
                ستوكي - اتصال مباشر
              </span>
           </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-15px) rotate(0.5deg); }
        }
        @keyframes gestures {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-5px, -8px) rotate(-1.5deg) scale(1.02); }
          40% { transform: translate(8px, -4px) rotate(1deg); }
          60% { transform: translate(-3px, -10px) rotate(-0.5deg) scale(1.01); }
          80% { transform: translate(4px, -6px) rotate(1.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-gestures { animation: gestures 1.8s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 10s linear infinite; }
      `}</style>
    </div>
  );
};

export default StookyAvatar;

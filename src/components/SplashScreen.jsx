import React, { useState, useEffect } from 'react';

const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    // Show splash screen every time the app loads (e.g., on page reload)
    setIsVisible(true);
    
    // Start the opening (split) animation after 1 second
    const openTimer = setTimeout(() => {
      setIsOpening(true);
    }, 1000);
    
    // Remove the component from DOM after exactly 2 seconds
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);
    
    return () => {
      clearTimeout(openTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Left Panel */}
      <div 
        className="absolute top-0 left-0 w-1/2 h-full bg-[#F2F2F7] transition-transform duration-700 ease-in-out border-r border-white/20 shadow-[10px_0_30px_rgba(0,0,0,0.05)]"
        style={{ transform: isOpening ? 'translateX(-100%)' : 'translateX(0)' }}
      ></div>
      
      {/* Right Panel */}
      <div 
        className="absolute top-0 right-0 w-1/2 h-full bg-[#F2F2F7] transition-transform duration-700 ease-in-out border-l border-white/20 shadow-[-10px_0_30px_rgba(0,0,0,0.05)]"
        style={{ transform: isOpening ? 'translateX(100%)' : 'translateX(0)' }}
      ></div>
      
      {/* Center Logo */}
      <div 
        className="z-10 flex flex-col items-center justify-center transition-all duration-700 ease-in-out"
        style={{ 
          opacity: isOpening ? 0 : 1,
          transform: isOpening ? 'scale(1.2)' : 'scale(1)'
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14 sm:w-20 sm:h-20 animate-pulse">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-800">
            Stel<span className="text-blue-500">Dot</span>
          </span>
        </div>
        <p className="text-gray-500 text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mt-1 animate-bounce">
          For Sustainable Humanity
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;

import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute w-16 h-16 rounded-full border-4 border-transparent border-t-[#06b6d4] border-r-[#06b6d4] opacity-70 animate-spin"></div>
        {/* Inner reverse spinning ring */}
        <div className="absolute w-10 h-10 rounded-full border-4 border-transparent border-b-[#3b82f6] border-l-[#3b82f6] opacity-70 animate-[spin_1s_linear_infinite_reverse]"></div>
        {/* Core glow */}
        <div className="w-4 h-4 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_15px_#10b981]"></div>
      </div>
    </div>
  );
}

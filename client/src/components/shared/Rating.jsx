import { Star } from 'lucide-react';
import { useState } from 'react';

export default function Rating({ value=0, onChange, readonly=false, size=20 }) {
  const [hover, setHover] = useState(null);
  const display = hover !== null ? hover : value;

  const handleClick = (starIdx, isHalf) => {
    if (readonly || !onChange) return;
    const newVal = isHalf ? starIdx - 0.5 : starIdx;
    onChange(newVal);
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => {
        const filled = display >= i;
        const half = display >= i - 0.5 && display < i;
        return (
          <div key={i} className="relative" onMouseLeave={() => setHover(null)}>
            {/* half hover zone */}
            {!readonly && (
              <>
                <button
                  className="absolute left-0 top-0 w-1/2 h-full z-10"
                  onMouseEnter={() => setHover(i - 0.5)}
                  onClick={() => handleClick(i, true)}
                />
                <button
                  className="absolute right-0 top-0 w-1/2 h-full z-10"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => handleClick(i, false)}
                />
              </>
            )}
            <Star
              size={size}
              className={`${filled ? 'fill-yellow-400 text-yellow-400' : half ? 'fill-yellow-400/50 text-yellow-400' : 'text-border'} ${!readonly ? 'cursor-pointer' : ''}`}
              strokeWidth={filled || half ? 0 : 1.5}
            />
            {half && <Star size={size} className="absolute inset-0 fill-yellow-400 text-yellow-400" style={{clipPath: 'inset(0 50% 0 0)'}} strokeWidth={0} />}
          </div>
        );
      })}
      <span className="ms-2 text-xs text-muted">{value ? `${value}/5` : ''}</span>
    </div>
  );
}

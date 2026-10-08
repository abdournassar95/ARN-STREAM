import { X } from 'lucide-react';

export default function Tag({ tag, onRemove, small }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'}`}
      style={{ background: `${tag.color}20`, borderColor: tag.color, color: tag.color }}
    >
      {tag.icon && <span>{tag.icon}</span>}
      {tag.name}
      {onRemove && (
        <button onClick={() => onRemove(tag)} className="ms-1 hover:bg-black/10 rounded-full p-0.5">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

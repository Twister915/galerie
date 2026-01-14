// Individual filmstrip thumbnail

import { memo } from 'preact/compat';
import type { Photo } from '../../types';
import { FILMSTRIP_THUMB_WIDTH } from '../../config';

interface FilmstripThumbProps {
  photo: Photo;
  index: number;
  isActive: boolean;
  onClick: (index: number) => void;
}

function FilmstripThumbInner({
  photo,
  index,
  isActive,
  onClick,
}: FilmstripThumbProps) {
  return (
    <div
      class={`filmstrip-thumb${isActive ? ' active' : ''}`}
      data-index={index}
      style={{
        position: 'absolute',
        left: `${index * FILMSTRIP_THUMB_WIDTH}px`,
      }}
      onClick={() => onClick(index)}
    >
      <img
        src={photo.microThumbPath}
        alt={photo.stem}
        // @ts-expect-error fetchPriority is not in types yet
        fetchpriority="low"
      />
    </div>
  );
}

export const FilmstripThumb = memo(FilmstripThumbInner);

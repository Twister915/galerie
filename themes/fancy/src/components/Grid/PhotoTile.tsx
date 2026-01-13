// Individual photo tile in the grid

import { memo } from 'preact/compat';
import type { Photo } from '../../types';

interface PhotoTileProps {
  photo: Photo;
  index: number;
  onClick: (index: number) => void;
}

function getTileSizeClass(hash: string): string {
  const value = parseInt(hash.substring(0, 2), 16);
  if (value < 25) return 'size-4x';
  if (value < 102) return 'size-2x';
  return 'size-1x';
}

function PhotoTileInner({ photo, index, onClick }: PhotoTileProps) {
  const sizeClass = getTileSizeClass(photo.hash);

  return (
    <div
      class={`photo-tile ${sizeClass}`}
      data-index={index}
      data-stem={photo.stem}
      onClick={() => onClick(index)}
    >
      <img
        src={photo.thumbPath}
        alt={photo.stem}
        loading="lazy"
        decoding="async"
        style={
          photo.width && photo.height
            ? { aspectRatio: `${photo.width} / ${photo.height}` }
            : undefined
        }
      />
    </div>
  );
}

export const PhotoTile = memo(PhotoTileInner);

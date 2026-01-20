// Individual photo tile in the grid

import { memo } from 'preact/compat';
import { simpleHash } from '../../utils/hash';
import type { Photo } from '../../types';

interface PhotoTileProps {
  photo: Photo;
  onClick: (stem: string) => void;
  sortKey: string; // Combination of sortMode + sortDirection for size variation
}

function getTileSizeClass(hash: string, sortKey: string): string {
  // Combine photo hash with sort key to get deterministic but varied sizes per sort
  const combined = simpleHash(hash + sortKey);
  const value = combined % 256;
  if (value < 25) return 'size-4x';
  if (value < 102) return 'size-2x';
  return 'size-1x';
}

function PhotoTileInner({ photo, onClick, sortKey }: PhotoTileProps) {
  const sizeClass = getTileSizeClass(photo.hash, sortKey);

  return (
    <div
      class={`photo-tile ${sizeClass}`}
      data-stem={photo.stem}
      onClick={() => onClick(photo.stem)}
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

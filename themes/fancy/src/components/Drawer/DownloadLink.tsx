// Download link component

import { formatBytes } from '../../utils/format';

interface DownloadLinkProps {
  href: string;
  size: number;
  label: string;
}

export function DownloadLink({ href, size, label }: DownloadLinkProps) {
  return (
    <a href={href} class="download-link" download>
      {label} ({formatBytes(size)})
    </a>
  );
}

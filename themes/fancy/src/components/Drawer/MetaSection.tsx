// Metadata section wrapper

import type { ComponentChildren } from 'preact';

interface MetaSectionProps {
  title: string;
  children: ComponentChildren;
}

export function MetaSection({ title, children }: MetaSectionProps) {
  return (
    <div class="meta-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

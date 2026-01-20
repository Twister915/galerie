// Shared dropdown behavior hook

import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { RefObject } from 'preact';

interface UseDropdownOptions {
  id: string;
  onClose?: () => void;
  onScroll?: () => void;
}

interface UseDropdownReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  containerRef: RefObject<HTMLDivElement>;
  triggerRef: RefObject<HTMLButtonElement>;
  handleTriggerClick: (e: MouseEvent) => void;
}

export function useDropdown(options: UseDropdownOptions): UseDropdownReturn {
  const { id, onClose, onScroll } = options;
  const [open, setOpenInternal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpenInternal(false);
    onClose?.();
  }, [onClose]);

  const setOpen = useCallback(
    (value: boolean) => {
      if (!value && open) {
        onClose?.();
      }
      setOpenInternal(value);
    },
    [open, onClose]
  );

  // Broadcast when this dropdown opens (for mutual exclusion)
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('dropdown:open', { detail: id }));
    }
  }, [open, id]);

  // Close when another dropdown opens
  useEffect(() => {
    function handleOtherOpen(e: Event) {
      const event = e as CustomEvent<string>;
      if (event.detail !== id && open) {
        close();
      }
    }

    window.addEventListener('dropdown:open', handleOtherOpen);
    return () => window.removeEventListener('dropdown:open', handleOtherOpen);
  }, [id, open, close]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [close]);

  // Close on Escape
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [open, close]);

  // Close on scroll
  useEffect(() => {
    function handleScroll() {
      onScroll?.();
      if (open) close();
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open, close, onScroll]);

  const handleTriggerClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setOpenInternal((prev) => !prev);
  }, []);

  return {
    open,
    setOpen,
    close,
    containerRef,
    triggerRef,
    handleTriggerClick,
  };
}

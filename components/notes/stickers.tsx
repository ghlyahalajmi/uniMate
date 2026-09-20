'use client';

import type { StickerKey } from '@/lib/notes/design';

/**
 * The sticker sheet.
 *
 * Drawn rather than emoji: an emoji is a different picture on every phone, and
 * half of them do not sit on a coloured note without a white box around them.
 * These are flat shapes on a 24-grid with their own colours, so a note looks
 * the same to the student who made it and to nobody else, because nobody else
 * sees it.
 */
export function Sticker({ k, size = 28 }: { k: StickerKey; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    style: { display: 'block' },
  };

  switch (k) {
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 2.8 14.9 9l6.8.8-5 4.6 1.4 6.7L12 17.7 5.9 21.1l1.4-6.7-5-4.6L9.1 9 12 2.8Z" fill="#f0b429" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 21s-7.5-4.6-9.2-9.3C1.6 8.4 3.6 5 7.1 5c2 0 3.6 1.1 4.9 2.8C13.3 6.1 14.9 5 16.9 5c3.5 0 5.5 3.4 4.3 6.7C19.5 16.4 12 21 12 21Z" fill="#e1557f" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...common}>
          <path d="M13 2.5c3.4 3.4 5.9 6 5.9 10.1A6.9 6.9 0 0 1 12 21.5a6.9 6.9 0 0 1-6.9-8.9c.4 1 1.2 1.8 2.3 2 0-3.4 1.6-5.9 5.6-12.1Z" fill="#ef7a3d" />
          <path d="M12.4 12.2c1.7 1.8 2.8 3 2.8 4.6a3.2 3.2 0 0 1-6.4 0c0-1.5 1.1-2.8 3.6-4.6Z" fill="#f4c542" />
        </svg>
      );
    case 'bulb':
      return (
        <svg {...common}>
          <path d="M12 2.5A6.5 6.5 0 0 0 8 14.2V16h8v-1.8A6.5 6.5 0 0 0 12 2.5Z" fill="#f4c542" />
          <path d="M9 17.5h6M10 20h4" stroke="#8a6a1f" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'coffee':
      return (
        <svg {...common}>
          <path d="M4 8h13v6.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5V8Z" fill="#8b5e3c" />
          <path d="M17 9.5h1.8a2.2 2.2 0 1 1 0 4.4H17" stroke="#8b5e3c" strokeWidth="1.8" fill="none" />
          <path d="M7.5 3.5c-.8 1 .8 1.8 0 2.8M11 3.5c-.8 1 .8 1.8 0 2.8" stroke="#b08b6a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill="#2f9e6e" />
          <path d="m7.5 12.4 3 3 6-6.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-6-4.5L6 21V3Z" fill="#6354e8" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 2.5c.9 4.6 2 5.7 6.6 6.6-4.6.9-5.7 2-6.6 6.6-.9-4.6-2-5.7-6.6-6.6 4.6-.9 5.7-2 6.6-6.6Z" fill="#8b80f0" />
          <path d="M18.5 15c.5 2.4 1 3 3.5 3.5-2.4.5-3 1-3.5 3.5-.5-2.4-1-3-3.5-3.5 2.4-.5 3-1 3.5-3.5Z" fill="#b3abf6" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill="#3b82c4" />
          <path d="M12 6.8V12l3.4 2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M20 4c0 9-5 13-11 13-2 0-3.5-.6-3.5-.6S7 5.5 20 4Z" fill="#4caf7d" />
          <path d="M4 21c2.5-5 6-8.5 10.5-11" stroke="#2f7a56" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'exam':
      return (
        <svg {...common}>
          <rect x="4.5" y="3" width="15" height="18" rx="2.2" fill="#e8e6fb" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke="#6354e8" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18" cy="18" r="4.4" fill="#e1557f" />
          <path d="m16.1 18.2 1.3 1.3 2.5-2.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'smile':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill="#f0b429" />
          <circle cx="9" cy="10" r="1.4" fill="#5a4410" />
          <circle cx="15" cy="10" r="1.4" fill="#5a4410" />
          <path d="M8 14.2a4.6 4.6 0 0 0 8 0" stroke="#5a4410" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    default:
      return null;
  }
}

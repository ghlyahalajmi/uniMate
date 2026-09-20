'use client';

import type { StickerKey } from '@/lib/notes/design';

/**
 * The sticker sheet.
 *
 * Drawn rather than emoji: an emoji is a different picture on every phone, and
 * half of them arrive in a white box that sits badly on coloured paper. These
 * are flat shapes on a 24-grid with their own colours.
 *
 * The art is a `Record` keyed by the sticker list rather than a switch, so
 * adding a key without drawing it is a type error instead of a blank square on
 * somebody's note.
 */
const ART: Record<StickerKey, React.ReactNode> = {
  star: (
    <path d="M12 2.8 14.9 9l6.8.8-5 4.6 1.4 6.7L12 17.7 5.9 21.1l1.4-6.7-5-4.6L9.1 9 12 2.8Z" fill="#f0b429" />
  ),
  heart: (
    <path d="M12 21s-7.5-4.6-9.2-9.3C1.6 8.4 3.6 5 7.1 5c2 0 3.6 1.1 4.9 2.8C13.3 6.1 14.9 5 16.9 5c3.5 0 5.5 3.4 4.3 6.7C19.5 16.4 12 21 12 21Z" fill="#e1557f" />
  ),
  flame: (
    <>
      <path d="M13 2.5c3.4 3.4 5.9 6 5.9 10.1A6.9 6.9 0 0 1 12 21.5a6.9 6.9 0 0 1-6.9-8.9c.4 1 1.2 1.8 2.3 2 0-3.4 1.6-5.9 5.6-12.1Z" fill="#ef7a3d" />
      <path d="M12.4 12.2c1.7 1.8 2.8 3 2.8 4.6a3.2 3.2 0 0 1-6.4 0c0-1.5 1.1-2.8 3.6-4.6Z" fill="#f4c542" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 2.5A6.5 6.5 0 0 0 8 14.2V16h8v-1.8A6.5 6.5 0 0 0 12 2.5Z" fill="#f4c542" />
      <path d="M9 17.5h6M10 20h4" stroke="#8a6a1f" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h13v6.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5V8Z" fill="#8b5e3c" />
      <path d="M17 9.5h1.8a2.2 2.2 0 1 1 0 4.4H17" stroke="#8b5e3c" strokeWidth="1.8" fill="none" />
      <path d="M7.5 3.5c-.8 1 .8 1.8 0 2.8M11 3.5c-.8 1 .8 1.8 0 2.8" stroke="#b08b6a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#2f9e6e" />
      <path d="m7.5 12.4 3 3 6-6.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4.5L6 21V3Z" fill="#6354e8" />,
  sparkle: (
    <>
      <path d="M12 2.5c.9 4.6 2 5.7 6.6 6.6-4.6.9-5.7 2-6.6 6.6-.9-4.6-2-5.7-6.6-6.6 4.6-.9 5.7-2 6.6-6.6Z" fill="#8b80f0" />
      <path d="M18.5 15c.5 2.4 1 3 3.5 3.5-2.4.5-3 1-3.5 3.5-.5-2.4-1-3-3.5-3.5 2.4-.5 3-1 3.5-3.5Z" fill="#b3abf6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#3b82c4" />
      <path d="M12 6.8V12l3.4 2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4c0 9-5 13-11 13-2 0-3.5-.6-3.5-.6S7 5.5 20 4Z" fill="#4caf7d" />
      <path d="M4 21c2.5-5 6-8.5 10.5-11" stroke="#2f7a56" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  exam: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.2" fill="#e8e6fb" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#6354e8" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="18" cy="18" r="4.4" fill="#e1557f" />
      <path d="m16.1 18.2 1.3 1.3 2.5-2.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#f0b429" />
      <circle cx="9" cy="10" r="1.4" fill="#5a4410" />
      <circle cx="15" cy="10" r="1.4" fill="#5a4410" />
      <path d="M8 14.2a4.6 4.6 0 0 0 8 0" stroke="#5a4410" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),

  pin: (
    <>
      <circle cx="12" cy="8.5" r="5.2" fill="#e1557f" />
      <circle cx="10.3" cy="7" r="1.6" fill="#f2a8bf" />
      <path d="M12 13.8V21" stroke="#8a2d47" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.6A1.6 1.6 0 0 1 5.6 3H19.5v18H5.6A1.6 1.6 0 0 1 4 19.4V4.6Z" fill="#3b82c4" />
      <path d="M8 3v18" stroke="#1f4f7d" strokeWidth="1.7" />
      <path d="M11 8h5.5M11 11.5h5.5" stroke="#cfe3f6" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  pencil: (
    <>
      <path d="M5.4 15.6 15.3 5.7l3 3-9.9 9.9-3-3Z" fill="#f4c542" />
      <path d="m16.4 4.6 1.2-1.2a2.1 2.1 0 0 1 3 3l-1.2 1.2-3-3Z" fill="#e08a3c" />
      <path d="m5.4 15.6 3 3L3.6 20.4l1.8-4.8Z" fill="#5a4410" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3.5h10V9a5 5 0 0 1-10 0V3.5Z" fill="#f0b429" />
      <path d="M17 5h2.6a2.6 2.6 0 0 1-2.6 4.6M7 5H4.4A2.6 2.6 0 0 0 7 9.6" stroke="#f0b429" strokeWidth="1.7" fill="none" />
      <path d="M12 14v3.6" stroke="#8a6a1f" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M8 21h8l-.8-3H8.8L8 21Z" fill="#8a6a1f" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2.4c3.3 2.7 5.1 6.4 5.1 10.5l-2.3 3.7H9.2L6.9 12.9C6.9 8.8 8.7 5.1 12 2.4Z" fill="#dfe5f0" />
      <circle cx="12" cy="10" r="2.2" fill="#3b82c4" />
      <path d="M6.9 13.4 4 17.2l3.6-.8ZM17.1 13.4 20 17.2l-3.6-.8Z" fill="#e1557f" />
      <path d="M10.2 17.6c.5 2.1 1.8 4 1.8 4s1.3-1.9 1.8-4Z" fill="#ef7a3d" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#e1557f" />
      <circle cx="12" cy="12" r="6" fill="#fdf1f4" />
      <circle cx="12" cy="12" r="2.8" fill="#e1557f" />
    </>
  ),
  crown: (
    <>
      <path d="M2.8 7.6 7.2 11.4 12 4.6l4.8 6.8 4.4-3.8L19.4 18H4.6L2.8 7.6Z" fill="#f0b429" />
      <path d="M5.4 20.6h13.2" stroke="#8a6a1f" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  music: (
    <>
      <path d="M9.4 18.2V6.4l9.2-2v11" stroke="#6354e8" strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <circle cx="7.1" cy="18.2" r="2.7" fill="#6354e8" />
      <circle cx="16.3" cy="15.4" r="2.7" fill="#6354e8" />
    </>
  ),
  moon: (
    <>
      <path d="M20.4 14.8A8.6 8.6 0 0 1 9.2 3.6a8.6 8.6 0 1 0 11.2 11.2Z" fill="#8b80f0" />
      <circle cx="18.6" cy="5.4" r="1.4" fill="#f4c542" />
    </>
  ),
  flower: (
    <>
      <g fill="#e1557f">
        <circle cx="12" cy="6.6" r="3.3" />
        <circle cx="17.3" cy="10.4" r="3.3" />
        <circle cx="15.3" cy="16.6" r="3.3" />
        <circle cx="8.7" cy="16.6" r="3.3" />
        <circle cx="6.7" cy="10.4" r="3.3" />
      </g>
      <circle cx="12" cy="12" r="2.9" fill="#f4c542" />
    </>
  ),
  palm: (
    <>
      <path d="M12.2 21c-.2-5 .3-8.4 1.6-11" stroke="#8b5e3c" strokeWidth="2.1" strokeLinecap="round" fill="none" />
      <g fill="#2f9e6e">
        <ellipse cx="9.4" cy="7.6" rx="4.6" ry="1.9" transform="rotate(-24 9.4 7.6)" />
        <ellipse cx="17.6" cy="8.4" rx="4.6" ry="1.9" transform="rotate(22 17.6 8.4)" />
        <ellipse cx="12.4" cy="5.4" rx="4.3" ry="1.8" transform="rotate(-72 12.4 5.4)" />
        <ellipse cx="14.6" cy="11" rx="4.3" ry="1.7" transform="rotate(62 14.6 11)" />
      </g>
      <circle cx="13.4" cy="8.6" r="1.5" fill="#f0b429" />
    </>
  ),
  laptop: (
    <>
      <rect x="5.6" y="5" width="12.8" height="9.2" rx="1.2" fill="#3b4a66" />
      <rect x="7" y="6.3" width="10" height="6.6" rx="0.6" fill="#9fc3e8" />
      <path d="M3.2 16h17.6l-1.1 2.4H4.3L3.2 16Z" fill="#6b7589" />
    </>
  ),
};

export function Sticker({ k, size = 28 }: { k: StickerKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {ART[k]}
    </svg>
  );
}

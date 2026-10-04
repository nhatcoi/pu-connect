import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="24" fill="#0B3D91" />
        <path d="M32 34V56a18 18 0 0 0 36 0V34" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
        <path d="M32 34Q50 8 68 34" fill="none" stroke="#F7941D" strokeWidth="6" strokeLinecap="round" />
        <circle cx="32" cy="34" r="7" fill="#fff" />
        <circle cx="68" cy="34" r="7" fill="#fff" />
        <circle cx="50" cy="19" r="5.5" fill="#F7941D" />
      </svg>
    ),
    {
      ...size,
    },
  );
}

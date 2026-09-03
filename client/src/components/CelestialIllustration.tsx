import React from "react";
/** Decorative geometry, deliberately not presented as a calculated client chart. */
export default function CelestialIllustration() {
  return <svg viewBox="0 0 400 400" aria-hidden="true" className="mx-auto w-full max-w-[330px] text-[#e6c891]" fill="none">
    <circle cx="200" cy="200" r="174" stroke="currentColor" strokeOpacity=".28" />
    <circle cx="200" cy="200" r="158" stroke="currentColor" strokeOpacity=".65" />
    <circle cx="200" cy="200" r="122" stroke="currentColor" strokeOpacity=".35" />
    {Array.from({ length: 72 }, (_, i) => <line key={i} x1="200" y1="26" x2="200" y2={i % 6 === 0 ? "40" : "32"} stroke="currentColor" strokeOpacity={i % 6 === 0 ? ".8" : ".35"} transform={`rotate(${i * 5} 200 200)`} />)}
    <path d="M200 78 322 200 200 322 78 200Z M114 114H286V286H114Z" stroke="currentColor" strokeOpacity=".5" />
    <path d="M200 78V322M78 200H322" stroke="currentColor" strokeOpacity=".2" />
    <circle cx="200" cy="200" r="45" fill="#28231f" stroke="currentColor" strokeOpacity=".8" />
    <circle cx="200" cy="200" r="27" stroke="currentColor" />
    <path d="M200 160V173M200 227V240M160 200H173M227 200H240M171 171 180 180M220 220 229 229M171 229 180 220M220 180 229 171" stroke="currentColor" />
    {[30, 120, 210, 300].map(angle => <circle key={angle} cx="200" cy="78" r="5" fill="#e6c891" transform={`rotate(${angle} 200 200)`} />)}
  </svg>;
}

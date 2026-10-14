/* ================================================================
   共有インラインSVGアイコンスプライト。姉妹サイト（emote/share/
   tai-nomacan/star-candle等）で使われている #pf-icon-sprite と
   同一のsymbol定義を移植（サブセット：ハブとitem機能で実際に
   使うものだけ）。<use href="#i-xxx"/> で参照する。
   ================================================================ */

const SPRITE_HTML = `
<svg id="pf-icon-sprite" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="i-folder" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M18 6 6 18"/> <path d="m6 6 12 12"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><path d="m21 21-4.34-4.34"/> <circle cx="11" cy="11" r="8"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/></symbol>
<symbol id="i-warning" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/> <path d="M12 9v4"/> <path d="M12 17h.01"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/> <path d="m15 5 4 4"/></symbol>
<symbol id="i-candle" viewBox="0 0 24 24"><path d="M9.5 21h5a1 1 0 0 0 1-1v-7.5a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3V20a1 1 0 0 0 1 1Z"/><path d="M12 9.5V5M10.3 5.2C10.3 3.7 12 3.5 12 2c0 1.5 1.7 1.7 1.7 3.2 0 .9-.75 1.3-1.7 1.3s-1.7-.4-1.7-1.3Z"/></symbol>
<symbol id="i-star-candle" viewBox="0 0 24 24"><path d="M9.5 21h5a1 1 0 0 0 1-1v-7.5a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3V20a1 1 0 0 0 1 1Z"/><path d="M12 9.5V5M10.3 5.2C10.3 3.7 12 3.5 12 2c0 1.5 1.7 1.7 1.7 3.2 0 .9-.75 1.3-1.7 1.3s-1.7-.4-1.7-1.3Z"/><path fill="currentColor" stroke="none" d="M18 4.7L18.7 6.3L20.3 7L18.7 7.7L18 9.3L17.3 7.7L15.7 7L17.3 6.3Z"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></symbol>
<symbol id="i-masks" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/><path d="M9 10v.01M15 10v.01"/><path d="M8.5 14.5q3.5 3 7 0"/></g></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/> <circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/> <path d="M20 2v4"/> <path d="M22 4h-4"/> <circle cx="4" cy="20" r="2"/></symbol>
<symbol id="i-wing" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.281) translate(-10.5 -12.83)"><path d="M4 19c2-6 6-11 13-13-1 6-2 9-6 12-3 2-5 2-7 1Z"/><path d="M7 17c3-2 6-5 8-9"/></g></symbol>
<symbol id="i-music-note" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/> <circle cx="6" cy="18" r="3"/> <circle cx="18" cy="16" r="3"/></symbol>
<symbol id="i-card" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/> <line x1="2" x2="22" y1="10" y2="10"/> <path d="M6 14h2"/></symbol>
<symbol id="i-sync" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/> <path d="M21 3v5h-5"/> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/> <path d="M8 16H3v5"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/> <circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-person" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/> <circle cx="12" cy="7" r="4"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M3 9h18"/> <path d="M3 15h18"/> <path d="M9 3v18"/> <path d="M15 3v18"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 5h16"/> <path d="M4 12h16"/> <path d="M4 19h16"/></symbol>
<symbol id="i-sheet-music" viewBox="0 0 24 24"><path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 10h8M8 13h8M8 16h5"/></symbol>
<symbol id="i-hanger" viewBox="0 0 24 24"><path d="M12 4.2a1.8 1.8 0 1 0-1.8 1.8"/><path d="M12 6v1.6"/><path d="M3.5 17.5 12 11l8.5 6.5"/><path d="M3.5 17.5h17"/></symbol>
<symbol id="i-monitor" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/> <line x1="8" x2="16" y1="21" y2="21"/> <line x1="12" x2="12" y1="17" y2="21"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></symbol>
<symbol id="i-crown" viewBox="0 0 24 24"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/> <path d="M5 21h14"/></symbol>
<symbol id="i-map" viewBox="0 0 24 24"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/> <path d="M15 5.764v15"/> <path d="M9 3.236v15"/></symbol>
<symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/></symbol>
<symbol id="i-palette" viewBox="0 0 24 24"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/> <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></symbol>
<symbol id="i-dice" viewBox="0 0 24 24"><rect width="12" height="12" x="2" y="10" rx="2" ry="2"/> <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/> <path d="M6 18h.01"/> <path d="M10 14h.01"/> <path d="M15 6h.01"/> <path d="M18 9h.01"/></symbol>
<symbol id="i-image" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/> <circle cx="9" cy="9" r="2"/> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></symbol>
<symbol id="i-gem" viewBox="0 0 24 24"><path d="M10.5 3 8 9l4 13 4-13-2.5-6"/> <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/> <path d="M2 9h20"/></symbol>
<symbol id="i-building" viewBox="0 0 24 24"><path d="M12 10h.01"/> <path d="M12 14h.01"/> <path d="M12 6h.01"/> <path d="M16 10h.01"/> <path d="M16 14h.01"/> <path d="M16 6h.01"/> <path d="M8 10h.01"/> <path d="M8 14h.01"/> <path d="M8 6h.01"/> <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/> <rect x="4" y="2" width="16" height="20" rx="2"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M10 11v6"/> <path d="M14 11v6"/> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/> <path d="M3 6h18"/> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 3v12"/> <path d="m17 8-5-5-5 5"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></symbol>
<symbol id="i-cart" viewBox="0 0 24 24"><path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/> <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/> <circle cx="18" cy="20" r="2"/> <circle cx="8" cy="20" r="2"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M9.5 9.5A1.5 1.5 0 0 1 11 8h6.5A1.5 1.5 0 0 1 19 9.5V16a1.5 1.5 0 0 1-1.5 1.5H11A1.5 1.5 0 0 1 9.5 16Z"/><path d="M6.5 14.5H6A1.5 1.5 0 0 1 4.5 13V6.5A1.5 1.5 0 0 1 6 5h6.5A1.5 1.5 0 0 1 14 6.5v.5"/></g></symbol>
<symbol id="i-tree" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 3l4 5.5h-2.6L17 13h-3.2l3.4 5H16v3h-8v-3h2.8l3.4-5H10.6l3.6-4.5H12Z"/><path d="M12 21v-2.5"/></g></symbol>
<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/> <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/> <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/> <path d="M4 22h16"/> <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/> <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></symbol>
<symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-chevron-left" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
<symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
</defs></svg>`;

let injected = false;
export function injectIconSprite() {
  if (injected) return;
  document.body.insertAdjacentHTML('afterbegin', SPRITE_HTML);
  injected = true;
}

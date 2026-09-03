/* ==========================================================================
   מערכת האייקונים
   --------------------------------------------------------------------------
   קווי מתאר על רשת 24, currentColor, ללא אימוג'ים. הסט והגישה נלקחו
   ממערכת הרכיבים של "פורטל שירותים ממשלתי אחיד" — נשמרו רק האייקונים
   שהמרשם משתמש בהם.

   שני אופני שימוש:
     ICONS.svg("search")     — מחרוזת SVG, לשימוש בתוך רינדור
     <span data-icon="search"> — מוזרק אוטומטית בטעינת הדף
   ========================================================================== */

window.ICONS = (function () {
  "use strict";

  const PATHS = {
    search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/>',
    award:    '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7 5-3 5 3-1.5-7"/>',
    flag:     '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    shield:   '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/>',
    sliders:  '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    doc:      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    whistle:  '<circle cx="8.5" cy="14" r="5.5"/><path d="M12.5 10.5 20 6v4l-6 3"/><path d="M8.5 11.5v2.5H11"/>',
    searchx:  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="m9 9 4 4M13 9l-4 4"/>',
    chevdown: '<path d="m6 9 6 6 6-6"/>',
    idcard:   '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.2 1.7-1.8 3-1.8s2.4.6 3 1.8M14 10h4M14 13.5h3"/>',
    filterx:  '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>'
  };

  function svg(name, size) {
    const d = PATHS[name];
    if (!d) return "";
    const s = size || 20;
    return `<svg class="ic-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${d}</svg>`;
  }

  /** מזריק אייקון לכל אלמנט עם data-icon, לפני התוכן הקיים */
  function hydrate(root = document) {
    root.querySelectorAll("[data-icon]").forEach(el => {
      const size = el.dataset.iconSize ? Number(el.dataset.iconSize) : 20;
      el.insertAdjacentHTML("afterbegin", svg(el.dataset.icon, size));
    });
  }

  document.addEventListener("DOMContentLoaded", () => hydrate());

  return { svg, hydrate };
})();

/* ==========================================================================
   מרשם מאמנים — לוגיקת האתר (גרסת Figma)
   --------------------------------------------------------------------------
   הלוגיקה זהה לגרסת הבסיס: שני מסלולי חיפוש, בדיוק לפי סעיף 3.4.

     מסלול א׳ — שם:   שם פרטי + שם משפחה, שניהם חובה יחדיו,
                      לפחות 2 תווים בכל אחד, חיפוש מוכל (contains).
     מסלול ב׳ — מזהה: ת"ז / נייד / דוא"ל, התאמה מדויקת (exact).

   הדרישה ששני שדות השם חובה יחדיו אינה נוחות — היא מה שמונע שליפת
   רשימות מהמרשם. הצירוף מחייב את המחפש לדעת את מי הוא מחפש.

   מבנה:
     1. ולידציה        — כללי סעיף 3.4
     2. חיפוש
     3. סינון תוצאות   — סעיף 3.5.2
     4. עיבוד תשובה    — הגבול שדרכו נתונים עוברים לתצוגה
     5. רינדור
     6. חיווט
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  /**
   * raw — הרשומות הגולמיות שהחיפוש החזיר (null = טרם בוצע חיפוש).
   * נשמרות גולמיות כי הסינון בטלפון ובדוא"ל נבדק מול השדות האמיתיים,
   * שאינם עוברים לשכבת התצוגה.
   */
  const state = {
    raw: null,
    filters: { sport: "", rank: "", mobile: "", email: "" }
  };

  const onlyDigits = s => String(s).replace(/[-\s]/g, "");
  const normalize  = s => (s || "").trim().replace(/\s+/g, " ").replace(/['׳']/g, "׳");

  /* ======================================================================
     1. ולידציה — סעיף 3.4
     ====================================================================== */

  const validators = {
    name(value, label) {
      if (!value) return `יש להזין ${label}`;
      if (value.length < 2) return `${label} חייב להכיל לפחות 2 תווים`;
      return null;
    },
    id(value) {
      if (!value) return "יש להזין מספר תעודת זהות";
      return /^\d{9}$/.test(onlyDigits(value))
        ? null : "מספר תעודת זהות חייב להכיל בדיוק 9 ספרות";
    },
    mobile(value) {
      if (!value) return "יש להזין מספר טלפון נייד";
      const d = onlyDigits(value);
      if (!/^\d{10}$/.test(d)) return "מספר טלפון נייד חייב להכיל 10 ספרות";
      return MOBILE_PREFIXES.includes(d.slice(0, 3))
        ? null
        : "קידומת סלולרית לא תקינה. קידומות מותרות: " + MOBILE_PREFIXES.join(", ");
    },
    email(value) {
      if (!value) return "יש להזין כתובת דואר אלקטרוני";
      return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)
        ? null : "כתובת דואר אלקטרוני אינה בפורמט תקין (לדוגמה: name@domain.com)";
    }
  };

  function setError(input, errSel, message) {
    const el = $(errSel);
    if (message) {
      input.setAttribute("aria-invalid", "true");
      el.textContent = message;
    } else {
      input.removeAttribute("aria-invalid");
      el.textContent = "";
    }
    return !message;
  }

  /* ======================================================================
     2. חיפוש
     ====================================================================== */

  /** מסלול א׳ — מוכל, על שני השדות יחד */
  function searchByName(first, last) {
    const f = normalize(first), l = normalize(last);
    return MOCK_RECORDS.filter(r =>
      normalize(r.FirstName).includes(f) && normalize(r.LastName).includes(l));
  }

  /** מסלול ב׳ — התאמה מדויקת */
  function searchByIdentifier(type, value) {
    const v = normalize(value);
    if (type === "email") {
      return MOCK_RECORDS.filter(r =>
        String(r.PersonEmail).toLowerCase() === v.toLowerCase());
    }
    const field = { id: "Id_Number__pc", mobile: "PersonMobilePhone" }[type];
    const needle = onlyDigits(v);
    return MOCK_RECORDS.filter(r => String(r[field]) === needle);
  }

  /* ======================================================================
     3. סינון תוצאות — סעיף 3.5.2
     ----------------------------------------------------------------------
     ענף ודרגה מצמצמים את ההסמכות המוצגות. טלפון ודוא"ל אינם מסלולי
     חיפוש כאן אלא כלי איתור: הם מצמצמים רשימת מאמנים בעלי שם זהה
     למאמן אחד מדויק, נבדקים מול הרשומה הגולמית, ואינם מגיעים לתצוגה.

     מחזיר [{ record, auths }] כדי שמניין "ההסמכות הרשומות" יישאר
     המספר המלא ולא ישתנה לפי הסינון (סעיף 3.5.1).
     ====================================================================== */

  function applyFilters(records) {
    const { sport, rank, mobile, email } = state.filters;
    const mNeedle = onlyDigits(mobile).trim();
    const eNeedle = email.trim().toLowerCase();

    return records
      .filter(r => !mNeedle || String(r.PersonMobilePhone) === mNeedle)
      .filter(r => !eNeedle || String(r.PersonEmail).toLowerCase() === eNeedle)
      .map(r => ({
        record: r,
        auths: r.authorizations.filter(a =>
          (!sport || a.businessType === sport) && (!rank || a.rank === rank))
      }))
      .filter(x => x.auths.length > 0);
  }

  function populateSportFilter(records) {
    const sports = [...new Set(records.flatMap(r => r.authorizations.map(a => a.businessType)))]
      .sort((a, b) => a.localeCompare(b, "he"));
    $("#filter-sport").innerHTML = '<option value="">כל הענפים</option>' +
      sports.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  /* ======================================================================
     4. עיבוד תשובה — חסימת פרטים אישיים (סעיף 3.5.1 + סעיף 4)
     ----------------------------------------------------------------------
     זהו הגבול היחיד שדרכו נתונים עוברים לשכבת התצוגה. הוא מעתיק
     במפורש רק שם, הסמכות ומזהה ממוסך — כך שאי אפשר להדליף שדה
     בטעות דרך שינוי ברינדור.

     חריג מכוון: 4 הספרות האחרונות של ת"ז, לצורך הבחנה בין מאמנים
     בעלי שם זהה. המספר המלא לעולם אינו מגיע לתצוגה.
     בפרודקשן המיסוך חייב להתבצע בשרת — כאן זו הגנת עומק בלבד.
     ====================================================================== */

  const maskId = n => {
    const d = String(n);
    return "•".repeat(Math.max(0, d.length - 4)) + d.slice(-4);
  };

  /** ראשי תיבות לעיגול שבראש הכרטיס */
  const initials = (first, last) =>
    (first.trim()[0] || "") + (last.trim()[0] || "");

  function toPublicView({ record, auths }) {
    return {
      firstName: record.FirstName,
      lastName:  record.LastName,
      maskedId:  maskId(record.Id_Number__pc),
      initials:  initials(record.FirstName, record.LastName),
      totalAuthorizations: record.authorizations.length,
      authorizations: auths.map(a => ({ sport: a.businessType, rank: a.rank }))
    };
  }

  /* ======================================================================
     5. רינדור
     ====================================================================== */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderCoach(c, i) {
    const shown = c.authorizations.length;
    const total = c.totalAuthorizations;
    const name  = `${c.firstName} ${c.lastName}`;
    const hid   = `coach-${i}`;

    const count = shown === total
      ? `${total} ${total === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}`
      : `מוצגות ${shown} מתוך ${total} הסמכות רשומות`;

    const rows = c.authorizations.map(a => `
      <li class="auth">
        <span class="auth__ic" data-icon="whistle" data-icon-size="18" aria-hidden="true"></span>
        <span class="auth__s">${esc(a.sport)}</span>
        <span class="rank" data-rank="${esc(a.rank)}">${esc(a.rank)}</span>
      </li>`).join("");

    return `
      <article class="coach" aria-labelledby="${hid}">
        <header class="coach__head">
          <span class="coach__av" aria-hidden="true">${esc(c.initials)}</span>
          <span class="coach__tx">
            <span class="coach__n" id="${hid}">${esc(name)}</span>
            <span class="coach__id">ת״ז <bdi>${esc(c.maskedId)}</bdi><span class="sr-only">
              — מוצגות ארבע הספרות האחרונות בלבד</span></span>
          </span>
        </header>
        <p class="coach__cnt" id="${hid}-cnt">${count}</p>
        <ul class="coach__list" aria-labelledby="${hid}-cnt">${rows}</ul>
      </article>`;
  }

  const renderEmpty = (title, body) => `
    <div class="empty">
      <span class="empty__ic" data-icon="searchx" data-icon-size="34" aria-hidden="true"></span>
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
    </div>`;

  /**
   * מיקום בלוק הנתונים.
   * לפני חיפוש הוא יושב בין החיפוש לתוצאות; ברגע שיש תוצאות הוא יורד
   * אל מתחתן, כדי שלא יחצוץ בין החיפוש לתוצאה שלו.
   *
   * ההזזה היא של הצומת עצמו ולא רק ויזואלית (order), כדי שסדר ה-DOM,
   * סדר הקריאה בקורא מסך והסדר הנראה יישארו זהים.
   */
  function placeFigures(hasResults) {
    const figs = $("#figures-slot");
    const res  = $("#results-slot");
    if (!figs || !res || !res.parentNode) return;

    const isAfter = res.compareDocumentPosition(figs) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (hasResults && !isAfter)      res.parentNode.insertBefore(figs, res.nextSibling);
    else if (!hasResults && isAfter) res.parentNode.insertBefore(figs, res);
  }

  function render() {
    const section = $("#results");
    const grid    = $("#results-grid");
    const filt    = $("#filter-bar");
    const status  = $("#results-status");
    const info    = $("#disclaimer");

    if (state.raw === null) {
      section.hidden = true; filt.hidden = true;
      placeFigures(false);
      return;
    }
    section.hidden = false;

    if (state.raw.length === 0) {
      filt.hidden = true;
      info.hidden = true;
      $("#results-count").textContent = "";
      grid.innerHTML = renderEmpty(
        "לא נמצאו תוצאות",
        "לא נמצא מאמן התואם לפרטים שהוזנו. יש לוודא אותם ולנסות שוב."
      );
      ICONS.hydrate(grid);
      placeFigures(true);
      status.textContent = "החיפוש הסתיים. לא נמצאו תוצאות.";
      return;
    }

    info.hidden = false;
    // הסינון מוצג רק כשיש יותר מתוצאה אחת (סעיף 3.5.2)
    filt.hidden = state.raw.length <= 1;

    const visible = applyFilters(state.raw).map(toPublicView);

    $("#results-count").innerHTML = visible.length === state.raw.length
      ? `נמצאו <strong>${visible.length}</strong> ${visible.length === 1 ? "מאמן" : "מאמנים"}:`
      : `מוצגים <strong>${visible.length}</strong> מתוך <strong>${state.raw.length}</strong> מאמנים:`;

    grid.innerHTML = visible.length === 0
      ? renderEmpty(
          "אין תוצאות התואמות לסינון",
          "לא נמצא מאמן התואם לערכים שנבחרו. ניתן לנקות את הסננים ולנסות שוב."
        )
      : visible.map(renderCoach).join("");
    ICONS.hydrate(grid);
    placeFigures(true);

    status.textContent = `נמצאו ${visible.length} תוצאות.`;
  }

  function showResults() {
    render();
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#results-t").focus({ preventScroll: true });
  }

  function resetFilters() {
    state.filters = { sport: "", rank: "", mobile: "", email: "" };
    ["#filter-sport", "#filter-rank", "#filter-mobile", "#filter-email"]
      .forEach(s => { $(s).value = ""; });
  }

  function beginSearch(records) {
    state.raw = records;
    resetFilters();
    populateSportFilter(records);
  }

  /* ======================================================================
     6. חיווט
     ====================================================================== */

  function initTabs() {
    const tabs = [$("#tab-name"), $("#tab-id")];

    function select(tab) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      // מעבר מסלול מנקה תוצאות, כדי שלא יוצגו תוצאות של מסלול אחר
      state.raw = null;
      render();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => select(tab));

      // ניווט מקלדת לפי תקן WAI-ARIA. ב-RTL חץ שמאלה מקדם קדימה.
      tab.addEventListener("keydown", e => {
        const i = tabs.indexOf(tab);
        let next = null;
        if (e.key === "ArrowLeft")  next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowRight") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home")       next = tabs[0];
        if (e.key === "End")        next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
  }

  function initNameSearch() {
    const form  = $("#form-name");
    const first = $("#first-name");
    const last  = $("#last-name");

    form.addEventListener("submit", e => {
      e.preventDefault();
      // שני השדות נבדקים תמיד, כדי שכל השגיאות יוצגו בבת אחת
      const okF = setError(first, "#first-name-error", validators.name(first.value.trim(), "שם פרטי"));
      const okL = setError(last,  "#last-name-error",  validators.name(last.value.trim(),  "שם משפחה"));
      if (!okF || !okL) { (!okF ? first : last).focus(); return; }

      beginSearch(searchByName(first.value, last.value));
      showResults();
    });

    first.addEventListener("input", () => {
      if (first.hasAttribute("aria-invalid")) setError(first, "#first-name-error", null); });
    last.addEventListener("input", () => {
      if (last.hasAttribute("aria-invalid")) setError(last, "#last-name-error", null); });
  }

  function initIdSearch() {
    const form  = $("#form-id");
    const kind  = $("#id-type");
    const input = $("#identifier");
    const label = $("#identifier-label");
    const hint  = $("#identifier-hint");

    const CONFIG = {
      id:     { label: "מספר תעודת זהות",     hint: "9 ספרות, כולל ספרת ביקורת.",
                type: "text",  mode: "numeric",     max: 9 },
      mobile: { label: "מספר טלפון נייד",      hint: "10 ספרות. קידומות מותרות: " + MOBILE_PREFIXES.join(", ") + ".",
                type: "tel",   mode: "tel",    max: 12 },
      email:  { label: "כתובת דואר אלקטרוני", hint: "בפורמט name@domain.com.",
                type: "email", mode: "email", max: 254 }
    };

    function syncField() {
      const c = CONFIG[kind.value];
      label.textContent = c.label;
      hint.textContent  = c.hint + " החיפוש מדויק ומחזיר מאמן אחד לכל היותר.";
      input.type        = c.type;
      input.inputMode   = c.mode;
      input.maxLength   = c.max;
      input.value       = "";
      setError(input, "#identifier-error", null);
    }

    kind.addEventListener("change", () => {
      syncField();
      state.raw = null;   // החלפת סוג מזהה מנקה תוצאות קודמות
      render();
      input.focus();
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!setError(input, "#identifier-error", validators[kind.value](input.value.trim()))) {
        input.focus(); return;
      }
      beginSearch(searchByIdentifier(kind.value, input.value));
      showResults();
    });

    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) setError(input, "#identifier-error", null); });

    syncField();
  }

  function initFilters() {
    const bind = (sel, key, evt) =>
      $(sel).addEventListener(evt, e => { state.filters[key] = e.target.value; render(); });

    bind("#filter-sport",  "sport",  "change");
    bind("#filter-rank",   "rank",   "change");
    bind("#filter-mobile", "mobile", "input");
    bind("#filter-email",  "email",  "input");

    $("#filter-clear").addEventListener("click", () => { resetFilters(); render(); });
  }

  /** נתוני הכרטיסים בהירו — סעיף 3.6 */
  function initStats() {
    $("#stat-coaches").textContent        = REGISTRY_STATS.coaches.toLocaleString("he-IL");
    $("#stat-sports").textContent         = REGISTRY_STATS.sports.toLocaleString("he-IL");
    $("#stat-authorizations").textContent = REGISTRY_STATS.authorizations.toLocaleString("he-IL");
  }

  function initRankOptions() {
    $("#filter-rank").innerHTML = '<option value="">כל הדרגות</option>' +
      RANKS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initStats();
    initRankOptions();
    initTabs();
    initNameSearch();
    initIdSearch();
    initFilters();
    render();
  });
})();

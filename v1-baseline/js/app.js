/* ==========================================================================
   מרשם מאמנים — לוגיקת האתר
   --------------------------------------------------------------------------
   מבנה:
     1. ולידציה        — כללי סעיף 3.4
     2. חיפוש          — מסלול א׳ (שם, contains) / מסלול ב׳ (מזהה, exact)
     3. עיבוד תשובה    — חשוב: פרטים אישיים לא עוברים לשכבת התצוגה
     4. סינון תוצאות   — סעיף 3.5.2
     5. רינדור         — כרטיסים, מצבי ריק, הכרזות לקורא מסך
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- קיצורים ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- מצב האפליקציה ---------- */
  const state = {
    /** תוצאות "נקיות" מהשרת — ללא פרטים אישיים */
    results: null,          // null = טרם בוצע חיפוש
    filters: { sport: "", rank: "" }
  };

  /* ======================================================================
     1. ולידציה — סעיף 3.4
     ====================================================================== */

  const validators = {
    /** ת"ז: בדיוק 9 ספרות */
    id(value) {
      if (!value) return "יש להזין מספר תעודת זהות";
      if (!/^\d{9}$/.test(value)) return "מספר תעודת זהות חייב להכיל בדיוק 9 ספרות";
      return null;
    },

    /** נייד: קידומת תקינה + 10 ספרות סה"כ */
    mobile(value) {
      if (!value) return "יש להזין מספר טלפון נייד";
      const digits = value.replace(/[-\s]/g, "");
      if (!/^\d{10}$/.test(digits)) return "מספר טלפון נייד חייב להכיל 10 ספרות";
      if (!MOBILE_PREFIXES.includes(digits.slice(0, 3))) {
        return "קידומת סלולרית לא תקינה. קידומות מותרות: " + MOBILE_PREFIXES.join(", ");
      }
      return null;
    },

    /** דוא"ל: פורמט תקני name@domain.com */
    email(value) {
      if (!value) return "יש להזין כתובת דואר אלקטרוני";
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)) {
        return "כתובת דואר אלקטרוני אינה בפורמט תקין (לדוגמה: name@domain.com)";
      }
      return null;
    },

    /** שם פרטי / משפחה: חובה, לפחות 2 תווים */
    name(value, label) {
      if (!value) return `יש להזין ${label}`;
      if (value.length < 2) return `${label} חייב להכיל לפחות 2 תווים`;
      return null;
    }
  };

  /** מציג או מנקה הודעת שגיאה לשדה */
  function setFieldError(input, message) {
    const errorEl = $("#" + input.getAttribute("aria-describedby").split(" ")
      .find(id => id.endsWith("-error")));
    if (message) {
      input.setAttribute("aria-invalid", "true");
      errorEl.textContent = message;
      errorEl.classList.add("is-visible");
    } else {
      input.removeAttribute("aria-invalid");
      errorEl.textContent = "";
      errorEl.classList.remove("is-visible");
    }
    return !message;
  }

  /* ======================================================================
     2. חיפוש
     ====================================================================== */

  /** נרמול לצורך השוואה — מסיר רווחים מיותרים ומאחד גרשיים */
  const normalize = str => (str || "").trim().replace(/\s+/g, " ").replace(/['׳']/g, "׳");

  /** מסלול א׳ — חיפוש מוכל (contains) על שם פרטי ושם משפחה */
  function searchByName(firstName, lastName) {
    const f = normalize(firstName), l = normalize(lastName);
    return MOCK_RECORDS.filter(r =>
      normalize(r.FirstName).includes(f) && normalize(r.LastName).includes(l)
    );
  }

  /** מסלול ב׳ — חיפוש מדויק (exact match) לפי מזהה */
  function searchByIdentifier(type, value) {
    const v = normalize(value);
    const field = { id: "Id_Number__pc", mobile: "PersonMobilePhone", email: "PersonEmail" }[type];
    const compare = type === "email"
      ? (a, b) => a.toLowerCase() === b.toLowerCase()   // דוא"ל אינו תלוי רישיות
      : (a, b) => a === b;
    const needle = type === "mobile" ? v.replace(/[-\s]/g, "") : v;
    return MOCK_RECORDS.filter(r => compare(String(r[field]), needle));
  }

  /* ======================================================================
     3. עיבוד תשובה — חסימת פרטים אישיים (סעיף 3.5.1 + סעיף 4)
     ----------------------------------------------------------------------
     ת"ז, טלפון ודוא"ל הם שדות חיפוש בלבד. הפונקציה הזו היא הגבול היחיד
     שדרכו נתונים עוברים לשכבת התצוגה — כך שאי אפשר להדליף אותם בטעות.
     בפרודקשן החסימה חייבת להתבצע גם בשרת; זו הגנת עומק, לא תחליף.
     ====================================================================== */

  function toPublicView(record) {
    return {
      firstName: record.FirstName,
      lastName:  record.LastName,
      authorizations: record.authorizations.map(a => ({
        sport: a.businessType,
        rank:  a.rank
      }))
    };
  }

  /* ======================================================================
     4. סינון תוצאות — סעיף 3.5.2
     ====================================================================== */

  /** מחזיר את התוצאות לאחר החלת הסינון הפעיל */
  function applyFilters(results) {
    const { sport, rank } = state.filters;
    if (!sport && !rank) return results;

    return results
      .map(coach => ({
        ...coach,
        authorizations: coach.authorizations.filter(a =>
          (!sport || a.sport === sport) && (!rank || a.rank === rank)
        )
      }))
      // מאמן ללא הסמכות תואמות יורד מהתצוגה
      .filter(coach => coach.authorizations.length > 0);
  }

  /** מאכלס את רשימת הענפים דינמית מתוך התוצאות */
  function populateSportFilter(results) {
    const select = $("#filter-sport");
    const sports = [...new Set(results.flatMap(c => c.authorizations.map(a => a.sport)))]
      .sort((a, b) => a.localeCompare(b, "he"));

    const current = select.value;
    select.innerHTML = '<option value="">כל הענפים</option>' +
      sports.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    // שמירה על הבחירה הקיימת אם היא עדיין רלוונטית
    if (sports.includes(current)) select.value = current;
  }

  /* ======================================================================
     5. רינדור
     ====================================================================== */

  /** בריחה מ-HTML — כל נתון שמגיע מהשרת עובר דרך כאן */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderCoachCard(coach) {
    const count = coach.authorizations.length;
    const fullName = `${coach.firstName} ${coach.lastName}`;

    const items = coach.authorizations.map(a => `
      <li class="auth-item">
        <span class="auth-item__sport">${esc(a.sport)}</span>
        <span class="rank-badge" data-rank="${esc(a.rank)}">${esc(a.rank)}</span>
      </li>`).join("");

    return `
      <article class="coach-card" aria-labelledby="coach-${esc(fullName.replace(/\s/g, "-"))}">
        <header>
          <h3 class="coach-card__name" id="coach-${esc(fullName.replace(/\s/g, "-"))}">${esc(fullName)}</h3>
          <p class="coach-card__meta">${count} ${count === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}</p>
        </header>
        <ul class="auth-list" aria-label="הסמכות של ${esc(fullName)}">${items}</ul>
      </article>`;
  }

  function renderEmptyState(title, body) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon" role="img" aria-label="אין תוצאות">🔍</div>
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>
      </div>`;
  }

  /** מרנדר את כל אזור התוצאות ומכריז על השינוי לקורא מסך */
  function render() {
    const section = $("#results");
    const grid = $("#results-grid");
    const head = $("#results-head");
    const filterBar = $("#filter-bar");
    const status = $("#results-status");

    // טרם בוצע חיפוש — אזור התוצאות מוסתר לגמרי
    if (state.results === null) {
      section.hidden = true;
      return;
    }
    section.hidden = false;

    // אין תוצאות כלל
    if (state.results.length === 0) {
      head.hidden = true;
      filterBar.hidden = true;
      grid.innerHTML = renderEmptyState(
        "לא נמצאו תוצאות",
        "לא נמצא מאמן התואם לפרטי החיפוש. יש לוודא את הפרטים שהוזנו ולנסות שוב."
      );
      status.textContent = "החיפוש הסתיים. לא נמצאו תוצאות.";
      return;
    }

    // בר הסינון מוצג רק כשיש יותר מתוצאה אחת (סעיף 3.5.2)
    filterBar.hidden = state.results.length <= 1;

    const visible = applyFilters(state.results);
    head.hidden = false;
    $("#results-count").innerHTML =
      `מוצגים <strong>${visible.length}</strong> מתוך <strong>${state.results.length}</strong> מאמנים`;

    if (visible.length === 0) {
      grid.innerHTML = renderEmptyState(
        "אין תוצאות התואמות לסינון",
        "לא נמצאו הסמכות התואמות לענף ולדרגה שנבחרו. ניתן לנקות את הסינון ולנסות שוב."
      );
    } else {
      grid.innerHTML = visible.map(renderCoachCard).join("");
    }

    status.textContent = `נמצאו ${visible.length} תוצאות.`;
  }

  /** גלילה רכה לאזור התוצאות והעברת המיקוד אליו */
  function focusResults() {
    const section = $("#results");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#results-title").focus();
  }

  /* ======================================================================
     חיווט הטופס
     ====================================================================== */

  /** מעבר בין לשוניות מסלולי החיפוש */
  function initTabs() {
    const tabs = $$(".tab");

    function select(tab) {
      tabs.forEach(t => {
        const isSelected = t === tab;
        t.setAttribute("aria-selected", String(isSelected));
        t.tabIndex = isSelected ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !isSelected;
      });
      // מעבר מסלול מנקה את התוצאות — כדי שלא יוצגו תוצאות של מסלול אחר
      state.results = null;
      state.filters = { sport: "", rank: "" };
      render();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => select(tab));

      // ניווט מקלדת בין לשוניות — תקן WAI-ARIA
      tab.addEventListener("keydown", e => {
        const i = tabs.indexOf(tab);
        let next = null;
        if (e.key === "ArrowLeft")  next = tabs[(i + 1) % tabs.length];        // RTL: שמאלה = הבא
        if (e.key === "ArrowRight") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home")       next = tabs[0];
        if (e.key === "End")        next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
  }

  /** מסלול א׳ — חיפוש לפי שם */
  function initNameSearch() {
    const form = $("#form-name");
    const first = $("#first-name");
    const last  = $("#last-name");

    form.addEventListener("submit", e => {
      e.preventDefault();

      // שני השדות חובה יחדיו — שניהם נבדקים תמיד כדי שכל השגיאות יוצגו בבת אחת
      const okFirst = setFieldError(first, validators.name(first.value.trim(), "שם פרטי"));
      const okLast  = setFieldError(last,  validators.name(last.value.trim(),  "שם משפחה"));
      if (!okFirst || !okLast) {
        (!okFirst ? first : last).focus();
        return;
      }

      const records = searchByName(first.value, last.value);
      state.results = records.map(toPublicView);
      state.filters = { sport: "", rank: "" };
      $("#filter-rank").value = "";
      populateSportFilter(state.results);
      render();
      focusResults();
    });

    // ניקוי שגיאה תוך כדי הקלדה
    [first, last].forEach(input =>
      input.addEventListener("input", () => {
        if (input.hasAttribute("aria-invalid")) setFieldError(input, null);
      })
    );
  }

  /** מסלול ב׳ — חיפוש לפי מזהה */
  function initIdentifierSearch() {
    const form  = $("#form-id");
    const input = $("#identifier");
    const label = $("#identifier-label");
    const hint  = $("#identifier-hint");

    /** הגדרות התצוגה לכל סוג מזהה */
    const config = {
      id:     { label: "מספר תעודת זהות", hint: "9 ספרות, כולל ספרת ביקורת",       type: "text",  mode: "numeric", ph: "לדוגמה: 987654321", max: 9 },
      mobile: { label: "מספר טלפון נייד",  hint: "10 ספרות. קידומות: " + MOBILE_PREFIXES.join(", "), type: "tel", mode: "tel", ph: "לדוגמה: 0521234567", max: 10 },
      email:  { label: "כתובת דואר אלקטרוני", hint: "בפורמט name@domain.com",       type: "email", mode: "email", ph: "לדוגמה: name@domain.com", max: 254 }
    };

    function currentType() {
      return $$('input[name="id-type"]').find(r => r.checked).value;
    }

    /** מעדכן את השדה היחיד בהתאם לסוג המזהה שנבחר */
    function syncField() {
      const c = config[currentType()];
      label.textContent = c.label;
      hint.textContent = c.hint;
      input.type = c.type;
      input.inputMode = c.mode;
      input.placeholder = c.ph;
      input.maxLength = c.max;
      input.value = "";
      setFieldError(input, null);
    }

    $$('input[name="id-type"]').forEach(radio =>
      radio.addEventListener("change", () => {
        syncField();
        // החלפת סוג מזהה מנקה תוצאות קודמות
        state.results = null;
        render();
        input.focus();
      })
    );

    form.addEventListener("submit", e => {
      e.preventDefault();
      const type = currentType();

      if (!setFieldError(input, validators[type](input.value.trim()))) {
        input.focus();
        return;
      }

      const records = searchByIdentifier(type, input.value);
      state.results = records.map(toPublicView);
      state.filters = { sport: "", rank: "" };
      $("#filter-rank").value = "";
      populateSportFilter(state.results);
      render();
      focusResults();
    });

    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) setFieldError(input, null);
    });

    syncField();
  }

  /** בר הסינון */
  function initFilters() {
    $("#filter-sport").addEventListener("change", e => {
      state.filters.sport = e.target.value;
      render();
    });
    $("#filter-rank").addEventListener("change", e => {
      state.filters.rank = e.target.value;
      render();
    });
    $("#filter-clear").addEventListener("click", () => {
      state.filters = { sport: "", rank: "" };
      $("#filter-sport").value = "";
      $("#filter-rank").value = "";
      render();
    });
  }

  /** סטטיסטיקות הדף הראשי — סעיף 3.6 */
  function initStats() {
    $("#stat-coaches").textContent        = REGISTRY_STATS.coaches.toLocaleString("he-IL");
    $("#stat-sports").textContent         = REGISTRY_STATS.sports.toLocaleString("he-IL");
    $("#stat-authorizations").textContent = REGISTRY_STATS.authorizations.toLocaleString("he-IL");
  }

  /** אכלוס רשימת הדרגות מהערכים הקבועים */
  function initRankOptions() {
    $("#filter-rank").innerHTML = '<option value="">כל הדרגות</option>' +
      RANKS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  }

  /* ---------- אתחול ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initStats();
    initRankOptions();
    initTabs();
    initNameSearch();
    initIdentifierSearch();
    initFilters();
    render();
  });
})();

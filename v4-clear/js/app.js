/* ==========================================================================
   מרשם מאמנים — לוגיקת האתר
   --------------------------------------------------------------------------
   שני מסלולי חיפוש, בדיוק לפי סעיף 3.4:

     מסלול א׳ — שם:   שם פרטי + שם משפחה, שניהם חובה יחדיו,
                      לפחות 2 תווים בכל אחד, חיפוש מוכל (contains).
     מסלול ב׳ — מזהה: ת"ז / נייד / דוא"ל, התאמה מדויקת (exact).

   הדרישה ששני שדות השם חובה יחדיו אינה נוחות — היא מה שמונע דליפה
   של רשימות. "כהן" לבדו היה מחזיר כל בעלי השם הזה במרשם; הצירוף
   מחייב את המחפש לדעת את מי הוא מחפש.

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

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /**
   * raw — הרשומות הגולמיות שהחיפוש החזיר (null = טרם בוצע חיפוש).
   * נשמרות גולמיות; המעבר לתצוגה קורה רק ב-toPublicView.
   */
  const state = {
    raw: null,
    filters: { sport: "", rank: "" }
  };

  const onlyDigits = str => String(str).replace(/[-\s]/g, "");
  const normalize  = str => (str || "").trim().replace(/\s+/g, " ").replace(/['׳']/g, "׳");

  /* ======================================================================
     1. ולידציה — סעיף 3.4
     ====================================================================== */

  const validators = {
    /** שם פרטי / משפחה: חובה, לפחות 2 תווים */
    name(value, label) {
      if (!value) return `יש להזין ${label}`;
      if (value.length < 2) return `${label} חייב להכיל לפחות 2 תווים`;
      return null;
    },

    /** ת"ז: בדיוק 9 ספרות */
    id(value) {
      if (!value) return "יש להזין מספר תעודת זהות";
      return /^\d{9}$/.test(onlyDigits(value))
        ? null
        : "מספר תעודת זהות חייב להכיל בדיוק 9 ספרות";
    },

    /** נייד: 10 ספרות + קידומת סלולרית תקינה */
    mobile(value) {
      if (!value) return "יש להזין מספר טלפון נייד";
      const digits = onlyDigits(value);
      if (!/^\d{10}$/.test(digits)) return "מספר טלפון נייד חייב להכיל 10 ספרות";
      return MOBILE_PREFIXES.includes(digits.slice(0, 3))
        ? null
        : "קידומת סלולרית לא תקינה. קידומות מותרות: " + MOBILE_PREFIXES.join(", ");
    },

    /** דוא"ל: פורמט תקני */
    email(value) {
      if (!value) return "יש להזין כתובת דואר אלקטרוני";
      return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)
        ? null
        : "כתובת דואר אלקטרוני אינה בפורמט תקין (לדוגמה: name@domain.com)";
    }
  };

  /** מציג או מנקה הודעת שגיאה לשדה */
  function setError(input, errorSel, message) {
    const errorEl = $(errorSel);
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

  /** מסלול א׳ — חיפוש מוכל על שם פרטי ושם משפחה יחד */
  function searchByName(first, last) {
    const f = normalize(first), l = normalize(last);
    return MOCK_RECORDS.filter(r =>
      normalize(r.FirstName).includes(f) && normalize(r.LastName).includes(l));
  }

  /** מסלול ב׳ — התאמה מדויקת לפי מזהה */
  function searchByIdentifier(type, value) {
    const v = normalize(value);

    if (type === "email") {
      return MOCK_RECORDS.filter(r =>
        String(r.PersonEmail).toLowerCase() === v.toLowerCase());
    }

    const field  = { id: "Id_Number__pc", mobile: "PersonMobilePhone" }[type];
    const needle = onlyDigits(v);
    return MOCK_RECORDS.filter(r => String(r[field]) === needle);
  }

  /* ======================================================================
     3. סינון תוצאות — סעיף 3.5.2
     ----------------------------------------------------------------------
     שני שדות בלבד: ענף ודרגה. מחזיר [{ record, auths }] כדי שספירת
     "ההסמכות הרשומות" תישאר המספר המלא (סעיף 3.5.1).
     ====================================================================== */

  function applyFilters(records) {
    const { sport, rank } = state.filters;
    return records
      .map(r => ({
        record: r,
        auths: r.authorizations.filter(a =>
          (!sport || a.businessType === sport) && (!rank || a.rank === rank))
      }))
      .filter(x => x.auths.length > 0);
  }

  /** מאכלס את רשימת הענפים דינמית מתוך התוצאות */
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

  function maskId(idNumber) {
    const digits = String(idNumber);
    return "•".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  }

  function toPublicView({ record, auths }) {
    return {
      firstName: record.FirstName,
      lastName:  record.LastName,
      maskedId:  maskId(record.Id_Number__pc),
      // המספר המלא, כדי שהסינון לא ישנה את "ההסמכות הרשומות"
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

  function renderCoachCard(coach, index) {
    const shown = coach.authorizations.length;
    const total = coach.totalAuthorizations;
    const fullName = `${coach.firstName} ${coach.lastName}`;
    const headingId = `coach-${index}`;

    const countText = shown === total
      ? `${total} ${total === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}`
      : `מוצגות ${shown} מתוך ${total} הסמכות רשומות`;

    const items = coach.authorizations.map(a => `
      <li class="auth-item">
        <span>${esc(a.sport)}</span>
        <span class="rank-badge" data-rank="${esc(a.rank)}">${esc(a.rank)}</span>
      </li>`).join("");

    return `
      <article class="coach-card" aria-labelledby="${headingId}">
        <header class="coach-card__head">
          <h3 class="coach-card__name" id="${headingId}">${esc(fullName)}</h3>
          <p class="coach-card__id">
            ת״ז <bdi>${esc(coach.maskedId)}</bdi>
            <span class="sr-only">— מוצגות ארבע הספרות האחרונות בלבד</span>
          </p>
        </header>
        <ul class="auth-list" aria-label="הסמכות של ${esc(fullName)}">${items}</ul>
        <p class="coach-card__count">${countText}</p>
      </article>`;
  }

  function renderEmpty(title, body) {
    return `
      <div class="empty">
        <span class="empty__ic" data-icon="searchx" data-icon-size="34" aria-hidden="true"></span>
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>
      </div>`;
  }

  function render() {
    const section    = $("#results");
    const grid       = $("#results-grid");
    const filterBar  = $("#filter-bar");
    const status     = $("#results-status");
    const disclaimer = $("#disclaimer");

    if (state.raw === null) {
      section.hidden = true;
      filterBar.hidden = true;
      return;
    }
    section.hidden = false;

    if (state.raw.length === 0) {
      filterBar.hidden = true;
      disclaimer.hidden = true;
      $("#results-count").textContent = "";
      grid.innerHTML = renderEmpty(
        "לא נמצאו תוצאות",
        "לא נמצא מאמן התואם לפרטים שהוזנו. יש לוודא אותם ולנסות שוב."
      );
      ICONS.hydrate(grid);
      status.textContent = "החיפוש הסתיים. לא נמצאו תוצאות.";
      return;
    }

    disclaimer.hidden = false;
    // הסינון מוצג רק כשיש יותר מתוצאה אחת (סעיף 3.5.2)
    filterBar.hidden = state.raw.length <= 1;

    const visible = applyFilters(state.raw).map(toPublicView);

    $("#results-count").innerHTML = visible.length === state.raw.length
      ? `<strong>${visible.length}</strong> ${visible.length === 1 ? "מאמן" : "מאמנים"}`
      : `<strong>${visible.length}</strong> מתוך <strong>${state.raw.length}</strong> מאמנים`;

    grid.innerHTML = visible.length === 0
      ? renderEmpty(
          "אין תוצאות התואמות לסינון",
          "לא נמצאו הסמכות התואמות לענף ולדרגה שנבחרו. ניתן לנקות את הסינון ולנסות שוב."
        )
      : visible.map(renderCoachCard).join("");
    ICONS.hydrate(grid);

    status.textContent = `נמצאו ${visible.length} תוצאות.`;
  }

  /** מציג את התוצאות ומעביר אליהן את המיקוד */
  function showResults() {
    render();
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#results-title").focus({ preventScroll: true });
  }

  /** מאפס את מצב התוצאות לפני חיפוש חדש */
  function beginSearch(records) {
    state.raw = records;
    state.filters = { sport: "", rank: "" };
    $("#filter-rank").value = "";
    populateSportFilter(records);
  }

  /* ======================================================================
     6. חיווט
     ====================================================================== */

  /** מעבר בין מסלולי החיפוש */
  function initTabs() {
    const tabs = $$(".seg__b");

    function select(tab) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      // מעבר מסלול מנקה תוצאות — כדי שלא יוצגו תוצאות של מסלול אחר
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

  /** מסלול א׳ — לפי שם */
  function initNameSearch() {
    const form  = $("#form-name");
    const first = $("#first-name");
    const last  = $("#last-name");

    form.addEventListener("submit", e => {
      e.preventDefault();

      // שני השדות נבדקים תמיד, כדי שכל השגיאות יוצגו בבת אחת
      const okF = setError(first, "#first-name-error",
        validators.name(first.value.trim(), "שם פרטי"));
      const okL = setError(last, "#last-name-error",
        validators.name(last.value.trim(), "שם משפחה"));

      if (!okF || !okL) { (!okF ? first : last).focus(); return; }

      beginSearch(searchByName(first.value, last.value));
      showResults();
    });

    first.addEventListener("input", () => {
      if (first.hasAttribute("aria-invalid")) setError(first, "#first-name-error", null);
    });
    last.addEventListener("input", () => {
      if (last.hasAttribute("aria-invalid")) setError(last, "#last-name-error", null);
    });
  }

  /** מסלול ב׳ — לפי מזהה */
  function initIdSearch() {
    const form  = $("#form-id");
    const input = $("#identifier");
    const label = $("#identifier-label");
    const hint  = $("#identifier-hint");

    const CONFIG = {
      id: {
        label: "מספר תעודת זהות", hint: "9 ספרות, כולל ספרת ביקורת",
        type: "text", mode: "numeric", max: 9
      },
      mobile: {
        label: "מספר טלפון נייד",
        hint: "10 ספרות. קידומות: " + MOBILE_PREFIXES.join(", "),
        type: "tel", mode: "tel", max: 12
      },
      email: {
        label: "כתובת דואר אלקטרוני", hint: "בפורמט name@domain.com",
        type: "email", mode: "email", max: 254
      }
    };

    const currentType = () => $$('input[name="id-type"]').find(r => r.checked).value;

    /** מעדכן את השדה היחיד לפי סוג המזהה שנבחר */
    function syncField() {
      const c = CONFIG[currentType()];
      label.textContent  = c.label;
      hint.textContent   = c.hint;
      input.type         = c.type;
      input.inputMode    = c.mode;
      input.maxLength    = c.max;
      input.value        = "";
      setError(input, "#identifier-error", null);
    }

    $$('input[name="id-type"]').forEach(radio =>
      radio.addEventListener("change", () => {
        syncField();
        state.raw = null;   // החלפת סוג מזהה מנקה תוצאות קודמות
        render();
        input.focus();
      })
    );

    form.addEventListener("submit", e => {
      e.preventDefault();
      const type = currentType();

      if (!setError(input, "#identifier-error", validators[type](input.value.trim()))) {
        input.focus();
        return;
      }

      beginSearch(searchByIdentifier(type, input.value));
      showResults();
    });

    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) setError(input, "#identifier-error", null);
    });

    syncField();
  }

  function initFilters() {
    $("#filter-sport").addEventListener("change", e => {
      state.filters.sport = e.target.value; render();
    });
    $("#filter-rank").addEventListener("change", e => {
      state.filters.rank = e.target.value; render();
    });
    $("#filter-clear").addEventListener("click", () => {
      state.filters = { sport: "", rank: "" };
      $("#filter-sport").value = "";
      $("#filter-rank").value  = "";
      render();
    });
  }

  /** שורת הנתונים — סעיף 3.6 */
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

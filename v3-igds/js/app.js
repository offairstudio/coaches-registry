/* ==========================================================================
   מרשם מאמנים — לוגיקת האתר (גרסה 3)
   --------------------------------------------------------------------------
   החיפוש בנוי לפי האפיון, סעיף 3.4: שני מסלולים נפרדים —
     מסלול א׳  שם פרטי + שם משפחה, שניהם חובה, חיפוש מוכל (contains)
     מסלול ב׳  מזהה יחיד (ת"ז / נייד / דוא"ל), התאמה מדויקת
   טלפון ודוא"ל מופיעים גם בבר הצמצום שאחרי החיפוש, ככלי איתור למקרה
   של כמה מאמנים בעלי שם זהה — שם הם לא מסלול חיפוש אלא מסנן.

   מבנה:
     1. ולידציה        — כללי סעיף 3.4
     2. חיפוש          — שם = מוכל · מזהה = מדויק
     3. צמצום תוצאות   — סעיף 3.5.2 + צמצום לפי טלפון/דוא"ל
     4. עיבוד תשובה    — חשוב: פרטים אישיים לא עוברים לשכבת התצוגה
     5. רינדור
     6. חיווט
   ========================================================================== */

(function () {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    /** רשומות הגלם שהחיפוש החזיר. null = טרם בוצע חיפוש */
    records: null,
    filters: { sport: "", rank: "", mobile: "", email: "" }
  };

  /** מסיר מקפים ורווחים מערך מספרי */
  const onlyDigits = str => String(str).replace(/[-\s]/g, "");

  /** נרמול לצורך השוואת טקסט — רווחים כפולים וגרשיים */
  const normalize = str => (str || "").trim().replace(/\s+/g, " ").replace(/['׳']/g, "׳");

  /* ======================================================================
     1. ולידציה — סעיף 3.4
     ====================================================================== */

  /** מטא־נתונים לכל סוג מזהה: תווית, רמז, ולידציה ושדה ההשוואה */
  const IDENTIFIERS = {
    id: {
      label: "מספר תעודת זהות",
      hint:  "בדיוק 9 ספרות",
      field: "Id_Number__pc",
      validate: value => /^\d{9}$/.test(onlyDigits(value))
        ? null
        : "מספר תעודת זהות חייב להכיל בדיוק 9 ספרות"
    },
    mobile: {
      label: "מספר טלפון נייד",
      hint:  "10 ספרות. קידומות מותרות: " + MOBILE_PREFIXES.join(", "),
      field: "PersonMobilePhone",
      validate: value => {
        const digits = onlyDigits(value);
        if (!/^\d{10}$/.test(digits)) return "מספר טלפון נייד חייב להכיל 10 ספרות";
        return MOBILE_PREFIXES.includes(digits.slice(0, 3))
          ? null
          : "קידומת סלולרית לא תקינה. קידומות מותרות: " + MOBILE_PREFIXES.join(", ");
      }
    },
    email: {
      label: "כתובת דואר אלקטרוני",
      hint:  "לדוגמה: name@domain.com",
      field: "PersonEmail",
      validate: value => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value.trim())
        ? null
        : "כתובת דואר אלקטרוני אינה בפורמט תקין (לדוגמה: name@domain.com)"
    }
  };

  /** שם — חובה, לפחות 2 תווים (סעיף 3.4 מסלול א׳) */
  function validateNamePart(value, fieldLabel) {
    const v = value.trim();
    if (!v) return `יש להזין ${fieldLabel}`;
    if (v.length < 2) return `${fieldLabel} חייב להכיל לפחות 2 תווים`;
    return null;
  }

  /**
   * מציג או מנקה שגיאה על שדה.
   * מצב השגיאה יושב על מעטפת ה-.field — כך גם המסגרת האדומה וגם ההודעה
   * נשלטות ממקום אחד, לפי רכיב השדה של מערכת העיצוב.
   */
  function setFieldError(input, message) {
    const field   = input.closest(".field");
    const errorEl = $("#" + input.id + "-error");

    if (message) {
      field.classList.add("err");
      input.setAttribute("aria-invalid", "true");
      errorEl.textContent = message;
    } else {
      field.classList.remove("err");
      input.removeAttribute("aria-invalid");
      errorEl.textContent = "";
    }
    return !message;
  }

  /* ======================================================================
     2. חיפוש
     ====================================================================== */

  /**
   * מסלול א׳ — חיפוש לפי שם, מוכל (contains) ולא התאמה מדויקת.
   * שני השדות נבדקים יחד; מי שמקליד "כהן" בשם משפחה יקבל גם "כהן-אלמוג".
   */
  function searchByName(first, last) {
    const f = normalize(first);
    const l = normalize(last);

    return MOCK_RECORDS.filter(r =>
      normalize(r.FirstName).includes(f) && normalize(r.LastName).includes(l)
    );
  }

  /** מסלול ב׳ — חיפוש לפי מזהה, התאמה מדויקת */
  function searchByIdentifier(type, raw) {
    const spec  = IDENTIFIERS[type];
    const value = normalize(raw);

    if (type === "email") {
      return MOCK_RECORDS.filter(r =>
        String(r.PersonEmail).toLowerCase() === value.toLowerCase());
    }
    const needle = onlyDigits(value);
    return MOCK_RECORDS.filter(r => String(r[spec.field]) === needle);
  }

  /* ======================================================================
     3. צמצום תוצאות
     ====================================================================== */

  /**
   * צמצום לפי טלפון או דוא"ל.
   * ההשוואה מתבצעת על רשומות הגלם, לפני הגבול שבסעיף 4 — כך שהערכים
   * עצמם לעולם לא מגיעים לשכבת התצוגה. המשתמש מקבל תשובת כן/לא בלבד,
   * ולא יכול לקרוא מהמרשם טלפון או דוא"ל של מישהו.
   */
  function narrowByContact(records) {
    const { mobile, email } = state.filters;
    let out = records;

    if (mobile.trim()) {
      const needle = onlyDigits(mobile);
      out = out.filter(r => String(r.PersonMobilePhone) === needle);
    }
    if (email.trim()) {
      const needle = email.trim().toLowerCase();
      out = out.filter(r => String(r.PersonEmail).toLowerCase() === needle);
    }
    return out;
  }

  /** צמצום לפי ענף ודרגה — סעיף 3.5.2. פועל על התצוגה הציבורית */
  function filterAuthorizations(coaches) {
    const { sport, rank } = state.filters;
    if (!sport && !rank) return coaches;

    return coaches
      .map(coach => ({
        ...coach,
        authorizations: coach.authorizations.filter(a =>
          (!sport || a.sport === sport) && (!rank || a.rank === rank)
        )
      }))
      .filter(coach => coach.authorizations.length > 0);
  }

  /** מאכלס את רשימת הענפים דינמית מתוך תוצאות החיפוש */
  function populateSportFilter(records) {
    const select = $("#filter-sport");
    const sports = [...new Set(records.flatMap(r => r.authorizations.map(a => a.businessType)))]
      .sort((a, b) => a.localeCompare(b, "he"));

    select.innerHTML = '<option value="">כל הענפים</option>' +
      sports.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  /* ======================================================================
     4. עיבוד תשובה — חסימת פרטים אישיים (סעיף 3.5.1 + סעיף 4)
     ----------------------------------------------------------------------
     זהו הגבול היחיד שדרכו נתונים עוברים לשכבת התצוגה. הוא מעתיק במפורש
     רק שם, ת"ז ממוסכת והסמכות — כך שאי אפשר להדליף שדה בטעות דרך
     שינוי ברינדור.

     חריג מכוון: 4 הספרות האחרונות של ת"ז, לצורך הבחנה בין מאמנים
     בעלי שם זהה. המספר המלא לעולם לא מגיע לשכבת התצוגה.
     בפרודקשן המיסוך חייב להתבצע בשרת — כאן זו הגנת עומק בלבד.
     ====================================================================== */

  function maskId(idNumber) {
    const digits = String(idNumber);
    return "•".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  }

  function toPublicView(record) {
    return {
      firstName: record.FirstName,
      lastName:  record.LastName,
      maskedId:  maskId(record.Id_Number__pc),
      // נשמר בנפרד כדי שהצמצום לא ישנה את "מספר ההסמכות הרשומות" (סעיף 3.5.1)
      totalAuthorizations: record.authorizations.length,
      authorizations: record.authorizations.map(a => ({
        sport: a.businessType,
        rank:  a.rank
      }))
    };
  }

  /* ======================================================================
     5. רינדור
     ====================================================================== */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /** גוון התגית לפי דרגה — ארבעה גוונים ממערכת העיצוב */
  const RANK_TINT = {
    "מאמן":       "tint-blue",
    "מאמן בכיר":  "tint-green"
  };

  /** ראשי תיבות לעיגול השם — אין תמונות במרשם */
  const initials = (first, last) => (first[0] || "") + (last[0] || "");

  function renderCoachCard(coach, index) {
    const shown     = coach.authorizations.length;
    const total     = coach.totalAuthorizations;
    const fullName  = `${coach.firstName} ${coach.lastName}`;
    const headingId = `coach-${index}`;

    // כשצמצום פעיל מציגים גם כמה הוסתרו — "מספר ההסמכות הרשומות"
    // חייב להישאר המספר המלא ולא להשתנות לפי הסינון
    const countText = shown === total
      ? `${total} ${total === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}`
      : `מוצגות ${shown} מתוך ${total} הסמכות רשומות`;

    const items = coach.authorizations.map(a => `
      <li class="auth-item">
        <span class="auth-item__sport">
          ${ICONS.svg("whistle", 17)}${esc(a.sport)}
        </span>
        <span class="badge ${RANK_TINT[a.rank] || "tint-blue"}">${esc(a.rank)}</span>
      </li>`).join("");

    return `
      <article class="coach-card" aria-labelledby="${headingId}">

        <header class="coach-card__head">
          <span class="coach-card__ava" aria-hidden="true">${esc(initials(coach.firstName, coach.lastName))}</span>
          <span class="coach-card__idwrap">
            <h3 class="coach-card__name" id="${headingId}">${esc(fullName)}</h3>
            <p class="coach-card__id">
              ת״ז <bdi>${esc(coach.maskedId)}</bdi>
              <span class="sr-only">— מוצגות ארבע הספרות האחרונות בלבד</span>
            </p>
          </span>
        </header>

        <ul class="auth-list" aria-label="הסמכות של ${esc(fullName)}">${items}</ul>

        <p class="coach-card__foot">${esc(countText)}</p>

      </article>`;
  }

  function renderEmptyState(icon, title, body) {
    return `
      <div class="empty">
        <span class="ic">${ICONS.svg(icon, 32)}</span>
        <b>${esc(title)}</b>
        <p>${esc(body)}</p>
      </div>`;
  }

  function render() {
    const section    = $("#results");
    const grid       = $("#results-grid");
    const filterBar  = $("#filter-bar");
    const status     = $("#results-status");
    const disclaimer = $("#disclaimer");
    const countPill  = $("#results-cnt");

    if (state.records === null) {
      section.hidden = true;
      filterBar.hidden = true;
      return;
    }
    section.hidden = false;

    if (state.records.length === 0) {
      filterBar.hidden  = true;
      disclaimer.hidden = true;
      countPill.hidden  = true;
      $("#results-count").textContent = "";
      grid.innerHTML = renderEmptyState(
        "searchx",
        "לא נמצאו תוצאות",
        "לא נמצא מאמן התואם לפרטים שהוזנו. יש לוודא את הפרטים ולנסות שוב."
      );
      status.textContent = "החיפוש הסתיים. לא נמצאו תוצאות.";
      return;
    }

    disclaimer.hidden = false;
    // בר הצמצום מוצג רק כשיש יותר מתוצאה אחת (סעיף 3.5.2)
    filterBar.hidden = state.records.length <= 1;

    // סדר הפעולות: צמצום על רשומות הגלם ⇐ מעבר לתצוגה ציבורית ⇐ צמצום הסמכות
    const visible = filterAuthorizations(narrowByContact(state.records).map(toPublicView));

    // תג הספירה ליד הכותרת מציג תמיד את סך התוצאות;
    // שורת הטקסט שמתחתיו מופיעה רק כשהצמצום מקטין אותן
    countPill.hidden = false;
    countPill.textContent = state.records.length;

    $("#results-count").innerHTML = visible.length === state.records.length
      ? ""
      : `מוצגים <strong>${visible.length}</strong> מתוך <strong>${state.records.length}</strong> מאמנים`;

    grid.innerHTML = visible.length === 0
      ? renderEmptyState(
          "filterx",
          "אין תוצאות התואמות לצמצום",
          "לא נמצא מאמן התואם לערכים שנבחרו. ניתן לנקות את הצמצום ולנסות שוב."
        )
      : visible.map(renderCoachCard).join("");

    status.textContent = `נמצאו ${visible.length} תוצאות.`;
  }

  /* ======================================================================
     6. חיווט
     ====================================================================== */

  /** מאפס תוצאות וצמצום — נקרא במעבר בין מסלולי החיפוש */
  function resetResults() {
    state.records = null;
    clearFilters();
    render();
  }

  function clearFilters() {
    state.filters = { sport: "", rank: "", mobile: "", email: "" };
    $("#filter-sport").value = "";
    $("#filter-rank").value  = "";
    $("#filter-mobile").value = "";
    $("#filter-email").value  = "";
  }

  /** מציג את התוצאות ומעביר אליהן מיקוד, כדי שקורא מסך יגיע לכותרת */
  function showResults(records) {
    state.records = records;
    clearFilters();
    populateSportFilter(records);
    render();

    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#results-title").focus({ preventScroll: true });
  }

  /* ---- לשוניות — ניווט מקלדת לפי תקן WAI-ARIA ---- */

  function initTabs() {
    const tabs = $$(".tab");

    function select(tab) {
      tabs.forEach(t => {
        const isSelected = t === tab;
        t.setAttribute("aria-selected", String(isSelected));
        t.tabIndex = isSelected ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !isSelected;
      });
      // מעבר מסלול מנקה את התוצאות — כדי שלא יוצגו תוצאות של המסלול הקודם
      resetResults();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => select(tab));

      tab.addEventListener("keydown", e => {
        const i = tabs.indexOf(tab);
        let next = null;
        if (e.key === "ArrowLeft")  next = tabs[(i + 1) % tabs.length];   // RTL: שמאלה = הבא
        if (e.key === "ArrowRight") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home")       next = tabs[0];
        if (e.key === "End")        next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
  }

  /* ---- מסלול א׳ — חיפוש לפי שם ---- */

  function initNameSearch() {
    const form  = $("#form-name");
    const first = $("#first-name");
    const last  = $("#last-name");

    form.addEventListener("submit", e => {
      e.preventDefault();

      // שני השדות נבדקים תמיד, כדי שכל השגיאות יוצגו בבת אחת
      const okFirst = setFieldError(first, validateNamePart(first.value, "שם פרטי"));
      const okLast  = setFieldError(last,  validateNamePart(last.value,  "שם משפחה"));
      if (!okFirst || !okLast) {
        (okFirst ? last : first).focus();
        return;
      }

      showResults(searchByName(first.value, last.value));
    });

    [first, last].forEach(input => {
      input.addEventListener("input", () => {
        if (input.hasAttribute("aria-invalid")) setFieldError(input, null);
      });
    });
  }

  /* ---- מסלול ב׳ — חיפוש לפי מזהה ---- */

  function initIdentifierSearch() {
    const form  = $("#form-id");
    const input = $("#identifier");

    /** התווית, הרמז ומקלדת המובייל משתנים לפי סוג המזהה שנבחר */
    function applyType(type) {
      const spec = IDENTIFIERS[type];
      $("#identifier-label").textContent = spec.label;
      $("#identifier-hint").textContent  = spec.hint;
      input.inputMode = type === "email" ? "email" : "numeric";
      input.value = "";
      setFieldError(input, null);
      resetResults();
    }

    $$('input[name="id-type"]').forEach(radio => {
      radio.addEventListener("change", () => applyType(radio.value));
    });

    form.addEventListener("submit", e => {
      e.preventDefault();

      const type = $('input[name="id-type"]:checked').value;
      const raw  = input.value.trim();

      const message = raw
        ? IDENTIFIERS[type].validate(raw)
        : `יש להזין ${IDENTIFIERS[type].label}`;

      if (!setFieldError(input, message)) {
        input.focus();
        return;
      }

      showResults(searchByIdentifier(type, raw));
    });

    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) setFieldError(input, null);
    });

    applyType("id");   // מאכלס את התווית והרמז ההתחלתיים
  }

  /* ---- בר הצמצום ---- */

  function initFilters() {
    const bind = (id, key, event) =>
      $(id).addEventListener(event, e => {
        state.filters[key] = e.target.value;
        render();
      });

    bind("#filter-sport",  "sport",  "change");
    bind("#filter-rank",   "rank",   "change");
    bind("#filter-mobile", "mobile", "input");
    bind("#filter-email",  "email",  "input");

    $("#filter-clear").addEventListener("click", () => {
      clearFilters();
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

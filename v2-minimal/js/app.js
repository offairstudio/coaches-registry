/* ==========================================================================
   מרשם מאמנים — לוגיקת האתר (גרסה מינימלית)
   --------------------------------------------------------------------------
   ההבדל מגרסת הבסיס: שדה חיפוש אחד במקום שני מסלולים נפרדים.
   המערכת מזהה לבד את סוג הערך שהוזן ובוחרת את כללי הולידציה והחיפוש
   המתאימים — אך כללי האפיון עצמם (סעיף 3.4) נשמרים ללא שינוי.

   מבנה:
     1. זיהוי סוג הקלט
     2. ולידציה        — כללי סעיף 3.4
     3. חיפוש          — שם = מוכל (contains) · מזהה = מדויק (exact)
     4. עיבוד תשובה    — חשוב: פרטים אישיים לא עוברים לשכבת התצוגה
     5. סינון תוצאות   — סעיף 3.5.2
     6. רינדור
   ========================================================================== */

(function () {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    results: null,                     // null = טרם בוצע חיפוש
    filters: { sport: "", rank: "" }
  };

  /* ======================================================================
     1. זיהוי סוג הקלט
     ----------------------------------------------------------------------
     הסדר חשוב: כתובת דוא"ל מזוהה לפי @, ערך מספרי לפי אורכו, וכל
     השאר נחשב שם. הזיהוי הוא לצורכי ולידציה ותצוגה בלבד — הוא לא
     "מנחש" תוצאות.
     ====================================================================== */

  const TYPE_LABELS = {
    email:  "דואר אלקטרוני",
    id:     "תעודת זהות",
    mobile: "טלפון נייד",
    name:   "שם",
    digits: "מספר"
  };

  /** מסיר מקפים ורווחים מערך מספרי */
  const onlyDigits = str => str.replace(/[-\s]/g, "");

  function detectType(raw) {
    const value = (raw || "").trim();
    if (!value) return null;

    if (value.includes("@")) return "email";

    // ערך שכולו ספרות (עם מקפים/רווחים אופציונליים)
    if (/^[\d\s-]+$/.test(value)) {
      const digits = onlyDigits(value);
      if (digits.length === 9)  return "id";
      if (digits.length === 10) return "mobile";
      return "digits";           // מספר באורך לא מזוהה — נטופל בולידציה
    }

    return "name";
  }

  /* ======================================================================
     2. ולידציה — סעיף 3.4
     ====================================================================== */

  function validate(type, raw) {
    const value = (raw || "").trim();

    if (!value) return "יש להזין שם, תעודת זהות, טלפון או דואר אלקטרוני";

    switch (type) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)
          ? null
          : "כתובת דואר אלקטרוני אינה בפורמט תקין (לדוגמה: name@domain.com)";

      case "id":
        // 9 ספרות בדיוק — כבר מובטח מהזיהוי, נשמר כאן כהגנה
        return /^\d{9}$/.test(onlyDigits(value))
          ? null
          : "מספר תעודת זהות חייב להכיל בדיוק 9 ספרות";

      case "mobile":
        return MOBILE_PREFIXES.includes(onlyDigits(value).slice(0, 3))
          ? null
          : "קידומת סלולרית לא תקינה. קידומות מותרות: " + MOBILE_PREFIXES.join(", ");

      case "digits":
        return "מספר לחיפוש חייב להיות תעודת זהות (9 ספרות) או טלפון נייד (10 ספרות)";

      case "name":
        // כל מילה בשם חייבת להכיל לפחות 2 תווים
        return value.split(/\s+/).every(part => part.length >= 2)
          ? null
          : "כל חלק בשם חייב להכיל לפחות 2 תווים";
    }
    return null;
  }

  function setError(message) {
    const input = $("#q");
    const errorEl = $("#q-error");
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
     3. חיפוש
     ====================================================================== */

  /** נרמול לצורך השוואה — רווחים כפולים וגרשיים */
  const normalize = str => (str || "").trim().replace(/\s+/g, " ").replace(/['׳']/g, "׳");

  /**
   * חיפוש לפי שם — מוכל (contains), לא התאמה מדויקת.
   * מילה אחת נבדקת מול שם פרטי או שם משפחה;
   * שתי מילים ומעלה נבדקות בשני הסדרים, כי משתמשים מקלידים גם "כהן דוד".
   */
  function searchByName(raw) {
    const parts = normalize(raw).split(" ").filter(Boolean);

    if (parts.length === 1) {
      const term = parts[0];
      return MOCK_RECORDS.filter(r =>
        normalize(r.FirstName).includes(term) || normalize(r.LastName).includes(term)
      );
    }

    const head = parts[0];
    const tail = parts.slice(1).join(" ");
    const matches = (first, last) => (r) =>
      normalize(r.FirstName).includes(first) && normalize(r.LastName).includes(last);

    return MOCK_RECORDS.filter(r => matches(head, tail)(r) || matches(tail, head)(r));
  }

  /** חיפוש לפי מזהה — מדויק (exact match) */
  function searchByIdentifier(type, raw) {
    const value = normalize(raw);
    const field = { id: "Id_Number__pc", mobile: "PersonMobilePhone", email: "PersonEmail" }[type];

    if (type === "email") {
      return MOCK_RECORDS.filter(r =>
        String(r.PersonEmail).toLowerCase() === value.toLowerCase());
    }
    const needle = onlyDigits(value);
    return MOCK_RECORDS.filter(r => String(r[field]) === needle);
  }

  /* ======================================================================
     4. עיבוד תשובה — חסימת פרטים אישיים (סעיף 3.5.1 + סעיף 4)
     ----------------------------------------------------------------------
     זהו הגבול היחיד שדרכו נתונים עוברים לשכבת התצוגה. הוא מעתיק במפורש
     רק שם והסמכות — כך שאי אפשר להדליף שדה בטעות דרך שינוי ברינדור.

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
      // נשמר בנפרד כדי שהסינון לא ישנה את "מספר ההסמכות הרשומות" (סעיף 3.5.1)
      totalAuthorizations: record.authorizations.length,
      authorizations: record.authorizations.map(a => ({
        sport: a.businessType,
        rank:  a.rank
      }))
    };
  }

  /* ======================================================================
     5. סינון תוצאות — סעיף 3.5.2
     ====================================================================== */

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
      .filter(coach => coach.authorizations.length > 0);
  }

  /** מאכלס את רשימת הענפים דינמית מתוך התוצאות */
  function populateSportFilter(results) {
    const select = $("#filter-sport");
    const sports = [...new Set(results.flatMap(c => c.authorizations.map(a => a.sport)))]
      .sort((a, b) => a.localeCompare(b, "he"));

    select.innerHTML = '<option value="">כל הענפים</option>' +
      sports.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  /* ======================================================================
     6. רינדור
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

    // כשסינון פעיל מציגים גם כמה הוסתרו — "מספר ההסמכות הרשומות"
    // חייב להישאר המספר המלא ולא להשתנות לפי הסינון
    const countText = shown === total
      ? `${total} ${total === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}`
      : `מוצגות ${shown} מתוך ${total} הסמכות רשומות`;

    const items = coach.authorizations.map(a => `
      <li class="auth-item">
        <span class="auth-item__sport">${esc(a.sport)}</span>
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
        <p class="coach-card__count">${count} ${count === 1 ? "הסמכה רשומה" : "הסמכות רשומות"}</p>
      </article>`;
  }

  function renderEmptyState(title, body) {
    return `
      <div class="empty-state">
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>
      </div>`;
  }

  function render() {
    const section = $("#results");
    const grid = $("#results-grid");
    const filterBar = $("#filter-bar");
    const status = $("#results-status");
    const disclaimer = $("#disclaimer");

    if (state.results === null) {
      section.hidden = true;
      filterBar.hidden = true;
      return;
    }
    section.hidden = false;

    if (state.results.length === 0) {
      filterBar.hidden = true;
      disclaimer.hidden = true;
      $("#results-count").textContent = "";
      grid.innerHTML = renderEmptyState(
        "לא נמצאו תוצאות",
        "לא נמצא מאמן התואם לערך שהוזן. יש לוודא את הפרטים ולנסות שוב."
      );
      status.textContent = "החיפוש הסתיים. לא נמצאו תוצאות.";
      return;
    }

    disclaimer.hidden = false;
    // בר הסינון מוצג רק כשיש יותר מתוצאה אחת (סעיף 3.5.2)
    filterBar.hidden = state.results.length <= 1;

    const visible = applyFilters(state.results);
    $("#results-count").innerHTML = visible.length === state.results.length
      ? `<strong>${visible.length}</strong> ${visible.length === 1 ? "מאמן" : "מאמנים"}`
      : `מוצגים <strong>${visible.length}</strong> מתוך <strong>${state.results.length}</strong> מאמנים`;

    grid.innerHTML = visible.length === 0
      ? renderEmptyState(
          "אין תוצאות התואמות לסינון",
          "לא נמצאו הסמכות התואמות לענף ולדרגה שנבחרו. ניתן לנקות את הסינון ולנסות שוב."
        )
      : visible.map(renderCoachCard).join("");

    status.textContent = `נמצאו ${visible.length} תוצאות.`;
  }

  /* ======================================================================
     חיווט
     ====================================================================== */

  /** מחוון סוג הקלט — מתעדכן תוך כדי הקלדה */
  function updateChip() {
    const chip = $("#detect-chip");
    const type = detectType($("#q").value);

    if (!type || type === "digits") {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    chip.textContent = "מזוהה כ" + TYPE_LABELS[type];
    chip.dataset.type = type;
  }

  function initSearch() {
    const form  = $("#form-search");
    const input = $("#q");

    form.addEventListener("submit", e => {
      e.preventDefault();

      const type = detectType(input.value);
      if (!setError(validate(type, input.value))) {
        input.focus();
        return;
      }

      const records = type === "name"
        ? searchByName(input.value)
        : searchByIdentifier(type, input.value);

      state.results = records.map(toPublicView);
      state.filters = { sport: "", rank: "" };
      $("#filter-rank").value = "";
      populateSportFilter(state.results);
      render();

      // גלילה לתוצאות והעברת המיקוד — כדי שקורא מסך יגיע לכותרת התוצאות
      $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
      $("#results-title").focus({ preventScroll: true });
    });

    input.addEventListener("input", () => {
      updateChip();
      if (input.hasAttribute("aria-invalid")) setError(null);
    });
  }

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

  document.addEventListener("DOMContentLoaded", () => {
    initStats();
    initRankOptions();
    initSearch();
    initFilters();
    render();
  });
})();

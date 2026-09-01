/* ==========================================================================
   שכבת נתונים — נתוני דמו לפרוטוטייפ
   --------------------------------------------------------------------------
   מדמה את התשובה של Salesforce. שמות השדות תואמים לאפיון:
     FirstName, LastName, Id_Number__pc, PersonMobilePhone, PersonEmail
     authorizations[] = businessLicense.regulatoryAuthorizationType
                        { businessType (ענף), rank (דרגה) }

   בשלב האינטגרציה מחליפים את MOCK_RECORDS בקריאת API, ומשאירים את
   מבנה האובייקט כפי שהוא — שאר הקוד לא צריך להשתנות.

   שים לב: רק רשומות שסטטוס = מאושר ו"הסרה מהמרשם" = לא נכללות כאן,
   בהתאם לסעיף 3.4. הסינון הזה קורה בצד השרת — לא בדפדפן.
   ========================================================================== */

/**
 * דרגות ההסמכה הקבועות.
 * שים לב: סעיף 3.5.2 באפיון מונה ארבע דרגות —
 * מדריך / מאמן / מאמן בכיר / מאמן לאומי. בפועל קיימות שתיים בלבד,
 * ולכן "מדריך" מופה ל"מאמן" ו"מאמן לאומי" ל"מאמן בכיר".
 * האפיון טעון עדכון בהתאם.
 */
const RANKS = ["מאמן", "מאמן בכיר"];

/** קידומות סלולריות תקינות (סעיף 3.4, מסלול ב׳) */
const MOBILE_PREFIXES = ["050", "051", "052", "053", "054", "055", "058"];

const MOCK_RECORDS = [
  {
    FirstName: "דוד", LastName: "כהן",
    Id_Number__pc: "312456789", PersonMobilePhone: "0521234567", PersonEmail: "david.cohen@walla.co.il",
    authorizations: [
      { businessType: "כדורגל", rank: "מאמן בכיר" },
      { businessType: "כדורסל", rank: "מאמן" },
      { businessType: "אתלטיקה קלה", rank: "מאמן" }
    ]
  },
  {
    FirstName: "דוד", LastName: "כהן-אלמוג",
    Id_Number__pc: "204871336", PersonMobilePhone: "0543398210", PersonEmail: "d.cohenalmog@gmail.com",
    authorizations: [{ businessType: "שחייה", rank: "מאמן" }]
  },
  {
    FirstName: "דודי", LastName: "כהנא",
    Id_Number__pc: "058992471", PersonMobilePhone: "0509923471", PersonEmail: "dudi.k@sport.org.il",
    authorizations: [
      { businessType: "ג׳ודו", rank: "מאמן בכיר" },
      { businessType: "היאבקות", rank: "מאמן בכיר" }
    ]
  },
  {
    FirstName: "מיכל", LastName: "לוי",
    Id_Number__pc: "987654321", PersonMobilePhone: "0587778812", PersonEmail: "michal.levi@gmail.com",
    authorizations: [
      { businessType: "התעמלות אמנותית", rank: "מאמן בכיר" },
      { businessType: "התעמלות מכשירים", rank: "מאמן בכיר" }
    ]
  },
  {
    FirstName: "מיכל", LastName: "לוינשטיין",
    Id_Number__pc: "331209845", PersonMobilePhone: "0531120984", PersonEmail: "m.levinstein@outlook.com",
    authorizations: [{ businessType: "טניס", rank: "מאמן" }]
  },
  {
    FirstName: "יוסי", LastName: "מזרחי",
    Id_Number__pc: "025641398", PersonMobilePhone: "0551049821", PersonEmail: "yossi.mizrahi@walla.co.il",
    authorizations: [
      { businessType: "כדורגל", rank: "מאמן בכיר" },
      { businessType: "כדורגל חופים", rank: "מאמן" }
    ]
  },
  {
    FirstName: "נועה", LastName: "בן־דוד",
    Id_Number__pc: "409813275", PersonMobilePhone: "0522087431", PersonEmail: "noa.bendavid@gmail.com",
    authorizations: [
      { businessType: "שחייה", rank: "מאמן בכיר" },
      { businessType: "טריאתלון", rank: "מאמן" },
      { businessType: "אתלטיקה קלה", rank: "מאמן" },
      { businessType: "אופניים", rank: "מאמן" }
    ]
  },
  {
    FirstName: "אבי", LastName: "כהן",
    Id_Number__pc: "117445692", PersonMobilePhone: "0501174456", PersonEmail: "avi.cohen@sport.org.il",
    authorizations: [{ businessType: "כדורעף", rank: "מאמן" }]
  },
  {
    FirstName: "שרה", LastName: "אברהמי",
    Id_Number__pc: "298734015", PersonMobilePhone: "0542987340", PersonEmail: "sarah.a@hotmail.com",
    authorizations: [
      { businessType: "כדורסל", rank: "מאמן בכיר" },
      { businessType: "כדוריד", rank: "מאמן בכיר" }
    ]
  },
  {
    FirstName: "רון", LastName: "פרידמן",
    Id_Number__pc: "376120948", PersonMobilePhone: "0537612094", PersonEmail: "ron.friedman@gmail.com",
    authorizations: [{ businessType: "שייט", rank: "מאמן בכיר" }]
  },
  {
    FirstName: "תמר", LastName: "שפירא",
    Id_Number__pc: "145983207", PersonMobilePhone: "0521459832", PersonEmail: "tamar.shapira@walla.co.il",
    authorizations: [
      { businessType: "התעמלות אמנותית", rank: "מאמן" },
      { businessType: "ריקוד ספורטיבי", rank: "מאמן" }
    ]
  },
  {
    FirstName: "עומר", LastName: "דהן",
    Id_Number__pc: "463027819", PersonMobilePhone: "0554630278", PersonEmail: "omer.dahan@gmail.com",
    authorizations: [
      { businessType: "ג׳ודו", rank: "מאמן" },
      { businessType: "קראטה", rank: "מאמן בכיר" },
      { businessType: "טאקוונדו", rank: "מאמן" }
    ]
  },
  {
    FirstName: "ליאת", LastName: "כהן",
    Id_Number__pc: "508914623", PersonMobilePhone: "0585089146", PersonEmail: "liat.cohen@outlook.com",
    authorizations: [
      { businessType: "טניס", rank: "מאמן בכיר" },
      { businessType: "טניס שולחן", rank: "מאמן" }
    ]
  },
  {
    FirstName: "איתי", LastName: "גולן",
    Id_Number__pc: "270648135", PersonMobilePhone: "0502706481", PersonEmail: "itay.golan@sport.org.il",
    authorizations: [{ businessType: "כדורסל", rank: "מאמן" }]
  },
  {
    FirstName: "רחל", LastName: "אזולאי",
    Id_Number__pc: "639418270", PersonMobilePhone: "0546394182", PersonEmail: "rachel.azoulay@gmail.com",
    authorizations: [
      { businessType: "כדורעף", rank: "מאמן בכיר" },
      { businessType: "כדורעף חופים", rank: "מאמן" },
      { businessType: "כדוריד", rank: "מאמן" }
    ]
  },
  {
    FirstName: "מוחמד", LastName: "אבו־ראס",
    Id_Number__pc: "184907253", PersonMobilePhone: "0531849072", PersonEmail: "m.aburas@walla.co.il",
    authorizations: [
      { businessType: "כדורגל", rank: "מאמן" },
      { businessType: "אתלטיקה קלה", rank: "מאמן בכיר" }
    ]
  }
];

/* ==========================================================================
   סטטיסטיקות לדף הראשי (סעיף 3.6)
   בפרודקשן הערכים מגיעים מהשרת — כאן הם נגזרים מנתוני הדמו כדי שהמספרים
   בפרוטוטייפ יהיו עקביים עם התוצאות שמוצגות בפועל.
   ========================================================================== */

const REGISTRY_STATS = {
  /** ספירת תיקי לקוחות ייחודיים */
  coaches: MOCK_RECORDS.length,
  /** ספירת ענפים ייחודיים (businessType) */
  sports: new Set(MOCK_RECORDS.flatMap(r => r.authorizations.map(a => a.businessType))).size,
  /** סך כל רשומות ההסמכה הפעילות */
  authorizations: MOCK_RECORDS.reduce((sum, r) => sum + r.authorizations.length, 0)
};

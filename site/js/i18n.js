// All words shown on screen, in English and Hindi.
// To change wording, edit here. {name} style parts are filled in by the app.
import { reasonByKey } from './recipes.js';

const STRINGS = {
  en: {
    langSwitch: 'हिंदी',
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
    back: 'Back',
    whoFlow: 'Welcome',
    whoTitle: 'Who are you?',
    whoHelp: 'Tap your name',
    notInList: 'My name is not in the list',
    typeName: 'Type your name',
    saveName: 'Save name',
    hello: 'Hello, {name}',
    changeWorker: 'Change',
    tileProduction: 'Batches made',
    tileProductionSub: 'Record what you produced',
    tileWaste: 'Waste / Spill',
    tileWasteSub: 'Record wasted or thrown material',
    tileLog: "Today's entries",
    tileLogSub: 'See, change or delete',
    todayCount: '{n} recorded today',
    report: 'Report',
    settings: 'Settings',
    legendUsed: 'In batches',
    legendWasted: 'Wasted',

    whichProduct: 'Which product did you make?',
    noProducts: 'No products are set up yet. Ask your supervisor.',
    search: 'Search product',
    howManyBatches: 'How many batches?',
    when: 'When was it made?',
    whenWaste: 'When did it happen?',
    today: 'Today',
    yesterday: 'Yesterday',
    willUse: 'This uses',
    noRecipe: 'This product has no recipe yet. Ask your supervisor.',
    addNote: '+ Add a note',
    notePlaceholder: 'Note (optional)',
    saveWhat: 'Save {what}',
    saveChanges: 'Save changes',

    saved: 'Saved',
    undo: 'Undo ({s})',
    done: 'Done',
    another: 'Add another',
    undone: 'Removed. Fix it and save again.',

    wasteWhat: 'What was wasted?',
    wasteRaw: 'Raw material',
    wasteProduct: 'Finished product / spoiled batch',
    wasteProductSub: 'A whole or part batch was thrown away',
    whichMaterial: 'Which raw material?',
    whichProductWaste: 'Which product was spoiled?',
    howMuch: 'How much {name} was wasted?',
    howManySpoiled: 'How many batches were spoiled?',
    countIn: 'Count in',
    rawLost: 'Raw material lost',
    next: 'Next',
    enterAmount: 'Enter how much',
    whyWasted: 'Why was it wasted?',
    pickReason: 'Tap a reason',
    otherNeedsNote: 'Please write what happened',
    saveWaste: 'Save waste',
    stepOf: 'Step {n} of {total}',

    sumProduction: '{batches} of {product}',
    sumWasteMat: '{qty} of {material} wasted',
    sumWasteProd: '{batches} of {product} spoiled',

    logTitle: "Today's entries",
    logHelp: 'Entries made on this phone today.',
    logEmpty: 'Nothing recorded today yet.',
    logLocked: 'Older entries are locked. Ask your supervisor to fix them in the sheet.',
    forDate: 'for {date}',
    change: 'Change',
    delete: 'Delete',
    confirmDelete: 'Delete this entry?',
    yesDelete: 'Yes, delete',
    noKeep: 'No, keep it',
    deletedToast: 'Entry deleted',

    stLocal: 'Saved on this phone · sheet not connected',
    stOk: 'Everything sent to the sheet',
    stSending: 'Sending to the sheet…',
    stWaiting: '{n} waiting · will send when internet is back',
    stError: 'Sheet problem · tell your supervisor',
    entrySent: 'Sent to sheet',
    entryWaiting: 'Saved on phone · sending soon',
    entryLocal: 'Saved on this phone',

    pinTitle: 'Enter PIN',
    pinHelp: 'Settings are for the owner or supervisor.',
    pinWrong: 'Wrong PIN. Try again.',
    setPhone: 'This phone',
    setPhoneName: 'Phone name (shown in reports)',
    setWorker: 'Current worker',
    setLanguage: 'Language',
    setSheet: 'Google Sheet',
    setSheetUrl: 'Sheet link (web app URL)',
    setSheetKey: 'Secret key',
    setSaveTest: 'Save and test',
    setUseTest: 'Use the test sheet on this computer',
    setDisconnect: 'Disconnect',
    setSyncNow: 'Send now',
    setTesting: 'Testing…',
    setTestOk: 'Connected to "{name}" · {n} products',
    setTestFail: 'Could not connect: {err}',
    setLastSync: 'Last sent: {time}',
    setNotConnected: 'Not connected. Entries stay on this phone.',
    never: 'never',
    setRecipes: 'Recipes',
    srcSheet: 'From the Google Sheet (checked {time})',
    srcBuiltIn: 'Built into the app (config.json)',
    setCounts: '{p} products · {m} raw materials · {w} workers',
    setRefresh: 'Get latest from sheet',
    recipeWarnings: 'Problems in the Recipes sheet',
    setData: 'Data on this phone',
    setDataCounts: '{n} entries kept · {w} waiting to send',
    setClear: 'Delete all entries on this phone',
    setClearConfirm: 'Delete all entries on this phone? Entries already sent stay in the Google Sheet.',
    setClearWarn: '{n} entries have NOT been sent yet and will be lost.',
    setCleared: 'All entries removed from this phone',
    setLock: 'Lock settings',
    setVersion: 'App version {v}',

    reportAll: 'All phones · from the Google Sheet',
    reportPhone: 'This phone only · sheet not connected',
    reportOffline: "Couldn't reach the sheet. Showing this phone only.",
    loading: 'Loading…',
    refresh: 'Refresh',
    share: 'Share',

    storageFull: 'Phone storage is full. Entry NOT saved. Tell your supervisor.',
    errorGeneric: 'Something went wrong. Please try again.',
    bootError: "The app couldn't start: {err}",
  },

  hi: {
    langSwitch: 'English',
    toLight: 'हल्के रंग में बदलें',
    toDark: 'गहरे रंग में बदलें',
    back: 'वापस',
    whoFlow: 'स्वागत है',
    whoTitle: 'आप कौन हैं?',
    whoHelp: 'अपना नाम दबाएँ',
    notInList: 'मेरा नाम लिस्ट में नहीं है',
    typeName: 'अपना नाम लिखें',
    saveName: 'नाम सेव करें',
    hello: 'नमस्ते, {name}',
    changeWorker: 'बदलें',
    tileProduction: 'बैच बनाए',
    tileProductionSub: 'जो बनाया वह लिखें',
    tileWaste: 'बर्बादी / गिरा माल',
    tileWasteSub: 'बर्बाद या फेंका माल लिखें',
    tileLog: 'आज की एंट्री',
    tileLogSub: 'देखें, बदलें या हटाएँ',
    todayCount: 'आज {n} एंट्री',
    report: 'रिपोर्ट',
    settings: 'सेटिंग्स',
    legendUsed: 'बैच में',
    legendWasted: 'बर्बाद',

    whichProduct: 'आपने कौन सा प्रोडक्ट बनाया?',
    noProducts: 'अभी कोई प्रोडक्ट नहीं जोड़ा गया। सुपरवाइज़र से पूछें।',
    search: 'प्रोडक्ट खोजें',
    howManyBatches: 'कितने बैच बने?',
    when: 'कब बनाया?',
    whenWaste: 'कब हुआ?',
    today: 'आज',
    yesterday: 'बीता कल',
    willUse: 'इसमें लगेगा',
    noRecipe: 'इस प्रोडक्ट की रेसिपी नहीं है। सुपरवाइज़र से पूछें।',
    addNote: '+ नोट लिखें',
    notePlaceholder: 'नोट (ज़रूरी नहीं)',
    saveWhat: '{what} सेव करें',
    saveChanges: 'बदलाव सेव करें',

    saved: 'सेव हो गया',
    undo: 'वापस लें ({s})',
    done: 'ठीक है',
    another: 'एक और जोड़ें',
    undone: 'हटा दिया। ठीक करके फिर सेव करें।',

    wasteWhat: 'क्या बर्बाद हुआ?',
    wasteRaw: 'कच्चा माल',
    wasteProduct: 'तैयार माल / खराब बैच',
    wasteProductSub: 'पूरा या आधा बैच फेंका गया',
    whichMaterial: 'कौन सा कच्चा माल?',
    whichProductWaste: 'कौन सा प्रोडक्ट खराब हुआ?',
    howMuch: 'कितना {name} बर्बाद हुआ?',
    howManySpoiled: 'कितने बैच खराब हुए?',
    countIn: 'किसमें गिनें',
    rawLost: 'कच्चा माल गया',
    next: 'आगे',
    enterAmount: 'मात्रा डालें',
    whyWasted: 'क्यों बर्बाद हुआ?',
    pickReason: 'कारण चुनें',
    otherNeedsNote: 'क्या हुआ, लिखें',
    saveWaste: 'बर्बादी सेव करें',
    stepOf: 'चरण {n} / {total}',

    sumProduction: '{product} के {batches}',
    sumWasteMat: '{qty} {material} बर्बाद हुआ',
    sumWasteProd: '{product} के {batches} खराब हुए',

    logTitle: 'आज की एंट्री',
    logHelp: 'इस फ़ोन से आज की गई एंट्री।',
    logEmpty: 'आज अभी तक कुछ नहीं लिखा गया।',
    logLocked: 'पुरानी एंट्री बदल नहीं सकते। सुपरवाइज़र शीट में ठीक करेंगे।',
    forDate: '{date} के लिए',
    change: 'बदलें',
    delete: 'हटाएँ',
    confirmDelete: 'यह एंट्री हटाएँ?',
    yesDelete: 'हाँ, हटाएँ',
    noKeep: 'नहीं, रहने दें',
    deletedToast: 'एंट्री हटा दी',

    stLocal: 'इस फ़ोन में सेव · शीट नहीं जुड़ी',
    stOk: 'सब शीट पर भेज दिया',
    stSending: 'शीट पर भेज रहे हैं…',
    stWaiting: '{n} बाकी · इंटरनेट आने पर जाएगा',
    stError: 'शीट में दिक्कत · सुपरवाइज़र को बताएँ',
    entrySent: 'शीट पर गया',
    entryWaiting: 'फ़ोन में सेव · जल्द जाएगा',
    entryLocal: 'इस फ़ोन में सेव',

    pinTitle: 'पिन डालें',
    pinHelp: 'सेटिंग्स मालिक या सुपरवाइज़र के लिए हैं।',
    pinWrong: 'गलत पिन। फिर से डालें।',
    setPhone: 'यह फ़ोन',
    setPhoneName: 'फ़ोन का नाम (रिपोर्ट में दिखेगा)',
    setWorker: 'अभी का वर्कर',
    setLanguage: 'भाषा',
    setSheet: 'गूगल शीट',
    setSheetUrl: 'शीट लिंक (वेब ऐप URL)',
    setSheetKey: 'सीक्रेट कोड',
    setSaveTest: 'सेव और टेस्ट करें',
    setUseTest: 'इस कंप्यूटर की टेस्ट शीट लगाएँ',
    setDisconnect: 'डिस्कनेक्ट करें',
    setSyncNow: 'अभी भेजें',
    setTesting: 'टेस्ट हो रहा है…',
    setTestOk: '"{name}" से जुड़ गया · {n} प्रोडक्ट',
    setTestFail: 'नहीं जुड़ा: {err}',
    setLastSync: 'आखिरी बार भेजा: {time}',
    setNotConnected: 'शीट नहीं जुड़ी। एंट्री इसी फ़ोन में रहेंगी।',
    never: 'कभी नहीं',
    setRecipes: 'रेसिपी',
    srcSheet: 'गूगल शीट से ({time} पर देखा)',
    srcBuiltIn: 'ऐप के अंदर (config.json)',
    setCounts: '{p} प्रोडक्ट · {m} कच्चे माल · {w} वर्कर',
    setRefresh: 'शीट से ताज़ा लें',
    recipeWarnings: 'रेसिपी शीट में गलतियाँ',
    setData: 'इस फ़ोन का डेटा',
    setDataCounts: '{n} एंट्री रखी हैं · {w} भेजना बाकी',
    setClear: 'इस फ़ोन की सारी एंट्री हटाएँ',
    setClearConfirm: 'इस फ़ोन की सारी एंट्री हटाएँ? जो शीट पर जा चुकी हैं, वे शीट में रहेंगी।',
    setClearWarn: '{n} एंट्री अभी नहीं भेजी गईं, वे खो जाएँगी।',
    setCleared: 'इस फ़ोन से सारी एंट्री हटा दी गईं',
    setLock: 'सेटिंग्स बंद करें',
    setVersion: 'ऐप वर्ज़न {v}',

    reportAll: 'सभी फ़ोन · गूगल शीट से',
    reportPhone: 'सिर्फ़ यह फ़ोन · शीट नहीं जुड़ी',
    reportOffline: 'शीट से नहीं जुड़ा। सिर्फ़ इस फ़ोन का दिखा रहे हैं।',
    loading: 'लोड हो रहा है…',
    refresh: 'रीफ़्रेश',
    share: 'शेयर करें',

    storageFull: 'फ़ोन की मेमोरी भरी है। एंट्री सेव नहीं हुई। सुपरवाइज़र को बताएँ।',
    errorGeneric: 'कुछ गड़बड़ हुई। फिर से कोशिश करें।',
    bootError: 'ऐप शुरू नहीं हुआ: {err}',
  },
};

let lang = 'en';

export function setLang(l) {
  lang = STRINGS[l] ? l : 'en';
  document.documentElement.lang = lang;
}

export function getLang() {
  return lang;
}

export function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}

// Name of a product / material / container in the current language.
export function nameOf(item) {
  if (!item) return '';
  if (lang === 'hi' && item.name_hi) return item.name_hi;
  return item.name || item.code || '';
}

// Batch note of a product in the current language.
export function noteOf(item) {
  if (!item) return '';
  if (lang === 'hi' && item.batchNote_hi) return item.batchNote_hi;
  return item.batchNote || '';
}

export function reasonLabel(key) {
  const r = reasonByKey(key);
  return lang === 'hi' ? r.hi : r.en;
}

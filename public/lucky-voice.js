/* ============================================================
   skipQs — "Hey Lucky" Voice Assistant  v2  (lucky-voice.js)
   
   Fixes in v2:
   - Wake word detected on interim results (not just final)
   - AudioContext unlocked on first user tap
   - Auto-starts mic when dashboard opens
   - Always-on hotword: keeps restarting after silence
   - New orders spoken aloud: "New order received — 1 Dosa for Ravi"
   - Speaks in English, Hindi, Tamil, Telugu, Kannada, Malayalam
   ============================================================ */

window.LuckyVoice = (function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  const WAKE_WORDS = [
    // English variations (Chrome often mishears)
    'hey lucky', 'hey luckey', 'hey luki', 'hey lacky', 'hey lucky',
    'a lucky', 'ok lucky', 'hello lucky', 'hey lucky hey', 'lucky',
    // Hindi
    'लकी', 'हे लकी', 'हेलकी', 'ए लकी',
    // Tamil (script + romanised — Chrome returns either)
    'ஹே லக்கி', 'he lakki', 'hey lakki', 'he lucky',
    // Telugu (script + romanised)
    'హే లకీ', 'he laki', 'hey laki', 'హేలకి', 'hē lakī',
    // Kannada
    'ಹೇ ಲಕ್ಕಿ', 'he lakki',
    // Malayalam
    'ഹേ ലക്കി', 'he lucky',
    // Marathi
    'हे लकी',
    // Bengali
    'হে লাকি', 'he laki',
  ];

  /* ── Shared AudioContext (unlocked on first user gesture) ─ */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) { return null; }
    }
    return audioCtx;
  }

  // Unlock AudioContext on first tap anywhere — required by mobile browsers
  function unlockAudio() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
  document.addEventListener('touchstart', unlockAudio, { once: false, passive: true });
  document.addEventListener('click',      unlockAudio, { once: false, passive: true });

  /* ── State ──────────────────────────────────────────────── */
  let recognition    = null;
  let awake          = false;
  let sleepTimer     = null;
  let restartTimer   = null;
  let currentLang    = 'en-IN';
  let queueRef       = [];
  let completeFn     = null;
  let startServingFn = null;
  let enabled        = false;
  let recognizing    = false;

  /* ── Sound: chime using Web Audio ───────────────────────── */
  function playChime(type = 'order') {
    const ctx = getAudioCtx();
    if (!ctx) return;

    // Resume if suspended (mobile)
    const play = () => {
      try {
        if (type === 'order') {
          // Three ascending tones — friendly shop door chime
          playTone(ctx, 880,  0,    0.22, 0.7);
          playTone(ctx, 1109, 0.18, 0.22, 0.7);
          playTone(ctx, 1318, 0.36, 0.38, 0.8);
        } else if (type === 'wake') {
          // Short double-ping — "I'm listening"
          playTone(ctx, 1200, 0,    0.12, 0.5);
          playTone(ctx, 1400, 0.14, 0.15, 0.5);
        } else if (type === 'done') {
          // Descending — "order complete"
          playTone(ctx, 1318, 0,    0.18, 0.6);
          playTone(ctx, 880,  0.2,  0.25, 0.6);
        }
      } catch (_) {}
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  }

  function playTone(ctx, freq, startDelay, duration, volume) {
    const t    = ctx.currentTime + startDelay;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /* ── Speech Synthesis ───────────────────────────────────── */
  let voicesLoaded = false;

  function loadVoices() {
    if (voicesLoaded) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
        voicesLoaded = true;
      };
    }
  }

  function speak(text, priority = false) {
    if (!window.speechSynthesis) return;
    if (priority) window.speechSynthesis.cancel();

    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = currentLang;
    utt.rate    = 0.9;
    utt.pitch   = 1.05;
    utt.volume  = 1.0;

    // Pick best available voice for this language
    const voices   = window.speechSynthesis.getVoices();
    const langCode = currentLang.slice(0, 2);
    // Try exact match first, then language prefix, then Indian English, then any English
    const preferred = voices.find(v => v.lang === currentLang)
                   || voices.find(v => v.lang.startsWith(langCode + '-'))
                   || voices.find(v => v.lang.startsWith(langCode))
                   || voices.find(v => v.lang === 'en-IN')
                   || voices.find(v => v.lang.startsWith('en'))
                   || null;
    if (preferred) utt.voice = preferred;
    // For languages without native voice, speak the romanised version in English
    // rather than silence — set utt.lang to en-IN as fallback
    if (!preferred || !voices.some(v => v.lang.startsWith(langCode))) {
      utt.lang = 'en-IN';
    }

    // Resume AudioContext so it doesn't block TTS
    unlockAudio();
    window.speechSynthesis.speak(utt);
  }

  /* ── Language strings ───────────────────────────────────── */
  function t(key, vars = {}) {
    const lang = currentLang.slice(0, 2);
    const strings = {
      listening: {
        en: 'Yes, I am listening',
        hi: 'हाँ बोलिए',
        ta: 'சொல்லுங்கள்',
        te: 'చెప్పండి',
        kn: 'ಹೇಳಿ',
        ml: 'പറയൂ'
      },
      newOrder: {
        en: `New order received. ${vars.service || ''} for ${vars.name || 'a customer'}`,
        hi: `नया ऑर्डर आया। ${vars.name || 'ग्राहक'} का ${vars.service || 'ऑर्डर'}`,
        ta: `புதிய ஆர்டர். ${vars.name || 'வாடிக்கையாளர்'} க்கு ${vars.service || 'ஆர்டர்'}`,
        te: `కొత్త ఆర్డర్ వచ్చింది. ${vars.name || 'కస్టమర్'} కి ${vars.service || 'ఆర్డర్'}`,
        kn: `ಹೊಸ ಆರ್ಡರ್ ಬಂತು. ${vars.name || 'ಗ್ರಾಹಕ'} ಗೆ ${vars.service || 'ಆರ್ಡರ್'}`,
        ml: `പുതിയ ഓർഡർ വന്നു. ${vars.name || 'ഉപഭോക്താവ്'} ക്ക് ${vars.service || 'ഓർഡർ'}`
      },
      orderReady: {
        en: `Order ${vars.pos || ''} is ready. Notifying ${vars.name || 'customer'} now.`,
        hi: `${vars.pos || ''} ऑर्डर तैयार है। ${vars.name || 'ग्राहक'} को सूचना भेजी जा रही है।`,
        ta: `${vars.pos || ''} ஆர்டர் ரெடி. ${vars.name || 'வாடிக்கையாளர்'} க்கு தகவல் அனுப்புகிறோம்.`,
        te: `${vars.pos || ''} ఆర్డర్ రెడీ. ${vars.name || 'కస్టమర్'} కి నోటిఫికేషన్ పంపుతున్నాం.`,
        kn: `${vars.pos || ''} ಆರ್ಡರ್ ರೆಡಿ. ${vars.name || 'ಗ್ರಾಹಕ'} ಗೆ ತಿಳಿಸಲಾಗುತ್ತಿದೆ.`,
        ml: `${vars.pos || ''} ഓർഡർ റെഡി. ${vars.name || 'ഉപഭോക്താവ്'} നെ അറിയിക്കുന്നു.`
      },
      readOrder: {
        en: `Order ${vars.pos}: ${vars.service} for ${vars.name}`,
        hi: `${vars.pos} ऑर्डर: ${vars.service}, ${vars.name} के लिए`,
        ta: `${vars.pos} ஆர்டர்: ${vars.service}, ${vars.name} க்காக`,
        te: `${vars.pos} ఆర్డర్: ${vars.service}, ${vars.name} కోసం`,
        kn: `${vars.pos} ಆರ್ಡರ್: ${vars.service}, ${vars.name} ಗಾಗಿ`,
        ml: `${vars.pos} ഓർഡർ: ${vars.service}, ${vars.name} ക്കുവേണ്ടി`
      },
      orderCount: {
        en: `${vars.n} order${vars.n > 1 ? 's' : ''} waiting`,
        hi: `${vars.n} ऑर्डर बाकी है`,
        ta: `${vars.n} ஆர்டர் உள்ளது`,
        te: `${vars.n} ఆర్డర్‌లు వేచి ఉన్నాయి`,
        kn: `${vars.n} ಆರ್ಡರ್ ಬಾಕಿ ಇದೆ`,
        ml: `${vars.n} ഓർഡർ കാത്തിരിക്കുന്നു`
      },
      noOrders: {
        en: 'No orders waiting right now',
        hi: 'अभी कोई ऑर्डर नहीं है',
        ta: 'இப்போது ஆர்டர் இல்லை',
        te: 'ఇప్పుడు ఆర్డర్‌లు లేవు',
        kn: 'ಈಗ ಯಾವ ಆರ್ಡರ್ ಇಲ್ಲ',
        ml: 'ഇപ്പോൾ ഓർഡർ ഒന്നുമില്ല'
      },
      notFound: {
        en: 'Order not found',
        hi: 'ऑर्डर नहीं मिला',
        ta: 'ஆர்டர் கிடைக்கவில்லை',
        te: 'ఆర్డర్ కనుగొనబడలేదు',
        kn: 'ಆರ್ಡರ್ ಸಿಗಲಿಲ್ಲ',
        ml: 'ഓർഡർ കണ്ടെത്തിയില്ല'
      },
      notUnderstood: {
        en: 'Sorry, I did not understand. Say: first order, second order, or first order packed.',
        hi: 'माफ करें, समझ नहीं आया। बोलिए: पहला ऑर्डर, दूसरा ऑर्डर, या पहला ऑर्डर तैयार।',
        ta: 'மன்னிக்கவும். முதல் ஆர்டர், இரண்டாவது ஆர்டர், அல்லது முதல் ஆர்டர் ரெடி என்று சொல்லுங்கள்.',
        te: 'క్షమించండి. మొదటి ఆర్డర్, లేదా మొదటి ఆర్డర్ రెడీ అని చెప్పండి.',
        kn: 'ಕ್ಷಮಿಸಿ. ಮೊದಲ ಆರ್ಡರ್, ಎರಡನೇ ಆರ್ಡರ್, ಅಥವಾ ಮೊದಲ ಆರ್ಡರ್ ರೆಡಿ ಎಂದು ಹೇಳಿ.',
        ml: 'ക്ഷമിക്കൂ. ആദ്യ ഓർഡർ, രണ്ടാം ഓർഡർ, അല്ലെങ്കിൽ ആദ്യ ഓർഡർ റെഡി എന്ന് പറയൂ.'
      }
    };
    const s = strings[key];
    if (!s) return key;
    return s[lang] || s['en'] || key;
  }

  function posWord(n) {
    const lang = currentLang.slice(0, 2);
    const pos = {
      en: ['first','second','third','fourth','fifth'],
      hi: ['पहला','दूसरा','तीसरा','चौथा','पाँचवाँ'],
      ta: ['முதல்','இரண்டாவது','மூன்றாவது','நான்காவது','ஐந்தாவது'],
      te: ['మొదటి','రెండవ','మూడవ','నాల్గవ','అయిదవ'],
      kn: ['ಮೊದಲ','ಎರಡನೇ','ಮೂರನೇ','ನಾಲ್ಕನೇ','ಐದನೇ'],
      ml: ['ആദ്യ','രണ്ടാം','മൂന്നാം','നാലാം','അഞ്ചാം']
    };
    return (pos[lang] || pos['en'])[n - 1] || `number ${n}`;
  }

  /* ── Command parser ─────────────────────────────────────── */
  function parseCommand(transcript) {
    const t = transcript.toLowerCase().trim();

    // Romanised versions of Indian language words that Chrome returns
    const posPatterns = [
      { idx: 0, words: [
        'first','1st','one','number one',
        'pahla','pehla',                           // Hindi romanised
        'muthal','mudal','mottam',                 // Tamil romanised
        'modati','modal','modhal',                 // Telugu romanised
        'modala',                                  // Kannada romanised
        'aadya',                                   // Malayalam romanised
      ]},
      { idx: 1, words: [
        'second','2nd','two','number two',
        'dusra','doosra',                          // Hindi romanised
        'rendu','randu','irandavathu',             // Tamil/Telugu romanised
        'eradane',                                 // Kannada romanised
        'randaam',                                 // Malayalam romanised
      ]},
      { idx: 2, words: [
        'third','3rd','three',
        'teesra',                                  // Hindi romanised
        'moondu','moodu','mudu',                   // Tamil/Telugu romanised
      ]},
      { idx: 3, words: ['fourth','4th','four','chautha','nalgu'] },
      { idx: 'next', words: [
        'next','agla',                             // Hindi romanised
        'aduttha',                                 // Tamil romanised
        'taruvata',                                // Telugu romanised
        'mundina',                                 // Kannada romanised
      ]},
    ];

    // Script versions (in case user has native keyboard)
    const scriptWords = {
      0: ['पहला','முதல்','మొదటి','మొదల','ಮೊದಲ','ആദ്യ'],
      1: ['दूसरा','இரண்டாவது','రెండవ','రెండో','೎ರಡನೇ','രണ്ടാം'],
      2: ['तीसरा','மூன்றாவது','మూడవ'],
    };

    const isComplete = t.includes('pack') || t.includes('ready') || t.includes('done') ||
      t.includes('complet') || t.includes('finish') || t.includes('over') ||
      // Hindi romanised
      t.includes('taiyar') || t.includes('ho gaya') || t.includes('tayar') ||
      // Tamil romanised
      t.includes('ready') || t.includes('aachu') ||
      // Telugu romanised (most common)
      t.includes('ayindi') || t.includes('ready ga') || t.includes('chesav') ||
      // Kannada romanised
      t.includes('aaythu') || t.includes('agide') ||
      // Malayalam romanised
      t.includes('aayi') || t.includes('ready ayi') ||
      // Scripts
      t.includes('तैयार') || t.includes('ரெடி') ||
      t.includes('రెడీ') || t.includes('అయింది') ||
      t.includes('ರೆಡಿ') || t.includes('റെഡി');

    for (const { idx, words } of posPatterns) {
      if (words.some(w => t.includes(w))) {
        return { action: isComplete ? 'complete' : 'read', pos: idx };
      }
    }
    // Check script words
    for (const [idxStr, scripts] of Object.entries(scriptWords)) {
      if (scripts.some(w => t.includes(w))) {
        const idx = parseInt(idxStr);
        return { action: isComplete ? 'complete' : 'read', pos: idx };
      }
    }

    if (t.includes('how many') || t.includes('kitne') || t.includes('en order') ||
        t.includes('enni') || t.includes('yenni') || t.includes('evvalavu')) {
      return { action: 'count' };
    }
    if (t.includes('help') || t.includes('madad') || t.includes('udhavi')) {
      return { action: 'help' };
    }
    // Open/close — require context to avoid false positives
    const openWords  = ['open the shop','open shop','open karo','shop open','kholo',
                        'thira','tirappu','thiravu',    // Tamil romanised
                        'tegadu','open chey',           // Telugu romanised  
                        'tholachu','sakunnu',           // Malayalam
                        'hudugide','open madу',         // Kannada
                        'shop kholo','dukan kholo'];    // Hindi
    const closeWords = ['close the shop','close shop','band karo','shop band','band karo',
                        'moodu','mooду',                // Tamil/Kannada romanised
                        'close chey','veseyyi',         // Telugu romanised
                        'adachu',                       // Malayalam romanised
                        'dukan band','shop band karo']; // Hindi
    if (openWords.some(w => t.includes(w)))  return { action: 'open' };
    if (closeWords.some(w => t.includes(w))) return { action: 'close' };

    return null;
  }

    /* ── Execute command ────────────────────────────────────── */
  async function executeCommand(cmd) {
    // Pause recognition for 2.5s after any command fires
    // This prevents the mic picking up Lucky's own voice response
    // and re-triggering the same command
    if (recognition && recognizing) {
      try { recognition.stop(); } catch(_) {}
      setTimeout(() => {
        if (!enabled || recognizing) return;
        try { recognition.start(); } catch(_) {}
      }, 2500);
    }

    const waiting = queueRef.filter(r => r.status === 'waiting');
    const serving = queueRef.filter(r => r.status === 'serving');
    const all     = [...serving, ...waiting];

    if (cmd.action === 'count') {
      speak(waiting.length === 0 ? t('noOrders') : t('orderCount', { n: waiting.length }), true);
      return;
    }
    if (cmd.action === 'help') {
      speak(t('notUnderstood'), true);
      return;
    }
    if (cmd.action === 'open' || cmd.action === 'close') {
      const wantOpen = cmd.action === 'open';
      // Call toggleStatus only if current state differs from desired state
      // This prevents the infinite loop where it keeps flipping
      const track = document.getElementById('toggleTrack');
      const isCurrentlyOpen = track?.classList.contains('open');
      if (isCurrentlyOpen === wantOpen) {
        // Already in desired state — just confirm
        speak('Shop is already ' + (wantOpen ? 'open' : 'closed'), true);
      } else {
        // Need to change state — call once only
        if (typeof toggleStatus === 'function') toggleStatus();
        speak('Shop is now ' + (wantOpen ? 'open' : 'closed'), true);
      }
      return;
    }

    let idx = cmd.pos === 'next'
      ? (serving.length > 0 ? serving.length : 0)
      : cmd.pos;

    const row = all[idx];
    if (!row) {
      speak(t('notFound'), true);
      return;
    }

    const pos    = posWord(idx + 1);
    const svc    = row.selected_service || 'order';
    const name   = row.customer_name   || 'customer';

    if (cmd.action === 'read') {
      playChime('wake');
      speak(t('readOrder', { pos, service: svc, name }), true);
    }

    if (cmd.action === 'complete') {
      playChime('done');
      speak(t('orderReady', { pos, name }), true);
      setTimeout(async () => {
        if (row.status === 'waiting' && startServingFn) {
          await startServingFn(row.id);
          await new Promise(r => setTimeout(r, 600));
        }
        if (completeFn) await completeFn(row.id);
      }, 1800);
    }
  }

  /* ── Wake word + command recognition ───────────────────── */
  let lastCommandTime = 0;       // timestamp of last executed command
  const CMD_COOLDOWN  = 4000;    // ms to block new commands after executing one
  let lastTranscript  = '';

  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const r          = new SR();
    r.continuous     = true;
    r.interimResults = true;   // need this to catch wake word quickly
    r.lang           = currentLang;
    r.maxAlternatives = 3;

    r.onstart = () => { recognizing = true; };
    r.onend   = () => {
      recognizing = false;
      if (!enabled) return;
      // Always restart — this is the "always-on hotword" behaviour
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        if (!enabled || recognizing) return;
        try { r.start(); } catch (_) {}
      }, 200);
    };

    r.onerror = (e) => {
      recognizing = false;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        toast('Microphone permission denied. Go to browser settings → allow microphone for skipQs.', 'error');
        enabled = false; updateUI(false, true); return;
      }
      // For other errors, just restart
      if (enabled) {
        restartTimer = setTimeout(() => {
          if (!enabled || recognizing) return;
          try { r.start(); } catch (_) {}
        }, 500);
      }
    };

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Check all alternatives, not just the top one
        let bestTranscript = '';
        for (let alt = 0; alt < e.results[i].length; alt++) {
          const candidate = e.results[i][alt].transcript.toLowerCase().trim();
          if (candidate.length > bestTranscript.length) bestTranscript = candidate;
        }
        const transcript = bestTranscript || e.results[i][0].transcript.toLowerCase().trim();
        const isFinal    = e.results[i].isFinal;

        // ── WAKE WORD: check on BOTH interim and final ──────
        // This makes it much more responsive
        if (!awake) {
          if (WAKE_WORDS.some(w => transcript.includes(w))) {
            awake = true;
            clearTimeout(sleepTimer);
            playChime('wake');
            speak(t('listening'), true);
            updateUI(true);
            sleepTimer = setTimeout(() => { awake = false; updateUI(false); }, 12000);
          }
          continue;
        }

        // ── COMMAND: only on final results ──────────────────
        if (!isFinal) continue;

        // Cooldown: ignore commands within 3s of last execution
        const now = Date.now();
        if (now - lastCommandTime < CMD_COOLDOWN) continue;
        // Skip exact duplicate transcript (belt-and-braces)
        if (transcript === lastTranscript && (now - lastCommandTime) < 8000) continue;
        lastTranscript = transcript;

        clearTimeout(sleepTimer);
        const cmd = parseCommand(transcript);
        if (cmd) {
          lastCommandTime = now;  // lock out new commands for 3s
          awake = false;          // ALWAYS sleep after any command — must say "Hey Lucky" again
          updateUI(false);
          executeCommand(cmd);
        } else if (transcript.length > 2) {
          // Only say "not understood" for real speech, not noise
          speak(t('notUnderstood'), true);
        }
        // Return to sleep state
        sleepTimer = setTimeout(() => { awake = false; updateUI(false); }, 5000);
      }
    };

    return r;
  }

  /* ── Public: announce new order (called from dashboard) ── */
  function announceNewOrder(customerName, serviceName) {
    playChime('order');
    // Speak after short delay so chime finishes first
    setTimeout(() => {
      speak(t('newOrder', {
        name:    customerName || 'a customer',
        service: serviceName  || 'an order'
      }), true);
    }, 900);
  }

  /* ── SVG mic icon (renders consistently on all platforms) ── */
  function _micSVG(color) {
    const c = color || '#23e5db';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3"/>
      <path d="M19 10a7 7 0 0 1-14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="9" y1="22" x2="15" y2="22"/>
    </svg>`;
  }

  /* ── UI ─────────────────────────────────────────────────── */
  function injectUI() {
    if (document.getElementById('luckyBtn')) return;

    const style = document.createElement('style');
    style.textContent = `
      #luckyBtn {
        position:fixed;bottom:90px;right:18px;z-index:8000;
        width:56px;height:56px;border-radius:50%;
        background:#002f34;border:2.5px solid #23e5db;
        color:#23e5db;font-size:1.4rem;
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3);
        transition:.2s;font-family:inherit;outline:none;
      }
      #luckyBtn:hover{transform:scale(1.08);}
      #luckyBtn.listening{background:#23e5db;color:#002f34;animation:luckyPulse 1.4s ease-in-out infinite;border-color:#002f34;}
      #luckyBtn.awake{background:#16a34a;color:white;border-color:#16a34a;animation:luckyPulse .9s ease-in-out infinite;}
      #luckyBtn.off{opacity:.55;}
      @keyframes luckyPulse{
        0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.3);}
        50%{box-shadow:0 4px 28px rgba(35,229,219,.7),0 0 0 10px rgba(35,229,219,.12);}
      }
      #luckyStatus{
        position:fixed;bottom:152px;right:14px;z-index:8000;
        background:#002f34;color:white;font-size:.7rem;font-weight:700;
        padding:.3rem .65rem;border-radius:50px;border:1px solid rgba(35,229,219,.4);
        pointer-events:none;white-space:nowrap;font-family:'Inter',sans-serif;
        opacity:0;transition:opacity .3s;
      }
      #luckyStatus.show{opacity:1;}
      /* First-use tooltip on desktop */
      #luckyBtn.off::after{
        content:'Tap to activate';
        position:absolute;right:68px;top:50%;transform:translateY(-50%);
        background:#002f34;color:#23e5db;font-size:.72rem;font-weight:700;
        padding:.3rem .7rem;border-radius:8px;white-space:nowrap;
        border:1px solid rgba(35,229,219,.3);pointer-events:none;
        opacity:0;transition:opacity .2s;
      }
      #luckyBtn.off:hover::after{opacity:1;}
      #luckyLangSel{
        position:fixed;bottom:92px;right:82px;z-index:8000;
        background:white;border:1.5px solid #e2e8f0;border-radius:10px;
        padding:.45rem .65rem;font-size:.8rem;font-family:inherit;
        cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.12);
      }
    `;
    document.head.appendChild(style);

    // Language selector
    const langSel = document.createElement('select');
    langSel.id = 'luckyLangSel';
    langSel.title = 'Voice language';
    langSel.innerHTML = `
      <option value="en-IN">🇬🇧 English</option>
      <option value="hi-IN">🇮🇳 हिंदी</option>
      <option value="ta-IN">தமிழ்</option>
      <option value="te-IN">తెలుగు</option>
      <option value="kn-IN">ಕನ್ನಡ</option>
      <option value="ml-IN">മലയാളം</option>
      <option value="mr-IN">मराठी</option>
      <option value="bn-IN">বাংলা</option>
      <option value="gu-IN">ગુજરાતી</option>
    `;
    langSel.value = currentLang;
    langSel.onchange = (e) => {
      currentLang = e.target.value;
      // Reset dedup state so new language works fresh
      lastTranscript  = '';
      lastCommandTime = 0;
      awake = false;
      if (recognition && recognizing) {
        try { recognition.stop(); } catch(_){}
      }
      recognition = setupRecognition();
      if (enabled) {
        setTimeout(() => {
          try { recognition.start(); recognizing = true; } catch(_){}
          updateUI(false);
        }, 400);
      }
      toast('Language changed: ' + e.target.options[e.target.selectedIndex].text + ' — say "Hey Lucky" to test');
    };
    document.body.appendChild(langSel);

    // Mic button
    const btn   = document.createElement('button');
    btn.id      = 'luckyBtn';
    btn.title   = 'Hey Lucky — Voice Assistant';
    btn.innerHTML = _micSVG();
    btn.onclick   = toggleVoice;
    document.body.appendChild(btn);

    // Status pill
    const status = document.createElement('div');
    status.id = 'luckyStatus';
    document.body.appendChild(status);
  }

  function updateUI(isAwake, isDisabled = false) {
    const btn    = document.getElementById('luckyBtn');
    const status = document.getElementById('luckyStatus');
    if (!btn) return;

    if (isDisabled) {
      btn.className = 'off';
      btn.innerHTML = '✕';
      btn.title = 'Microphone blocked — tap to retry';
    } else if (isAwake) {
      btn.className = 'awake';
      btn.innerHTML = _micSVG('white');
      btn.title = 'Listening for command…';
    } else if (enabled) {
      btn.className = 'listening';
      btn.innerHTML = _micSVG('#002f34');
      btn.title = 'Listening — say "Hey Lucky"';
    } else {
      btn.className = 'off';
      btn.innerHTML = _micSVG('#23e5db');
      btn.title = 'Tap to activate voice assistant';
    }

    if (status) {
      status.textContent = isDisabled ? 'Mic blocked — allow in browser settings'
                         : isAwake    ? 'Listening… give a command'
                         : enabled    ? 'Say "Hey Lucky"'
                         : 'Tap mic to activate voice';
      status.className = 'show';  // always show so user knows what to do
    }
  }

  function toggleVoice() {
    unlockAudio(); // unlock audio context on tap
    if (!recognition) {
      recognition = setupRecognition();
      if (!recognition) {
        toast('Voice assistant not supported. Please use Chrome on Android.', 'error');
        return;
      }
    }
    if (enabled) {
      enabled = false; awake = false;
      clearTimeout(sleepTimer); clearTimeout(restartTimer);
      try { recognition.stop(); } catch(_){}
      updateUI(false);
      toast('Voice assistant off');
    } else {
      enabled = true;
      try { recognition.start(); recognizing = true; } catch(_){}
      updateUI(false);
      toast('🎤 Say "Hey Lucky" to start');
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init(options = {}) {
    if (options.completeFn)     completeFn     = options.completeFn;
    if (options.startServingFn) startServingFn = options.startServingFn;
    injectUI();
    loadVoices();

    // AUTO-START: enable mic automatically on touch/mobile devices only.
    // Desktop Chrome blocks recognition.start() without a user gesture.
    // On mobile/tablet, start automatically after 2 seconds.
    const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (isTouchDevice) {
      setTimeout(() => {
        if (enabled) return;
        recognition = setupRecognition();
        if (!recognition) return;
        enabled = true;
        try { recognition.start(); recognizing = true; } catch(_) {}
        updateUI(false);
      }, 2000);
    }
    // Desktop: show a clear "tap to activate" tooltip on the button
  }

  function updateQueue(rows) { queueRef = rows || []; }

  return { init, updateQueue, speak, announceNewOrder };

})();

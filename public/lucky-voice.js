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
    'hey lucky', 'hey luckey', 'hey luki', 'hey lacky',
    'a lucky', 'ok lucky', 'hello lucky',
    'लकी', 'हे लकी', 'ஹே லக்கி', 'హే లకీ', 'ಹೇ ಲಕ್ಕಿ', 'ഹേ ലക്കി'
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

    // Pick best available voice
    const voices   = window.speechSynthesis.getVoices();
    const langCode = currentLang.slice(0, 2);
    const preferred = voices.find(v => v.lang === currentLang)
                   || voices.find(v => v.lang.startsWith(langCode))
                   || voices.find(v => v.lang.startsWith('en'))
                   || null;
    if (preferred) utt.voice = preferred;

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

    // Position keywords — map to 0-based index
    const posPatterns = [
      { idx: 0, words: ['first','1st','one','number one','पहला','முதல்','మొదటి','ಮೊದಲ','ആദ്യ'] },
      { idx: 1, words: ['second','2nd','two','number two','दूसरा','இரண்டாவது','రెండవ','ఎரڈو','ರెండನೇ','రెண్డవ','రెండాం'] },
      { idx: 2, words: ['third','3rd','three','तीसरा','மூன்றாவது','మూడవ'] },
      { idx: 3, words: ['fourth','4th','four','चौथा'] },
      { idx: 'next', words: ['next','अगला','அடுத்த','తదుపరి','ಮುಂದಿನ','അടുത്ത'] },
    ];

    const isComplete = t.includes('pack') || t.includes('ready') || t.includes('done') ||
                       t.includes('complet') || t.includes('finish') ||
                       t.includes('तैयार') || t.includes('ரெடி') || t.includes('రెడీ') ||
                       t.includes('ರೆಡಿ') || t.includes('റെഡി');

    for (const { idx, words } of posPatterns) {
      if (words.some(w => t.includes(w))) {
        return { action: isComplete ? 'complete' : 'read', pos: idx };
      }
    }

    if (t.includes('how many') || t.includes('kitne') || t.includes('कितने') ||
        t.includes('எத்தனை') || t.includes('ఎన్ని') || t.includes('ಎಷ್ಟು')) {
      return { action: 'count' };
    }
    if (t.includes('help') || t.includes('मदद') || t.includes('உதவி')) {
      return { action: 'help' };
    }
    if (t.includes('open') || t.includes('खोलो') || t.includes('திற'))  return { action: 'open' };
    if (t.includes('close') || t.includes('बंद')  || t.includes('மூடு')) return { action: 'close' };

    return null;
  }

  /* ── Execute command ────────────────────────────────────── */
  async function executeCommand(cmd) {
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
      document.querySelector('[onclick="toggleStatus()"]')?.click();
      speak(cmd.action === 'open' ? 'Shop is now open' : 'Shop is now closed', true);
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
  let lastTranscript = '';

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

        // Skip if same as last (avoid duplicate firing)
        if (transcript === lastTranscript) continue;
        lastTranscript = transcript;

        clearTimeout(sleepTimer);
        const cmd = parseCommand(transcript);
        if (cmd) {
          executeCommand(cmd);
        } else {
          speak(t('notUnderstood'), true);
        }
        // Sleep after command handled
        sleepTimer = setTimeout(() => { awake = false; updateUI(false); }, 10000);
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
      if (recognition && recognizing) {
        try { recognition.stop(); } catch(_){}
      }
      recognition = setupRecognition();
      if (enabled) {
        setTimeout(() => { try { recognition.start(); recognizing = true; } catch(_){} }, 300);
      }
      toast('Language: ' + e.target.options[e.target.selectedIndex].text);
    };
    document.body.appendChild(langSel);

    // Mic button
    const btn   = document.createElement('button');
    btn.id      = 'luckyBtn';
    btn.title   = 'Hey Lucky — Voice Assistant';
    btn.innerHTML = '🎤';
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
      btn.innerHTML = '🚫';
      btn.title = 'Microphone blocked — tap to retry';
    } else if (isAwake) {
      btn.className = 'awake';
      btn.innerHTML = '🗣️';
    } else if (enabled) {
      btn.className = 'listening';
      btn.innerHTML = '🎙️';
    } else {
      btn.className = 'off';
      btn.innerHTML = '🎤';
    }

    if (status) {
      status.textContent = isDisabled ? '🚫 Mic blocked'
                         : isAwake    ? '🟢 Listening for command…'
                         : enabled    ? '🔵 Say "Hey Lucky"'
                         : '';
      status.className = (enabled || isDisabled) ? 'show' : '';
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

    // AUTO-START: enable mic automatically after 2 seconds
    // (needs slight delay so browser registers the page as active)
    setTimeout(() => {
      if (enabled) return; // already started
      recognition = setupRecognition();
      if (!recognition) return;
      enabled = true;
      try { recognition.start(); recognizing = true; } catch(_){}
      updateUI(false);
    }, 2000);
  }

  function updateQueue(rows) { queueRef = rows || []; }

  return { init, updateQueue, speak, announceNewOrder };

})();

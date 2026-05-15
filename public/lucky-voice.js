/* ============================================================
   skipQs — "Hey Lucky" Voice Assistant  (lucky-voice.js)

   FREE. No API key. Uses only browser-native APIs:
   • SpeechRecognition  — listens for wake word + commands
   • SpeechSynthesis    — reads orders aloud
   • Works in English, Hindi, Tamil, Telugu, Kannada, Malayalam

   COMMANDS (after saying "Hey Lucky"):
   ─────────────────────────────────────────────────────────
   "first order"          → reads order 1 aloud
   "second order"         → reads order 2 aloud
   "next order"           → reads next pending order
   "how many orders"      → tells total queue count
   "first order packed"   → marks order 1 complete + alerts customer
   "second order packed"  → marks order 2 complete + alerts customer
   "next order packed"    → marks next order complete

   HINDI  — "पहला ऑर्डर" / "पहला ऑर्डर तैयार"
   TAMIL  — "முதல் ஆர்டர்" / "முதல் ஆர்டர் ரெடி"
   TELUGU — "మొదటి ఆర్డర్" / "మొదటి ఆర్డర్ రెడీ"
   ============================================================ */

window.LuckyVoice = (function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  const WAKE_WORDS  = ['hey lucky', 'hey luckey', 'hey luki', 'लकी', 'ஹே லக்கி'];
  const LANG_VOICES = {
    en: ['en-IN', 'en-GB', 'en-US'],
    hi: ['hi-IN'],
    ta: ['ta-IN'],
    te: ['te-IN'],
    kn: ['kn-IN'],
    ml: ['ml-IN']
  };

  /* ── State ──────────────────────────────────────────────── */
  let recognition    = null;
  let awake          = false;         // true after wake word heard
  let sleepTimer     = null;          // auto-sleep after 8s of silence
  let currentLang    = 'en-IN';
  let onMic          = false;
  let queueRef       = [];            // live reference to active queue rows
  let completeFn     = null;          // injected: (id) => completeService(id)
  let startServingFn = null;          // injected: (id) => startServing(id)
  let enabled        = false;

  /* ── Speech Synthesis ───────────────────────────────────── */
  function speak(text, priority = false) {
    if (!window.speechSynthesis) return;
    if (priority) window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = currentLang;
    utt.rate   = 0.92;
    utt.pitch  = 1.05;
    utt.volume = 1.0;

    // Pick best available voice for the language
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      LANG_VOICES[currentLang.slice(0,2)]?.some(l => v.lang.startsWith(l.slice(0,5)))
    ) || voices.find(v => v.lang.startsWith('en')) || null;
    if (preferred) utt.voice = preferred;

    window.speechSynthesis.speak(utt);
    return utt;
  }

  /* ── Order text builder ─────────────────────────────────── */
  function buildOrderText(row, position) {
    const svc  = row.selected_service || 'your order';
    const name = row.customer_name    || 'customer';
    const pos  = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : `number ${position}`;

    if (currentLang.startsWith('hi')) {
      return `${pos === 'first' ? 'पहला' : pos === 'second' ? 'दूसरा' : pos} ऑर्डर — ${svc} — ${name} के लिए`;
    }
    if (currentLang.startsWith('ta')) {
      return `${pos === 'first' ? 'முதல்' : pos === 'second' ? 'இரண்டாவது' : pos} ஆர்டர் — ${svc} — ${name} க்காக`;
    }
    if (currentLang.startsWith('te')) {
      return `${pos === 'first' ? 'మొదటి' : pos === 'second' ? 'రెండవ' : pos} ఆర్డర్ — ${svc} — ${name} కోసం`;
    }
    return `Order ${pos}: ${svc} for ${name}`;
  }

  function readyText(row, position) {
    const name = row.customer_name || 'customer';
    const pos  = position === 1 ? 'first' : position === 2 ? 'second' : `number ${position}`;
    if (currentLang.startsWith('hi'))
      return `${pos === 'first' ? 'पहला' : 'दूसरा'} ऑर्डर तैयार है। ${name} को सूचना भेजी जा रही है।`;
    if (currentLang.startsWith('ta'))
      return `${pos === 'first' ? 'முதல்' : 'இரண்டாவது'} ஆர்டர் ரெடி. ${name} க்கு தகவல் அனுப்புகிறோம்.`;
    if (currentLang.startsWith('te'))
      return `${pos === 'first' ? 'మొదటి' : 'రెండవ'} ఆర్డర్ రెడీ. ${name} కి నోటిఫికేషన్ పంపుతున్నాం.`;
    return `Order ${pos} is ready. Notifying ${name} now.`;
  }

  /* ── Command parser ─────────────────────────────────────── */
  function parseCommand(transcript) {
    const t = transcript.toLowerCase().trim();

    // ── ORDER READ COMMANDS ──────────────────────────────────
    const readMap = [
      { patterns: ['first order','1st order','number one','पहला ऑर्डर','முதல் ஆர்டர்','మొదటి ఆర్డర్'], pos: 0 },
      { patterns: ['second order','2nd order','number two','दूसरा ऑर्डर','இரண்டாவது ஆர்டர்','రెండవ ఆర్డర్'], pos: 1 },
      { patterns: ['third order','3rd order','number three'], pos: 2 },
      { patterns: ['next order','next one','अगला ऑर्डर','அடுத்த ஆர்டர்'], pos: 'next' },
    ];

    for (const { patterns, pos } of readMap) {
      const isRead = patterns.some(p => t.includes(p));
      if (!isRead) continue;
      // Check if "packed" or "ready" also in transcript — that's a complete command
      const isComplete = t.includes('packed') || t.includes('ready') || t.includes('done') ||
                         t.includes('तैयार') || t.includes('ரெடி') || t.includes('రెడీ');
      return { action: isComplete ? 'complete' : 'read', pos };
    }

    // ── QUEUE STATUS ─────────────────────────────────────────
    if (t.includes('how many') || t.includes('kitne') || t.includes('எத்தனை') || t.includes('ఎన్ని')) {
      return { action: 'count' };
    }

    // ── OPEN/CLOSE ───────────────────────────────────────────
    if (t.includes('open') || t.includes('खोलो') || t.includes('திற')) return { action: 'open' };
    if (t.includes('close') || t.includes('बंद') || t.includes('மூடு'))  return { action: 'close' };

    // ── HELP ─────────────────────────────────────────────────
    if (t.includes('help') || t.includes('मदद') || t.includes('உதவி')) return { action: 'help' };

    return null;
  }

  /* ── Execute command ────────────────────────────────────── */
  async function executeCommand(cmd) {
    const waiting = queueRef.filter(r => r.status === 'waiting');
    const serving = queueRef.filter(r => r.status === 'serving');
    const all     = [...serving, ...waiting]; // serving first

    if (cmd.action === 'count') {
      const n = waiting.length;
      if (n === 0) speak(currentLang.startsWith('hi') ? 'अभी कोई ऑर्डर नहीं है' : 'No orders waiting right now', true);
      else speak(currentLang.startsWith('hi') ? `${n} ऑर्डर बाकी हैं` : `${n} order${n > 1 ? 's' : ''} waiting`, true);
      return;
    }

    if (cmd.action === 'help') {
      speak('Say: first order, second order, next order, first order packed, how many orders', true);
      return;
    }

    if (cmd.action === 'open') {
      document.querySelector('[onclick="toggleStatus()"]')?.click();
      speak('Shop is now open', true);
      return;
    }

    if (cmd.action === 'close') {
      document.querySelector('[onclick="toggleStatus()"]')?.click();
      speak('Shop is now closed', true);
      return;
    }

    // Resolve position
    let idx = cmd.pos;
    if (cmd.pos === 'next') {
      idx = serving.length > 0 ? all.indexOf(waiting[0]) : 0;
    }

    const row = all[idx];
    if (!row) {
      speak(idx === 0
        ? (currentLang.startsWith('hi') ? 'कोई ऑर्डर नहीं है' : 'No order at that position')
        : 'Order not found', true);
      return;
    }

    if (cmd.action === 'read') {
      speak(buildOrderText(row, idx + 1), true);
    }

    if (cmd.action === 'complete') {
      speak(readyText(row, idx + 1), true);
      // Mark as serving first if still waiting, then complete after speak
      setTimeout(async () => {
        if (row.status === 'waiting' && startServingFn) {
          await startServingFn(row.id);
          await new Promise(r => setTimeout(r, 500));
        }
        if (completeFn) await completeFn(row.id);
      }, 1500);
    }
  }

  /* ── Wake word listener ─────────────────────────────────── */
  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const r = new SR();
    r.continuous     = true;
    r.interimResults = true;
    r.lang           = currentLang;
    r.maxAlternatives = 3;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();

        if (!awake) {
          // Check for wake word
          if (WAKE_WORDS.some(w => t.includes(w))) {
            awake = true;
            clearTimeout(sleepTimer);
            speak(currentLang.startsWith('hi') ? 'हाँ बोलिए' :
                  currentLang.startsWith('ta') ? 'சொல்லுங்கள்' :
                  currentLang.startsWith('te') ? 'చెప్పండి' : 'Yes, I am listening', true);
            updateUI(true);
            // Auto-sleep after 10s
            sleepTimer = setTimeout(() => {
              awake = false;
              updateUI(false);
            }, 10000);
          }
          continue;
        }

        // We're awake — parse command from final results
        if (e.results[i].isFinal) {
          clearTimeout(sleepTimer);
          const cmd = parseCommand(t);
          if (cmd) {
            executeCommand(cmd);
          } else {
            speak(currentLang.startsWith('hi') ? 'माफ करें, समझ नहीं आया' :
                  'Sorry, I didn\'t understand that', true);
          }
          // Sleep after command
          sleepTimer = setTimeout(() => { awake = false; updateUI(false); }, 8000);
        }
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech') return; // normal
      console.warn('[Lucky] Speech error:', e.error);
      if (e.error === 'not-allowed') {
        toast('Microphone permission denied — cannot use voice assistant', 'error');
        enabled = false;
        updateUI(false, true);
      }
    };

    r.onend = () => {
      if (enabled && onMic) {
        // Auto-restart so it keeps listening
        try { r.start(); } catch (_) {}
      }
    };

    return r;
  }

  /* ── UI: mic button + status indicator ─────────────────── */
  function injectUI() {
    if (document.getElementById('luckyBtn')) return;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #luckyBtn {
        position: fixed; bottom: 90px; right: 18px; z-index: 8000;
        width: 56px; height: 56px; border-radius: 50%;
        background: #002f34; border: 2.5px solid #23e5db;
        color: #23e5db; font-size: 1.4rem;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,.3);
        transition: .2s; font-family: inherit;
      }
      #luckyBtn:hover { transform: scale(1.08); }
      #luckyBtn.listening { background: #23e5db; color: #002f34; animation: luckyPulse 1.2s ease-in-out infinite; border-color:#002f34; }
      #luckyBtn.awake    { background: #16a34a; color: white; border-color:#16a34a; animation: luckyPulse .8s ease-in-out infinite; }
      #luckyBtn.disabled { opacity: .4; cursor: not-allowed; }
      @keyframes luckyPulse { 0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.3)} 50%{box-shadow:0 4px 28px rgba(35,229,219,.6),0 0 0 8px rgba(35,229,219,.15)} }
      #luckyStatus {
        position: fixed; bottom: 152px; right: 12px; z-index: 8000;
        background: #002f34; color: white; font-size: .72rem; font-weight: 700;
        padding: .35rem .7rem; border-radius: 50px; border: 1px solid #23e5db;
        display: none; white-space: nowrap; pointer-events: none;
        font-family: 'Inter', sans-serif;
      }
      #luckyLangSel {
        position: fixed; bottom: 90px; right: 82px; z-index: 8000;
        background: white; border: 1.5px solid #e2e8f0; border-radius: 8px;
        padding: .4rem .6rem; font-size: .78rem; font-family: inherit;
        cursor: pointer; display: none;
      }
      #luckyBtn:hover ~ #luckyLangSel,
      #luckyLangSel:hover { display: block; }
    `;
    document.head.appendChild(style);

    // Language selector
    const langSel = document.createElement('select');
    langSel.id = 'luckyLangSel';
    langSel.title = 'Assistant language';
    langSel.innerHTML = `
      <option value="en-IN">🇬🇧 English</option>
      <option value="hi-IN">🇮🇳 हिंदी</option>
      <option value="ta-IN">தமிழ்</option>
      <option value="te-IN">తెలుగు</option>
      <option value="kn-IN">ಕನ್ನಡ</option>
      <option value="ml-IN">മലയാളം</option>
    `;
    langSel.onchange = (e) => {
      currentLang = e.target.value;
      if (recognition) { try { recognition.stop(); } catch(_){} }
      recognition = setupRecognition();
      if (enabled) { try { recognition.start(); onMic = true; } catch(_){} }
      toast('Language changed to ' + e.target.options[e.target.selectedIndex].text);
    };
    document.body.appendChild(langSel);

    // Mic button
    const btn = document.createElement('button');
    btn.id    = 'luckyBtn';
    btn.title = 'Hey Lucky — Voice Assistant';
    btn.innerHTML = '🎤';
    btn.onclick = toggleVoice;
    document.body.appendChild(btn);

    // Status label
    const status = document.createElement('div');
    status.id = 'luckyStatus';
    document.body.appendChild(status);
  }

  function updateUI(isAwake, isDisabled = false) {
    const btn    = document.getElementById('luckyBtn');
    const status = document.getElementById('luckyStatus');
    if (!btn) return;
    btn.className = isDisabled ? 'disabled' : isAwake ? 'awake' : (enabled ? 'listening' : '');
    btn.innerHTML = isDisabled ? '🚫' : isAwake ? '🗣️' : (enabled ? '🎙️' : '🎤');
    if (status) {
      status.style.display = enabled ? 'block' : 'none';
      status.textContent = isAwake ? '🟢 Listening…' : '🔵 Say "Hey Lucky"';
    }
  }

  function toggleVoice() {
    if (!recognition) {
      recognition = setupRecognition();
      if (!recognition) {
        toast('Voice not supported on this browser. Use Chrome on Android.', 'error');
        return;
      }
    }
    if (enabled) {
      enabled = false; onMic = false; awake = false;
      try { recognition.stop(); } catch(_) {}
      updateUI(false);
      toast('Voice assistant off');
    } else {
      enabled = true;
      try { recognition.start(); onMic = true; } catch(_) {}
      updateUI(false);
      toast('🎤 Say "Hey Lucky" to give a command');
      // Load voices (async on some browsers)
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
    }
  }

  /* ── Public API ─────────────────────────────────────────── */
  function init(options = {}) {
    if (options.completeFn)     completeFn     = options.completeFn;
    if (options.startServingFn) startServingFn = options.startServingFn;
    injectUI();
    // Pre-load voices
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  // Called by provider dashboard on every queue refresh
  function updateQueue(rows) {
    queueRef = rows || [];
  }

  return { init, updateQueue, speak };
})();

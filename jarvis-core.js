/* =========================================================
   ASHINA · JARVIS CORE 1.3
   Voice + AI command engine + Music control
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     CONFIG
     --------------------------------------------------------- */

  const CONFIG = {
    name: "JARVIS",
    project: "ASHINA",
    version: "1.3",

    storage: {
      memory: "ashina_jarvis_memory",
      history: "ashina_jarvis_history",
      settings: "ashina_jarvis_settings"
    },

    maxHistory: 100,
    maxMemories: 100,
    visibleHistory: 15,

    speech: {
      language: "ru-RU",

      // Киношная подача:
      // чуть ниже голос, спокойнее скорость
      rate: 0.92,
      pitch: 0.82,
      volume: 1.0
    }
  };

  /* ---------------------------------------------------------
     DEFAULT SETTINGS
     --------------------------------------------------------- */

  const DEFAULT_SETTINGS = {
    voice: true,
    speech: true,
    fastMode: false,
    mode: "LOCAL",
    aiMode: "LOCAL"
  };

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */

  const state = {
    ready: true,
    status: "ready",

    lastCommand: "",
    lastTopic: "",
    lastUserMessage: "",
    lastAIMessage: "",

    commandCount: 0,

    voiceListening: false,
    recognitionStarting: false,

    speechSupported:
      typeof window !== "undefined" &&
      "speechSynthesis" in window,

    recognitionSupported:
      typeof window !== "undefined" &&
      (
        "SpeechRecognition" in window ||
        "webkitSpeechRecognition" in window
      ),

    memory: [],
    history: [],

    settings: {
      ...DEFAULT_SETTINGS
    },

    recognition: null
  };

  /* ---------------------------------------------------------
     COMMAND QUEUE
     --------------------------------------------------------- */

  let commandQueue = Promise.resolve();

  function enqueue(task) {
    const run = commandQueue.then(() => task());

    commandQueue = run.catch(() => undefined);

    return run;
  }

  /* ---------------------------------------------------------
     HELPERS
     --------------------------------------------------------- */

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[!?.,;:()[\]{}"'«»]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeString(value) {
    return String(value ?? "");
  }

  function escapeHTML(value) {
    return safeString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nowTime() {
    return new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function nowDate() {
    return new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function randomItem(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return items[Math.floor(Math.random() * items.length)];
  }

  /* ---------------------------------------------------------
     LOCAL STORAGE
     --------------------------------------------------------- */

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);

      return parsed ?? fallback;
    } catch (error) {
      console.warn("[JARVIS] loadJSON:", error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("[JARVIS] saveJSON:", error);
      return false;
    }
  }

  /* ---------------------------------------------------------
     MEMORY
     --------------------------------------------------------- */

  function loadMemory() {
    const data = loadJSON(
      CONFIG.storage.memory,
      []
    );

    state.memory = Array.isArray(data)
      ? data.slice(-CONFIG.maxMemories)
      : [];
  }

  function saveMemory() {
    state.memory = state.memory.slice(
      -CONFIG.maxMemories
    );

    saveJSON(
      CONFIG.storage.memory,
      state.memory
    );
  }

  function remember(text) {
    const value = safeString(text).trim();

    if (!value) {
      return false;
    }

    state.memory.push({
      text: value,
      time: Date.now()
    });

    saveMemory();

    return true;
  }

  function clearMemory() {
    state.memory = [];
    saveMemory();
    return true;
  }

  function getMemory() {
    return [...state.memory];
  }

  function renderMemory() {
    if (!state.memory.length) {
      return "В памяти пока ничего нет.";
    }

    return state.memory
      .slice(-10)
      .map((item, index) => {
        return `${index + 1}. ${item.text}`;
      })
      .join("\n");
  }

  /* ---------------------------------------------------------
     HISTORY
     --------------------------------------------------------- */

  function loadHistory() {
    const data = loadJSON(
      CONFIG.storage.history,
      []
    );

    state.history = Array.isArray(data)
      ? data.slice(-CONFIG.maxHistory)
      : [];
  }

  function saveHistory() {
    state.history = state.history.slice(
      -CONFIG.maxHistory
    );

    saveJSON(
      CONFIG.storage.history,
      state.history
    );
  }

  function addHistory(role, text) {
    const message = {
      role: safeString(role),
      text: safeString(text),
      time: Date.now()
    };

    state.history.push(message);
    saveHistory();

    return message;
  }

  function getContext() {
    return state.history
      .slice(-CONFIG.visibleHistory)
      .map(item => ({
        role: item.role,
        text: item.text
      }));
  }

  function renderHistory() {
    return state.history
      .slice(-CONFIG.visibleHistory)
      .map(item => {
        const label =
          item.role === "user"
            ? "Вы"
            : "JARVIS";

        return `${label}: ${item.text}`;
      })
      .join("\n");
  }

  /* ---------------------------------------------------------
     UI LOG
     --------------------------------------------------------- */

  function getLogElement() {
    return document.getElementById("log");
  }

  function addMessage(role, text) {
    const log = getLogElement();

    addHistory(role, text);

    if (!log) {
      return;
    }

    const row = document.createElement("div");

    row.className =
      role === "user"
        ? "jarvis-message user"
        : "jarvis-message ai";

    row.innerHTML = `
      <div class="jarvis-message-role">
        ${role === "user" ? "YOU" : "JARVIS"}
      </div>
      <div class="jarvis-message-text">
        ${escapeHTML(text)}
      </div>
      <div class="jarvis-message-time">
        ${nowTime()}
      </div>
    `;

    log.appendChild(row);

    while (log.children.length > 50) {
      log.removeChild(log.firstChild);
    }

    log.scrollTop = log.scrollHeight;
  }

  /* ---------------------------------------------------------
     STATUS
     --------------------------------------------------------- */

  function setStatus(status) {
    state.status = status;

    document.documentElement.dataset.jarvisStatus =
      status;

    const elements = document.querySelectorAll(
      "[data-jarvis-status]"
    );

    elements.forEach(element => {
      element.textContent = status;
    });
  }

  /* ---------------------------------------------------------
     SPEECH
     --------------------------------------------------------- */

  let selectedVoice = null;

  function findBestRussianVoice() {
    if (!state.speechSupported) {
      return null;
    }

    const voices =
      window.speechSynthesis.getVoices() || [];

    if (!voices.length) {
      return null;
    }

    const russian = voices.filter(voice => {
      return (
        voice.lang &&
        voice.lang.toLowerCase().startsWith("ru")
      );
    });

    if (!russian.length) {
      return voices[0] || null;
    }

    /*
      Сначала стараемся найти мужской голос.
      Браузер не гарантирует наличие такого голоса,
      поэтому используем fallback.
    */

    const maleWords = [
      "male",
      "муж",
      "man",
      "dmitry",
      "alex",
      "pavel",
      "maxim"
    ];

    const maleVoice = russian.find(voice => {
      const name = (
        voice.name || ""
      ).toLowerCase();

      return maleWords.some(word =>
        name.includes(word)
      );
    });

    return maleVoice || russian[0];
  }

  function refreshVoice() {
    selectedVoice = findBestRussianVoice();
  }

  if (state.speechSupported) {
    refreshVoice();

    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoice();
    };
  }

  function stopSpeaking() {
    if (!state.speechSupported) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn(
        "[JARVIS] stopSpeaking:",
        error
      );
    }

    if (state.status === "speaking") {
      setStatus("ready");
    }
  }

  function speak(text) {
    if (!state.speechSupported) {
      return false;
    }

    if (!state.settings.speech) {
      return false;
    }

    const value = safeString(text).trim();

    if (!value) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(value);

      utterance.lang =
        CONFIG.speech.language;

      /*
        JARVIS 1.3
        Спокойная, уверенная подача.
      */

      utterance.rate =
        CONFIG.speech.rate;

      utterance.pitch =
        CONFIG.speech.pitch;

      utterance.volume =
        CONFIG.speech.volume;

      refreshVoice();

      if (selectedVoice) {
        utterance.voice =
          selectedVoice;
      }

      utterance.onstart = () => {
        setStatus("speaking");
      };

      utterance.onend = () => {
        if (!state.voiceListening) {
          setStatus("ready");
        }
      };

      utterance.onerror = () => {
        setStatus("ready");
      };

      window.speechSynthesis.speak(
        utterance
      );

      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] speak:",
        error
      );

      setStatus("ready");

      return false;
    }
  }

  /* ---------------------------------------------------------
     MUSIC HELPERS
     --------------------------------------------------------- */

  function getAudioElement() {
    return (
      document.getElementById("audio") ||
      document.getElementById("music") ||
      document.querySelector("audio")
    );
  }

  function getMusicButtons(direction) {
    const selectors =
      direction === "next"
        ? [
            "[data-music-next]",
            "[data-next-track]",
            "[data-next-music]",
            "#nextTrack",
            "#nextMusic",
            "#musicNext",
            ".music-next",
            ".next-track"
          ]
        : [
            "[data-music-prev]",
            "[data-previous-track]",
            "[data-prev-track]",
            "[data-prev-music]",
            "#prevTrack",
            "#previousTrack",
            "#prevMusic",
            "#musicPrev",
            ".music-prev",
            ".prev-track"
          ];

    const result = [];

    selectors.forEach(selector => {
      document
        .querySelectorAll(selector)
        .forEach(element => {
          if (!result.includes(element)) {
            result.push(element);
          }
        });
    });

    return result;
  }

  function clickFirstMusicButton(direction) {
    const buttons =
      getMusicButtons(direction);

    if (!buttons.length) {
      return false;
    }

    const button = buttons[0];

    try {
      button.click();
      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] music button:",
        error
      );

      return false;
    }
  }

  function callMusicFunction(names) {
    for (const name of names) {
      try {
        if (
          typeof window[name] ===
          "function"
        ) {
          window[name]();
          return true;
        }
      } catch (error) {
        console.warn(
          "[JARVIS] music function:",
          name,
          error
        );
      }
    }

    return false;
  }

  function getMusicItems() {
    const selectors = [
      "[data-track]",
      "[data-music]",
      "[data-song]",
      "[data-audio]",
      ".track",
      ".music-track",
      ".song",
      ".playlist-item"
    ];

    const items = [];

    selectors.forEach(selector => {
      document
        .querySelectorAll(selector)
        .forEach(element => {
          if (!items.includes(element)) {
            items.push(element);
          }
        });
    });

    return items;
  }

  function activateMusicItem(item) {
    if (!item) {
      return false;
    }

    try {
      item.click();
      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] activate music item:",
        error
      );

      return false;
    }
  }

  function nextMusic() {
    /*
      Сначала используем существующую
      систему приложения.
    */

    if (
      callMusicFunction([
        "nextTrack",
        "nextMusic",
        "playNextTrack",
        "playNextMusic",
        "musicNext"
      ])
    ) {
      return true;
    }

    /*
      Затем ищем существующую кнопку.
    */

    if (
      clickFirstMusicButton("next")
    ) {
      return true;
    }

    /*
      Дополнительный fallback:
      если есть элементы плейлиста,
      пытаемся выбрать следующий.
    */

    const items = getMusicItems();

    if (items.length > 1) {
      const activeIndex =
        items.findIndex(item => {
          return (
            item.classList.contains("active") ||
            item.classList.contains("playing") ||
            item.getAttribute(
              "aria-current"
            ) === "true"
          );
        });

      let nextIndex;

      if (activeIndex < 0) {
        nextIndex = 0;
      } else {
        nextIndex =
          (activeIndex + 1) %
          items.length;
      }

      return activateMusicItem(
        items[nextIndex]
      );
    }

    return false;
  }

  function previousMusic() {
    if (
      callMusicFunction([
        "previousTrack",
        "prevTrack",
        "previousMusic",
        "prevMusic",
        "playPreviousTrack",
        "musicPrev"
      ])
    ) {
      return true;
    }

    if (
      clickFirstMusicButton("prev")
    ) {
      return true;
    }

    const items = getMusicItems();

    if (items.length > 1) {
      const activeIndex =
        items.findIndex(item => {
          return (
            item.classList.contains("active") ||
            item.classList.contains("playing") ||
            item.getAttribute(
              "aria-current"
            ) === "true"
          );
        });

      let previousIndex;

      if (activeIndex <= 0) {
        previousIndex =
          items.length - 1;
      } else {
        previousIndex =
          activeIndex - 1;
      }

      return activateMusicItem(
        items[previousIndex]
      );
    }

    return false;
  }

  function playMusic() {
    if (
      callMusicFunction([
        "playMusic",
        "startMusic",
        "resumeMusic",
        "musicPlay"
      ])
    ) {
      return true;
    }

    const audio = getAudioElement();

    if (!audio) {
      return false;
    }

    try {
      const promise =
        audio.play();

      if (
        promise &&
        typeof promise.catch ===
        "function"
      ) {
        promise.catch(error => {
          console.warn(
            "[JARVIS] play:",
            error
          );
        });
      }

      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] play:",
        error
      );

      return false;
    }
  }

  function stopMusic() {
    if (
      callMusicFunction([
        "stopMusic",
        "pauseMusic",
        "musicStop"
      ])
    ) {
      return true;
    }

    const audio = getAudioElement();

    if (!audio) {
      return false;
    }

    try {
      audio.pause();
      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] stop:",
        error
      );

      return false;
    }
  }

  function toggleMusic() {
    const audio = getAudioElement();

    if (audio) {
      if (audio.paused) {
        return playMusic();
      }

      return stopMusic();
    }

    return callMusicFunction([
      "toggleMusic",
      "musicToggle"
    ]);
  }

  /* ---------------------------------------------------------
     NAVIGATION
     --------------------------------------------------------- */

  function findSection(name) {
    const normalized =
      normalizeText(name);

    const aliases = {
      home: [
        "home",
        "главная",
        "домой"
      ],

      chat: [
        "chat",
        "чат",
        "сообщения"
      ],

      music: [
        "music",
        "музыка",
        "плеер"
      ],

      news: [
        "news",
        "лента",
        "новости"
      ],

      ai: [
        "ai",
        "ии",
        "джарвес",
        "искусственный интеллект"
      ]
    };

    let target = null;

    Object.keys(aliases).forEach(key => {
      if (
        target ||
        !aliases[key].includes(
          normalized
        )
      ) {
        return;
      }

      target = key;
    });

    if (!target) {
      target = normalized;
    }

    const selectors = [
      `[data-section="${target}"]`,
      `section[data-section="${target}"]`,
      `section#${target}`,
      `#${target}`
    ];

    for (const selector of selectors) {
      const element =
        document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function openSection(name) {
    const normalized =
      normalizeText(name);

    const aliases = {
      главная: "home",
      домой: "home",
      чат: "chat",
      сообщения: "chat",
      музыка: "music",
      плеер: "music",
      лента: "news",
      новости: "news",
      ии: "ai",
      джарвес: "ai"
    };

    const target =
      aliases[normalized] ||
      normalized;

    /*
      Сначала пытаемся использовать
      существующую функцию приложения.
    */

    if (
      typeof window.openSection ===
        "function" &&
      window.openSection !==
        openSection
    ) {
      try {
        window.openSection(target);
        return true;
      } catch (_) {}
    }

    if (
      typeof window.showSection ===
        "function"
    ) {
      try {
        window.showSection(target);
        return true;
      } catch (_) {}
    }

    /*
      Ищем кнопку навигации.
    */

    const navSelectors = [
      `[data-section="${target}"]`,
      `[data-nav="${target}"]`,
      `[data-page="${target}"]`,
      `[data-target="${target}"]`
    ];

    for (const selector of navSelectors) {
      const elements =
        document.querySelectorAll(
          selector
        );

      for (const element of elements) {
        const tag =
          element.tagName.toLowerCase();

        if (
          tag !== "section" &&
          !element.matches(
            "[data-section-content]"
          )
        ) {
          try {
            element.click();
            return true;
          } catch (_) {}
        }
      }
    }

    const section =
      findSection(target);

    if (!section) {
      return false;
    }

    const sections =
      document.querySelectorAll(
        "section"
      );

    sections.forEach(item => {
      item.classList.remove("active");

      if (
        item !== section &&
        item.hasAttribute("hidden")
      ) {
        item.setAttribute(
          "hidden",
          ""
        );
      }
    });

    section.classList.add("active");

    section.removeAttribute(
      "hidden"
    );

    return true;
  }

  /* ---------------------------------------------------------
     DIAGNOSTICS
     --------------------------------------------------------- */

  function diagnose() {
    const audio =
      getAudioElement();

    const diagnostics = {
      localStorage:
        (() => {
          try {
            const key =
              "__jarvis_test__";

            localStorage.setItem(
              key,
              "1"
            );

            localStorage.removeItem(
              key
            );

            return true;
          } catch (_) {
            return false;
          }
        })(),

      audio: !!audio,

      speech:
        state.speechSupported,

      recognition:
        state.recognitionSupported,

      serviceWorker:
        "serviceWorker" in navigator,

      indexedDB:
        "indexedDB" in window,

      online:
        navigator.onLine,

      history:
        state.history.length,

      memory:
        state.memory.length
    };

    return diagnostics;
  }

  function diagnosticsText() {
    const d = diagnose();

    return [
      `Локальное хранилище: ${d.localStorage ? "OK" : "ОШИБКА"}`,
      `Музыкальный модуль: ${d.audio ? "OK" : "НЕ НАЙДЕН"}`,
      `Озвучивание: ${d.speech ? "OK" : "НЕДОСТУПНО"}`,
      `Распознавание речи: ${d.recognition ? "OK" : "НЕДОСТУПНО"}`,
      `Service Worker: ${d.serviceWorker ? "OK" : "НЕТ"}`,
      `IndexedDB: ${d.indexedDB ? "OK" : "НЕТ"}`,
      `Сеть: ${d.online ? "ONLINE" : "OFFLINE"}`,
      `Память: ${d.memory}`,
      `История: ${d.history}`
    ].join("\n");
  }

  /* ---------------------------------------------------------
     INTENT DETECTION
     --------------------------------------------------------- */

  function hasAny(text, words) {
    return words.some(word =>
      text.includes(word)
    );
  }

  function detectIntent(command) {
    const text =
      normalizeText(command);

    if (!text) {
      return "empty";
    }

    if (
      hasAny(text, [
        "привет",
        "здравствуй",
        "добрый день",
        "добрый вечер",
        "доброе утро",
        "хай",
        "hello"
      ])
    ) {
      return "greeting";
    }

    if (
      hasAny(text, [
        "кто ты",
        "ты кто",
        "как тебя зовут",
        "твое имя",
        "твоё имя"
      ])
    ) {
      return "identity";
    }

    if (
      hasAny(text, [
        "что ты умеешь",
        "твои возможности",
        "какие у тебя функции",
        "что умеешь"
      ])
    ) {
      return "capabilities";
    }

    if (
      hasAny(text, [
        "статус системы",
        "состояние системы",
        "как система",
        "система работает"
      ])
    ) {
      return "status";
    }

    if (
      hasAny(text, [
        "диагностика",
        "проверь систему",
        "проведи диагностику",
        "проверка системы"
      ])
    ) {
      return "diagnostics";
    }

    if (
      hasAny(text, [
        "который час",
        "сколько времени",
        "текущее время",
        "время сейчас"
      ])
    ) {
      return "time";
    }

    if (
      hasAny(text, [
        "какая сегодня дата",
        "какое сегодня число",
        "сегодняшняя дата",
        "какой сегодня день"
      ])
    ) {
      return "date";
    }

    if (
      hasAny(text, [
        "запомни",
        "запиши в память",
        "сохрани в память",
        "помни"
      ])
    ) {
      return "remember";
    }

    if (
      hasAny(text, [
        "что ты помнишь",
        "что помнишь",
        "покажи память",
        "моя память"
      ])
    ) {
      return "memory";
    }

    if (
      hasAny(text, [
        "очисти память",
        "забудь все",
        "забудь всё",
        "удали память"
      ])
    ) {
      return "clear_memory";
    }

    /* -------------------------------------------------------
       MUSIC INTENTS
       ------------------------------------------------------- */

    if (
      hasAny(text, [
        "предыдущая песня",
        "предыдущий трек",
        "предыдущая мелодия",
        "прошлая песня",
        "прошлый трек",
        "верни предыдущую",
        "верни прошлую",
        "назад песню",
        "музыку назад"
      ])
    ) {
      return "music_previous";
    }

    if (
      hasAny(text, [
        "следующая песня",
        "следующий трек",
        "следующая мелодия",
        "другая песня",
        "другой трек",
        "другая мелодия",
        "смени песню",
        "смени трек",
        "смени мелодию",
        "поменяй песню",
        "поменяй трек",
        "поменяй мелодию",
        "поставь другую",
        "включи другую",
        "переключи песню",
        "переключи трек",
        "переключи музыку",
        "следующую музыку",
        "дальше песню",
        "дальше трек"
      ])
    ) {
      return "music_next";
    }

    if (
      hasAny(text, [
        "запусти музыку",
        "включи музыку",
        "включи песню",
        "запусти песню",
        "начни музыку",
        "возобнови музыку",
        "продолжи музыку",
        "проиграй музыку",
        "проиграй песню"
      ])
    ) {
      return "music_play";
    }

    if (
      hasAny(text, [
        "останови музыку",
        "выключи музыку",
        "поставь музыку на паузу",
        "поставь на паузу",
        "пауза музыки",
        "останови песню",
        "останови трек"
      ])
    ) {
      return "music_stop";
    }

    if (
      hasAny(text, [
        "переключи музыку",
        "переключить музыку"
      ])
    ) {
      return "music_next";
    }

    if (
      hasAny(text, [
        "открой чат",
        "открой чаты",
        "перейди в чат",
        "перейди в чаты"
      ])
    ) {
      return "open_chat";
    }

    if (
      hasAny(text, [
        "открой музыку",
        "перейди в музыку",
        "открой плеер"
      ])
    ) {
      return "open_music";
    }

    if (
      hasAny(text, [
        "открой ленту",
        "открой новости",
        "перейди в ленту",
        "перейди в новости"
      ])
    ) {
      return "open_news";
    }

    if (
      hasAny(text, [
        "открой главную",
        "перейди на главную",
        "домой"
      ])
    ) {
      return "open_home";
    }

    if (
      hasAny(text, [
        "открой ии",
        "открой ai",
        "открой джарвис",
        "перейди в ии"
      ])
    ) {
      return "open_ai";
    }

    if (
      hasAny(text, [
        "останови голос",
        "замолчи",
        "перестань говорить",
        "выключи голос"
      ])
    ) {
      return "stop_voice";
    }

    if (
      hasAny(text, [
        "помощь",
        "помоги",
        "что сказать",
        "команды"
      ])
    ) {
      return "help";
    }

    return "conversation";
  }

  /* ---------------------------------------------------------
     MEMORY COMMAND PARSER
     --------------------------------------------------------- */

  function extractMemoryText(command) {
    const original =
      safeString(command).trim();

    const patterns = [
      /^запомни\s+/i,
      /^помни\s+/i,
      /^запиши в память\s+/i,
      /^сохрани в память\s+/i
    ];

    let result = original;

    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result =
          result.replace(
            pattern,
            ""
          ).trim();

        break;
      }
    }

    return result;
  }

  /* ---------------------------------------------------------
     RESPONSES
     --------------------------------------------------------- */

  function responseForIntent(
    intent,
    command
  ) {
    switch (intent) {
      case "greeting":
        return randomItem([
          "Здравствуйте. JARVIS на связи.",
          "Приветствую. Все системы готовы.",
          "Рад вас слышать. JARVIS готов к работе.",
          "Здравствуйте. Чем могу помочь?"
        ]);

      case "identity":
        return "Я JARVIS, голосовой AI-модуль системы ASHINA.";

      case "capabilities":
        return [
          "Я могу отвечать на вопросы, работать с памятью, выполнять команды навигации и управлять музыкой.",
          "Также я умею принимать голосовые команды."
        ].join(" ");

      case "status":
        return "Система ASHINA работает. JARVIS находится в режиме готовности.";

      case "diagnostics":
        return diagnosticsText();

      case "time":
        return `Сейчас ${nowTime()}.`;

      case "date":
        return `Сегодня ${nowDate()}.`;

      case "memory":
        return renderMemory();

      case "clear_memory":
        clearMemory();
        return "Память очищена.";

      case "open_chat":
        return openSection("chat")
          ? "Открываю чат."
          : "Не удалось открыть чат.";

      case "open_music":
        return openSection("music")
          ? "Открываю музыку."
          : "Не удалось открыть раздел музыки.";

      case "open_news":
        return openSection("news")
          ? "Открываю ленту."
          : "Не удалось открыть ленту.";

      case "open_home":
        return openSection("home")
          ? "Возвращаюсь на главную."
          : "Не удалось открыть главную.";

      case "open_ai":
        return openSection("ai")
          ? "Открываю AI-ядро."
          : "Не удалось открыть AI-ядро.";

      case "music_play":
        return playMusic()
          ? "Музыка запущена."
          : "Не удалось запустить музыку.";

      case "music_stop":
        return stopMusic()
          ? "Музыка остановлена."
          : "Не удалось остановить музыку.";

      case "music_next":
        return nextMusic()
          ? "Переключаю на следующую мелодию."
          : "Не удалось переключить мелодию. Проверьте, доступно ли переключение треков в музыкальном модуле.";

      case "music_previous":
        return previousMusic()
          ? "Возвращаю предыдущую мелодию."
          : "Не удалось вернуть предыдущую мелодию.";

      case "stop_voice":
        stopSpeaking();
        return "Голосовой вывод остановлен.";

      case "help":
        return [
          "Вы можете сказать:",
          "смени мелодию;",
          "следующая песня;",
          "предыдущая песня;",
          "запусти музыку;",
          "останови музыку;",
          "открой чат;",
          "открой музыку;",
          "статус системы;"
        ].join(" ");

      default:
        return null;
    }
  }

  /* ---------------------------------------------------------
     CONVERSATIONAL FALLBACK
     --------------------------------------------------------- */

  function conversationalResponse(command) {
    const text =
      normalizeText(command);

    if (!text) {
      return "Я вас слушаю.";
    }

    if (
      text.includes("как дела") ||
      text.includes("как ты")
    ) {
      return "Все системы в норме. Готов продолжать работу.";
    }

    if (
      text.includes("спасибо") ||
      text.includes("благодарю")
    ) {
      return randomItem([
        "Всегда пожалуйста.",
        "К вашим услугам.",
        "Рад помочь."
      ]);
    }

    if (
      text.includes("молодец") ||
      text.includes("круто") ||
      text.includes("отлично")
    ) {
      return "Принято. Продолжаю работу.";
    }

    if (
      text.includes("ты здесь") ||
      text.includes("ты тут")
    ) {
      return "Да. JARVIS на связи.";
    }

    if (
      text.includes("готов")
    ) {
      return "Всегда готов.";
    }

    return "Команда принята. Я пока работаю в локальном режиме и не могу дать полноценный ответ на этот запрос.";
  }

  /* ---------------------------------------------------------
     PROCESS COMMAND
     --------------------------------------------------------- */

  async function processCommand(command) {
    const original =
      safeString(command).trim();

    const normalized =
      normalizeText(original);

    if (!normalized) {
      return "Я вас слушаю.";
    }

    state.lastCommand = original;
    state.commandCount++;

    const intent =
      detectIntent(original);

    state.lastTopic = intent;

    if (intent === "remember") {
      const memoryText =
        extractMemoryText(original);

      if (!memoryText) {
        return "Что именно нужно запомнить?";
      }

      remember(memoryText);

      return `Запомнил: ${memoryText}`;
    }

    if (intent === "stop_voice") {
      stopSpeaking();
      return "Голосовой вывод остановлен.";
    }

    const knownResponse =
      responseForIntent(
        intent,
        original
      );

    if (knownResponse) {
      return knownResponse;
    }

    return conversationalResponse(
      original
    );
  }

  /* ---------------------------------------------------------
     ASK
     --------------------------------------------------------- */

  async function ask(command) {
    const text =
      safeString(command).trim();

    if (!text) {
      return "";
    }

    return enqueue(async () => {
      setStatus("thinking");

      state.lastUserMessage =
        text;

      addMessage(
        "user",
        text
      );

      let answer = "";

      try {
        answer =
          await processCommand(
            text
          );
      } catch (error) {
        console.error(
          "[JARVIS] processCommand:",
          error
        );

        answer =
          "Произошла ошибка при выполнении команды.";
      }

      answer =
        safeString(answer).trim();

      if (!answer) {
        answer =
          "Команда обработана.";
      }

      state.lastAIMessage =
        answer;

      addMessage(
        "ai",
        answer
      );

      if (
        state.settings.voice &&
        state.settings.speech
      ) {
        speak(answer);
      } else {
        setStatus("ready");
      }

      return answer;
    });
  }

  /* ---------------------------------------------------------
     VOICE RECOGNITION
     --------------------------------------------------------- */

  function createRecognition() {
    if (!state.recognitionSupported) {
      return null;
    }

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      return null;
    }

    const recognition =
      new Recognition();

    recognition.lang =
      CONFIG.speech.language;

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.voiceListening = true;
      state.recognitionStarting =
        false;

      setStatus("listening");
    };

    recognition.onresult = event => {
      try {
        const result =
          event.results?.[0]?.[0];

        const text =
          result?.transcript?.trim();

        if (text) {
          ask(text);
        }
      } catch (error) {
        console.warn(
          "[JARVIS] recognition result:",
          error
        );
      }
    };

    recognition.onerror = event => {
      console.warn(
        "[JARVIS] recognition error:",
        event?.error
      );

      state.voiceListening = false;
      state.recognitionStarting =
        false;

      setStatus("ready");
    };

    recognition.onend = () => {
      state.voiceListening = false;
      state.recognitionStarting =
        false;

      setStatus("ready");
    };

    return recognition;
  }

  function startVoice() {
    if (!state.recognitionSupported) {
      return false;
    }

    if (
      state.voiceListening ||
      state.recognitionStarting
    ) {
      return true;
    }

    try {
      stopSpeaking();

      state.recognitionStarting =
        true;

      if (state.recognition) {
        try {
          state.recognition.abort();
        } catch (_) {}
      }

      state.recognition =
        createRecognition();

      if (!state.recognition) {
        state.recognitionStarting =
          false;

        return false;
      }

      state.recognition.start();

      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] startVoice:",
        error
      );

      state.voiceListening = false;
      state.recognitionStarting =
        false;

      setStatus("ready");

      return false;
    }
  }

  function stopVoice() {
    if (
      !state.recognition
    ) {
      state.voiceListening =
        false;

      state.recognitionStarting =
        false;

      setStatus("ready");

      return true;
    }

    try {
      state.recognition.stop();
    } catch (_) {
      try {
        state.recognition.abort();
      } catch (_) {}
    }

    state.voiceListening = false;
    state.recognitionStarting =
      false;

    setStatus("ready");

    return true;
  }

  /* ---------------------------------------------------------
     SETTINGS
     --------------------------------------------------------- */

  function loadSettings() {
    const saved =
      loadJSON(
        CONFIG.storage.settings,
        {}
      );

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(saved || {})
    };
  }

  function saveSettings() {
    saveJSON(
      CONFIG.storage.settings,
      state.settings
    );
  }

  function setSettings(newSettings) {
    if (
      !newSettings ||
      typeof newSettings !==
        "object"
    ) {
      return getSettings();
    }

    state.settings = {
      ...state.settings,
      ...newSettings
    };

    saveSettings();

    return getSettings();
  }

  function getSettings() {
    return {
      ...state.settings
    };
  }

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */

  function getState() {
    return {
      ...state,
      memory: getMemory(),
      history: getContext(),
      settings: getSettings()
    };
  }

  /* ---------------------------------------------------------
     INITIALIZATION
     --------------------------------------------------------- */

  function init() {
    loadMemory();
    loadHistory();
    loadSettings();

    refreshVoice();

    setStatus("ready");

    console.log(
      `[JARVIS] ${CONFIG.name} ${CONFIG.version} ready`
    );
  }

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */

  const API = {
    ask,

    speak,
    stopSpeaking,

    startVoice,
    stopVoice,

    remember,
    getMemory,
    clearMemory,

    getContext,

    diagnose,
    playMusic,
    stopMusic,
    toggleMusic,

    nextMusic,
    previousMusic,

    openSection,

    setSettings,
    getSettings,

    getState,

    processCommand
  };

  /* ---------------------------------------------------------
     GLOBALS
     --------------------------------------------------------- */

  window.JARVIS =
    API;

  window.JARVIS_API =
    API;

  window.ASHINA_JARVIS =
    API;

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();

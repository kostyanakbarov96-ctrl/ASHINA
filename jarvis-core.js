```javascript
/* =========================================================
   ASHINA · JARVIS CORE 1.2
   Stable local AI core
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = {
    name: "JARVIS",
    project: "ASHINA",
    version: "1.2",

    storage: {
      memory: "ASHINA_JARVIS_MEMORY",
      history: "ASHINA_JARVIS_HISTORY",
      settings: "ASHINA_JARVIS_SETTINGS"
    },

    maxHistory: 100,
    maxMemories: 100,
    visibleHistory: 15,

    speech: {
      language: "ru-RU",
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    }
  };

  const DEFAULT_SETTINGS = {
    voice: true,
    speech: true,
    fastMode: false,
    mode: "LOCAL",
    aiMode: "LOCAL"
  };

  const state = {
    status: "ready",
    lastCommand: "",
    lastTopic: "",
    lastUserMessage: "",
    lastAIMessage: "",
    commandCount: 0,
    memory: [],
    history: [],
    settings: { ...DEFAULT_SETTINGS }
  };

  let recognition = null;
  let recognitionStarting = false;
  let speechQueue = Promise.resolve();

  /* =========================================================
     STORAGE
     ========================================================= */

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (!value) return fallback;

      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      console.warn("[JARVIS] Storage read error:", error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("[JARVIS] Storage write error:", error);
      return false;
    }
  }

  function loadState() {
    state.memory = loadJSON(CONFIG.storage.memory, []);
    state.history = loadJSON(CONFIG.storage.history, []);
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...loadJSON(CONFIG.storage.settings, {})
    };

    if (!Array.isArray(state.memory)) {
      state.memory = [];
    }

    if (!Array.isArray(state.history)) {
      state.history = [];
    }
  }

  loadState();

  /* =========================================================
     HELPERS
     ========================================================= */

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
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
      month: "2-digit",
      year: "numeric"
    });
  }

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getLogElement() {
    return document.getElementById("log");
  }

  function getAudioElement() {
    return (
      document.getElementById("audio") ||
      document.getElementById("music") ||
      document.querySelector("audio")
    );
  }

  /* =========================================================
     UI STATE
     ========================================================= */

  function setStatus(status) {
    state.status = status;

    const elements = [
      document.getElementById("jarvisStatus"),
      document.getElementById("aiStatus"),
      document.querySelector("[data-jarvis-status]")
    ];

    elements.forEach((element) => {
      if (!element) return;

      element.textContent = status;

      element.dataset.status = status;
      element.classList.remove(
        "ready",
        "thinking",
        "speaking",
        "listening",
        "error"
      );

      if (status) {
        element.classList.add(String(status).toLowerCase());
      }
    });

    renderJarvisState();
  }

  function renderJarvisState() {
    try {
      const elements = [
        document.getElementById("jarvisState"),
        document.getElementById("aiState"),
        document.querySelector("[data-jarvis-state]")
      ];

      elements.forEach((element) => {
        if (!element) return;

        element.textContent = state.status;
        element.dataset.status = state.status;
      });
    } catch (error) {
      console.warn("[JARVIS] State render error:", error);
    }
  }

  /* =========================================================
     CHAT LOG
     ========================================================= */

  function addMessage(role, text, save = true) {
    const message = String(text || "").trim();

    if (!message) return;

    const log = getLogElement();

    if (log) {
      const row = document.createElement("div");

      row.className =
        role === "user"
          ? "jarvis-message user"
          : "jarvis-message ai";

      row.dataset.role = role;

      const label =
        role === "user"
          ? "Вы"
          : "JARVIS";

      row.innerHTML = `
        <div class="jarvis-message-label">${escapeHTML(label)}</div>
        <div class="jarvis-message-text">${escapeHTML(message)}</div>
        <div class="jarvis-message-time">${escapeHTML(nowTime())}</div>
      `;

      log.appendChild(row);

      while (log.children.length > CONFIG.visibleHistory * 2) {
        log.removeChild(log.firstChild);
      }

      log.scrollTop = log.scrollHeight;
    }

    if (save) {
      addHistory(role, message);
    }
  }

  /* =========================================================
     HISTORY
     ========================================================= */

  function addHistory(role, text) {
    state.history.push({
      role,
      text,
      time: new Date().toISOString()
    });

    if (state.history.length > CONFIG.maxHistory) {
      state.history =
        state.history.slice(-CONFIG.maxHistory);
    }

    saveJSON(CONFIG.storage.history, state.history);
  }

  function getHistory(limit = CONFIG.visibleHistory) {
    return state.history.slice(-limit);
  }

  function getContext(limit = 10) {
    return getHistory(limit)
      .map((item) => `${item.role}: ${item.text}`)
      .join("\n");
  }

  function clearHistory() {
    state.history = [];
    saveJSON(CONFIG.storage.history, []);

    const log = getLogElement();

    if (log) {
      log.innerHTML = "";
    }
  }

  /* =========================================================
     MEMORY
     ========================================================= */

  function remember(text) {
    const value = String(text || "").trim();

    if (!value) return false;

    state.memory.push({
      text: value,
      time: new Date().toISOString()
    });

    if (state.memory.length > CONFIG.maxMemories) {
      state.memory =
        state.memory.slice(-CONFIG.maxMemories);
    }

    saveJSON(CONFIG.storage.memory, state.memory);

    return true;
  }

  function getMemory() {
    return state.memory.map((item) => item.text);
  }

  function clearMemory() {
    state.memory = [];
    saveJSON(CONFIG.storage.memory, []);
  }

  function renderMemory() {
    return getMemory();
  }

  /* =========================================================
     SPEECH
     ========================================================= */

  function getSpeechSynthesis() {
    return window.speechSynthesis || null;
  }

  function speak(text) {
    if (!state.settings.speech) {
      return Promise.resolve();
    }

    const synthesis = getSpeechSynthesis();

    if (!synthesis) {
      return Promise.resolve();
    }

    const message = String(text || "").trim();

    if (!message) {
      return Promise.resolve();
    }

    speechQueue = speechQueue
      .catch(() => undefined)
      .then(() => {
        return new Promise((resolve) => {
          try {
            synthesis.cancel();

            const utterance =
              new SpeechSynthesisUtterance(message);

            utterance.lang = CONFIG.speech.language;
            utterance.rate = CONFIG.speech.rate;
            utterance.pitch = CONFIG.speech.pitch;
            utterance.volume = CONFIG.speech.volume;

            utterance.onstart = () => {
              setStatus("speaking");
            };

            utterance.onend = () => {
              setStatus("ready");
              resolve();
            };

            utterance.onerror = () => {
              setStatus("ready");
              resolve();
            };

            synthesis.speak(utterance);
          } catch (error) {
            console.warn("[JARVIS] Speech error:", error);
            setStatus("ready");
            resolve();
          }
        });
      });

    return speechQueue;
  }

  function stopSpeaking() {
    const synthesis = getSpeechSynthesis();

    if (synthesis) {
      try {
        synthesis.cancel();
      } catch (error) {
        console.warn("[JARVIS] Speech stop error:", error);
      }
    }

    setStatus("ready");
  }

  /* =========================================================
     MUSIC
     ========================================================= */

  function playMusic() {
    const audio = getAudioElement();

    if (!audio) {
      return {
        success: false,
        message: "Музыкальный проигрыватель не найден."
      };
    }

    try {
      const result = audio.play();

      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }

      return {
        success: true,
        message: "Музыка запущена."
      };
    } catch (error) {
      console.warn("[JARVIS] Music play error:", error);

      return {
        success: false,
        message: "Не удалось запустить музыку."
      };
    }
  }

  function stopMusic() {
    const audio = getAudioElement();

    if (!audio) {
      return {
        success: false,
        message: "Музыкальный проигрыватель не найден."
      };
    }

    try {
      audio.pause();

      return {
        success: true,
        message: "Музыка остановлена."
      };
    } catch (error) {
      console.warn("[JARVIS] Music stop error:", error);

      return {
        success: false,
        message: "Не удалось остановить музыку."
      };
    }
  }

  function toggleMusic() {
    const audio = getAudioElement();

    if (!audio) {
      return {
        success: false,
        message: "Музыкальный проигрыватель не найден."
      };
    }

    if (audio.paused) {
      return playMusic();
    }

    return stopMusic();
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function openSection(sectionName) {
    const name = normalize(sectionName);

    const aliases = {
      home: ["home", "главная"],
      chat: ["chat", "чат"],
      music: ["music", "музыка"],
      news: ["news", "лента", "новости"],
      ai: ["ai", "ии", "искусственный интеллект"]
    };

    let target = name;

    Object.keys(aliases).forEach((key) => {
      if (aliases[key].includes(name)) {
        target = key;
      }
    });

    const selectors = [
      `[data-section="${target}"]`,
      `#${target}`,
      `section[data-page="${target}"]`,
      `[data-page="${target}"]`
    ];

    let element = null;

    for (const selector of selectors) {
      try {
        element = document.querySelector(selector);
        if (element) break;
      } catch (error) {}
    }

    if (element) {
      if (
        element.tagName === "BUTTON" ||
        element.tagName === "A" ||
        element.onclick
      ) {
        try {
          element.click();
          return true;
        } catch (error) {}
      }
    }

    const sections = document.querySelectorAll(
      "section[data-section], section[data-page]"
    );

    if (sections.length) {
      sections.forEach((section) => {
        const sectionNameValue =
          section.dataset.section ||
          section.dataset.page ||
          "";

        const active =
          normalize(sectionNameValue) === target;

        section.classList.toggle("active", active);

        if (active) {
          section.removeAttribute("hidden");
        } else {
          section.setAttribute("hidden", "");
        }
      });

      return true;
    }

    return false;
  }

  /* =========================================================
     DIAGNOSTICS
     ========================================================= */

  function diagnose() {
    const audio = getAudioElement();

    const result = {
      localStorage: false,
      audio: false,
      speech: false,
      recognition: false,
      serviceWorker: false,
      indexedDB: false,
      online: navigator.onLine
    };

    try {
      const testKey = "__jarvis_test__";

      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);

      result.localStorage = true;
    } catch (error) {
      result.localStorage = false;
    }

    result.audio = !!audio;
    result.speech = !!window.speechSynthesis;

    result.recognition = !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition
    );

    result.serviceWorker =
      "serviceWorker" in navigator;

    result.indexedDB =
      "indexedDB" in window;

    return result;
  }

  function diagnosticsText() {
    const d = diagnose();

    return [
      `Хранилище: ${d.localStorage ? "OK" : "ошибка"}`,
      `Музыка: ${d.audio ? "OK" : "не найдена"}`,
      `Озвучивание: ${d.speech ? "OK" : "недоступно"}`,
      `Голосовой ввод: ${d.recognition ? "OK" : "недоступен"}`,
      `Service Worker: ${d.serviceWorker ? "OK" : "нет"}`,
      `IndexedDB: ${d.indexedDB ? "OK" : "нет"}`,
      `Сеть: ${d.online ? "онлайн" : "офлайн"}`
    ].join("\n");
  }

  /* =========================================================
     INTENT DETECTION
     ========================================================= */

  function has(text, words) {
    return words.some((word) => text.includes(word));
  }

  function classifyCommand(command) {
    const text = normalize(command);

    if (!text) {
      return "empty";
    }

    if (
      has(text, [
        "привет",
        "здравствуй",
        "добрый день",
        "добрый вечер",
        "доброе утро",
        "салют",
        "хай"
      ])
    ) {
      return "greeting";
    }

    if (
      has(text, [
        "кто ты",
        "ты кто",
        "представься",
        "как тебя зовут"
      ])
    ) {
      return "identity";
    }

    if (
      has(text, [
        "что ты умеешь",
        "твои возможности",
        "возможности",
        "что можешь",
        "функции"
      ])
    ) {
      return "capabilities";
    }

    if (
      has(text, [
        "статус системы",
        "статус",
        "состояние системы",
        "диагностика",
        "проверь систему"
      ])
    ) {
      return "diagnostics";
    }

    if (
      has(text, [
        "который час",
        "сколько времени",
        "текущее время",
        "время сейчас"
      ])
    ) {
      return "time";
    }

    if (
      has(text, [
        "какая дата",
        "какое сегодня число",
        "сегодняшняя дата",
        "число сегодня"
      ])
    ) {
      return "date";
    }

    if (
      has(text, [
        "что ты помнишь",
        "что помнишь",
        "покажи память",
        "моя память"
      ])
    ) {
      return "memory";
    }

    if (
      has(text, [
        "запомни",
        "запиши в память",
        "сохрани в память"
      ])
    ) {
      return "remember";
    }

    if (
      has(text, [
        "забудь всё",
        "очисти память",
        "удали память",
        "забудь память"
      ])
    ) {
      return "clearMemory";
    }

    if (
      has(text, [
        "запусти музыку",
        "включи музыку",
        "начни музыку",
        "воспроизведи музыку"
      ])
    ) {
      return "playMusic";
    }

    if (
      has(text, [
        "останови музыку",
        "выключи музыку",
        "поставь музыку на паузу",
        "пауза музыки"
      ])
    ) {
      return "stopMusic";
    }

    if (
      has(text, [
        "переключи музыку",
        "переключить музыку"
      ])
    ) {
      return "toggleMusic";
    }

    if (
      has(text, [
        "открой чат",
        "перейди в чат",
        "запусти чат"
      ])
    ) {
      return "openChat";
    }

    if (
      has(text, [
        "открой музыку",
        "перейди в музыку",
        "открой музыкальный раздел"
      ])
    ) {
      return "openMusic";
    }

    if (
      has(text, [
        "открой ленту",
        "открой новости",
        "перейди в ленту",
        "перейди в новости"
      ])
    ) {
      return "openNews";
    }

    if (
      has(text, [
        "открой главную",
        "открой домой",
        "перейди домой",
        "на главную"
      ])
    ) {
      return "openHome";
    }

    if (
      has(text, [
        "открой ии",
        "открой ai",
        "открой искусственный интеллект"
      ])
    ) {
      return "openAI";
    }

    if (
      has(text, [
        "останови голос",
        "замолчи",
        "прекрати говорить",
        "стоп голос"
      ])
    ) {
      return "stopSpeaking";
    }

    if (
      has(text, [
        "помощь",
        "справка",
        "что сказать",
        "команды"
      ])
    ) {
      return "help";
    }

    return "conversation";
  }

  /* =========================================================
     COMMAND PROCESSING
     ========================================================= */

  async function processCommand(command) {
    const original = String(command || "").trim();
    const text = normalize(original);

    const intent = classifyCommand(text);

    state.lastCommand = original;
    state.commandCount++;

    switch (intent) {
      case "empty":
        return "Команда не распознана.";

      case "greeting":
        return "Здравствуйте. JARVIS к вашим услугам.";

      case "identity":
        return "Я JARVIS — локальное AI-ядро ASHINA.";

      case "capabilities":
        return [
          "Я могу отвечать на команды,",
          "работать с памятью,",
          "управлять музыкой,",
          "открывать разделы ASHINA,",
          "проверять состояние системы",
          "и работать с голосовым вводом."
        ].join(" ");

      case "diagnostics":
        return `Диагностика ASHINA:\n${diagnosticsText()}`;

      case "time":
        return `Сейчас ${nowTime()}.`;

      case "date":
        return `Сегодня ${nowDate()}.`;

      case "memory":
        if (!state.memory.length) {
          return "Память пока пуста.";
        }

        return [
          "Я помню:",
          ...state.memory.map(
            (item, index) =>
              `${index + 1}. ${item.text}`
          )
        ].join("\n");

      case "remember": {
        const value = original
          .replace(/^запомни\s*/i, "")
          .replace(/^запиши в память\s*/i, "")
          .replace(/^сохрани в память\s*/i, "")
          .trim();

        if (!value) {
          return "Что именно нужно запомнить?";
        }

        remember(value);

        return `Запомнил: ${value}`;
      }

      case "clearMemory":
        clearMemory();
        return "Память очищена.";

      case "playMusic": {
        const result = playMusic();
        return result.message;
      }

      case "stopMusic": {
        const result = stopMusic();
        return result.message;
      }

      case "toggleMusic": {
        const result = toggleMusic();
        return result.message;
      }

      case "openChat":
        openSection("chat");
        return "Открываю чат.";

      case "openMusic":
        openSection("music");
        return "Открываю музыку.";

      case "openNews":
        openSection("news");
        return "Открываю ленту.";

      case "openHome":
        openSection("home");
        return "Открываю главную.";

      case "openAI":
        openSection("ai");
        return "Открываю AI.";

      case "stopSpeaking":
        stopSpeaking();
        return "Голосовой вывод остановлен.";

      case "help":
        return [
          "Доступные команды:",
          "«Привет»",
          "«Кто ты?»",
          "«Что ты умеешь?»",
          "«Статус системы»",
          "«Который час?»",
          "«Запусти музыку»",
          "«Останови музыку»",
          "«Открой чат»",
          "«Открой музыку»",
          "«Открой ленту»",
          "«Запомни ...»",
          "«Что ты помнишь?»"
        ].join("\n");

      case "conversation":
      default:
        return conversationFallback(original);
    }
  }

  /* =========================================================
     BASIC CONVERSATION
     ========================================================= */

  function conversationFallback(command) {
    const text = normalize(command);

    if (
      has(text, [
        "как дела",
        "как ты",
        "всё хорошо"
      ])
    ) {
      return "Все основные системы JARVIS работают штатно.";
    }

    if (
      has(text, [
        "спасибо",
        "благодарю"
      ])
    ) {
      return "Всегда к вашим услугам.";
    }

    if (
      has(text, [
        "молодец",
        "круто",
        "отлично",
        "хорошо"
      ])
    ) {
      return "Принято. Продолжаю работу.";
    }

    if (
      has(text, [
        "ты здесь",
        "ты на месте",
        "джарвис ты здесь"
      ])
    ) {
      return "Да. Я здесь.";
    }

    return `Команда получена: «${command}». В локальном режиме я пока не подключён к внешней AI-модели для свободного диалога.`;
  }

  /* =========================================================
     MAIN ASK
     ========================================================= */

  async function ask(command) {
    const text = String(command || "").trim();

    if (!text) {
      return "";
    }

    setStatus("thinking");

    addMessage("user", text);

    state.lastUserMessage = text;

    try {
      const response = await processCommand(text);

      state.lastAIMessage = response;

      addMessage("ai", response);

      setStatus("ready");

      if (
        state.settings.voice &&
        state.settings.speech
      ) {
        speak(response);
      }

      return response;
    } catch (error) {
      console.error("[JARVIS] Command error:", error);

      const response =
        "Произошла внутренняя ошибка JARVIS.";

      state.lastAIMessage = response;

      addMessage("ai", response);

      setStatus("error");

      return response;
    }
  }

  /* =========================================================
     VOICE RECOGNITION
     ========================================================= */

  function createRecognition() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      return null;
    }

    const instance = new Recognition();

    instance.lang = "ru-RU";
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      recognitionStarting = false;
      setStatus("listening");
    };

    instance.onresult = (event) => {
      try {
        const result =
          event.results?.[0]?.[0]?.transcript || "";

        const command = result.trim();

        if (command) {
          ask(command);
        }
      } catch (error) {
        console.warn(
          "[JARVIS] Voice result error:",
          error
        );
      }
    };

    instance.onerror = (event) => {
      recognitionStarting = false;

      console.warn(
        "[JARVIS] Voice recognition error:",
        event?.error
      );

      setStatus("ready");
    };

    instance.onend = () => {
      recognitionStarting = false;
      setStatus("ready");
    };

    return instance;
  }

  function startVoice() {
    if (
      recognitionStarting ||
      state.status === "listening"
    ) {
      return false;
    }

    if (!recognition) {
      recognition = createRecognition();
    }

    if (!recognition) {
      const message =
        "Голосовой ввод не поддерживается этим браузером.";

      addMessage("ai", message);

      return false;
    }

    try {
      recognitionStarting = true;
      recognition.start();

      return true;
    } catch (error) {
      recognitionStarting = false;

      console.warn(
        "[JARVIS] Voice start error:",
        error
      );

      setStatus("ready");

      return false;
    }
  }

  function stopVoice() {
    if (!recognition) {
      return false;
    }

    try {
      recognition.stop();
      recognitionStarting = false;
      setStatus("ready");

      return true;
    } catch (error) {
      console.warn(
        "[JARVIS] Voice stop error:",
        error
      );

      recognitionStarting = false;
      setStatus("ready");

      return false;
    }
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function setSettings(newSettings = {}) {
    state.settings = {
      ...state.settings,
      ...newSettings
    };

    saveJSON(
      CONFIG.storage.settings,
      state.settings
    );

    return { ...state.settings };
  }

  function getSettings() {
    return { ...state.settings };
  }

  /* =========================================================
     STATE
     ========================================================= */

  function getState() {
    return {
      status: state.status,
      lastCommand: state.lastCommand,
      lastTopic: state.lastTopic,
      lastUserMessage: state.lastUserMessage,
      lastAIMessage: state.lastAIMessage,
      commandCount: state.commandCount,
      memoryCount: state.memory.length,
      historyCount: state.history.length,
      settings: { ...state.settings },
      version: CONFIG.version,
      name: CONFIG.name,
      project: CONFIG.project
    };
  }

  /* =========================================================
     API
     ========================================================= */

  const API = {
    ask,
    speak,
    stopSpeaking,

    startVoice,
    stopVoice,

    remember,
    getMemory,
    clearMemory,
    renderMemory,

    getContext,
    getHistory,
    clearHistory,

    diagnose,
    diagnosticsText,

    playMusic,
    stopMusic,
    toggleMusic,

    openSection,

    setSettings,
    getSettings,

    getState,

    config: CONFIG
  };

  /* =========================================================
     GLOBAL EXPORTS
     ========================================================= */

  window.JARVIS = API;
  window.JARVIS_API = API;
  window.ASHINA_JARVIS = API;

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function init() {
    renderJarvisState();

    console.log(
      `[JARVIS ${CONFIG.version}] ${CONFIG.project} core ready.`
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
```

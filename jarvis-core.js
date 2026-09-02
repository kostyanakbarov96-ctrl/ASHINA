/* =========================================================
   ASHINA · JARVIS CORE 1.2
   FIXED BUILD
   - One command = one processing cycle
   - No duplicate Enter/input listener (UI owns input)
   - Stronger Russian intent matching
   - Safe queue recovery
   - Voice recognition race protection
   - Existing public API preserved
   - Music / reactions are not modified here
========================================================= */
(function () {
  "use strict";

  const CONFIG = {
    name: "JARVIS",
    project: "ASHINA",
    version: "1.2",
    mode: "LOCAL",
    storage: {
      memory: "ashina_jarvis_memory_v1",
      history: "ashina_jarvis_history_v1",
      settings: "ashina_jarvis_settings_v1"
    },
    maxHistory: 100,
    maxMemories: 100,
    visibleHistory: 15
  };

  const DEFAULT_SETTINGS = {
    voice: true,
    speech: true,
    fastMode: false,
    mode: "LOCAL"
  };

  const state = {
    ready: false,
    thinking: false,
    speaking: false,
    listening: false,
    lastCommand: "",
    lastTopic: "",
    lastUserMessage: "",
    lastAIMessage: "",
    commandCount: 0,
    memory: [],
    history: [],
    settings: { ...DEFAULT_SETTINGS }
  };

  let commandQueue = Promise.resolve();
  let initialized = false;
  let recognition = null;
  let recognitionStarting = false;

  const $ = (id) => document.getElementById(id);

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);

      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;
    } catch (_) {
      return false;
    }
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalize(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[!?.,;:()[\]{}]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, list) {
    return list.some(
      (item) => text.includes(item)
    );
  }

  function setStatus(text) {
    const ids = [
      "aiCore",
      "homeJarvisStatus",
      "jarvisStatus"
    ];

    ids.forEach((id) => {
      const el = $(id);

      if (el) {
        el.textContent = text;
      }
    });
  }

  function addMessage(text, type, save) {
    const message = cleanText(text);

    if (!message) {
      return;
    }

    const log = $("log");

    if (log) {
      const line =
        document.createElement("div");

      line.className =
        "ai-line " +
        (type || "jarvis");

      line.textContent = message;

      log.appendChild(line);

      log.scrollTop =
        log.scrollHeight;
    }

    if (save !== false) {
      addHistory(
        type || "jarvis",
        message
      );
    }
  }

  function addHistory(type, text) {
    const message = cleanText(text);

    if (!message) {
      return;
    }

    state.history.push({
      type:
        type === "user"
          ? "user"
          : "jarvis",
      text: message,
      time: Date.now()
    });

    if (
      state.history.length >
      CONFIG.maxHistory
    ) {
      state.history =
        state.history.slice(
          -CONFIG.maxHistory
        );
    }

    saveJSON(
      CONFIG.storage.history,
      state.history
    );
  }

  function renderHistory() {
    const log = $("log");

    if (!log) {
      return;
    }

    log.innerHTML = "";

    state.history
      .slice(-CONFIG.visibleHistory)
      .forEach((item) => {
        const line =
          document.createElement("div");

        line.className =
          "ai-line " +
          (
            item.type === "user"
              ? "user"
              : "jarvis"
          );

        line.textContent = item.text;

        log.appendChild(line);
      });

    log.scrollTop =
      log.scrollHeight;
  }

  function loadHistory() {
    const value =
      loadJSON(
        CONFIG.storage.history,
        []
      );

    state.history =
      Array.isArray(value)
        ? value.slice(
            -CONFIG.maxHistory
          )
        : [];
  }

  function getContext(limit) {
    return state.history.slice(
      -(Number(limit) || 10)
    );
  }

  function saveMemory(render) {
    if (
      state.memory.length >
      CONFIG.maxMemories
    ) {
      state.memory =
        state.memory.slice(
          -CONFIG.maxMemories
        );
    }

    saveJSON(
      CONFIG.storage.memory,
      state.memory
    );

    if (render !== false) {
      renderMemory();
    }
  }

  function loadMemory() {
    const value =
      loadJSON(
        CONFIG.storage.memory,
        []
      );

    state.memory =
      Array.isArray(value)
        ? value.slice(
            -CONFIG.maxMemories
          )
        : [];
  }

  function remember(text) {
    const value =
      cleanText(text);

    if (!value) {
      return false;
    }

    const duplicate =
      state.memory.some(
        (item) =>
          normalize(item) ===
          normalize(value)
      );

    if (!duplicate) {
      state.memory.push(value);
    }

    saveMemory();

    return true;
  }

  function clearMemory() {
    state.memory = [];

    saveMemory();

    return true;
  }

  function getMemory() {
    return [
      ...state.memory
    ];
  }

  function renderMemory() {
    const box =
      $("memoryBox") ||
      $("jarvisMemory");

    if (!box) {
      return;
    }

    try {
      if (!state.memory.length) {
        box.textContent =
          "Память пуста.";

        return;
      }

      box.textContent =
        state.memory
          .map(
            (item, index) =>
              `${index + 1}. ${item}`
          )
          .join("\n");
    } catch (_) {
      box.textContent =
        "Память недоступна.";
    }
  }

  function speak(text) {
    const message =
      cleanText(text);

    if (
      !message ||
      state.settings.speech === false
    ) {
      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          message
        );

      utterance.lang =
        "ru-RU";

      utterance.rate =
        state.settings.fastMode
          ? 1.05
          : 0.95;

      utterance.pitch = 1;

      state.speaking = true;

      setStatus(
        "JARVIS · ГОВОРЮ"
      );

      utterance.onend = () => {
        state.speaking = false;

        if (
          state.ready &&
          !state.thinking &&
          !state.listening
        ) {
          setStatus("READY");
        }
      };

      utterance.onerror = () => {
        state.speaking = false;

        if (
          state.ready &&
          !state.thinking &&
          !state.listening
        ) {
          setStatus("READY");
        }
      };

      window.speechSynthesis.speak(
        utterance
      );
    } catch (error) {
      state.speaking = false;

      console.warn(
        "JARVIS speech error",
        error
      );
    }
  }

  function stopSpeaking() {
    try {
      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    } catch (_) {}

    state.speaking = false;

    if (
      state.ready &&
      !state.thinking &&
      !state.listening
    ) {
      setStatus("READY");
    }
  }

  function getAudio() {
    return (
      $("audio") ||
      $("music")
    );
  }

  async function playMusic() {
    const audio =
      getAudio();

    if (!audio) {
      return (
        "Музыкальный плеер не найден."
      );
    }

    try {
      await audio.play();

      return "Музыка запущена.";
    } catch (_) {
      return (
        "Не удалось запустить музыку. " +
        "Нажми воспроизведение в плеере."
      );
    }
  }

  function stopMusic() {
    const audio =
      getAudio();

    if (!audio) {
      return (
        "Музыкальный плеер не найден."
      );
    }

    try {
      audio.pause();
    } catch (_) {}

    return "Музыка остановлена.";
  }

  async function toggleMusic() {
    const audio =
      getAudio();

    if (!audio) {
      return (
        "Музыкальный плеер не найден."
      );
    }

    if (audio.paused) {
      return playMusic();
    }

    return stopMusic();
  }

  function openSection(section) {
    const name =
      normalize(section);

    const aliases = {
      home: "home",
      главная: "home",

      чат: "chat",
      chat: "chat",

      музыка: "music",
      music: "music",

      лента: "news",
      новости: "news",
      news: "news",

      ai: "ai",
      jarvis: "ai",
      ии: "ai"
    };

    const target =
      aliases[name] || name;

    const selectors = [
      `section[data-section="${target}"]`,
      `section#${target}`,
      `[data-section="${target}"]`
    ];

    let el = null;

    for (
      const selector
      of selectors
    ) {
      try {
        el =
          document.querySelector(
            selector
          );
      } catch (_) {}

      if (el) {
        break;
      }
    }

    if (
      el &&
      typeof el.click === "function" &&
      !el.matches("section")
    ) {
      el.click();

      return (
        `Открываю раздел «${target}».`
      );
    }

    if (el) {
      document
        .querySelectorAll("section")
        .forEach((section) => {
          section.classList.toggle(
            "active",
            section === el
          );

          if (section === el) {
            section.removeAttribute(
              "hidden"
            );
          } else {
            section.setAttribute(
              "hidden",
              ""
            );
          }
        });

      el.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      return (
        `Открываю раздел «${target}».`
      );
    }

    return (
      `Раздел «${section}» не найден.`
    );
  }

  async function diagnose() {
    const checks = [];

    const add =
      (name, ok, detail) => {
        checks.push(
          `${ok ? "✓" : "✗"} ` +
          `${name}: ${detail}`
        );
      };

    try {
      add(
        "LocalStorage",
        true,
        "доступен"
      );
    } catch (_) {
      add(
        "LocalStorage",
        false,
        "недоступен"
      );
    }

    const audio =
      getAudio();

    add(
      "Audio",
      !!audio,
      audio
        ? "элемент найден"
        : "элемент не найден"
    );

    add(
      "Speech",
      "speechSynthesis" in window,
      "браузерная речь"
    );

    add(
      "Voice",
      !!(
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
      ),
      "распознавание речи"
    );

    add(
      "Service Worker",
      "serviceWorker" in navigator,
      "API доступен"
    );

    add(
      "IndexedDB",
      "indexedDB" in window,
      "API доступен"
    );

    add(
      "Network",
      navigator.onLine !== false,
      navigator.onLine === false
        ? "offline"
        : "online"
    );

    add(
      "Memory",
      true,
      `${state.memory.length} записей`
    );

    add(
      "History",
      true,
      `${state.history.length} записей`
    );

    return (
      "Диагностика JARVIS\n" +
      checks.join("\n")
    );
  }

  function helpText() {
    return [
      "Я могу:",
      "• показать статус и диагностику системы",
      "• сообщить время и дату",
      "• запоминать и очищать локальную память",
      "• открывать главную, чат, музыку, ленту и AI",
      "• запускать, останавливать и переключать музыку",
      "• управлять голосовым режимом",
      "• отвечать на базовые вопросы о себе и ASHINA."
    ].join("\n");
  }

  function currentTime() {
    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    ).format(
      new Date()
    );
  }

  function currentDate() {
    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(
      new Date()
    );
  }

  function extractRememberText(
    command
  ) {
    const raw =
      cleanText(command);

    const match =
      raw.match(
        /^(?:jarvis[,:]?\s*)?(?:запомни|запомнить|сохрани|сохрани в память)\s+(.+)$/i
      );

    return match
      ? cleanText(match[1])
      : "";
  }

  function classify(command) {
    const raw =
      cleanText(command);

    const n =
      normalize(raw);

    if (!n) {
      return "empty";
    }

    if (
      includesAny(
        n,
        [
          "привет",
          "здравствуй",
          "здравствуйте",
          "доброе утро",
          "добрый день",
          "добрый вечер",
          "хай",
          "hello"
        ]
      )
    ) {
      return "greeting";
    }

    if (
      includesAny(
        n,
        [
          "кто ты",
          "ты кто",
          "как тебя зовут",
          "твое имя",
          "твоя версия",
          "что ты такое"
        ]
      )
    ) {
      return "identity";
    }

    if (
      includesAny(
        n,
        [
          "что ты умеешь",
          "что умеешь",
          "твои возможности",
          "возможности",
          "помощь",
          "help",
          "команды"
        ]
      )
    ) {
      return "help";
    }

    if (
      includesAny(
        n,
        [
          "статус системы",
          "статус",
          "состояние системы",
          "система работает",
          "система в норме"
        ]
      )
    ) {
      return "status";
    }

    if (
      includesAny(
        n,
        [
          "диагностика",
          "проверь систему",
          "проверка системы",
          "диагностика системы",
          "проверь jarvis"
        ]
      )
    ) {
      return "diagnostics";
    }

    if (
      includesAny(
        n,
        [
          "который час",
          "сколько времени",
          "сколько сейчас времени",
          "текущее время",
          "время сейчас",
          "время"
        ]
      )
    ) {
      return "time";
    }

    if (
      includesAny(
        n,
        [
          "какая сегодня дата",
          "сегодняшняя дата",
          "какое сегодня число",
          "сегодня",
          "дата"
        ]
      )
    ) {
      return "date";
    }

    if (
      /^(?:jarvis[,:]?\s*)?(?:запомни|запомнить|сохрани|сохрани в память)\b/i
        .test(raw)
    ) {
      return "remember";
    }

    if (
      includesAny(
        n,
        [
          "покажи память",
          "что ты помнишь",
          "что помнишь",
          "моя память",
          "память"
        ]
      ) &&
      !includesAny(
        n,
        [
          "очисти",
          "удали",
          "забудь"
        ]
      )
    ) {
      return "memory_show";
    }

    if (
      includesAny(
        n,
        [
          "очисти память",
          "удали память",
          "забудь все",
          "забудь всё",
          "сбрось память"
        ]
      )
    ) {
      return "memory_clear";
    }

    if (
      includesAny(
        n,
        [
          "запусти музыку",
          "включи музыку",
          "воспроизведи музыку",
          "музыку включи",
          "play music"
        ]
      )
    ) {
      return "music_play";
    }

    if (
      includesAny(
        n,
        [
          "останови музыку",
          "выключи музыку",
          "поставь музыку на паузу",
          "пауза музыки",
          "stop music"
        ]
      )
    ) {
      return "music_stop";
    }

    if (
      includesAny(
        n,
        [
          "переключи музыку",
          "переключить музыку",
          "плей пауза",
          "play pause"
        ]
      )
    ) {
      return "music_toggle";
    }

    if (
      includesAny(
        n,
        [
          "открой чат",
          "открой сообщения",
          "перейди в чат",
          "перейти в чат"
        ]
      )
    ) {
      return "open_chat";
    }

    if (
      includesAny(
        n,
        [
          "открой музыку",
          "открой плеер",
          "перейди в музыку",
          "перейти в музыку"
        ]
      )
    ) {
      return "open_music";
    }

    if (
      includesAny(
        n,
        [
          "открой ленту",
          "открой новости",
          "перейди в ленту",
          "перейди в новости",
          "покажи ленту"
        ]
      )
    ) {
      return "open_news";
    }

    if (
      includesAny(
        n,
        [
          "открой главную",
          "на главную",
          "перейди домой",
          "домой",
          "главная"
        ]
      )
    ) {
      return "open_home";
    }

    if (
      includesAny(
        n,
        [
          "открой ai",
          "открой ии",
          "открой jarvis",
          "перейди в ai",
          "перейди в ии"
        ]
      )
    ) {
      return "open_ai";
    }

    if (
      includesAny(
        n,
        [
          "останови голос",
          "выключи голос",
          "замолчи",
          "не говори",
          "стоп голос"
        ]
      )
    ) {
      return "stop_voice";
    }

    if (
      includesAny(
        n,
        [
          "слушай меня",
          "начни слушать",
          "включи голосовое управление",
          "голосовое управление"
        ]
      )
    ) {
      return "start_voice";
    }

    return "fallback";
  }

   async function processCommand(
    command
  ) {
    const raw =
      cleanText(command);

    const n =
      normalize(raw);

    const intent =
      classify(raw);

    switch (intent) {

      case "empty":
        return "Готов. Введи команду.";

      case "greeting":
        return (
          "Привет. JARVIS на связи " +
          "и готов к работе."
        );

      case "identity":
        return (
          `Я ${CONFIG.name}, ` +
          `локальное AI-ядро ${CONFIG.project}. ` +
          `Версия ${CONFIG.version}.`
        );

      case "help":
        return helpText();

      case "status":
        return (
          "Система в норме. " +
          "JARVIS READY. " +
          `Команд обработано: ${state.commandCount}. ` +
          `Память: ${state.memory.length}. ` +
          `История: ${state.history.length}.`
        );

      case "diagnostics":
        return diagnose();

      case "time":
        return (
          `Сейчас ${currentTime()}.`
        );

      case "date":
        return (
          `Сегодня ${currentDate()}.`
        );

      case "remember": {
        const value =
          extractRememberText(raw);

        if (!value) {
          return (
            "Что именно запомнить?"
          );
        }

        remember(value);

        return (
          `Запомнил: «${value}».`
        );
      }

      case "memory_show":

        if (!state.memory.length) {
          return "Память пуста.";
        }

        return (
          "Моя локальная память:\n" +
          state.memory
            .map(
              (item, i) =>
                `${i + 1}. ${item}`
            )
            .join("\n")
        );

      case "memory_clear":

        clearMemory();

        return (
          "Локальная память очищена."
        );

      case "music_play":

        return playMusic();

      case "music_stop":

        return stopMusic();

      case "music_toggle":

        return toggleMusic();

      case "open_chat":

        return openSection(
          "chat"
        );

      case "open_music":

        return openSection(
          "music"
        );

      case "open_news":

        return openSection(
          "news"
        );

      case "open_home":

        return openSection(
          "home"
        );

      case "open_ai":

        return openSection(
          "ai"
        );

      case "stop_voice":

        stopSpeaking();

        stopVoice();

        return (
          "Голосовой вывод остановлен."
        );

      case "start_voice":

        return startVoice();

      default:
        break;
    }

    /*
      Безопасный разговорный fallback.

      JARVIS не притворяется подключённым
      к внешней нейросети, если её нет.
    */

    if (
      n.includes("ashina")
    ) {
      return (
        "ASHINA работает локально. " +
        "Я могу управлять доступными разделами, " +
        "памятью, музыкой и системными функциями."
      );
    }

    if (
      n.includes("ты работаешь") ||
      n.includes(
        "ты работаешь сейчас"
      )
    ) {
      return state.ready
        ? "Да. JARVIS работает и готов принимать команды."
        : "Я ещё запускаюсь.";
    }

    if (
      n.includes("спасибо")
    ) {
      return (
        "Пожалуйста. Я на связи."
      );
    }

    if (
      n.includes("молодец") ||
      n.includes("круто")
    ) {
      return (
        "Принято. Продолжаю работу."
      );
    }

    if (
      n.includes("помнишь меня")
    ) {
      return state.memory.length
        ? "Да. У меня есть сохранённые записи локальной памяти."
        : "Пока в локальной памяти ничего нет.";
    }

    return (
      `Команду «${raw}» я получил, ` +
      "но в текущем локальном ядре " +
      "нет подходящего действия. " +
      "Попробуй «что ты умеешь» или «помощь»."
    );
  }

  function ask(
    command,
    options
  ) {
    const text =
      cleanText(command);

    if (!text) {
      return Promise.resolve("");
    }

    commandQueue =
      commandQueue
        .catch(() => undefined)
        .then(
          async () => {

            state.thinking = true;

            state.lastCommand =
              text;

            state.lastUserMessage =
              text;

            state.commandCount += 1;

            setStatus(
              "JARVIS · ДУМАЮ"
            );

            /*
              ВАЖНО:

              index.html теперь только передаёт
              команду в ask().

              Само ядро добавляет сообщение
              пользователя в историю.

              Поэтому одна команда =
              одна запись пользователя.
            */

            addMessage(
              text,
              "user",
              true
            );

            try {

              const answer =
                cleanText(
                  await processCommand(
                    text
                  )
                );

              state.lastAIMessage =
                answer;

              state.lastTopic =
                classify(text);

              addMessage(
                answer,
                "jarvis",
                true
              );

              saveMemory(false);

              if (
                !options ||
                options.speak !== false
              ) {
                speak(answer);
              }

              return answer;

            } finally {

              state.thinking =
                false;

              if (
                state.ready &&
                !state.speaking &&
                !state.listening
              ) {
                setStatus(
                  "READY"
                );
              }

              renderMemory();
            }
          }
        );

    return commandQueue;
  }

  function startVoice() {

    if (
      state.settings.voice === false
    ) {
      return (
        "Голосовое управление " +
        "отключено в настройках."
      );
    }

    if (
      recognitionStarting ||
      state.listening
    ) {
      return (
        "Я уже слушаю."
      );
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return (
        "Распознавание речи " +
        "недоступно в этом браузере."
      );
    }

    if (!recognition) {

      recognition =
        new SpeechRecognition();

      recognition.lang =
        "ru-RU";

      recognition.continuous =
        false;

      recognition.interimResults =
        false;

      recognition.maxAlternatives =
        1;

      recognition.onstart =
        () => {

          recognitionStarting =
            false;

          state.listening =
            true;

          setStatus(
            "JARVIS · СЛУШАЮ"
          );
        };

      recognition.onresult =
        (event) => {

          const transcript =
            cleanText(
              event.results
                ?.[
                  0
                ]
                ?.[0]
                ?.transcript || ""
            );

          if (transcript) {
            ask(transcript);
          }
        };

      recognition.onerror =
        (event) => {

          recognitionStarting =
            false;

          state.listening =
            false;

          if (
            event &&
            event.error ===
              "not-allowed"
          ) {
            console.warn(
              "JARVIS voice permission denied"
            );
          } else if (
            event &&
            event.error ===
              "no-speech"
          ) {
            console.info(
              "JARVIS voice: no speech"
            );
          } else {
            console.warn(
              "JARVIS voice error",
              event &&
                event.error
            );
          }

          if (
            state.ready &&
            !state.thinking &&
            !state.speaking
          ) {
            setStatus(
              "READY"
            );
          }
        };

      recognition.onend =
        () => {

          recognitionStarting =
            false;

          state.listening =
            false;

          if (
            state.ready &&
            !state.thinking &&
            !state.speaking
          ) {
            setStatus(
              "READY"
            );
          }
        };
    }

    try {

      recognitionStarting =
        true;

      recognition.start();

      return "Слушаю...";

    } catch (error) {

      recognitionStarting =
        false;

      state.listening =
        false;

      if (
        error &&
        error.name ===
          "InvalidStateError"
      ) {
        return (
          "Голосовое управление " +
          "уже запускается."
        );
      }

      console.warn(
        "JARVIS recognition start error",
        error
      );

      return (
        "Не удалось запустить " +
        "голосовое управление."
      );
    }
  }

  function stopVoice() {

    recognitionStarting =
      false;

    try {

      if (recognition) {
        recognition.stop();
      }

    } catch (_) {}

    state.listening =
      false;

    if (
      state.ready &&
      !state.thinking &&
      !state.speaking
    ) {
      setStatus(
        "READY"
      );
    }

    return (
      "Голосовое управление " +
      "остановлено."
    );
  }

  function restoreHistory() {
    renderHistory();
  }

  function setSettings(next) {

    if (
      !next ||
      typeof next !== "object"
    ) {
      return getSettings();
    }

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...state.settings,
      ...next
    };

    saveJSON(
      CONFIG.storage.settings,
      state.settings
    );

    return getSettings();
  }

  function getSettings() {
    return {
      ...state.settings
    };
  }

  function getState() {
    return {
      ...state,
      memory: [
        ...state.memory
      ],
      history: [
        ...state.history
      ],
      settings: {
        ...state.settings
      }
    };
  }

  function loadSettings() {

    const value =
      loadJSON(
        CONFIG.storage.settings,
        {}
      );

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(
        value &&
        typeof value === "object"
          ? value
          : {}
      )
    };
  }

  function initialize() {

    if (initialized) {
      return window.JARVIS;
    }

    initialized =
      true;

    loadSettings();

    loadMemory();

    loadHistory();

    renderMemory();

    restoreHistory();

    state.ready =
      true;

    setStatus(
      "READY"
    );

    try {

      window.dispatchEvent(
        new CustomEvent(
          "jarvis:ready",
          {
            detail: {
              version:
                CONFIG.version
            }
          }
        )
      );

    } catch (_) {}

    return window.JARVIS;
  }

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

    openSection,

    setSettings,

    getSettings,

    getState,

    restoreHistory,

    initialize,

    config:
      CONFIG
  };

  /*
    Единый публичный API JARVIS.
    Старые имена сохраняем для совместимости
    с текущим index.html.
  */

  window.JARVIS =
    API;

  window.JARVIS_API =
    API;

  window.ASHINA_JARVIS =
    API;

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

  } else {

    initialize();

  }

})();

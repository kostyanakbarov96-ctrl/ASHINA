/* =========================================================
   ASHINA JARVIS CORE
   Version 1.0
   Local Intelligence Core
   ========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       CONFIG
    --------------------------------------------------------- */

    const CONFIG = {
        name: "JARVIS",
        project: "ASHINA",
        version: "1.0",
        mode: "LOCAL",

        storage: {
            memory: "ashina_jarvis_memory_v1",
            history: "ashina_jarvis_history_v1",
            settings: "ashina_jarvis_settings_v1"
        },

        maxHistory: 100,
        maxMemories: 100
    };


    /* ---------------------------------------------------------
       STATE
    --------------------------------------------------------- */

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

        settings: {
            voice: true,
            speech: true,
            fastMode: false
        }
    };


    /* ---------------------------------------------------------
       SAFE DOM
    --------------------------------------------------------- */

    function $(id) {
        return document.getElementById(id) || null;
    }


    function setText(id, text) {
        const el = $(id);

        if (el) {
            el.textContent = text;
        }
    }


    function addClass(id, className) {
        const el = $(id);

        if (el) {
            el.classList.add(className);
        }
    }


    function removeClass(id, className) {
        const el = $(id);

        if (el) {
            el.classList.remove(className);
        }
    }


    /* ---------------------------------------------------------
       STORAGE
    --------------------------------------------------------- */

    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);

            if (!raw) {
                return fallback;
            }

            return JSON.parse(raw);
        } catch (error) {
            console.warn("JARVIS storage read error:", error);
            return fallback;
        }
    }


    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn("JARVIS storage write error:", error);
            return false;
        }
    }


    /* ---------------------------------------------------------
       MEMORY
    --------------------------------------------------------- */

    function loadMemory() {
        const saved = loadJSON(CONFIG.storage.memory, null);

        if (saved && typeof saved === "object") {
            state.memory = Array.isArray(saved.memories)
                ? saved.memories
                : [];

            state.lastCommand = saved.lastCommand || "";
            state.lastTopic = saved.lastTopic || "";
            state.lastUserMessage = saved.lastUserMessage || "";
            state.lastAIMessage = saved.lastAIMessage || "";
            state.commandCount = Number(saved.commandCount || 0);
        }
    }


    function saveMemory() {
        saveJSON(CONFIG.storage.memory, {
            memories: state.memory.slice(0, CONFIG.maxMemories),
            lastCommand: state.lastCommand,
            lastTopic: state.lastTopic,
            lastUserMessage: state.lastUserMessage,
            lastAIMessage: state.lastAIMessage,
            commandCount: state.commandCount,
            updated: Date.now()
        });

        renderMemory();
    }


    function remember(text) {
        if (!text) {
            return false;
        }

        const clean = String(text).trim();

        if (!clean) {
            return false;
        }

        const exists = state.memory.some(
            item => item.toLowerCase() === clean.toLowerCase()
        );

        if (!exists) {
            state.memory.unshift(clean);
            state.memory = state.memory.slice(0, CONFIG.maxMemories);
            saveMemory();
        }

        return true;
    }


    function clearMemory() {
        state.memory = [];

        state.lastTopic = "";
        state.lastCommand = "";

        saveMemory();

        return true;
    }


    function getMemory() {
        return [...state.memory];
    }


    function renderMemory() {
        const box = $("memoryBox");

        if (!box) {
            return;
        }

        if (!state.memory.length) {
            box.textContent = "Память пуста.";
            return;
        }

        box.innerHTML = state.memory
            .map((item, index) =>
                `<div>${index + 1}. ${escapeHTML(item)}</div>`
            )
            .join("");
    }


    /* ---------------------------------------------------------
       HISTORY
    --------------------------------------------------------- */

    function loadHistory() {
        const saved = loadJSON(CONFIG.storage.history, []);

        if (Array.isArray(saved)) {
            state.history = saved.slice(-CONFIG.maxHistory);
        }
    }


    function saveHistory() {
        state.history = state.history.slice(-CONFIG.maxHistory);

        saveJSON(CONFIG.storage.history, state.history);
    }


    function addHistory(role, text) {
        state.history.push({
            role,
            text,
            time: Date.now()
        });

        saveHistory();
    }


    function getContext(limit = 10) {
        return state.history
            .slice(-limit)
            .map(item => ({
                role: item.role,
                text: item.text
            }));
    }


    /* ---------------------------------------------------------
       SETTINGS
    --------------------------------------------------------- */

    function loadSettings() {
        const saved = loadJSON(
            CONFIG.storage.settings,
            null
        );

        if (saved && typeof saved === "object") {
            state.settings = {
                ...state.settings,
                ...saved
            };
        }
    }


    function saveSettings() {
        saveJSON(
            CONFIG.storage.settings,
            state.settings
        );
    }


    function setSettings(settings = {}) {
        state.settings = {
            ...state.settings,
            ...settings
        };

        saveSettings();

        return {
            ...state.settings
        };
    }


    /* ---------------------------------------------------------
       SECURITY
    --------------------------------------------------------- */

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    /* ---------------------------------------------------------
       UI OUTPUT
    --------------------------------------------------------- */

    function setThinking(value) {
        state.thinking = value;

        const core = $("core");

        if (core) {
            if (value) {
                core.classList.add("thinking");
            } else {
                core.classList.remove("thinking");
            }
        }

        const status = $("aiStatus");

        if (status) {
            status.textContent = value
                ? "JARVIS думает..."
                : "JARVIS готов";
        }
    }


    function addMessage(text, type = "ai") {
        const log = $("log");

        if (log) {
            const message = document.createElement("div");

            message.className = `message ${type}`;
            message.textContent = text;

            log.appendChild(message);

            log.scrollTop = log.scrollHeight;
        }

        addHistory(
            type === "user" ? "user" : "assistant",
            text
        );
    }


    /* ---------------------------------------------------------
       VOICE
    --------------------------------------------------------- */

    function speak(text) {
        if (!state.settings.voice) {
            return;
        }

        if (!state.settings.speech) {
            return;
        }

        if (!("speechSynthesis" in window)) {
            return;
        }

        try {
            window.speechSynthesis.cancel();

            const utterance =
                new SpeechSynthesisUtterance(text);

            utterance.lang = "ru-RU";
            utterance.rate = 0.95;
            utterance.pitch = 0.95;
            utterance.volume = 1;

            state.speaking = true;

            utterance.onend = () => {
                state.speaking = false;
            };

            utterance.onerror = () => {
                state.speaking = false;
            };

            window.speechSynthesis.speak(utterance);

        } catch (error) {
            console.warn("JARVIS speech error:", error);
            state.speaking = false;
        }
    }


    function stopSpeaking() {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        state.speaking = false;
    }


    /* ---------------------------------------------------------
       NORMALIZATION
    --------------------------------------------------------- */

    function normalize(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[!?.,:;()[\]{}"'`]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }


    function contains(text, words) {
        return words.some(word =>
            text.includes(word)
        );
    }


    /* ---------------------------------------------------------
       MUSIC
    --------------------------------------------------------- */

    function getMusicElement() {
        return (
            $("audio") ||
            $("music")
        );
    }


    async function playMusic() {
        const audio = getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message: "Музыкальный модуль сейчас недоступен."
            };
        }

        try {
            await audio.play();

            return {
                ok: true,
                message: "Музыка запущена."
            };

        } catch (error) {
            console.warn("Music play error:", error);

            return {
                ok: false,
                message: "Не удалось запустить музыку. Возможно, браузер ждёт нажатия пользователя."
            };
        }
    }


    function stopMusic() {
        const audio = getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message: "Музыкальный модуль недоступен."
            };
        }

        audio.pause();

        return {
            ok: true,
            message: "Музыка остановлена."
        };
    }


    function toggleMusic() {
        const audio = getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message: "Музыкальный модуль недоступен."
            };
        }

        if (audio.paused) {
            return playMusic();
        }

        audio.pause();

        return {
            ok: true,
            message: "Музыка поставлена на паузу."
        };
    }


    /* ---------------------------------------------------------
       NAVIGATION
    --------------------------------------------------------- */

    function openSection(section) {
        if (!section) {
            return false;
        }

        const cleanSection =
            String(section)
                .replace("#", "")
                .trim();

        const target =
            document.getElementById(cleanSection);

        if (target) {
            document.querySelectorAll("section").forEach(
                sectionElement => {
                    sectionElement.style.display =
                        sectionElement.id === cleanSection
                            ? ""
                            : "none";
                }
            );

            window.location.hash = cleanSection;

            return true;
        }

        window.location.hash = cleanSection;

        return true;
    }


    /* ---------------------------------------------------------
       DIAGNOSTICS
    --------------------------------------------------------- */

    async function diagnose() {
        const results = {};

        results.localStorage =
            (() => {
                try {
                    const test = "__ashina_test__";

                    localStorage.setItem(test, "1");
                    localStorage.removeItem(test);

                    return true;
                } catch {
                    return false;
                }
            })();

        results.audio =
            !!getMusicElement();

        results.speechSynthesis =
            "speechSynthesis" in window;

        results.speechRecognition =
            !!(
                window.SpeechRecognition ||
                window.webkitSpeechRecognition
            );

        results.serviceWorker =
            "serviceWorker" in navigator;

        results.indexedDB =
            "indexedDB" in window;

        results.jarvis =
            true;

        results.online =
            navigator.onLine;

        const available =
            Object.values(results)
                .filter(Boolean)
                .length;

        const total =
            Object.keys(results).length;

        return {
            ...results,
            available,
            total,
            percentage:
                Math.round(
                    (available / total) * 100
                )
        };
    }


    async function diagnosticsText() {
        const result = await diagnose();

        const lines = [
            "Диагностика ASHINA:",
            `LocalStorage: ${result.localStorage ? "OK" : "ERROR"}`,
            `Audio: ${result.audio ? "OK" : "ERROR"}`,
            `Speech: ${result.speechSynthesis ? "OK" : "ERROR"}`,
            `Voice input: ${result.speechRecognition ? "OK" : "ERROR"}`,
            `Service Worker: ${result.serviceWorker ? "OK" : "ERROR"}`,
            `IndexedDB: ${result.indexedDB ? "OK" : "ERROR"}`,
            `Интернет: ${result.online ? "ONLINE" : "OFFLINE"}`,
            `JARVIS: ${result.jarvis ? "ONLINE" : "ERROR"}`,
            `Готовность: ${result.percentage}%`
        ];

        return lines.join("\n");
    }


    /* ---------------------------------------------------------
       COMMAND PROCESSOR
       --------------------------------------------------------- */

    async function processCommand(command) {
        const original =
            String(command || "").trim();

        if (!original) {
            return "";
        }

        const text = normalize(original);

        state.lastCommand = original;
        state.lastUserMessage = original;
        state.commandCount++;

        addHistory("user", original);

        saveMemory();

        /* GREETING */

        if (
            contains(text, [
                "привет",
                "здравствуй",
                "доброе утро",
                "добрый день",
                "добрый вечер"
            ])
        ) {
            return "Привет. JARVIS на связи. ASHINA готова к работе.";
        }


        /* IDENTITY */

        if (
            contains(text, [
                "кто ты",
                "ты кто",
                "представься"
            ])
        ) {
            return `Я ${CONFIG.name}, локальное AI-ядро проекта ${CONFIG.project}. Версия ${CONFIG.version}.`;
        }


        /* STATUS */

        if (
            contains(text, [
                "статус",
                "состояние",
                "как дела"
            ])
        ) {
            return `JARVIS работает. Команд обработано: ${state.commandCount}.`;
        }


        /* CAPABILITIES */

        if (
            contains(text, [
                "что ты умеешь",
                "возможности",
                "что умеешь"
            ])
        ) {
            return "Я могу управлять разделами ASHINA, музыкой, памятью, голосом и диагностикой. Архитектура готова для расширения AI-модуля.";
        }


        /* TIME */

        if (
            contains(text, [
                "который час",
                "сколько времени",
                "время"
            ])
        ) {
            return `Сейчас ${new Date().toLocaleTimeString(
                "ru-RU",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )}.`;
        }


        /* DATE */

        if (
            contains(text, [
                "какая дата",
                "сегодня дата",
                "какое сегодня число"
            ])
        ) {
            return `Сегодня ${new Date().toLocaleDateString(
                "ru-RU",
                {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            )}.`;
        }


        /* MEMORY ADD */

        if (
            text.startsWith("запомни ") ||
            text.startsWith("запиши в память ") ||
            text.startsWith("сохрани в память ")
        ) {
            let memoryText = original
                .replace(
                    /^запомни\s+/i,
                    ""
                )
                .replace(
                    /^запиши в память\s+/i,
                    ""
                )
                .replace(
                    /^сохрани в память\s+/i,
                    ""
                )
                .trim();

            if (memoryText) {
                remember(memoryText);

                return "Записал это в память ASHINA.";
            }

            return "Что именно нужно запомнить?";
        }


        /* MEMORY SHOW */

        if (
            contains(text, [
                "покажи память",
                "что ты помнишь",
                "моя память"
            ])
        ) {
            if (!state.memory.length) {
                return "Память пока пуста.";
            }

            return [
                "Что сейчас хранится в памяти:",
                ...state.memory.map(
                    (item, index) =>
                        `${index + 1}. ${item}`
                )
            ].join("\n");
        }


        /* MEMORY CLEAR */

        if (
            contains(text, [
                "очисти память",
                "забудь всё",
                "удали память"
            ])
        ) {
            clearMemory();

            return "Память очищена.";
        }


        /* DIAGNOSTICS */

        if (
            contains(text, [
                "диагностика",
                "проверь систему",
                "проведи диагностику",
                "проверка системы"
            ])
        ) {
            return await diagnosticsText();
        }


        /* MUSIC PLAY */

        if (
            contains(text, [
                "включи музыку",
                "запусти музыку",
                "играй музыку",
                "включи трек"
            ])
        ) {
            const result = await playMusic();

            return result.message;
        }


        /* MUSIC STOP */

        if (
            contains(text, [
                "выключи музыку",
                "останови музыку",
                "поставь музыку на паузу",
                "пауза"
            ])
        ) {
            const result = stopMusic();

            return result.message;
        }


        /* MUSIC TOGGLE */

        if (
            text === "музыка"
        ) {
            const result = await toggleMusic();

            return result.message;
        }


        /* OPEN CHAT */

        if (
            contains(text, [
                "открой чат",
                "перейди в чат"
            ])
        ) {
            openSection("chat");

            return "Открываю чат.";
        }


        /* OPEN MUSIC */

        if (
            contains(text, [
                "открой музыку",
                "перейди в музыку"
            ])
        ) {
            openSection("music");

            return "Открываю музыку.";
        }


        /* OPEN NEWS */

        if (
            contains(text, [
                "открой новости",
                "перейди в новости",
                "открой ленту"
            ])
        ) {
            openSection("news");

            return "Открываю ленту.";
        }


        /* OPEN HOME */

        if (
            contains(text, [
                "открой главную",
                "на главную"
            ])
        ) {
            openSection("home");

            return "Возвращаюсь на главную.";
        }


        /* OPEN AI */

        if (
            contains(text, [
                "открой ai",
                "открой ии",
                "открой искусственный интеллект"
            ])
        ) {
            openSection("ai");

            return "Открываю AI-центр.";
        }


        /* STOP VOICE */

        if (
            contains(text, [
                "замолчи",
                "останови голос",
                "выключи голос"
            ])
        ) {
            stopSpeaking();

            return "Голосовой вывод остановлен.";
        }


        /* HELP */

        if (
            contains(text, [
                "помощь",
                "справка",
                "команды"
            ])
        ) {
            return [
                "Доступные команды:",
                "• Привет",
                "• Кто ты?",
                "• Что ты умеешь?",
                "• Статус",
                "• Диагностика",
                "• Включи музыку",
                "• Останови музыку",
                "• Открой чат",
                "• Открой музыку",
                "• Открой новости",
                "• Покажи память",
                "• Запомни ...",
                "• Очисти память"
            ].join("\n");
        }


        /* FALLBACK */

        return "Команда получена. Сейчас я ещё не знаю, как выполнить её полностью, но архитектура JARVIS готова для подключения новых навыков.";
    }


    /* ---------------------------------------------------------
       ASK
       --------------------------------------------------------- */

    async function ask(command, options = {}) {
        const text =
            String(command || "").trim();

        if (!text) {
            return "";
        }

        setThinking(true);

        let response;

        try {
            response = await processCommand(text);
        } catch (error) {
            console.error("JARVIS command error:", error);

            response =
                "Произошла ошибка при обработке команды.";
        }

        state.lastAIMessage = response;

        saveMemory();

        if (options.render !== false) {
            addMessage(response, "ai");
        }

        if (
            options.speak !== false &&
            state.settings.voice &&
            state.settings.speech
        ) {
            speak(response);
        }

        setThinking(false);

        return response;
    }


    /* ---------------------------------------------------------
       VOICE INPUT
       --------------------------------------------------------- */

    let recognition = null;


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

        instance.onstart = () => {
            state.listening = true;

            setText(
                "aiStatus",
                "Слушаю..."
            );
        };

        instance.onend = () => {
            state.listening = false;

            if (!state.thinking) {
                setText(
                    "aiStatus",
                    "JARVIS готов"
                );
            }
        };

        instance.onerror = error => {
            console.warn(
                "JARVIS voice recognition error:",
                error
            );

            state.listening = false;

            setText(
                "aiStatus",
                "Ошибка голосового ввода"
            );
        };

        instance.onresult = event => {
            const transcript =
                event.results?.[0]?.[0]?.transcript || "";

            if (!transcript) {
                return;
            }

            const input =
                $("command") ||
                $("input");

            if (input) {
                input.value = transcript;
            }

            ask(transcript);
        };

        return instance;
    }


    function startVoice() {
        if (state.listening) {
            return false;
        }

        if (!recognition) {
            recognition = createRecognition();
        }

        if (!recognition) {
            return false;
        }

        try {
            recognition.start();
            return true;
        } catch (error) {
            console.warn(
                "Voice start error:",
                error
            );

            return false;
        }
    }


    function stopVoice() {
        if (!recognition) {
            return;
        }

        try {
            recognition.stop();
        } catch {
            // already stopped
        }

        state.listening = false;
    }


    /* ---------------------------------------------------------
       INPUT CONNECTION
       --------------------------------------------------------- */

    function connectInput() {
        const input =
            $("command") ||
            $("input");

        if (!input) {
            return;
        }

        input.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                addMessage(text, "user");

                input.value = "";

                ask(text);
            }
        );
    }


    /* ---------------------------------------------------------
       RESTORE UI
       --------------------------------------------------------- */

    function restoreHistory() {
        const log = $("log");

        if (!log) {
            return;
        }

        log.innerHTML = "";

        const items =
            state.history.slice(-15);

        if (!items.length) {
            addMessage(
                "JARVIS онлайн. Ядро ASHINA готово.",
                "ai"
            );

            return;
        }

        items.forEach(item => {
            const message =
                document.createElement("div");

            message.className =
                `message ${
                    item.role === "user"
                        ? "user"
                        : "ai"
                }`;

            message.textContent =
                item.text;

            log.appendChild(message);
        });

        log.scrollTop = log.scrollHeight;
    }


    /* ---------------------------------------------------------
       PUBLIC API
       --------------------------------------------------------- */

    const API = {
        name: CONFIG.name,
        project: CONFIG.project,
        version: CONFIG.version,
        mode: CONFIG.mode,

        get ready() {
            return state.ready;
        },

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

        getSettings() {
            return {
                ...state.settings
            };
        },

        getState() {
            return {
                ...state,
                memory: [...state.memory],
                history: [...state.history]
            };
        }
    };


    /* ---------------------------------------------------------
       GLOBAL REGISTRATION
       --------------------------------------------------------- */

    window.JARVIS = API;
    window.JARVIS_API = API;

    window.ASHINA_JARVIS = API;


    /* ---------------------------------------------------------
       STARTUP
       --------------------------------------------------------- */

    function initialize() {
        try {
            loadSettings();
            loadMemory();
            loadHistory();

            renderMemory();
            restoreHistory();
            connectInput();

            state.ready = true;

            setText(
                "aiStatus",
                "JARVIS готов"
            );

            const systemStatus =
                $("systemStatus");

            if (systemStatus) {
                systemStatus.textContent =
                    "JARVIS ONLINE";
            }

            console.log(
                `ASHINA ${CONFIG.project} — ${CONFIG.name} Core ${CONFIG.version} ONLINE`
            );

        } catch (error) {
            console.error(
                "JARVIS initialization error:",
                error
            );
        }
    }


    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

})();

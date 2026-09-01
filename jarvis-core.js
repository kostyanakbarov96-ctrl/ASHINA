/* =========================================================
   ASHINA JARVIS CORE
   Version 1.1
   Local Intelligence Core
   FIX BUILD
   ========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       CONFIG
    --------------------------------------------------------- */

    const CONFIG = {
        name: "JARVIS",
        project: "ASHINA",
        version: "1.1",
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
       INTERNAL CONTROL
       --------------------------------------------------------- */

    let recognition = null;

    let commandQueue = Promise.resolve();

    let initialized = false;


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
       STORAGE
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
            console.warn(
                "JARVIS storage read error:",
                key,
                error
            );

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

        } catch (error) {
            console.warn(
                "JARVIS storage write error:",
                key,
                error
            );

            return false;
        }
    }


    /* ---------------------------------------------------------
       MEMORY
       --------------------------------------------------------- */

    function loadMemory() {
        const saved =
            loadJSON(
                CONFIG.storage.memory,
                null
            );

        if (!saved || typeof saved !== "object") {
            return;
        }

        if (Array.isArray(saved.memories)) {
            state.memory =
                saved.memories
                    .filter(item =>
                        typeof item === "string"
                    )
                    .slice(
                        0,
                        CONFIG.maxMemories
                    );
        }

        state.lastCommand =
            String(
                saved.lastCommand || ""
            );

        state.lastTopic =
            String(
                saved.lastTopic || ""
            );

        state.lastUserMessage =
            String(
                saved.lastUserMessage || ""
            );

        state.lastAIMessage =
            String(
                saved.lastAIMessage || ""
            );

        const count =
            Number(
                saved.commandCount || 0
            );

        state.commandCount =
            Number.isFinite(count)
                ? Math.max(0, count)
                : 0;
    }


    function saveMemory(render = true) {
        const data = {
            memories:
                state.memory
                    .slice(
                        0,
                        CONFIG.maxMemories
                    ),

            lastCommand:
                state.lastCommand,

            lastTopic:
                state.lastTopic,

            lastUserMessage:
                state.lastUserMessage,

            lastAIMessage:
                state.lastAIMessage,

            commandCount:
                state.commandCount,

            updated:
                Date.now()
        };

        const result =
            saveJSON(
                CONFIG.storage.memory,
                data
            );

        if (render) {
            renderMemory();
        }

        return result;
    }


    function remember(text) {
        const clean =
            String(text || "").trim();

        if (!clean) {
            return false;
        }

        const exists =
            state.memory.some(
                item =>
                    item.toLowerCase() ===
                    clean.toLowerCase()
            );

        if (exists) {
            return true;
        }

        state.memory.unshift(clean);

        state.memory =
            state.memory.slice(
                0,
                CONFIG.maxMemories
            );

        saveMemory();

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
        const box =
            $("memoryBox");

        if (!box) {
            return;
        }

        if (!state.memory.length) {
            box.textContent =
                "Память пуста.";

            return;
        }

        box.innerHTML =
            state.memory
                .map(
                    (item, index) =>
                        `<div>${index + 1}. ${escapeHTML(item)}</div>`
                )
                .join("");
    }


    /* ---------------------------------------------------------
       HISTORY
       --------------------------------------------------------- */

    function loadHistory() {
        const saved =
            loadJSON(
                CONFIG.storage.history,
                []
            );

        if (!Array.isArray(saved)) {
            return;
        }

        state.history =
            saved
                .filter(item =>
                    item &&
                    typeof item === "object" &&
                    typeof item.text === "string"
                )
                .map(item => ({
                    role:
                        item.role === "user"
                            ? "user"
                            : "assistant",

                    text:
                        String(item.text),

                    time:
                        Number(item.time) ||
                        Date.now()
                }))
                .slice(
                    -CONFIG.maxHistory
                );
    }


    function saveHistory() {
        state.history =
            state.history.slice(
                -CONFIG.maxHistory
            );

        return saveJSON(
            CONFIG.storage.history,
            state.history
        );
    }


    function addHistory(role, text) {
        const clean =
            String(text || "").trim();

        if (!clean) {
            return;
        }

        state.history.push({
            role:
                role === "user"
                    ? "user"
                    : "assistant",

            text:
                clean,

            time:
                Date.now()
        });

        state.history =
            state.history.slice(
                -CONFIG.maxHistory
            );

        saveHistory();
    }


    function getContext(limit = 10) {
        const safeLimit =
            Math.max(
                1,
                Math.min(
                    Number(limit) || 10,
                    CONFIG.maxHistory
                )
            );

        return state.history
            .slice(-safeLimit)
            .map(item => ({
                role: item.role,
                text: item.text
            }));
    }


    /* ---------------------------------------------------------
       SETTINGS
       --------------------------------------------------------- */

    function loadSettings() {
        const saved =
            loadJSON(
                CONFIG.storage.settings,
                null
            );

        if (!saved || typeof saved !== "object") {
            return;
        }

        state.settings = {
            ...state.settings,
            ...saved
        };
    }


    function saveSettings() {
        return saveJSON(
            CONFIG.storage.settings,
            state.settings
        );
    }


    function setSettings(settings = {}) {
        if (
            !settings ||
            typeof settings !== "object"
        ) {
            return {
                ...state.settings
            };
        }

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
       UI
       --------------------------------------------------------- */

    function setThinking(value) {
        state.thinking = !!value;

        const core =
            $("core");

        if (core) {
            core.classList.toggle(
                "thinking",
                state.thinking
            );
        }

        const status =
            $("aiStatus");

        if (!status) {
            return;
        }

        if (state.listening) {
            status.textContent =
                "Слушаю...";

            return;
        }

        status.textContent =
            state.thinking
                ? "JARVIS думает..."
                : "JARVIS готов";
    }


    function addMessage(
        text,
        type = "ai",
        save = true
    ) {
        const clean =
            String(text || "").trim();

        if (!clean) {
            return;
        }

        const log =
            $("log");

        if (log) {
            const message =
                document.createElement("div");

            message.className =
                `message ${
                    type === "user"
                        ? "user"
                        : "ai"
                }`;

            message.textContent =
                clean;

            log.appendChild(message);

            log.scrollTop =
                log.scrollHeight;
        }

        if (save) {
            addHistory(
                type === "user"
                    ? "user"
                    : "assistant",
                clean
            );
        }
    }


    /* ---------------------------------------------------------
       VOICE OUTPUT
       --------------------------------------------------------- */

    function speak(text) {
        if (!state.settings.voice) {
            return false;
        }

        if (!state.settings.speech) {
            return false;
        }

        if (
            !(
                "speechSynthesis" in
                window
            )
        ) {
            return false;
        }

        const clean =
            String(text || "").trim();

        if (!clean) {
            return false;
        }

        try {
            window.speechSynthesis.cancel();

            const utterance =
                new SpeechSynthesisUtterance(
                    clean
                );

            utterance.lang =
                "ru-RU";

            /*
             * FastMode slightly speeds up
             * speech without affecting command
             * processing.
             */

            utterance.rate =
                state.settings.fastMode
                    ? 1.05
                    : 0.95;

            utterance.pitch =
                0.95;

            utterance.volume =
                1;

            state.speaking =
                true;

            utterance.onend =
                () => {
                    state.speaking =
                        false;
                };

            utterance.onerror =
                () => {
                    state.speaking =
                        false;
                };

            window.speechSynthesis
                .speak(utterance);

            return true;

        } catch (error) {
            console.warn(
                "JARVIS speech error:",
                error
            );

            state.speaking =
                false;

            return false;
        }
    }


    function stopSpeaking() {
        if (
            "speechSynthesis" in
            window
        ) {
            try {
                window.speechSynthesis
                    .cancel();
            } catch {
                // ignore
            }
        }

        state.speaking =
            false;
    }


    /* ---------------------------------------------------------
       NORMALIZATION
       --------------------------------------------------------- */

    function normalize(text) {
        return String(text || "")
            .toLowerCase()
            .replace(
                /[!?.,:;()[\]{}"'`]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    function contains(text, words) {
        return words.some(
            word =>
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
        const audio =
            getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message:
                    "Музыкальный модуль сейчас недоступен."
            };
        }

        try {
            /*
             * Calling play() directly keeps
             * command execution fast.
             */

            await audio.play();

            return {
                ok: true,
                message:
                    "Музыка запущена."
            };

        } catch (error) {
            console.warn(
                "Music play error:",
                error
            );

            return {
                ok: false,
                message:
                    "Не удалось запустить музыку. Возможно, браузер ждёт нажатия пользователя."
            };
        }
    }


    function stopMusic() {
        const audio =
            getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message:
                    "Музыкальный модуль недоступен."
            };
        }

        audio.pause();

        return {
            ok: true,
            message:
                "Музыка остановлена."
        };
    }


    async function toggleMusic() {
        const audio =
            getMusicElement();

        if (!audio) {
            return {
                ok: false,
                message:
                    "Музыкальный модуль недоступен."
            };
        }

        if (audio.paused) {
            return playMusic();
        }

        audio.pause();

        return {
            ok: true,
            message:
                "Музыка поставлена на паузу."
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
                .replace(/^#/, "")
                .trim();

        const target =
            document.getElementById(
                cleanSection
            );

        if (!target) {
            return false;
        }

        /*
         * Important:
         * don't force inline display styles.
         * The ASHINA UI controls visibility
         * through its active classes.
         */

        document
            .querySelectorAll(
                "section"
            )
            .forEach(
                sectionElement => {
                    sectionElement.classList.toggle(
                        "active",
                        sectionElement.id ===
                            cleanSection
                    );
                }
            );

        /*
         * Compatibility fallback for
         * layouts without .active rules.
         */

        document
            .querySelectorAll(
                "section"
            )
            .forEach(
                sectionElement => {
                    if (
                        sectionElement.id ===
                        cleanSection
                    ) {
                        sectionElement.removeAttribute(
                            "hidden"
                        );
                    } else {
                        sectionElement.removeAttribute(
                            "hidden"
                        );
                    }
                }
            );

        try {
            window.location.hash =
                cleanSection;
        } catch {
            // ignore
        }

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
                    const key =
                        "__ashina_jarvis_test__";

                    localStorage.setItem(
                        key,
                        "1"
                    );

                    localStorage.removeItem(
                        key
                    );

                    return true;

                } catch {
                    return false;
                }
            })();

        results.audio =
            !!getMusicElement();

        results.speechSynthesis =
            "speechSynthesis" in
            window;

        results.speechRecognition =
            !!(
                window.SpeechRecognition ||
                window.webkitSpeechRecognition
            );

        results.serviceWorker =
            "serviceWorker" in
            navigator;

        results.indexedDB =
            "indexedDB" in
            window;

        results.jarvis =
            true;

        results.online =
            navigator.onLine;

        const available =
            Object.values(results)
                .filter(Boolean)
                .length;

        const total =
            Object.keys(results)
                .length;

        return {
            ...results,

            available,

            total,

            percentage:
                total
                    ? Math.round(
                        (
                            available /
                            total
                        ) * 100
                    )
                    : 0
        };
    }


    async function diagnosticsText() {
        const result =
            await diagnose();

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
            String(command || "")
                .trim();

        if (!original) {
            return "";
        }

        const text =
            normalize(original);

        state.lastCommand =
            original;

        state.lastUserMessage =
            original;

        state.commandCount++;

        /*
         * Only one history entry is created
         * here. The old version also added the
         * same user message from the UI.
         */

        addHistory(
            "user",
            original
        );

        /*
         * Save important state once.
         */

        saveMemory(false);


        /* -----------------------------------------------------
           GREETING
           ----------------------------------------------------- */

        if (
            contains(text, [
                "привет",
                "здравствуй",
                "доброе утро",
                "добрый день",
                "добрый вечер"
            ])
        ) {
            return (
                "Привет. JARVIS на связи. " +
                "ASHINA готова к работе."
            );
        }


        /* -----------------------------------------------------
           IDENTITY
           ----------------------------------------------------- */

        if (
            contains(text, [
                "кто ты",
                "ты кто",
                "представься"
            ])
        ) {
            return (
                `Я ${CONFIG.name}, ` +
                `локальное AI-ядро проекта ` +
                `${CONFIG.project}. ` +
                `Версия ${CONFIG.version}.`
            );
        }


        /* -----------------------------------------------------
           STATUS
           ----------------------------------------------------- */

        if (
            contains(text, [
                "статус",
                "состояние",
                "как дела"
            ])
        ) {
            return (
                `JARVIS работает. ` +
                `Команд обработано: ` +
                `${state.commandCount}.`
            );
        }


        /* -----------------------------------------------------
           CAPABILITIES
           ----------------------------------------------------- */

        if (
            contains(text, [
                "что ты умеешь",
                "возможности",
                "что умеешь"
            ])
        ) {
            return (
                "Я могу управлять разделами ASHINA, " +
                "музыкой, памятью, голосом и " +
                "диагностикой. Архитектура готова " +
                "для расширения AI-модуля."
            );
        }


        /* -----------------------------------------------------
           TIME
           ----------------------------------------------------- */

        if (
            contains(text, [
                "который час",
                "сколько времени",
                "время"
            ])
        ) {
            return (
                `Сейчас ${new Date()
                    .toLocaleTimeString(
                        "ru-RU",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )}.`
            );
        }


        /* -----------------------------------------------------
           DATE
           ----------------------------------------------------- */

        if (
            contains(text, [
                "какая дата",
                "сегодня дата",
                "какое сегодня число"
            ])
        ) {
            return (
                `Сегодня ${new Date()
                    .toLocaleDateString(
                        "ru-RU",
                        {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        }
                    )}.`
            );
        }


        /* -----------------------------------------------------
           MEMORY ADD
           ----------------------------------------------------- */

        if (
            text.startsWith(
                "запомни "
            ) ||
            text.startsWith(
                "запиши в память "
            ) ||
            text.startsWith(
                "сохрани в память "
            )
        ) {
            let memoryText =
                original
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
                remember(
                    memoryText
                );

                return (
                    "Записал это в память ASHINA."
                );
            }

            return (
                "Что именно нужно запомнить?"
            );
        }


        /* -----------------------------------------------------
           MEMORY SHOW
           ----------------------------------------------------- */

        if (
            contains(text, [
                "покажи память",
                "что ты помнишь",
                "моя память"
            ])
        ) {
            if (!state.memory.length) {
                return (
                    "Память пока пуста."
                );
            }

            return [
                "Что сейчас хранится в памяти:",
                ...state.memory.map(
                    (item, index) =>
                        `${index + 1}. ${item}`
                )
            ].join("\n");
        }


        /* -----------------------------------------------------
           MEMORY CLEAR
           ----------------------------------------------------- */

        if (
            contains(text, [
                "очисти память",
                "забудь всё",
                "удали память"
            ])
        ) {
            clearMemory();

            return (
                "Память очищена."
            );
        }


        /* -----------------------------------------------------
           DIAGNOSTICS
           ----------------------------------------------------- */

        if (
            contains(text, [
                "диагностика",
                "проверь систему",
                "проведи диагностику",
                "проверка системы"
            ])
        ) {
            return (
                await diagnosticsText()
            );
        }


        /* -----------------------------------------------------
           MUSIC PLAY
           ----------------------------------------------------- */

        if (
            contains(text, [
                "включи музыку",
                "запусти музыку",
                "играй музыку",
                "включи трек"
            ])
        ) {
            const result =
                await playMusic();

            return result.message;
        }


        /* -----------------------------------------------------
           MUSIC STOP
           ----------------------------------------------------- */

        if (
            contains(text, [
                "выключи музыку",
                "останови музыку",
                "поставь музыку на паузу",
                "пауза"
            ])
        ) {
            const result =
                stopMusic();

            return result.message;
        }


        /* -----------------------------------------------------
           MUSIC TOGGLE
           ----------------------------------------------------- */

        if (
            text === "музыка"
        ) {
            const result =
                await toggleMusic();

            return result.message;
        }


        /* -----------------------------------------------------
           OPEN CHAT
           ----------------------------------------------------- */

        if (
            contains(text, [
                "открой чат",
                "перейди в чат"
            ])
        ) {
            if (
                openSection("chat")
            ) {
                return (
                    "Открываю чат."
                );
            }

            return (
                "Раздел чата сейчас недоступен."
            );
        }


        /* -----------------------------------------------------
           OPEN MUSIC
           ----------------------------------------------------- */

        if (
            contains(text, [
                "открой музыку",
                "перейди в музыку"
            ])
        ) {
            if (
                openSection("music")
            ) {
                return (
                    "Открываю музыку."
                );
            }

            return (
                "Музыкальный раздел сейчас недоступен."
            );
        }


        /* -----------------------------------------------------
           OPEN NEWS
           ----------------------------------------------------- */

        if (
            contains(text, [
                "открой новости",
                "перейди в новости",
                "открой ленту"
            ])
        ) {
            if (
                openSection("news")
            ) {
                return (
                    "Открываю ленту."
                );
            }

            return (
                "Раздел ленты сейчас недоступен."
            );
        }


        /* -----------------------------------------------------
           OPEN HOME
           ----------------------------------------------------- */

        if (
            contains(text, [
                "открой главную",
                "на главную"
            ])
        ) {
            if (
                openSection("home")
            ) {
                return (
                    "Возвращаюсь на главную."
                );
            }

            return (
                "Главный раздел сейчас недоступен."
            );
        }


        /* -----------------------------------------------------
           OPEN AI
           ----------------------------------------------------- */

        if (
            contains(text, [
                "открой ai",
                "открой ии",
                "открой искусственный интеллект"
            ])
        ) {
            if (
                openSection("ai")
            ) {
                return (
                    "Открываю AI-центр."
                );
            }

            return (
                "AI-центр сейчас недоступен."
            );
        }


        /* -----------------------------------------------------
           STOP VOICE
           ----------------------------------------------------- */

        if (
            contains(text, [
                "замолчи",
                "останови голос",
                "выключи голос"
            ])
        ) {
            stopSpeaking();

            return (
                "Голосовой вывод остановлен."
            );
        }


        /* -----------------------------------------------------
           HELP
           ----------------------------------------------------- */

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
                "• Открой главную",
                "• Покажи память",
                "• Запомни ...",
                "• Очисти память"
            ].join("\n");
        }


        /* -----------------------------------------------------
           FALLBACK
           ----------------------------------------------------- */

        return (
            "Команда получена. Сейчас я ещё не знаю, " +
            "как выполнить её полностью, но ядро " +
            "JARVIS работает и готово к расширению."
        );
    }


    /* ---------------------------------------------------------
       ASK
       --------------------------------------------------------- */

    function ask(command, options = {}) {
        const text =
            String(command || "")
                .trim();

        if (!text) {
            return Promise.resolve("");
        }

        /*
         * Commands are queued.
         *
         * This prevents two commands from
         * simultaneously changing state,
         * music, navigation and speech.
         */

        const task =
            commandQueue.then(
                async () => {
                    setThinking(true);

                    let response = "";

                    try {
                        response =
                            await processCommand(
                                text
                            );

                    } catch (error) {
                        console.error(
                            "JARVIS command error:",
                            error
                        );

                        response =
                            "Произошла ошибка при обработке команды.";
                    }

                    state.lastAIMessage =
                        response;

                    saveMemory(false);

                    if (
                        options.render !== false
                    ) {
                        addMessage(
                            response,
                            "ai",
                            true
                        );
                    }

                    /*
                     * Voice runs after the response
                     * has already been generated.
                     *
                     * It does not delay the command
                     * processor itself.
                     */

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
            );

        /*
         * Keep queue alive even if one command
         * unexpectedly rejects.
         */

        commandQueue =
            task.catch(
                error => {
                    console.error(
                        "JARVIS queue error:",
                        error
                    );
                }
            );

        return task;
    }


    /* ---------------------------------------------------------
       VOICE INPUT
       --------------------------------------------------------- */

    function createRecognition() {
        const Recognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!Recognition) {
            return null;
        }

        const instance =
            new Recognition();

        instance.lang =
            "ru-RU";

        instance.continuous =
            false;

        instance.interimResults =
            false;

        instance.onstart =
            () => {
                state.listening =
                    true;

                setText(
                    "aiStatus",
                    "Слушаю..."
                );
            };


        instance.onend =
            () => {
                state.listening =
                    false;

                if (!state.thinking) {
                    setText(
                        "aiStatus",
                        "JARVIS готов"
                    );
                }
            };


        instance.onerror =
            error => {
                console.warn(
                    "JARVIS voice recognition error:",
                    error
                );

                state.listening =
                    false;

                setText(
                    "aiStatus",
                    "Ошибка голосового ввода"
                );
            };


        instance.onresult =
            event => {
                const transcript =
                    event
                        .results?.[0]?.[0]
                        ?.transcript || "";

                if (!transcript) {
                    return;
                }

                const input =
                    $("command") ||
                    $("input");

                if (input) {
                    input.value =
                        transcript;
                }

                /*
                 * Do not manually add the user
                 * message here.
                 * ask() handles the complete flow.
                 */

                ask(transcript);
            };

        return instance;
    }


    function startVoice() {
        if (state.listening) {
            return false;
        }

        if (!recognition) {
            recognition =
                createRecognition();
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

        state.listening =
            false;
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

        /*
         * Prevent duplicate listeners
         * if initialize is accidentally called
         * more than once.
         */

        if (
            input.dataset.jarvisConnected ===
            "true"
        ) {
            return;
        }

        input.dataset.jarvisConnected =
            "true";

        input.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Enter"
                ) {
                    return;
                }

                event.preventDefault();

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                input.value = "";

                /*
                 * ask() now creates both user
                 * and assistant history entries.
                 */

                ask(text);
            }
        );
    }


    /* ---------------------------------------------------------
       RESTORE UI
       --------------------------------------------------------- */

    function restoreHistory() {
        const log =
            $("log");

        if (!log) {
            return;
        }

        log.innerHTML = "";

        const items =
            state.history.slice(
                -CONFIG.visibleHistory
            );

        /*
         * IMPORTANT:
         * Do not call addMessage() here.
         * That would write restored messages
         * back into history.
         */

        if (!items.length) {
            const message =
                document.createElement(
                    "div"
                );

            message.className =
                "message ai";

            message.textContent =
                "JARVIS онлайн. Ядро ASHINA готово.";

            log.appendChild(
                message
            );

            return;
        }

        items.forEach(
            item => {
                const message =
                    document.createElement(
                        "div"
                    );

                message.className =
                    `message ${
                        item.role === "user"
                            ? "user"
                            : "ai"
                    }`;

                message.textContent =
                    item.text;

                log.appendChild(
                    message
                );
            }
        );

        log.scrollTop =
            log.scrollHeight;
    }


    /* ---------------------------------------------------------
       PUBLIC API
       --------------------------------------------------------- */

    const API = {
        name:
            CONFIG.name,

        project:
            CONFIG.project,

        version:
            CONFIG.version,

        mode:
            CONFIG.mode,

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
    };


    /* ---------------------------------------------------------
       GLOBAL REGISTRATION
       --------------------------------------------------------- */

    window.JARVIS =
        API;

    window.JARVIS_API =
        API;

    window.ASHINA_JARVIS =
        API;


    /* ---------------------------------------------------------
       STARTUP
       --------------------------------------------------------- */

    function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        try {
            loadSettings();

            loadMemory();

            loadHistory();

            renderMemory();

            restoreHistory();

            connectInput();

            state.ready =
                true;

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
                `ASHINA ${CONFIG.project} — ` +
                `${CONFIG.name} Core ` +
                `${CONFIG.version} ONLINE`
            );

        } catch (error) {
            console.error(
                "JARVIS initialization error:",
                error
            );

            state.ready =
                false;

            setText(
                "aiStatus",
                "Ошибка запуска JARVIS"
            );
        }
    }


    /* ---------------------------------------------------------
       DOM READY
       --------------------------------------------------------- */

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

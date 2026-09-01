```javascript
/* =====================================================
   ASHINA JARVIS CORE 0.3
   LOCAL INTELLIGENCE ENGINE

   Этот файл является мозгом JARVIS.

   Интерфейс находится в:
   ai-test.html

   Логика находится здесь:
   jarvis-core.js
===================================================== */


/* =====================================================
   ОСНОВНЫЕ ОБЪЕКТЫ
===================================================== */

const JARVIS = {

    name: "JARVIS",

    project: "ASHINA",

    version: "0.3",

    mode: "LOCAL",

    ready: false,

    thinking: false,

    speaking: false,

    listening: false

};


/* =====================================================
   DOM
===================================================== */

const log =
document.getElementById("log");

const input =
document.getElementById("command");

const core =
document.getElementById("core");

const aiStatus =
document.getElementById("aiStatus");

const music =
document.getElementById("music");

const memoryBox =
document.getElementById("memory");

const systemStatus =
document.getElementById("systemStatus");

const adminPin =
document.getElementById("adminPin");

const adminStatus =
document.getElementById("adminStatus");


/* =====================================================
   LOCAL STORAGE
===================================================== */

const STORAGE = {

    chat: "ashina_jarvis_chat",

    memory: "ashina_jarvis_memory",

    settings: "ashina_jarvis_settings",

    admin: "ashina_jarvis_admin",

    stats: "ashina_jarvis_stats"

};


/* =====================================================
   СОСТОЯНИЕ JARVIS
===================================================== */

let conversation = [];

let jarvisMemory = {

    project: "ASHINA",

    version: "0.3",

    role: "JARVIS",

    memories: [],

    lastCommand: "",

    lastTopic: "",

    lastUserMessage: "",

    lastAIMessage: "",

    commandCount: 0,

    admin: false,

    created: Date.now(),

    updated: Date.now()

};


/* =====================================================
   ЗАГРУЗКА ПАМЯТИ
===================================================== */

function loadMemory(){

    try{

        const saved =
        localStorage.getItem(
            STORAGE.memory
        );

        if(saved){

            const parsed =
            JSON.parse(saved);

            if(
                parsed &&
                typeof parsed === "object"
            ){

                jarvisMemory = {

                    ...jarvisMemory,

                    ...parsed

                };

            }

        }

    }catch(error){

        console.warn(
            "JARVIS memory load error:",
            error
        );

    }


    try{

        const savedChat =
        localStorage.getItem(
            STORAGE.chat
        );

        if(savedChat){

            const parsed =
            JSON.parse(savedChat);

            if(Array.isArray(parsed)){

                conversation =
                parsed.slice(-50);

            }

        }

    }catch(error){

        console.warn(
            "JARVIS chat load error:",
            error
        );

    }

}


/* =====================================================
   СОХРАНЕНИЕ ПАМЯТИ
===================================================== */

function saveMemory(){

    try{

        jarvisMemory.updated =
        Date.now();

        localStorage.setItem(
            STORAGE.memory,
            JSON.stringify(
                jarvisMemory
            )
        );

    }catch(error){

        console.warn(
            "JARVIS memory save error:",
            error
        );

    }

    updateMemoryUI();

}


/* =====================================================
   СОХРАНЕНИЕ ДИАЛОГА
===================================================== */

function saveConversation(){

    try{

        localStorage.setItem(
            STORAGE.chat,
            JSON.stringify(
                conversation.slice(-50)
            )
        );

    }catch(error){

        console.warn(
            "JARVIS conversation save error:",
            error
        );

    }

}


/* =====================================================
   БЕЗОПАСНЫЙ HTML
===================================================== */

function escapeHTML(text){

    return String(text)

        .replace(/&/g,"&amp;")

        .replace(/</g,"&lt;")

        .replace(/>/g,"&gt;")

        .replace(/"/g,"&quot;")

        .replace(/'/g,"&#039;");

}


/* =====================================================
   UI ПАМЯТИ
===================================================== */

function updateMemoryUI(){

    if(!memoryBox){
        return;
    }

    let html = "";


    html +=
    '<div class="memory-row">' +

        '<span>Проект</span>' +

        '<strong>' +

        escapeHTML(
            jarvisMemory.project
        ) +

        '</strong>' +

    '</div>';


    html +=
    '<div class="memory-row">' +

        '<span>Роль</span>' +

        '<strong>' +

        escapeHTML(
            jarvisMemory.role
        ) +

        '</strong>' +

    '</div>';


    html +=
    '<div class="memory-row">' +

        '<span>Версия</span>' +

        '<strong>' +

        escapeHTML(
            jarvisMemory.version
        ) +

        '</strong>' +

    '</div>';


    html +=
    '<div class="memory-row">' +

        '<span>Режим</span>' +

        '<strong class="green">' +

        escapeHTML(
            JARVIS.mode
        ) +

        '</strong>' +

    '</div>';


    html +=
    '<div class="memory-row">' +

        '<span>Команд</span>' +

        '<strong>' +

        jarvisMemory.commandCount +

        '</strong>' +

    '</div>';


    html +=
    '<div class="memory-row">' +

        '<span>Администратор</span>' +

        '<strong class="' +

        (
            jarvisMemory.admin
            ?
            "green"
            :
            "yellow"
        ) +

        '">' +

        (
            jarvisMemory.admin
            ?
            "Открыт"
            :
            "Закрыт"
        ) +

        '</strong>' +

    '</div>';


    html +=
    '<div style="margin-top:8px">' +

        '<strong>Запомнено:</strong>' +

    '</div>';


    if(
        Array.isArray(
            jarvisMemory.memories
        ) &&
        jarvisMemory.memories.length
    ){

        jarvisMemory.memories
        .slice(-10)
        .forEach(
            function(memory){

                html +=
                '<div class="small">• ' +

                escapeHTML(memory) +

                '</div>';

            }
        );

    }else{

        html +=
        '<div class="small">' +
        'Пока ничего.' +
        '</div>';

    }


    memoryBox.innerHTML =
    html;

}


/* =====================================================
   СООБЩЕНИЕ
===================================================== */

function addMessage(
    text,
    type
){

    const div =
    document.createElement(
        "div"
    );


    div.className =
    "message " +

    (
        type === "user"

        ?

        "user"

        :

        type === "system"

        ?

        "system"

        :

        "ai"
    );


    const label =
    document.createElement(
        "div"
    );

    label.className =
    "message-label";


    label.textContent =

    type === "user"

    ?

    "Ты"

    :

    type === "system"

    ?

    "Система"

    :

    "JARVIS";


    div.appendChild(
        label
    );


    const body =
    document.createElement(
        "div"
    );

    body.textContent =
    text;


    div.appendChild(
        body
    );


    log.appendChild(
        div
    );


    log.scrollTop =
    log.scrollHeight;


    conversation.push({

        type: type,

        text: text,

        time: Date.now()

    });


    saveConversation();

}


/* =====================================================
   ВОССТАНОВЛЕНИЕ ДИАЛОГА
===================================================== */

function restoreConversation(){

    if(
        !conversation.length
    ){

        addMessage(

            "JARVIS CORE запущен. " +

            "Локальное интеллектуальное ядро " +

            "готово к работе с ASHINA.",

            "ai"

        );

        return;

    }


    conversation
    .slice(-15)
    .forEach(
        function(item){

            const div =
            document.createElement(
                "div"
            );


            div.className =
            "message " +

            (
                item.type === "user"

                ?

                "user"

                :

                item.type === "system"

                ?

                "system"

                :

                "ai"
            );


            const label =
            document.createElement(
                "div"
            );

            label.className =
            "message-label";


            label.textContent =

            item.type === "user"

            ?

            "Ты"

            :

            item.type === "system"

            ?

            "Система"

            :

            "JARVIS";


            div.appendChild(
                label
            );


            const body =
            document.createElement(
                "div"
            );

            body.textContent =
            item.text;


            div.appendChild(
                body
            );


            log.appendChild(
                div
            );

        }
    );


    log.scrollTop =
    log.scrollHeight;

}


/* =====================================================
   ГОЛОС JARVIS
===================================================== */

function speak(text){

    if(
        !("speechSynthesis" in window)
    ){

        return;

    }


    try{

        speechSynthesis.cancel();

    }catch(error){}


    const speech =
    new SpeechSynthesisUtterance(
        text
    );


    speech.lang =
    "ru-RU";


    speech.rate =
    0.94;


    speech.pitch =
    0.90;


    speech.volume =
    1;


    speech.onstart =
    function(){

        JARVIS.speaking =
        true;

        core.classList.add(
            "active"
        );

        aiStatus.textContent =
        "JARVIS говорит...";

    };


    speech.onend =
    function(){

        JARVIS.speaking =
        false;

        core.classList.remove(
            "active"
        );

        aiStatus.textContent =
        "JARVIS готов.";

    };


    speech.onerror =
    function(){

        JARVIS.speaking =
        false;

        core.classList.remove(
            "active"
        );

        aiStatus.textContent =
        "JARVIS готов.";

    };


    speechSynthesis.speak(
        speech
    );

}


/* =====================================================
   ОТВЕТ JARVIS
===================================================== */

function answer(text){

    JARVIS.thinking =
    true;


    core.classList.add(
        "thinking"
    );


    aiStatus.textContent =
    "JARVIS анализирует...";


    setTimeout(

        function(){

            JARVIS.thinking =
            false;


            core.classList.remove(
                "thinking"
            );


            jarvisMemory.lastAIMessage =
            text;


            saveMemory();


            addMessage(
                text,
                "ai"
            );


            speak(
                text
            );

        },

        220

    );

}


/* =====================================================
   НОРМАЛИЗАЦИЯ ТЕКСТА
===================================================== */

function normalize(text){

    return String(text)

        .toLowerCase()

        .replace(/[!?.,:;]/g," ")

        .replace(/\s+/g," ")

        .trim();

}


/* =====================================================
   ПОИСК СЛОВ
===================================================== */

function containsAny(
    text,
    words
){

    return words.some(
        function(word){

            return text.includes(
                word
            );

        }
    );

}


/* =====================================================
   ПАМЯТЬ КОНТЕКСТА
===================================================== */

function getRecentContext(){

    return conversation
        .slice(-8)
        .map(
            function(item){

                return (

                    item.type +

                    ": " +

                    item.text

                );

            }
        )
        .join("\n");

}


/* =====================================================
   ЗАПОМИНАНИЕ
===================================================== */

function remember(text){

    const value =
    String(text)
    .trim();


    if(!value){

        return false;

    }


    if(
        !jarvisMemory.memories
        .includes(value)
    ){

        jarvisMemory.memories.push(
            value
        );

    }


    if(
        jarvisMemory.memories.length > 50
    ){

        jarvisMemory.memories =
        jarvisMemory.memories
        .slice(-50);

    }


    saveMemory();

    return true;

}


/* =====================================================
   ОПРЕДЕЛЕНИЕ КОМАНДЫ ПАМЯТИ
===================================================== */

function extractMemory(
    original
){

    let value =
    original;


    value =
    value.replace(
        /запомни/ig,
        ""
    );


    value =
    value.replace(
        /запиши в память/ig,
        ""
    );


    value =
    value.replace(
        /сохрани в память/ig,
        ""
    );


    value =
    value.trim();


    return value;

}


/* =====================================================
   ОЧИСТКА ПАМЯТИ
===================================================== */

function clearMemory(){

    jarvisMemory.memories =
    [];

    jarvisMemory.lastTopic =
    "";

    jarvisMemory.lastCommand =
    "";

    saveMemory();

}


/* =====================================================
   ДИАГНОСТИКА
===================================================== */

async function runStatus(
    sayResult = false
){

    if(!systemStatus){

        return;

    }


    systemStatus.textContent =
    "Проверяю компоненты...";


    const checks = [];


    /* -------------------------
       LocalStorage
    ------------------------- */

    try{

        localStorage.setItem(
            "ashina_test",
            "1"
        );

        localStorage.removeItem(
            "ashina_test"
        );

        checks.push([
            "Локальная память",
            true
        ]);

    }catch(error){

        checks.push([
            "Локальная память",
            false
        ]);

    }


    /* -------------------------
       Speech
    ------------------------- */

    checks.push([
        "Голосовой синтез",
        "speechSynthesis" in window
    ]);


    /* -------------------------
       Recognition
    ------------------------- */

    checks.push([
        "Распознавание речи",

        (
            "SpeechRecognition"
            in window

            ||

            "webkitSpeechRecognition"
            in window
        )
    ]);


    /* -------------------------
       Service Worker
    ------------------------- */

    checks.push([
        "Service Worker",
        "serviceWorker" in navigator
    ]);


    /* -------------------------
       Audio
    ------------------------- */

    try{

        const response =
        await fetch(
            "audio.wav",
            {
                method:"HEAD",
                cache:"no-store"
            }
        );


        checks.push([
            "audio.wav",
            response.ok
        ]);

    }catch(error){

        checks.push([
            "audio.wav",
            false
        ]);

    }


    /* -------------------------
       Manifest
    ------------------------- */

    try{

        const response =
        await fetch(
            "manifest.webmanifest",
            {
                method:"HEAD",
                cache:"no-store"
            }
        );


        checks.push([
            "Manifest",
            response.ok
        ]);

    }catch(error){

        checks.push([
            "Manifest",
            false
        ]);

    }


    /* -------------------------
       JARVIS CORE
    ------------------------- */

    checks.push([
        "JARVIS Core",
        true
    ]);


    /* -------------------------
       Результат
    ------------------------- */

    let html = "";

    let good = 0;


    checks.forEach(
        function(check){

            if(check[1]){

                good++;

            }


            html +=

            '<div class="' +

            (
                check[1]
                ?
                "green"
                :
                "red"
            ) +

            '">' +

            (
                check[1]
                ?
                "🟢 "
                :
                "🔴 "
            ) +

            escapeHTML(
                check[0]
            ) +

            '</div>';

        }
    );


    systemStatus.innerHTML =

    html +

    "<br><strong>" +

    good +

    "/" +

    checks.length +

    " систем доступны</strong>";


    if(sayResult){

        answer(

            "Диагностика завершена. " +

            good +

            " из " +

            checks.length +

            " систем доступны."

        );

    }

}


/* =====================================================
   АДМИНИСТРАТОР
===================================================== */

const DEMO_ADMIN_PIN =
"ASHINA";


function unlockAdmin(){

    const pin =
    adminPin.value;


    if(
        pin === DEMO_ADMIN_PIN
    ){

        jarvisMemory.admin =
        true;


        saveMemory();


        adminStatus.innerHTML =
        '<span class="green">' +

        '🟢 Административный режим активирован.' +

        '</span>';


        answer(

            "Административный режим активирован. " +

            "Это демонстрационный локальный режим."

        );

    }else{

        jarvisMemory.admin =
        false;


        saveMemory();


        adminStatus.innerHTML =
        '<span class="red">' +

        '🔴 Неверный PIN.' +

        '</span>';


        answer(
            "Доступ отклонён."
        );

    }

}


/* =====================================================
   ОПРЕДЕЛЕНИЕ ВРЕМЕНИ
===================================================== */

function currentTime(){

    const now =
    new Date();


    return now.toLocaleTimeString(
        "ru-RU",
        {
            hour:"2-digit",
            minute:"2-digit"
        }
    );

}


/* =====================================================
   ОПРЕДЕЛЕНИЕ ДАТЫ
===================================================== */

function currentDate(){

    const now =
    new Date();


    return now.toLocaleDateString(
        "ru-RU",
        {
            day:"numeric",
            month:"long",
            year:"numeric"
        }
    );

}


/* =====================================================
   ОТКРЫТИЕ РАЗДЕЛОВ ASHINA
===================================================== */

function openAshinaSection(
    section
){

    try{

        window.location.href =
        "index.html#" +
        section;

    }catch(error){

        answer(
            "Не удалось открыть раздел ASHINA."
        );

    }

}


/* =====================================================
   МУЗЫКА
===================================================== */

function playMusic(){

    music.play()

    .then(
        function(){

            answer(
                "Музыка включена."
            );

        }
    )

    .catch(
        function(){

            answer(

                "Браузер заблокировал запуск звука. " +

                "Нажми на страницу и повтори команду."

            );

        }
    );

}


/* =====================================================
   ОСНОВНОЙ МОЗГ JARVIS
===================================================== */

function processCommand(
    command
){

    const original =
    String(command).trim();


    if(!original){

        return;

    }


    const text =
    normalize(
        original
    );


    jarvisMemory.lastCommand =
    original;


    jarvisMemory.lastUserMessage =
    original;


    jarvisMemory.commandCount++;


    saveMemory();


    /* =================================================
       ПРИВЕТСТВИЕ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "привет",
                "здравствуй",
                "добрый день",
                "добрый вечер",
                "доброе утро",
                "хай",
                "hello",
                "здарова"
            ]
        )
    ){

        answer(

            "Привет. JARVIS на связи. " +

            "Локальное ядро ASHINA активно. " +

            "Готов работать."

        );

        return;

    }


    /* =================================================
       КАК ДЕЛА
    ================================================= */

    if(
        containsAny(
            text,
            [
                "как дела",
                "как ты",
                "что нового"
            ]
        )
    ){

        answer(

            "Системы работают стабильно. " +

            "Я нахожусь в локальном режиме " +

            "и продолжаю развиваться вместе с ASHINA."

        );

        return;

    }


    /* =================================================
       КТО ТЫ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "кто ты",
                "ты кто",
                "что ты такое"
            ]
        )
    ){

        answer(

            "Я JARVIS — локальное интеллектуальное ядро ASHINA. " +

            "Сейчас я работаю без обязательного подключения к интернету. " +

            "Моя архитектура позволяет постепенно добавлять новые навыки, " +

            "память, анализ и управление ASHINA."

        );

        return;

    }


    /* =================================================
       ВОЗМОЖНОСТИ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "что ты умеешь",
                "что умеешь",
                "твои возможности",
                "возможности",
                "что можешь"
            ]
        )
    ){

        answer(

            "Сейчас я умею понимать команды на естественном языке, " +

            "сохранять память, учитывать недавний контекст, " +

            "работать с голосом, управлять музыкой, " +

            "проверять состояние ASHINA и открывать её разделы. " +

            "Следующий уровень — подключение дополнительных локальных навыков."

        );

        return;

    }


    /* =================================================
       ВРЕМЯ
    ================================================= */

    if(
        text === "время" ||
        containsAny(
            text,
            [
                "который час",
                "сколько времени",
                "текущее время"
            ]
        )
    ){

        answer(

            "Сейчас " +
            currentTime() +
            "."

        );

        return;

    }


    /* =================================================
       ДАТА
    ================================================= */

    if(
        containsAny(
            text,
            [
                "какое сегодня число",
                "какая сегодня дата",
                "сегодняшняя дата"
            ]
        )
    ){

        answer(

            "Сегодня " +
            currentDate() +
            "."

        );

        return;

    }


    /* =================================================
       ПАМЯТЬ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "запомни",
                "запиши в память",
                "сохрани в память"
            ]
        )
    ){

        const memory =
        extractMemory(
            original
        );


        if(!memory){

            answer(
                "Что именно мне нужно запомнить?"
            );

            return;

        }


        remember(
            memory
        );


        answer(

            "Запомнил. " +

            "Информация сохранена в локальной памяти JARVIS."

        );

        return;

    }


    /* =================================================
       ЧТО ПОМНИШЬ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "что ты помнишь",
                "что помнишь",
                "покажи память",
                "что в памяти"
            ]
        )
    ){

        if(
            !jarvisMemory.memories.length
        ){

            answer(
                "В пользовательской памяти пока ничего нет."
            );

            return;

        }


        answer(

            "Последнее, что я помню: " +

            jarvisMemory.memories
            .slice(-5)
            .join("; ")

        );

        return;

    }


    /* =================================================
       ОЧИСТКА ПАМЯТИ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "очисти память",
                "удали память",
                "забудь всё",
                "забудь все"
            ]
        )
    ){

        const confirmed =
        confirm(
            "Очистить пользовательскую память JARVIS?"
        );


        if(!confirmed){

            answer(
                "Очистка памяти отменена."
            );

            return;

        }


        clearMemory();


        answer(
            "Память очищена."
        );

        return;

    }


    /* =================================================
       ДИАГНОСТИКА
    ================================================= */

    if(
        containsAny(
            text,
            [
                "проверь систему",
                "диагностика",
                "диагностируй",
                "проверь ашина",
                "состояние системы",
                "статус системы",
                "проверка системы"
            ]
        )
    ){

        runStatus(
            true
        );

        return;

    }


    /* =================================================
       МУЗЫКА — ВКЛЮЧИТЬ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "включи музыку",
                "запусти музыку",
                "проиграй музыку",
                "включить музыку"
            ]
        )
    ){

        playMusic();

        return;

    }


    /* =================================================
       МУЗЫКА — ОСТАНОВИТЬ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "останови музыку",
                "выключи музыку",
                "поставь музыку на паузу",
                "пауза музыки"
            ]
        )
    ){

        music.pause();


        answer(
            "Музыка остановлена."
        );

        return;

    }


    /* =================================================
       ОТКРЫТЬ ЧАТ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "открой чат",
                "перейди в чат",
                "запусти чат"
            ]
        )
    ){

        answer(
            "Открываю чат ASHINA."
        );


        setTimeout(
            function(){

                openAshinaSection(
                    "chat"
                );

            },
            400
        );

        return;

    }


    /* =================================================
       ОТКРЫТЬ МУЗЫКУ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "открой музыку",
                "перейди в музыку",
                "музыкальный раздел"
            ]
        )
    ){

        answer(
            "Открываю музыкальный раздел ASHINA."
        );


        setTimeout(
            function(){

                openAshinaSection(
                    "music"
                );

            },
            400
        );

        return;

    }


    /* =================================================
       ПОВТОР
    ================================================= */

    if(
        containsAny(
            text,
            [
                "повтори",
                "повтори последнюю команду"
            ]
        )
    ){

        const previous =
        conversation
        .filter(
            function(item){

                return item.type === "user";

            }
        )
        .slice(-2,-1)[0];


        if(previous){

            answer(

                "Последняя команда была: " +

                previous.text

            );

        }else{

            answer(
                "Мне пока нечего повторять."
            );

        }

        return;

    }


    /* =================================================
       КОНТЕКСТ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "что мы делали",
                "о чём мы говорили",
                "о чем мы говорили",
                "что было раньше"
            ]
        )
    ){

        const context =
        getRecentContext();


        if(!context){

            answer(
                "Контекст пока пуст."
            );

            return;

        }


        const lastMessages =
        conversation
        .slice(-6)
        .map(
            function(item){

                return item.text;

            }
        );


        answer(

            "Последние события диалога: " +

            lastMessages.join(
                " | "
            )

        );

        return;

    }


    /* =================================================
       ASHINA
    ================================================= */

    if(
        containsAny(
            text,
            [
                "что такое ашина",
                "что такое ashina",
                "расскажи про ашина",
                "расскажи про ashina"
            ]
        )
    ){

        answer(

            "ASHINA — проект, в котором JARVIS является " +

            "одним из интеллектуальных компонентов. " +

            "Моя задача — постепенно научиться понимать " +

            "команды пользователя и помогать управлять системой."

        );

        return;

    }


    /* =================================================
       АДМИНИСТРАТОР
    ================================================= */

    if(
        containsAny(
            text,
            [
                "режим администратора",
                "админ режим",
                "административный режим"
            ]
        )
    ){

        if(
            jarvisMemory.admin
        ){

            answer(
                "Административный режим уже активен."
            );

        }else{

            answer(

                "Административный режим закрыт. " +

                "Для локального прототипа используй поле PIN."

            );

        }

        return;

    }


    /* =================================================
       ПОМОЩЬ
    ================================================= */

    if(
        containsAny(
            text,
            [
                "помоги",
                "помощь",
                "help",
                "команды"
            ]
        )
    ){

        answer(

            "Ты можешь попросить меня: " +

            "проверить систему, запомнить информацию, " +

            "показать память, включить музыку, открыть чат, " +

            "открыть музыку, сообщить время или дату, " +

            "рассказать о себе или повторить последнюю команду."

        );

        return;

    }


    /* =================================================
       НЕИЗВЕСТНАЯ КОМАНДА
    ================================================= */

    jarvisMemory.lastTopic =
    original;


    saveMemory();


    answer(

        "Я понял обращение: «" +

        original +

        "». Но у меня пока нет навыка для выполнения этой команды. " +

        "Я сохранил её в контексте. " +

        "В дальнейшем мы сможем добавить для неё отдельный навык."

    );

}


/* =====================================================
   ОТПРАВКА
===================================================== */

function sendCommand(){

    if(!input){

        return;

    }


    const text =
    input.value.trim();


    if(!text){

        return;

    }


    input.value = "";


    ask(
        text
    );

}


/* =====================================================
   ASK
===================================================== */

function ask(text){

    const value =
    String(text).trim();


    if(!value){

        return;

    }


    addMessage(
        value,
        "user"
    );


    processCommand(
        value
    );

}


/* =====================================================
   ENTER
===================================================== */

if(input){

    input.addEventListener(
        "keydown",
        function(event){

            if(
                event.key === "Enter"
            ){

                event.preventDefault();

                sendCommand();

            }

        }
    );

}


/* =====================================================
   ГОЛОСОВОЙ ВВОД
===================================================== */

function startVoice(){

    const Recognition =

    window.SpeechRecognition ||

    window.webkitSpeechRecognition;


    if(!Recognition){

        answer(

            "Распознавание речи недоступно " +

            "в этом браузере."

        );

        return;

    }


    if(
        JARVIS.listening
    ){

        return;

    }


    const recognition =
    new Recognition();


    JARVIS.listening =
    true;


    recognition.lang =
    "ru-RU";


    recognition.interimResults =
    false;


    recognition.maxAlternatives =
    3;


    aiStatus.textContent =
    "🎙️ Слушаю...";


    core.classList.add(
        "active"
    );


    recognition.onresult =
    function(event){

        const text =
        event.results[0][0]
        .transcript;


        JARVIS.listening =
        false;


        core.classList.remove(
            "active"
        );


        aiStatus.textContent =
        "Команда получена.";


        ask(
            text
        );

    };


    recognition.onerror =
    function(){

        JARVIS.listening =
        false;


        core.classList.remove(
            "active"
        );


        aiStatus.textContent =
        "Ошибка распознавания речи.";

    };


    recognition.onend =
    function(){

        JARVIS.listening =
        false;


        core.classList.remove(
            "active"
        );


        if(
            !JARVIS.thinking &&
            !JARVIS.speaking
        ){

            aiStatus.textContent =
            "JARVIS готов.";

        }

    };


    try{

        recognition.start();

    }catch(error){

        JARVIS.listening =
        false;


        core.classList.remove(
            "active"
        );


        aiStatus.textContent =
        "Не удалось запустить микрофон.";

    }

}


/* =====================================================
   SERVICE WORKER
===================================================== */

if(
    "serviceWorker" in navigator
){

    navigator.serviceWorker
    .register(
        "sw.js"
    )
    .catch(
        function(error){

            console.warn(
                "ASHINA Service Worker:",
                error
            );

        }
    );

}


/* =====================================================
   ВОССТАНОВЛЕНИЕ АДМИНА
===================================================== */

function restoreAdmin(){

    if(
        jarvisMemory.admin
    ){

        adminStatus.innerHTML =

        '<span class="green">' +

        '🟢 Локальный административный режим активен.' +

        '</span>';

    }

}


/* =====================================================
   ЗАПУСК JARVIS
===================================================== */

function initializeJarvis(){

    loadMemory();

    updateMemoryUI();

    restoreConversation();

    restoreAdmin();

    runStatus();

    JARVIS.ready =
    true;


    aiStatus.textContent =

    "JARVIS готов. " +

    "Локальное интеллектуальное ядро активно.";

}


initializeJarvis();


/* =====================================================
   ГЛОБАЛЬНЫЙ API JARVIS

   Это важно для будущего развития.

   Другие файлы ASHINA смогут обращаться
   к JARVIS через window.JARVIS_API
===================================================== */

window.JARVIS_API = {

    version: JARVIS.version,

    mode: JARVIS.mode,

    ask: ask,

    speak: speak,

    remember: remember,

    getMemory: function(){

        return {

            ...jarvisMemory,

            memories: [
                ...jarvisMemory.memories
            ]

        };

    },

    clearMemory: clearMemory,

    diagnose: runStatus,

    playMusic: playMusic,

    stopMusic: function(){

        music.pause();

    },

    openSection: openAshinaSection,

    getContext: getRecentContext

};


/* =====================================================
   КОНЕЦ JARVIS CORE
===================================================== */
```

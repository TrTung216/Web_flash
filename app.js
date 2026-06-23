/**
 * app.js — Logic chính của Quiz App
 * ===================================
 * File này xử lý toàn bộ state, render UI, và tương tác người dùng.
 * Không cần chỉnh sửa file này khi chỉ muốn thay đổi câu hỏi.
 */

// ─────────────────────────────────────────────────────
// HỆ THỐNG ÂM THANH (Web Audio API)
// ─────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    }
}

function playStreakSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.08 + 0.1);
        osc.start(audioCtx.currentTime + i * 0.08);
        osc.stop(audioCtx.currentTime + i * 0.08 + 0.1);
    });
}

function playSadSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// ─────────────────────────────────────────────────────
// HIỆU ỨNG PHÁO HOA
// ─────────────────────────────────────────────────────
function fireCuteConfetti() {
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: 0.2, y: 0.8 } }));
    confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: 0.8, y: 0.8 } }));
    confetti({
        particleCount: 15, scalar: 2, spread: 100,
        origin: { y: 0.6 }, shapes: ['circle'],
        colors: ['#ff90e8', '#ffeb3b', '#00e676'],
    });
}

// ─────────────────────────────────────────────────────
// QUẢN LÝ DỮ LIỆU CÂU HỎI
// ─────────────────────────────────────────────────────
let rawQuizData = [];
let chapterNames = {};

/**
 * Nhận object data đã parse và nạp vào app.
 * Hỗ trợ 2 định dạng:
 *   - { chapterNames: {...}, questions: [...] }
 *   - Chỉ là mảng câu hỏi: [...]
 */
function loadQuizData(data, sourceLabel) {
    let questions, names;
    if (Array.isArray(data)) {
        questions = data;
        names = {};
    } else {
        questions = data.questions || [];
        names = data.chapterNames || {};
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        alert("File câu hỏi không hợp lệ hoặc không có câu hỏi nào!");
        return false;
    }

    // Chuẩn hoá các câu hỏi: đảm bảo `options` là mảng, `chapter` là số (mặc định 1), `correct` là chỉ số số nguyên
    questions = questions.map(orig => {
        const q = Object.assign({}, orig);
        if (!Array.isArray(q.options)) {
            if (typeof q.options === 'string') {
                q.options = q.options.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            } else {
                q.options = [];
            }
        }
        const n = parseInt(q.chapter, 10);
        q.chapter = isNaN(n) ? 1 : n;

        if (typeof q.correct === 'string') {
            const s = q.correct.trim().toUpperCase();
            if (/^[A-D]$/.test(s)) q.correct = {'A':0,'B':1,'C':2,'D':3}[s];
            else {
                const ci = parseInt(s, 10);
                q.correct = isNaN(ci) ? 0 : ci;
            }
        } else if (typeof q.correct !== 'number') {
            q.correct = 0;
        }

        if (q.options.length === 0) q.correct = -1;
        if (q.correct < 0 || q.correct >= q.options.length) q.correct = q.options.length > 0 ? 0 : -1;
        return q;
    });

    rawQuizData = questions;
    chapterNames = names;
    renderChapterCheckboxes();
    applySettings(true);

    const status = document.getElementById('dataSourceStatus');
    if (status) {
        status.innerText = `✅ Đã tải ${questions.length} câu hỏi${sourceLabel ? ' — ' + sourceLabel : ''}`;
    }
    return true;
}

/**
 * Tự động thử tải questions.js cùng thư mục (chạy qua Live Server / web server).
 * Nếu không tìm thấy thì yêu cầu người dùng chọn file thủ công.
 */
async function autoLoadDefaultFile() {
    const status = document.getElementById('dataSourceStatus');
    try {
        // Thử tải questions.js (file JS export biến QUIZ_DATA)
        const script = document.createElement('script');
        script.src = 'questions.js';
        script.onload = () => {
            if (typeof QUIZ_DATA !== 'undefined') {
                loadQuizData(QUIZ_DATA, 'questions.js');
            } else {
                if (status) status.innerText = 'Chưa có dữ liệu. Hãy chọn file câu hỏi (.js hoặc .json).';
            }
        };
        script.onerror = () => {
            if (status) status.innerText = 'Chưa có dữ liệu. Hãy bấm "Chọn file câu hỏi" để tải lên.';
        };
        document.head.appendChild(script);
    } catch (err) {
        if (status) status.innerText = 'Chưa có dữ liệu. Hãy bấm "Chọn file câu hỏi" để tải lên.';
    }
}

/**
 * Xử lý upload file câu hỏi (.js hoặc .json) từ máy người dùng.
 * Hỗ trợ cả file JS (dùng biến QUIZ_DATA) và file JSON thuần.
 */
window.handleQuestionFileUpload = function (fileInputEl) {
    const file = fileInputEl.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            if (ext === 'js') {
                // Thực thi JS, lấy biến QUIZ_DATA
                // eslint-disable-next-line no-new-func
                const fn = new Function(e.target.result + '\nreturn typeof QUIZ_DATA !== "undefined" ? QUIZ_DATA : null;');
                const data = fn();
                if (!data) throw new Error('Không tìm thấy biến QUIZ_DATA trong file.');
                loadQuizData(data, file.name);
            } else {
                // JSON thuần
                const data = JSON.parse(e.target.result);
                loadQuizData(data, file.name);
            }
            playSound('correct');
        } catch (err) {
            alert("Không đọc được file. Kiểm tra lại định dạng!\n\n" + err.message);
        }
    };
    reader.readAsText(file);
};

// Xử lý upload file .docx (Word) client-side bằng mammoth.js
window.handleDocxFileUpload = function (fileInputEl) {
    const file = fileInputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const arrayBuffer = e.target.result;
        if (typeof mammoth === 'undefined') {
            alert('Thư viện đọc .docx chưa tải xong. Vui lòng thử lại sau.');
            return;
        }
        mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
            .then(result => {
                const html = result.value;
                const parsed = parseDocxHtmlToQuizData(html);
                if (!parsed || parsed.length === 0) {
                    alert('Không tìm thấy câu hỏi trong file .docx. Hãy kiểm tra định dạng (số câu, phương án A./B.).');
                    return;
                }
                loadQuizData(parsed, file.name + ' (docx)');
                playSound('correct');
            })
            .catch(err => {
                alert('Lỗi khi chuyển .docx: ' + (err && err.message ? err.message : err));
            });
    };
    reader.readAsArrayBuffer(file);
};

function parseDocxHtmlToQuizData(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const paras = Array.from(wrapper.querySelectorAll('p, li'));
    const lines = [];
    paras.forEach(p => {
        const parts = p.innerHTML.split(/<br\s*\/?/i);
        parts.forEach(part => {
            const text = part.replace(/<[^>]+>/g, '').trim();
            if (text) lines.push({ text: text, html: part });
        });
    });

    const questions = [];
    let cur = null;

    function pushCur() {
        if (!cur) return;
        const opts = cur.options.filter(Boolean);
        if (opts.length === 0) { cur = null; return; }
        if (cur.correct === -1) {
            const star = opts.findIndex(o => /^\*/.test(o) || /\(đúng\)|✅/i.test(o));
            cur.correct = star !== -1 ? star : 0;
        }
        questions.push({ question: cur.question.trim(), options: opts, correct: cur.correct, chapter: 1 });
        cur = null;
    }

    for (const ln of lines) {
        const line = ln.text;
        const htmlPart = ln.html;
        if (!line) continue;
        const qMatch = line.match(/^\s*(?:Câu\s*)?(\d+)\s*[\.\)\-:]\s*(.+)$/i);
        if (qMatch) {
            pushCur();
            cur = { question: qMatch[2].trim(), options: [], correct: -1 };
            continue;
        }
        const optMatch = line.match(/^\s*([A-D])\s*[\.\)\-:]\s*(.+)$/i);
        if (optMatch && cur) {
            const idx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[optMatch[1].toUpperCase()];
            const txt = optMatch[2].trim().replace(/^\*/, '').trim();
            cur.options[idx] = txt;
            if (/<strong|<b|font-weight:\s*700/i.test(htmlPart)) cur.correct = idx;
            continue;
        }
        const ansMatch = line.match(/(?:Đáp án|Đáp|Answer|Correct|Đúng)[:\s]*([A-D]|\d+)/i);
        if (ansMatch && cur) {
            const a = ansMatch[1];
            let idx;
            if (/[A-D]/i.test(a)) idx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[a.toUpperCase()];
            else idx = parseInt(a, 10) - 1;
            if (!isNaN(idx)) cur.correct = idx;
            continue;
        }
        if (cur) {
            const bullet = line.match(/^[\-\•\*]\s*(.+)$/);
            if (bullet) {
                const nextIdx = cur.options.findIndex(o => !o);
                const i = nextIdx === -1 ? cur.options.length : nextIdx;
                cur.options[i] = bullet[1].trim();
                if (/<strong|<b|font-weight:\s*700/i.test(htmlPart)) cur.correct = i;
                continue;
            }
            if (cur.options.length === 0) {
                cur.question += ' ' + line;
            } else {
                const last = cur.options.length - 1;
                cur.options[last] = (cur.options[last] + ' ' + line).trim();
            }
            continue;
        }
        if (line.endsWith('?')) {
            pushCur();
            cur = { question: line.trim(), options: [], correct: -1 };
            continue;
        }
    }

    pushCur();
    return questions.map(q => {
        const opts = q.options || [];
        const correct = (typeof q.correct === 'number' && q.correct >= 0 && q.correct < opts.length) ? q.correct : 0;
        return { question: q.question, options: opts, correct: correct, chapter: 1 };
    });
}

// ─────────────────────────────────────────────────────
// STATE CỦA APP
// ─────────────────────────────────────────────────────
let activeQuizData = [];
let currentQuestion = 0;
let selectedAnswers = [];
let isCurrentAnswered = false;
let showResult = false;
let statCorrectCount = 0;
let statWrongCount = 0;
let currentStreak = 0;
let timerInterval;
let secondsElapsed = 0;
let selectedChapters = [];

const appElement = document.getElementById('app');

// ─────────────────────────────────────────────────────
// KHỞI ĐỘNG
// ─────────────────────────────────────────────────────
function initApp() {
    startTimer();
    autoLoadDefaultFile();
}

// ─────────────────────────────────────────────────────
// TIMER
// ─────────────────────────────────────────────────────
function startTimer() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const m = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
        const s = (secondsElapsed % 60).toString().padStart(2, '0');
        document.getElementById('timerDisplay').innerText = `${m}:${s}`;
    }, 1000);
}

// ─────────────────────────────────────────────────────
// XỬ LÝ UI
// ─────────────────────────────────────────────────────
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

window.toggleControlPanel = function () {
    playSound('click');
    const panelContent = document.getElementById('controlPanelContent');
    const toggleBtn = document.getElementById('togglePanelBtn');
    if (panelContent.classList.contains('hidden')) {
        panelContent.classList.remove('hidden');
        panelContent.classList.add('flex');
        toggleBtn.innerText = 'Thu nhỏ';
    } else {
        panelContent.classList.add('hidden');
        panelContent.classList.remove('flex');
        toggleBtn.innerText = 'Mở rộng';
    }
};

window.applySettings = function (isInitial = false) {
    if (!rawQuizData || rawQuizData.length === 0) {
        appElement.innerHTML = `
            <div class="bg-white dark:bg-darkCard dark:text-white border-4 border-black p-8 brutal-shadow text-center pop-in w-full">
                <h2 class="text-2xl font-bold mb-4 uppercase">Chưa có dữ liệu câu hỏi</h2>
                <p class="mb-2">Vui lòng bấm <span class="font-bold">"Chọn file câu hỏi"</span> ở Bảng Điều Khiển và chọn file <span class="font-bold">questions.js</span> hoặc <span class="font-bold">questions.json</span>.</p>
            </div>
        `;
        return;
    }

    const checkboxes = document.querySelectorAll('.chapter-cb');
    selectedChapters = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));

    if (selectedChapters.length === 0) {
        alert("Vui lòng chọn ít nhất 1 chương!");
        return;
    }

    const isRandom = document.getElementById('randomToggle').checked;
    activeQuizData = rawQuizData.filter(q => selectedChapters.includes(q.chapter));

    if (isRandom) shuffleArray(activeQuizData);

    currentQuestion = 0;
    selectedAnswers = Array(activeQuizData.length).fill(null);
    isCurrentAnswered = false;
    showResult = false;
    statCorrectCount = 0;
    statWrongCount = 0;
    currentStreak = 0;
    updateStatsUI();
    startTimer();

    if (!isInitial && window.innerWidth < 768) {
        const panelContent = document.getElementById('controlPanelContent');
        const toggleBtn = document.getElementById('togglePanelBtn');
        panelContent.classList.add('hidden');
        panelContent.classList.remove('flex');
        toggleBtn.innerText = '▶ Mở rộng';
    }

    render();
};

window.toggleStats = function () {
    playSound('click');
    const tooltip = document.getElementById('statsTooltip');
    tooltip.classList.toggle('hidden');
    tooltip.classList.toggle('flex');
};

function updateStatsUI() {
    document.getElementById('statCorrect').innerText = statCorrectCount;
    document.getElementById('statWrong').innerText = statWrongCount;
    document.getElementById('statStreak').innerText = currentStreak;
}

window.toggleDarkMode = function (isDark) {
    playSound('click');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
};

function renderChapterCheckboxes() {
    const container = document.getElementById('chapterCheckboxes');
    const chapterSet = new Set(rawQuizData.map(q => q.chapter));
    const chapters = Array.from(chapterSet).sort((a, b) => a - b);

    container.innerHTML = chapters.map(i => {
        const label = chapterNames[i] || chapterNames[String(i)] || `Chương ${i}`;
        return `
            <label class="flex items-center gap-2 text-black dark:text-white cursor-pointer bg-white dark:bg-gray-800 border-2 border-black px-2 py-1 brutal-shadow-sm brutal-hover">
                <input type="checkbox" value="${i}" class="chapter-cb w-4 h-4 border-2 border-black accent-blue-400" checked>
                ${label}
            </label>
        `;
    }).join('');
}

// ─────────────────────────────────────────────────────
// RENDER CHÍNH
// ─────────────────────────────────────────────────────
function render() {
    if (showResult) renderResult();
    else renderQuiz();
}

function renderQuiz() {
    if (activeQuizData.length === 0) return;
    const q = activeQuizData[currentQuestion];

    const optionsHtml = q.options.map((opt, index) => {
        let bgColor = "bg-white dark:bg-darkCard";
        let textColor = "text-gray-800 dark:text-gray-200";
        let borderStyle = "border-2 border-black dark:border-gray-900";
        let cursorStyle = isCurrentAnswered ? "cursor-default disabled" : "cursor-pointer brutal-hover brutal-active";

        if (isCurrentAnswered) {
            if (index === q.correct) {
                bgColor = "bg-green-400"; textColor = "text-black font-bold";
            } else if (index === selectedAnswers[currentQuestion]) {
                bgColor = "bg-red-400"; textColor = "text-white font-bold";
            } else {
                bgColor = "bg-gray-100 dark:bg-gray-800 opacity-50";
            }
        }

        return `
            <div class="${bgColor} ${textColor} ${borderStyle} ${cursorStyle} brutal-shadow-sm p-4 transition-all duration-200 pop-in"
                 style="animation-delay: ${index * 0.05}s;"
                 onclick="selectOption(${index})">
                <span class="text-lg">${opt}</span>
            </div>
        `;
    }).join('');

    const isLast = currentQuestion === activeQuizData.length - 1;
    const actionBtnHtml = `
        <div class="flex gap-3 mt-4">
            ${currentQuestion > 0
            ? `<button onclick="goBack()" class="bg-gray-300 text-black font-bold border-2 border-black brutal-shadow-sm brutal-hover brutal-active px-6 py-3 uppercase">Quay lại</button>`
            : ''}
            ${isLast
            ? `<button onclick="submitQuiz()" class="bg-[#ff90e8] text-black font-bold border-2 border-black brutal-shadow-sm brutal-hover brutal-active px-8 py-3 uppercase">Xem Điểm</button>`
            : `<button onclick="goNext()" class="bg-blue-400 text-black font-bold border-2 border-black brutal-shadow-sm brutal-hover brutal-active px-8 py-3 uppercase">Tiếp theo</button>`}
        </div>
    `;

    appElement.innerHTML = `
        <div class="w-full">
            <div class="mb-6 flex items-center justify-between font-bold text-black dark:text-white border-2 border-black bg-white dark:bg-darkCard p-3 brutal-shadow-sm pop-in">
                <span class="uppercase tracking-wide">Tiến độ (${chapterNames[q.chapter] || 'Chương ' + q.chapter})</span>
                <span class="bg-black text-white px-3 py-1">${currentQuestion + 1} / ${activeQuizData.length}</span>
            </div>
            <div class="bg-white dark:bg-darkCard border-4 border-black p-6 md:p-8 mb-8 brutal-shadow pop-in">
                <h2 class="text-xl md:text-2xl font-bold leading-relaxed text-black dark:text-white">${q.question}</h2>
            </div>
            <div class="flex flex-col space-y-4 mb-4">${optionsHtml}</div>
            <div class="flex justify-end h-16 items-center">${actionBtnHtml}</div>
        </div>
    `;
}

function renderResult() {
    clearInterval(timerInterval);
    const m = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const s = (secondsElapsed % 60).toString().padStart(2, '0');

    appElement.innerHTML = `
        <div class="bg-white dark:bg-darkCard dark:text-white border-4 border-black p-8 brutal-shadow text-center pop-in w-full">
            <h2 class="text-4xl font-bold mb-4 uppercase text-black dark:text-white">Tuyệt Vời!</h2>
            <p class="text-xl mb-4">Hoàn thành trong: <span class="font-bold border-b-2 border-black dark:border-white">${m}:${s}</span></p>
            <p class="text-2xl mb-8">Bạn đã đúng <span class="bg-green-400 text-black px-3 py-1 border-2 border-black font-bold">${statCorrectCount} / ${activeQuizData.length}</span> câu</p>
            <button onclick="playSound('click'); applySettings()" class="bg-[#ff90e8] text-black font-bold border-2 border-black brutal-shadow-sm brutal-hover brutal-active px-8 py-4 text-xl uppercase tracking-wider">
                Làm Lại Lượt Mới ↻
            </button>
        </div>
    `;
}

// ─────────────────────────────────────────────────────
// TƯƠNG TÁC CÂU HỎI
// ─────────────────────────────────────────────────────
window.selectOption = function (index) {
    if (isCurrentAnswered) return;

    const q = activeQuizData[currentQuestion];
    selectedAnswers[currentQuestion] = index;
    isCurrentAnswered = true;

    if (index === q.correct) {
        statCorrectCount++;
        currentStreak++;
        if (currentStreak >= 3) {
            playStreakSound();
            fireCuteConfetti();
            appElement.classList.add('animate-tada');
            setTimeout(() => appElement.classList.remove('animate-tada'), 500);
        } else {
            playSound('correct');
        }
    } else {
        statWrongCount++;
        if (currentStreak >= 3) {
            playSadSound();
        } else {
            playSound('wrong');
        }
        currentStreak = 0;
    }

    updateStatsUI();
    render();
};

window.goBack = function () {
    playSound('click');
    if (currentQuestion > 0) {
        currentQuestion--;
        isCurrentAnswered = selectedAnswers[currentQuestion] !== null;
        render();
    }
};

window.goNext = function () {
    playSound('click');
    if (currentQuestion < activeQuizData.length - 1) {
        currentQuestion++;
        isCurrentAnswered = selectedAnswers[currentQuestion] !== null;
        render();
    }
};

window.submitQuiz = function () {
    playSound('click');
    showResult = true;
    render();
};

// ─────────────────────────────────────────────────────
// KHỞI ĐỘNG KHI TRANG TẢI XONG
// ─────────────────────────────────────────────────────
initApp();
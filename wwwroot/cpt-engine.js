let dotnetRef = null;

function dn(method, ...args) {
    if (!dotnetRef) {
        console.error('Blazor bağlantısı yok, çağrı atlandı:', method);
        return Promise.resolve();
    }
    return dotnetRef.invokeMethodAsync(method, ...args)
        .catch(e => console.error('DotNet hatası [' + method + ']:', e));
}

// ============================================================
// AYARLAR / YARDIMCILAR (YENİ)
// ============================================================
// Blazor projenin GERÇEK assembly adı buraya yazılmalı.
// Boşluklu ad sorun çıkarırsa (örn. 'Cpt_proje') sadece bu satırı değiştir.
const DOTNET_ASSEMBLY = 'Cpt proje';

// DotNet çağrılarını güvenli yapar: hata olursa test akışı bozulmaz, konsola yazar.
function dn(method, ...args) {
    try {
        if (!window.DotNet) {
            console.error('DotNet nesnesi bulunamadı (Blazor henüz yüklenmemiş olabilir):', method);
            return Promise.resolve();
        }
        return DotNet.invokeMethodAsync(DOTNET_ASSEMBLY, method, ...args)
            .catch(e => console.error('DotNet hatası [' + method + ']:', e));
    } catch (e) {
        console.error('DotNet çağrı hatası [' + method + ']:', e);
        return Promise.resolve();
    }
}

// Test başlatma kontrolü: DB hazır mı, başka test çalışıyor mu?
function testBaslatilabilir() {
    if (!db) {
        console.error('Veritabanı henüz hazır değil, test başlatılmadı.');
        return false;
    }
    if (window.isTestRunning) return false;
    window.isTestRunning = true;
    return true;
}

async function initDatabase() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });
    db = new SQL.Database();

    db.run(`
        CREATE TABLE sessions (
          session_id INTEGER PRIMARY KEY AUTOINCREMENT,
          participant_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          config_json TEXT,
          total_trials INTEGER
        );

        CREATE TABLE trials (
          trial_id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES sessions(session_id),
          trial_index INTEGER NOT NULL,
          stimulus_type TEXT NOT NULL,
          stimulus_onset_ms INTEGER NOT NULL,
          stimulus_offset_ms INTEGER,
          response_ms INTEGER,
          rt_ms INTEGER,
          outcome TEXT,
          distractor_active INTEGER DEFAULT 0
        );

        CREATE TABLE events (
          event_id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES sessions(session_id),
          event_time_ms INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          linked_trial_id INTEGER
        );

        CREATE INDEX idx_trials_session ON trials(session_id);
        CREATE INDEX idx_events_session ON events(session_id);
    `);
    console.log("Sanal SQLite (WASM) Veritabanı başarıyla oluşturuldu.");
}
const dbReady = initDatabase().catch(e => console.error('Veritabanı oluşturulamadı:', e));

class TrialScheduler {
    constructor(trials, defaultIsi, onStimulus, onEnd) {
        this.trials = trials;
        this.defaultIsi = defaultIsi;
        this.onStimulus = onStimulus;
        this.onEnd = onEnd;
        this.index = 0;
        this.nextTime = 0;
        this.rafId = null;
    }

    start() {
        this.nextTime = performance.now() + 500;
        this.rafId = requestAnimationFrame(t => this._tick(t));
    }

    _tick(now) {
        if (this.index >= this.trials.length) {
            if (now >= this.nextTime) {
                this.onEnd();
                return;
            }
        } else if (now >= this.nextTime) {
            const trial = this.trials[this.index];
            const onsetMs = performance.now();

            this.onStimulus(trial, onsetMs);

            this.index++;
            const currentIsi = trial.isi !== undefined ? trial.isi : this.defaultIsi;
            this.nextTime = onsetMs + trial.duration + currentIsi;
        }
        this.rafId = requestAnimationFrame(t => this._tick(t));
    }

    stop() {
        cancelAnimationFrame(this.rafId);
    }
}

window.isTestRunning = false;
window.cptCleanup = null; // Çalışan testi güvenle durdurmak için (YENİ)

window.cptInterop = {
    baglan: function (ref) {
        dotnetRef = ref;
        console.log('Blazor bağlandı');
    },

    // Çalışan testi elle durdurur (hata olursa / kullanıcı çıkarsa) (YENİ)
    testiDurdur: function () {
        try { if (window.cptCleanup) window.cptCleanup(); } catch (e) { console.error(e); }
        window.cptCleanup = null;
        const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
        const msgEl = document.getElementById('instructionMsg'); if (msgEl) msgEl.remove();
        window.isTestRunning = false;
    },

    // ========================================================
    // BLOK 1: Temel Görsel Ayırt Etme (3 Şekil x 3 Renk)
    // ========================================================
    testMotoruBaslat: function () {
        if (!testBaslatilabilir()) return;
        console.log('BLOK1 başladı', new Date().toLocaleTimeString());

        const totalTrials = 40;
        const startTime = Date.now();
        db.run(`INSERT INTO sessions (participant_id, started_at, total_trials) VALUES (?, ?, ?)`, ['Test-Kullanicisi-Blok1', startTime, totalTrials]);

        const res = db.exec("SELECT last_insert_rowid()");
        currentSessionId = res[0].values[0][0];

        const shapes = {
            star: "M12,2 L15,9 L22,9 L16,14 L18,21 L12,17 L6,21 L8,14 L2,9 L9,9 Z",
            triangle: "M12,2 L22,20 L2,20 Z",
            circle: "M12,2 A10,10 0 1,0 12,22 A10,10 0 1,0 12,2 Z"
        };
        const colors = ['blue', 'red', 'gold'];

        function getRandomNonTarget() {
            let shapeKeys = Object.keys(shapes);
            let randomShape, randomColor;
            do {
                randomShape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                randomColor = colors[Math.floor(Math.random() * colors.length)];
            } while (randomShape === 'star' && randomColor === 'blue');
            return { shape: randomShape, color: randomColor };
        }

        const trials = [];
        for (let i = 0; i < totalTrials; i++) {
            const isTarget = Math.random() < 0.5;
            trials.push({ type: isTarget ? 'target' : 'nontarget', duration: 500 });
        }

        let currentOnsetMs = 0; let currentTrial = null; let responseRecorded = false; let currentTrialId = null;

        const keyListener = function (event) {
            if (event.code !== 'Space') return;
            const pressMs = performance.now();
            if (!currentTrial) {
                db.run(`INSERT INTO events (session_id, event_time_ms, event_type, linked_trial_id) VALUES (?, ?, 'keypress', NULL)`, [currentSessionId, pressMs]);
                dn('CptVeriKaydet', 'hyperactivity', null, null);
                return;
            }
            if (responseRecorded) return;
            responseRecorded = true;
            const reactionTime = pressMs - currentOnsetMs;
            const outcome = currentTrial.type === 'target' ? 'hit' : 'commission';
            db.run(`UPDATE trials SET response_ms = ?, rt_ms = ?, outcome = ? WHERE trial_id = ?`, [pressMs, reactionTime, outcome, currentTrialId]);
            dn('CptVeriKaydet', outcome, currentTrial.type, reactionTime);
        };
        document.addEventListener('keydown', keyListener);

        const scheduler = new TrialScheduler(trials, 1000,
            (trial, onsetMs) => {
                currentTrial = trial; currentOnsetMs = onsetMs; responseRecorded = false;
                db.run(`INSERT INTO trials (session_id, trial_index, stimulus_type, stimulus_onset_ms, distractor_active) VALUES (?, ?, ?, ?, ?)`, [currentSessionId, scheduler.index, trial.type, onsetMs, 0]);
                const trialRes = db.exec("SELECT last_insert_rowid()"); currentTrialId = trialRes[0].values[0][0];

                const svgEl = document.getElementById('dynamicStimulus');
                const pathEl = document.getElementById('stimulusPath');
                if (svgEl && pathEl) {
                    if (trial.type === 'target') {
                        pathEl.setAttribute('d', shapes.star); pathEl.setAttribute('fill', 'blue');
                    } else {
                        const nonTarget = getRandomNonTarget();
                        pathEl.setAttribute('d', shapes[nonTarget.shape]); pathEl.setAttribute('fill', nonTarget.color);
                    }
                    svgEl.style.visibility = 'visible';
                }
                setTimeout(() => {
                    if (svgEl) svgEl.style.visibility = 'hidden';
                    const offsetMs = performance.now();
                    if (!responseRecorded) {
                        const outcome = trial.type === 'target' ? 'omission' : 'correct_rejection';
                        db.run(`UPDATE trials SET stimulus_offset_ms = ?, outcome = ? WHERE trial_id = ?`, [offsetMs, outcome, currentTrialId]);
                        dn('CptVeriKaydet', outcome, trial.type, null);
                    } else {
                        db.run(`UPDATE trials SET stimulus_offset_ms = ? WHERE trial_id = ?`, [offsetMs, currentTrialId]);
                    }
                    currentTrial = null; currentTrialId = null;
                }, trial.duration);
            },
            () => {
                document.removeEventListener('keydown', keyListener);
                db.run(`UPDATE sessions SET ended_at = ? WHERE session_id = ?`, [Date.now(), currentSessionId]);
                const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
                window.isTestRunning = false;
                window.cptCleanup = null;
                dn('TestBitti');
            }
        );
        window.cptCleanup = () => {
            scheduler.stop();
            document.removeEventListener('keydown', keyListener);
        };
        scheduler.start();
    },

    // ========================================================
    // BLOK 2: Dürtüsellik ve Go/No-Go (Yeşil ve Kırmızı Daire)
    // ========================================================
    testMotoruBaslatBlok2: function () {
        if (!testBaslatilabilir()) return;

        const totalTrials = 60;
        const startTime = Date.now();
        db.run(`INSERT INTO sessions (participant_id, started_at, total_trials) VALUES (?, ?, ?)`, ['Test-Kullanicisi-Blok2', startTime, totalTrials]);

        const res = db.exec("SELECT last_insert_rowid()");
        currentSessionId = res[0].values[0][0];

        const shapes = { circle: "M12,2 A10,10 0 1,0 12,22 A10,10 0 1,0 12,2 Z" };

        const trials = [];
        for (let i = 0; i < totalTrials; i++) {
            const isTarget = Math.random() < 0.8;
            trials.push({ type: isTarget ? 'target' : 'nontarget', duration: 500 });
        }

        let currentOnsetMs = 0; let currentTrial = null; let responseRecorded = false; let currentTrialId = null;

        const keyListener = function (event) {
            if (event.code !== 'Space') return;
            const pressMs = performance.now();
            if (!currentTrial) {
                db.run(`INSERT INTO events (session_id, event_time_ms, event_type, linked_trial_id) VALUES (?, ?, 'keypress', NULL)`, [currentSessionId, pressMs]);
                dn('CptVeriKaydet', 'hyperactivity', null, null);
                return;
            }
            if (responseRecorded) return;
            responseRecorded = true;
            const reactionTime = pressMs - currentOnsetMs;
            const outcome = currentTrial.type === 'target' ? 'hit' : 'commission';
            db.run(`UPDATE trials SET response_ms = ?, rt_ms = ?, outcome = ? WHERE trial_id = ?`, [pressMs, reactionTime, outcome, currentTrialId]);
            dn('CptVeriKaydet', outcome, currentTrial.type, reactionTime);
        };
        document.addEventListener('keydown', keyListener);

        const scheduler = new TrialScheduler(trials, 1000,
            (trial, onsetMs) => {
                currentTrial = trial; currentOnsetMs = onsetMs; responseRecorded = false;
                db.run(`INSERT INTO trials (session_id, trial_index, stimulus_type, stimulus_onset_ms, distractor_active) VALUES (?, ?, ?, ?, ?)`, [currentSessionId, scheduler.index, trial.type, onsetMs, 0]);
                const trialRes = db.exec("SELECT last_insert_rowid()"); currentTrialId = trialRes[0].values[0][0];

                const svgEl = document.getElementById('dynamicStimulus');
                const pathEl = document.getElementById('stimulusPath');
                if (svgEl && pathEl) {
                    pathEl.setAttribute('d', shapes.circle);
                    if (trial.type === 'target') {
                        pathEl.setAttribute('fill', '#2ea043');
                    } else {
                        pathEl.setAttribute('fill', '#f85149');
                    }
                    svgEl.style.visibility = 'visible';
                }
                setTimeout(() => {
                    if (svgEl) svgEl.style.visibility = 'hidden';
                    const offsetMs = performance.now();
                    if (!responseRecorded) {
                        const outcome = trial.type === 'target' ? 'omission' : 'correct_rejection';
                        db.run(`UPDATE trials SET stimulus_offset_ms = ?, outcome = ? WHERE trial_id = ?`, [offsetMs, outcome, currentTrialId]);
                        dn('CptVeriKaydet', outcome, trial.type, null);
                    } else {
                        db.run(`UPDATE trials SET stimulus_offset_ms = ? WHERE trial_id = ?`, [offsetMs, currentTrialId]);
                    }
                    currentTrial = null; currentTrialId = null;
                }, trial.duration);
            },
            () => {
                document.removeEventListener('keydown', keyListener);
                db.run(`UPDATE sessions SET ended_at = ? WHERE session_id = ?`, [Date.now(), currentSessionId]);
                const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
                window.isTestRunning = false;
                window.cptCleanup = null;
                dn('TestBitti');
            }
        );
        window.cptCleanup = () => {
            scheduler.stop();
            document.removeEventListener('keydown', keyListener);
        };
        scheduler.start();
    },

    // ========================================================
    // BLOK 3: Sürdürülebilir Dikkat (3 Şekil x 4 Renk, Değişken Zaman)
    // ========================================================
    testMotoruBaslatBlok3: function () {
        if (!testBaslatilabilir()) return;

        const startTime = Date.now();

        db.run(`INSERT INTO sessions (participant_id, started_at, total_trials) VALUES (?, ?, ?)`, ['Test-Kullanicisi-Blok3', startTime, 0]);
        const res = db.exec("SELECT last_insert_rowid()");
        currentSessionId = res[0].values[0][0];

        const shapes = {
            circle: "M12,2 A10,10 0 1,0 12,22 A10,10 0 1,0 12,2 Z",
            triangle: "M12,2 L22,20 L2,20 Z",
            square: "M4,4 H20 V20 H4 Z"
        };

        const colors = ['#2F81F7', '#f85149', '#2ea043', '#e3b341'];

        function getRandomNonTarget() {
            let shapeKeys = Object.keys(shapes);
            let randomShape, randomColor;
            do {
                randomShape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                randomColor = colors[Math.floor(Math.random() * colors.length)];
            } while (randomShape === 'circle' && randomColor === '#2F81F7');
            return { shape: randomShape, color: randomColor };
        }

        const trials = [];
        let elapsedMs = 0;

        const blockDurationMs = 1 * 60 * 1000;

        while (elapsedMs < blockDurationMs) {
            let targetProb, minIsi, maxIsi;

            if (elapsedMs < 15000) {
                targetProb = 0.25; minIsi = 1000; maxIsi = 2000;
            } else if (elapsedMs < 30000) {
                targetProb = 0.15; minIsi = 1500; maxIsi = 2500;
            } else if (elapsedMs < 45000) {
                targetProb = 0.20; minIsi = 500; maxIsi = 3500;
            } else {
                targetProb = 0.10; minIsi = 2000; maxIsi = 4000;
            }

            const isTarget = Math.random() < targetProb;
            const currentIsi = Math.floor(Math.random() * (maxIsi - minIsi + 1)) + minIsi;
            const duration = 500;

            trials.push({
                type: isTarget ? 'target' : 'nontarget',
                duration: duration,
                isi: currentIsi
            });

            elapsedMs += (duration + currentIsi);
        }

        db.run(`UPDATE sessions SET total_trials = ? WHERE session_id = ?`, [trials.length, currentSessionId]);

        let currentOnsetMs = 0; let currentTrial = null; let responseRecorded = false; let currentTrialId = null;

        const keyListener = function (event) {
            if (event.code !== 'Space') return;
            const pressMs = performance.now();
            if (!currentTrial) {
                db.run(`INSERT INTO events (session_id, event_time_ms, event_type, linked_trial_id) VALUES (?, ?, 'keypress', NULL)`, [currentSessionId, pressMs]);
                dn('CptVeriKaydet', 'hyperactivity', null, null);
                return;
            }
            if (responseRecorded) return;
            responseRecorded = true;
            const reactionTime = pressMs - currentOnsetMs;
            const outcome = currentTrial.type === 'target' ? 'hit' : 'commission';
            db.run(`UPDATE trials SET response_ms = ?, rt_ms = ?, outcome = ? WHERE trial_id = ?`, [pressMs, reactionTime, outcome, currentTrialId]);
            dn('CptVeriKaydet', outcome, currentTrial.type, reactionTime);
        };
        document.addEventListener('keydown', keyListener);

        const scheduler = new TrialScheduler(trials, 1000,
            (trial, onsetMs) => {
                currentTrial = trial; currentOnsetMs = onsetMs; responseRecorded = false;
                db.run(`INSERT INTO trials (session_id, trial_index, stimulus_type, stimulus_onset_ms, distractor_active) VALUES (?, ?, ?, ?, ?)`, [currentSessionId, scheduler.index, trial.type, onsetMs, 0]);
                const trialRes = db.exec("SELECT last_insert_rowid()"); currentTrialId = trialRes[0].values[0][0];

                const svgEl = document.getElementById('dynamicStimulus');
                const pathEl = document.getElementById('stimulusPath');

                if (svgEl && pathEl) {
                    if (trial.type === 'target') {
                        pathEl.setAttribute('d', shapes.circle);
                        pathEl.setAttribute('fill', '#2F81F7');
                    } else {
                        const nonTarget = getRandomNonTarget();
                        pathEl.setAttribute('d', shapes[nonTarget.shape]);
                        pathEl.setAttribute('fill', nonTarget.color);
                    }
                    svgEl.style.visibility = 'visible';
                }

                setTimeout(() => {
                    if (svgEl) svgEl.style.visibility = 'hidden';
                    const offsetMs = performance.now();
                    if (!responseRecorded) {
                        const outcome = trial.type === 'target' ? 'omission' : 'correct_rejection';
                        db.run(`UPDATE trials SET stimulus_offset_ms = ?, outcome = ? WHERE trial_id = ?`, [offsetMs, outcome, currentTrialId]);
                        dn('CptVeriKaydet', outcome, trial.type, null);
                    } else {
                        db.run(`UPDATE trials SET stimulus_offset_ms = ? WHERE trial_id = ?`, [offsetMs, currentTrialId]);
                    }
                    currentTrial = null; currentTrialId = null;
                }, trial.duration);
            },
            () => {
                document.removeEventListener('keydown', keyListener);
                db.run(`UPDATE sessions SET ended_at = ? WHERE session_id = ?`, [Date.now(), currentSessionId]);
                const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
                window.isTestRunning = false;
                window.cptCleanup = null;
                dn('TestBitti');
            }
        );
        window.cptCleanup = () => {
            scheduler.stop();
            document.removeEventListener('keydown', keyListener);
        };
        scheduler.start();
    },

    // ========================================================
    // BLOK 4: Hareketli Çeldiriciler (Distractor Task)
    // ========================================================
    testMotoruBaslatBlok4: function () {
        if (!testBaslatilabilir()) return;

        const totalTrials = 80;
        const startTime = Date.now();
        db.run(`INSERT INTO sessions (participant_id, started_at, total_trials) VALUES (?, ?, ?)`, ['Test-Kullanicisi-Blok4', startTime, totalTrials]);
        const res = db.exec("SELECT last_insert_rowid()");
        currentSessionId = res[0].values[0][0];

        const shapes = {
            star: "M12,2 L15,9 L22,9 L16,14 L18,21 L12,17 L6,21 L8,14 L2,9 L9,9 Z",
            triangle: "M12,2 L22,20 L2,20 Z",
            circle: "M12,2 A10,10 0 1,0 12,22 A10,10 0 1,0 12,2 Z"
        };
        const colors = ['blue', 'red', 'gold'];

        function getRandomNonTarget() {
            let shapeKeys = Object.keys(shapes);
            let randomShape, randomColor;
            do {
                randomShape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                randomColor = colors[Math.floor(Math.random() * colors.length)];
            } while (randomShape === 'star' && randomColor === 'blue');
            return { shape: randomShape, color: randomColor };
        }

        const trials = [];
        for (let i = 0; i < totalTrials; i++) {
            const isTarget = Math.random() < 0.5;
            trials.push({ type: isTarget ? 'target' : 'nontarget', duration: 500, isi: 1000 });
        }

        // --- 1. YENİLİK: İŞİTSEL ÇELDİRİCİLER (WEB AUDIO API) ---
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();

        let soundInterval = setInterval(() => {
            if (!window.isTestRunning) return;
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.type = Math.random() > 0.5 ? 'square' : 'sawtooth';
            osc.frequency.value = Math.random() * 800 + 200;

            osc.start();
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.stop(audioCtx.currentTime + 0.2);
        }, 1500);

        // --- MEVCUT: GÖRSEL ÇELDİRİCİLER (UÇUŞAN ŞEKİLLER) ---
        let distractorInterval = setInterval(() => {
            const box = document.querySelector('.stimulus-box');
            if (!box || !window.isTestRunning) return;

            const dist = document.createElement('div');
            dist.style.position = 'absolute';
            const size = Math.floor(Math.random() * 20) + 15;
            dist.style.width = size + 'px';
            dist.style.height = size + 'px';
            dist.style.backgroundColor = ['#f85149', '#2ea043', '#e3b341', '#a371f7'][Math.floor(Math.random() * 4)];
            dist.style.borderRadius = Math.random() > 0.5 ? '50%' : '0%';
            dist.style.opacity = '0.5';
            dist.style.zIndex = '0';

            const fromLeft = Math.random() > 0.5;
            dist.style.top = Math.floor(Math.random() * 400) + 10 + 'px';
            dist.style.left = fromLeft ? '-40px' : '740px';
            dist.style.transition = 'left 2s linear';

            box.appendChild(dist);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    dist.style.left = fromLeft ? '740px' : '-40px';
                });
            });

            setTimeout(() => {
                if (box.contains(dist)) box.removeChild(dist);
            }, 2000);
        }, 500);

        let currentOnsetMs = 0; let currentTrial = null; let responseRecorded = false; let currentTrialId = null;

        const keyListener = function (event) {
            if (event.code !== 'Space') return;
            const pressMs = performance.now();
            if (!currentTrial) {
                db.run(`INSERT INTO events (session_id, event_time_ms, event_type, linked_trial_id) VALUES (?, ?, 'keypress', NULL)`, [currentSessionId, pressMs]);
                dn('CptVeriKaydet', 'hyperactivity', null, null);
                return;
            }
            if (responseRecorded) return;
            responseRecorded = true;
            const reactionTime = pressMs - currentOnsetMs;
            const outcome = currentTrial.type === 'target' ? 'hit' : 'commission';
            db.run(`UPDATE trials SET response_ms = ?, rt_ms = ?, outcome = ? WHERE trial_id = ?`, [pressMs, reactionTime, outcome, currentTrialId]);
            dn('CptVeriKaydet', outcome, currentTrial.type, reactionTime);
        };
        document.addEventListener('keydown', keyListener);

        const scheduler = new TrialScheduler(trials, 1000,
            (trial, onsetMs) => {
                currentTrial = trial; currentOnsetMs = onsetMs; responseRecorded = false;
                db.run(`INSERT INTO trials (session_id, trial_index, stimulus_type, stimulus_onset_ms, distractor_active) VALUES (?, ?, ?, ?, ?)`, [currentSessionId, scheduler.index, trial.type, onsetMs, 1]);
                const trialRes = db.exec("SELECT last_insert_rowid()"); currentTrialId = trialRes[0].values[0][0];

                const svgEl = document.getElementById('dynamicStimulus');
                const pathEl = document.getElementById('stimulusPath');

                if (svgEl && pathEl) {
                    svgEl.style.zIndex = '10';

                    // --- 2. YENİLİK: ANA HEDEFİ RASTGELE KONUMLANDIRMA ---
                    const randomX = Math.floor(Math.random() * 500) - 250;
                    const randomY = Math.floor(Math.random() * 300) - 150;
                    svgEl.style.transform = `translate(${randomX}px, ${randomY}px)`;

                    if (trial.type === 'target') {
                        pathEl.setAttribute('d', shapes.star);
                        pathEl.setAttribute('fill', 'blue');
                    } else {
                        const nonTarget = getRandomNonTarget();
                        pathEl.setAttribute('d', shapes[nonTarget.shape]);
                        pathEl.setAttribute('fill', nonTarget.color);
                    }
                    svgEl.style.visibility = 'visible';
                }

                setTimeout(() => {
                    if (svgEl) {
                        svgEl.style.visibility = 'hidden';
                        svgEl.style.transform = 'translate(0px, 0px)';
                    }
                    const offsetMs = performance.now();
                    if (!responseRecorded) {
                        const outcome = trial.type === 'target' ? 'omission' : 'correct_rejection';
                        db.run(`UPDATE trials SET stimulus_offset_ms = ?, outcome = ? WHERE trial_id = ?`, [offsetMs, outcome, currentTrialId]);
                        dn('CptVeriKaydet', outcome, trial.type, null);
                    } else {
                        db.run(`UPDATE trials SET stimulus_offset_ms = ? WHERE trial_id = ?`, [offsetMs, currentTrialId]);
                    }
                    currentTrial = null; currentTrialId = null;
                }, trial.duration);
            },
            () => {
                clearInterval(distractorInterval);
                clearInterval(soundInterval);
                if (audioCtx.state !== 'closed') audioCtx.close();
                document.removeEventListener('keydown', keyListener);
                db.run(`UPDATE sessions SET ended_at = ? WHERE session_id = ?`, [Date.now(), currentSessionId]);
                const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
                window.isTestRunning = false;
                window.cptCleanup = null;
                dn('TestBitti');
            }
        );
        // Hata / erken çıkışta ses ve uçan şekillerin devam etmemesi için (YENİ)
        window.cptCleanup = () => {
            scheduler.stop();
            clearInterval(distractorInterval);
            clearInterval(soundInterval);
            if (audioCtx.state !== 'closed') audioCtx.close();
            document.removeEventListener('keydown', keyListener);
        };
        scheduler.start();
    },

    // ========================================================
    // BLOK 5: Zihinsel Esneklik (Set-Shifting / Kural Değiştirme)
    // ========================================================
    testMotoruBaslatBlok5: function () {
        if (!testBaslatilabilir()) return;

        const startTime = Date.now();
        db.run(`INSERT INTO sessions (participant_id, started_at, total_trials) VALUES (?, ?, ?)`, ['Test-Kullanicisi-Blok5', startTime, 60]);
        const res = db.exec("SELECT last_insert_rowid()");
        currentSessionId = res[0].values[0][0];

        const shapes = {
            circle: "M12,2 A10,10 0 1,0 12,22 A10,10 0 1,0 12,2 Z",
            triangle: "M12,2 L22,20 L2,20 Z",
            square: "M4,4 H20 V20 H4 Z"
        };
        const colors = ['#2ea043', '#2F81F7', '#f85149', '#e3b341'];

        const trials = [];
        // AŞAMA 1: İlk Kural - Yeşil Daire (30 Deneme)
        for (let i = 0; i < 30; i++) {
            const isTarget = Math.random() < 0.4;
            trials.push({ type: isTarget ? 'target' : 'nontarget', phase: 1, duration: 500, isi: 1000 });
        }

        // ORTA MOLA: Kural Değişimi Uyarısı (Ekranda 4 saniye kalır)
        trials.push({ type: 'instruction', text: "⚠️ DİKKAT KURAL DEĞİŞTİ ⚠️\n\nArtık SADECE\nMAVİ ÜÇGEN'e basacaksın!", duration: 4000, isi: 1000 });

        // AŞAMA 2: Yeni Kural - Mavi Üçgen (30 Deneme)
        for (let i = 0; i < 30; i++) {
            const isTarget = Math.random() < 0.4;
            trials.push({ type: isTarget ? 'target' : 'nontarget', phase: 2, duration: 500, isi: 1000 });
        }

        let currentOnsetMs = 0; let currentTrial = null; let responseRecorded = false; let currentTrialId = null;
        let realTrialCounter = 0; // Talimat ekranı trial_index'i kaydırmasın diye (YENİ)

        const keyListener = function (event) {
            if (event.code !== 'Space') return;
            const pressMs = performance.now();

            if (currentTrial && currentTrial.type === 'instruction') return;

            if (!currentTrial) {
                db.run(`INSERT INTO events (session_id, event_time_ms, event_type, linked_trial_id) VALUES (?, ?, 'keypress', NULL)`, [currentSessionId, pressMs]);
                dn('CptVeriKaydet', 'hyperactivity', null, null);
                return;
            }
            if (responseRecorded) return;
            responseRecorded = true;
            const reactionTime = pressMs - currentOnsetMs;
            const outcome = currentTrial.type === 'target' ? 'hit' : 'commission';
            db.run(`UPDATE trials SET response_ms = ?, rt_ms = ?, outcome = ? WHERE trial_id = ?`, [pressMs, reactionTime, outcome, currentTrialId]);
            dn('CptVeriKaydet', outcome, currentTrial.type, reactionTime);
        };
        document.addEventListener('keydown', keyListener);

        // Bu blok için, her denemenin kendi duration + isi değerini kullanan scheduler
        class Blok5Scheduler {
            constructor(trials, defaultIsi, onTrial, onEnd) {
                this.trials = trials;
                this.defaultIsi = defaultIsi;
                this.onTrial = onTrial;
                this.onEnd = onEnd;
                this.index = -1;
                this.timer = null;
                this.stopped = false;
            }
            start() { this.next(); }
            stop() { this.stopped = true; clearTimeout(this.timer); }
            next() {
                if (this.stopped) return;
                this.index++;
                if (this.index >= this.trials.length) { this.onEnd(); return; }
                const trial = this.trials[this.index];
                this.onTrial(trial, performance.now());
                const wait = (trial.duration ?? 0) + (trial.isi ?? this.defaultIsi);
                this.timer = setTimeout(() => this.next(), wait);
            }
        }

        const scheduler = new Blok5Scheduler(trials, 1000,
            (trial, onsetMs) => {
                currentTrial = trial; currentOnsetMs = onsetMs; responseRecorded = false;

                const svgEl = document.getElementById('dynamicStimulus');
                const pathEl = document.getElementById('stimulusPath');
                const boxEl = document.querySelector('.stimulus-box');

                if (trial.type === 'instruction') {
                    if (svgEl) svgEl.style.visibility = 'hidden';
                    let msgEl = document.getElementById('instructionMsg');
                    if (!msgEl && boxEl) {
                        msgEl = document.createElement('div');
                        msgEl.id = 'instructionMsg';
                        msgEl.style.position = 'absolute';
                        msgEl.style.color = '#e3b341';
                        msgEl.style.fontSize = '24px';
                        msgEl.style.fontWeight = 'bold';
                        msgEl.style.textAlign = 'center';
                        msgEl.style.whiteSpace = 'pre-line';
                        boxEl.appendChild(msgEl);
                    }
                    if (msgEl) {
                        msgEl.innerText = trial.text;
                        msgEl.style.visibility = 'visible';
                    }

                    setTimeout(() => {
                        if (msgEl) msgEl.style.visibility = 'hidden';
                        currentTrial = null;
                    }, trial.duration);
                    return; // DB'ye trial olarak kaydetmeden çık
                }

                db.run(`INSERT INTO trials (session_id, trial_index, stimulus_type, stimulus_onset_ms, distractor_active) VALUES (?, ?, ?, ?, ?)`, [currentSessionId, realTrialCounter++, trial.type, onsetMs, 0]);
                const trialRes = db.exec("SELECT last_insert_rowid()"); currentTrialId = trialRes[0].values[0][0];

                let targetShape = trial.phase === 1 ? 'circle' : 'triangle';
                let targetColor = trial.phase === 1 ? '#2ea043' : '#2F81F7';

                function getRandomNonTarget() {
                    let shapeKeys = Object.keys(shapes);
                    let randomShape, randomColor;
                    do {
                        randomShape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                        randomColor = colors[Math.floor(Math.random() * colors.length)];
                    } while (randomShape === targetShape && randomColor === targetColor);

                    // KRİTİK TUZAK (Perseverasyon Ölçümü)
                    if (trial.phase === 2 && Math.random() < 0.3) {
                        return { shape: 'circle', color: '#2ea043' };
                    }
                    return { shape: randomShape, color: randomColor };
                }

                if (svgEl && pathEl) {
                    if (trial.type === 'target') {
                        pathEl.setAttribute('d', shapes[targetShape]);
                        pathEl.setAttribute('fill', targetColor);
                    } else {
                        const nonTarget = getRandomNonTarget();
                        pathEl.setAttribute('d', shapes[nonTarget.shape]);
                        pathEl.setAttribute('fill', nonTarget.color);
                    }
                    svgEl.style.visibility = 'visible';
                }

                setTimeout(() => {
                    if (svgEl) svgEl.style.visibility = 'hidden';
                    const offsetMs = performance.now();
                    if (!responseRecorded) {
                        const outcome = trial.type === 'target' ? 'omission' : 'correct_rejection';
                        db.run(`UPDATE trials SET stimulus_offset_ms = ?, outcome = ? WHERE trial_id = ?`, [offsetMs, outcome, currentTrialId]);
                        dn('CptVeriKaydet', outcome, trial.type, null);
                    } else {
                        db.run(`UPDATE trials SET stimulus_offset_ms = ? WHERE trial_id = ?`, [offsetMs, currentTrialId]);
                    }
                    currentTrial = null; currentTrialId = null;
                }, trial.duration);
            },
            () => {
                document.removeEventListener('keydown', keyListener);
                db.run(`UPDATE sessions SET ended_at = ? WHERE session_id = ?`, [Date.now(), currentSessionId]);
                const svgEl = document.getElementById('dynamicStimulus'); if (svgEl) svgEl.style.visibility = 'hidden';
                let msgEl = document.getElementById('instructionMsg'); if (msgEl) msgEl.remove();
                window.isTestRunning = false;
                window.cptCleanup = null;

                const ozet = window.cptInterop.sonuclariHesapla(false);
                dn('SonuclariEkrandaGoster', ozet).then(() => dn('TestBitti'));
            }
        );
        window.cptCleanup = () => {
            scheduler.stop();
            document.removeEventListener('keydown', keyListener);
        };
        scheduler.start();
    },

    // sadeceSonOturum = true verilirse yalnızca en son bloğun verisi hesaplanır.
    // Parametresiz çağırırsan eskisi gibi tüm bloklar birlikte hesaplanır.
    sonuclariHesapla: function (sadeceSonOturum) {
        if (!db) return {};
        const w = (sadeceSonOturum && currentSessionId) ? ` AND session_id = ${Number(currentSessionId)}` : '';

        // 1. ODAKLANMA (Omission - Kaçırma Hataları)
        let resOmission = db.exec("SELECT COUNT(*) FROM trials WHERE outcome = 'omission'" + w);
        let omissionCount = resOmission.length > 0 ? resOmission[0].values[0][0] : 0;

        let odaklanma = "YÜKSEK (Harika)";
        if (omissionCount > 3 && omissionCount <= 8) odaklanma = "ORTA (Kısmi Dikkatsizlik)";
        else if (omissionCount > 8) odaklanma = "DÜŞÜK (Odak Dağınıklığı)";

        // 2. DÜRTÜ KONTROLÜ (Commission - Yanlış Basma Hataları)
        let resCommission = db.exec("SELECT COUNT(*) FROM trials WHERE outcome = 'commission'" + w);
        let commissionCount = resCommission.length > 0 ? resCommission[0].values[0][0] : 0;

        let durtuKontrol = "YÜKSEK (Sakin ve Kontrollü)";
        if (commissionCount > 3 && commissionCount <= 8) durtuKontrol = "ORTA (Hafif Sabırsız)";
        else if (commissionCount > 8) durtuKontrol = "DÜŞÜK (Dürtüsel / Aceleci)";

        // 3. HİPERAKTİVİTE (Boşta Tuşa Basma - linked_trial_id IS NULL)
        let resHyper = db.exec("SELECT COUNT(*) FROM events WHERE event_type = 'keypress' AND linked_trial_id IS NULL" + w);
        let hyperCount = resHyper.length > 0 ? resHyper[0].values[0][0] : 0;

        let hiperaktivite = "DÜŞÜK (Hareketsiz / Odaklı)";
        if (hyperCount > 2 && hyperCount <= 6) hiperaktivite = "ORTA (Hafif Kıpır Kıpır)";
        else if (hyperCount > 6) hiperaktivite = "YÜKSEK (Motor Huzursuzluk)";

        // 4. ZİHİNSEL ESNEKLİK (Blok 5'in EN SON oturumundaki hatalar)
        let resFlex = db.exec("SELECT COUNT(*) FROM trials WHERE session_id = (SELECT MAX(session_id) FROM sessions WHERE participant_id = 'Test-Kullanicisi-Blok5') AND outcome IN ('omission', 'commission')");
        let flexCount = resFlex.length > 0 ? resFlex[0].values[0][0] : 0;

        let esneklik = "YÜKSEK (Hızlı Uyum)";
        if (flexCount > 3 && flexCount <= 7) esneklik = "ORTA (Normal Geçiş)";
        else if (flexCount > 7) esneklik = "DÜŞÜK (Kurala Takılma / Zorlanma)";

        // 5. İŞLEM HIZI (Ortalama RT - Reaksiyon Süresi)
        let resRt = db.exec("SELECT AVG(rt_ms) FROM trials WHERE rt_ms IS NOT NULL AND rt_ms > 0" + w);
        let avgRt = resRt.length > 0 && resRt[0].values[0][0] !== null ? Math.round(resRt[0].values[0][0]) : 0;

        let hiz = "DENGELİ";
        if (avgRt > 0 && avgRt < 350) hiz = "ÇOK HIZLI";
        else if (avgRt > 550) hiz = "YAVAŞ / TEMKİNLİ";

        // 6. GENEL PERFORMANS SKORU (100 Üzerinden)
        let toplamHataPuanı = (omissionCount * 2) + (commissionCount * 2) + (hyperCount * 1.5) + (flexCount * 2);
        let genelPuan = Math.max(0, Math.round(100 - toplamHataPuanı));

        let sonucOzeti = {
            Odaklanma: odaklanma,
            DurtuKontrolu: durtuKontrol,
            Hiperaktivite: hiperaktivite,
            ZihinselEsneklik: esneklik,
            IslemHizi: avgRt + " ms (" + hiz + ")",
        };

        console.table(sonucOzeti);

        return sonucOzeti;
    }
};
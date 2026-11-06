const COMMAND_LIST = [
  'help',
  'game',
  'arcade',
  'neofetch',
  'whoami',
  'about',
  'projects',
  'leetcode',
  'euler',
  'playlist',
  'running',
  'drums',
  'why',
  'coffee',
  'ls',
  'cat',
  'skills',
  'theme',
  'play',
  'bpm',
  'cadence',
  'globe',
  'ascii',
  'socials',
  'weather',
  'fortune',
  'matrix',
  'sudo',
  'history',
  'date',
  'pwd',
  'echo',
  'warp',
  'clear',
  'exit',
];

const VIRTUAL_FILES = {
  'about.md': {
    title: 'about.md — Rishav Kumar (@rishav-netizen)',
    rows: [
      ['Origin', 'Born in Shimla (May 4, 2007 · 12:01 AM) → CSE undergrad at IIIT Bhubaneswar'],
      ['Curiosity', 'Used to walk into the school staff room every morning with sheets full of questions'],
      ['Drumming', 'Started on tabla in 6th grade, then taught myself drums by ear on jam-pad Tama kits with ProMark sticks'],
      ['Running', '5K PR in 27:58 · 10K PR in 1:02:00 + regular strength workouts'],
      ['Exploring', 'Augmented Reality (AR), low-level C99/C++17, Arduino robotics, AI/ML & problem solving'],
    ],
  },
  'playlist.txt': {
    title: 'playlist.txt — On Rotation (Jam Pad & Running Tracks)',
    rows: [
      ['01 · Polyphia', 'Playing God — intricate syncopation & pocket'],
      ['02 · Plini', 'Handmade Cities / Electric Sunrise — prog-fusion feel'],
      ['03 · Michael Jackson', 'Beat It — timeless rock groove'],
      ['04 · Bon Jovi', 'Livin’ on a Prayer / It’s My Life — pure arena energy'],
      ['05 · The Local Train', 'Choo Lo / Aaoge Tum Kabhi — Indian indie-rock anthems'],
    ],
  },
  'running.log': {
    title: 'running.log — Road Running & Workout Notes',
    rows: [
      ['5K Personal Best', '27:58'],
      ['10K Personal Best', '1 hr 02 min (1:02:00)'],
      ['Routine', '5K/10K road miles + strength workouts to reset after long coding sessions'],
    ],
  },
  'skills.json': {
    code: `{
  "low_level": ["C99", "C++17", "POSIX Termios", "Makefile", "CMake"],
  "robotics_hardware": ["Arduino Uno", "115200-Baud UART", "HIL Simulation"],
  "ar_graphics_ai": ["Augmented Reality", "Raylib", "Python 3", "FastAPI", "PyDeck 3D"],
  "off_the_clock": ["Tama Kit + ProMark Sticks", "6th-Grade Tabla", "5K (27:58)", "10K (1:02)"]
}`,
  },
};

const FORTUNES = [
  '“Still the same kid from Shimla walking into the staff room with a sheet full of questions.”',
  '“You don’t need a drum kit at home to learn the groove—just ears, ProMark sticks, and a jam pad Tama.”',
  '“First master the raw bytes in C99; the abstractions will take care of themselves.”',
  '“5K in 27:58, 10K in 1:02, and always another question to ask.”',
];

export class CadenceTerminal {
  constructor({
    container,
    input,
    form,
    audio,
    sequencer,
    updateBpm,
    launchWarp,
    setTheme,
    onDrum,
    onGlobeAction,
    onAsciiMode,
    onOpenGame,
    onCloseDrawer,
  }) {
    this.container = container;
    this.input = input;
    this.form = form;
    this.audio = audio;
    this.sequencer = sequencer;
    this.updateBpm = updateBpm;
    this.launchWarp = launchWarp;
    this.setTheme = setTheme;
    this.onDrum = onDrum;
    this.onGlobeAction = onGlobeAction;
    this.onAsciiMode = onAsciiMode;
    this.onOpenGame = onOpenGame;
    this.onCloseDrawer = onCloseDrawer;
    this.history = [];
    this.historyIndex = -1;

    this.bind();
    this.printWelcome();
  }

  bind() {
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = this.input.value.trim();
      if (!raw) return;
      this.history.push(raw);
      this.historyIndex = this.history.length;
      this.execute(raw);
      this.input.value = '';
      this.scrollBottom();
    });

    this.input?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex -= 1;
          this.input.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex += 1;
          this.input.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const current = this.input.value.trim().toLowerCase();
        if (!current) return;
        const match = COMMAND_LIST.find((c) => c.startsWith(current));
        if (match) this.input.value = `${match} `;
      }
    });

    document.querySelectorAll('[data-term-cmd]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const cmd = chip.dataset.termCmd;
        if (this.input) this.input.value = cmd;
        this.execute(cmd);
        this.scrollBottom();
      });
    });
  }

  scrollBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  printWelcome() {
    this.writeBlock(`
      <div class="term-welcome">
        <div><span class="term-accent">✦ Rishav’s Interactive Shell</span> <span class="term-dim">(Tab to autocomplete · ⌘K or \` to toggle)</span></div>
        <div class="term-dim">Try <span class="term-accent">help</span>, <span class="term-accent">whoami</span>, <span class="term-accent">about</span>, <span class="term-accent">projects</span>, <span class="term-accent">leetcode</span>, <span class="term-accent">playlist</span>, or <span class="term-accent">drums</span>.</div>
      </div>
    `);
  }

  writeLine(html) {
    if (!this.container) return;
    const p = document.createElement('div');
    p.className = 'term-line';
    p.innerHTML = html;
    this.container.appendChild(p);
  }

  writeBlock(html) {
    if (!this.container) return;
    const block = document.createElement('div');
    block.className = 'term-block';
    block.innerHTML = html;
    this.container.appendChild(block);
  }

  writeKeyValueRows(title, rows) {
    const rowsHtml = rows
      .map(
        ([key, val]) => `
        <div class="term-grid-row">
          <span class="term-grid-key">${key}</span>
          <span class="term-grid-val">${val}</span>
        </div>`
      )
      .join('');
    this.writeBlock(`
      ${title ? `<div class="term-section-heading">${title}</div>` : ''}
      <div class="term-grid-table">${rowsHtml}</div>
    `);
  }

  trigger(type, options) {
    if (this.onDrum) this.onDrum(type, options);
    else void this.audio?.hit(type);
  }

  execute(raw) {
    this.writeLine(
      `<span class="term-prompt">rishav@desk:~$</span> <span class="term-user-cmd">${this.escape(raw)}</span>`
    );
    const parts = raw.split(' ').filter(Boolean);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = (parts[1] || '').toLowerCase();
    const rest = parts.slice(1).join(' ');

    switch (cmd) {
      case 'help':
        this.writeKeyValueRows('Available Commands', [
          ['about', 'Personal story from Shimla to IIIT Bhubaneswar'],
          ['projects', 'Five featured builds with tech stack and GitHub links'],
          ['leetcode', 'Live LeetCode stats (@rishav_leet) in C99, C++17 & Python 3'],
          ['euler [1|2]', 'Project Euler archive in Python 3 (81 solved + proofs)'],
          ['playlist', 'Tracks on rotation for jam sessions and road runs'],
          ['drums', 'From 6th-grade tabla to Tama jam pads + live drum fill'],
          ['running', '5K (27:58) & 10K (1:02:00) PRs and training routine'],
          ['why', 'What I am currently exploring (AR, C/C++, AI/ML, robotics)'],
          ['skills', 'Core technical stack and off-the-clock disciplines'],
          ['neofetch', 'Side-by-side system and personal snapshot'],
          ['whoami', 'Client session & network telemetry lookup'],
          ['ls / cat <file>', 'Read notes: about.md, playlist.txt, running.log, skills.json'],
          ['game [mode]', 'Open Mini Arcade (runner or rhythm)'],
          ['play <sound>', 'Trigger synth: kick | snare | hat | groove | stop'],
          ['bpm <60-220>', 'Set drum groove tempo'],
          ['theme <name>', 'Switch theme: sunset | dark | ocean | midnight | light'],
          ['clear / exit', 'Clear terminal history or close drawer'],
        ]);
        break;

      case 'neofetch':
      case 'fastfetch': {
        const currentTheme = document.documentElement.dataset.theme || 'sunset';
        const art = [
          '     . · * · .     ',
          '  ·  ╱   ✦   ╲  ·  ',
          ' *  (    Ω    )  * ',
          '  ·  ╲   ✦   ╱  ·  ',
          "     ' · * · '     ",
          '  TAMA × 5K 27:58  ',
        ].join('\n');
        const infoRows = [
          ['Host', 'Rishav Kumar (born May 4, 2007 in Shimla)'],
          ['Campus', 'IIIT Bhubaneswar · CSE Undergrad'],
          ['Languages', 'C99, C++17, Python 3, JavaScript'],
          ['Drums', 'Tama Kit (jam pads) + ProMark sticks · Tabla roots'],
          ['Road PRs', '5K in 27:58 · 10K in 1:02:00'],
          ['Exploring', 'AR · Low-Level C/C++ · AI/ML · Arduino Robotics'],
          ['Theme', this.escape(currentTheme)],
        ]
          .map(
            ([k, v]) =>
              `<div class="term-nf-row"><span class="term-nf-key">${k}:</span><span class="term-nf-val">${v}</span></div>`
          )
          .join('');
        this.writeBlock(`
          <div class="term-neofetch">
            <pre class="term-neofetch__art">${art}</pre>
            <div class="term-neofetch__info">
              <div class="term-nf-header">rishav@iiit-bh</div>
              ${infoRows}
            </div>
          </div>
        `);
        break;
      }

      case 'whoami':
        this.handleWhoAmI();
        break;

      case 'about':
        this.writeBlock(`
          <div class="term-section-heading">Hey, I’m Rishav (@rishav-netizen)</div>
          <p class="term-prose">
            I grew up in Shimla, Himachal Pradesh, and as a kid I used to walk into the school staff room every morning with full sheets of written questions for my teachers. Today I’m studying CSE at IIIT Bhubaneswar and channeling that same curiosity into low-level C99/C++17 engines, Augmented Reality, AI/ML, and Arduino robotics.
          </p>
        `);
        break;

      case 'why':
        this.writeKeyValueRows('Current Obsessions', [
          ['Augmented Reality', 'Interactive 3D spatial interfaces and computer vision'],
          ['Low-Level Systems', 'Writing C99 and C++17 engines without black-box wrappers'],
          ['Robotics & HIL', 'Arduino hardware-in-the-loop simulations and POSIX serial bridges'],
          ['AI / ML & DSA', 'Daily algorithmic problem solving in C99, C++17 & Python 3'],
          ['Off the Clock', '5K/10K road runs, strength workouts, and Tama jam-pad sessions'],
        ]);
        break;

      case 'playlist':
      case 'music': {
        const file = VIRTUAL_FILES['playlist.txt'];
        this.writeKeyValueRows(
          file.title,
          file.rows.map(([k, v]) => [this.escape(k), this.escape(v)])
        );
        break;
      }

      case 'running':
      case 'cadence': {
        const file = VIRTUAL_FILES['running.log'];
        this.writeKeyValueRows(
          file.title,
          file.rows.map(([k, v]) => [this.escape(k), this.escape(v)])
        );
        break;
      }

      case 'drums':
      case 'solo':
        this.trigger('kick');
        window.setTimeout(() => this.trigger('hat', { count: false }), 90);
        window.setTimeout(() => this.trigger('rim'), 180);
        window.setTimeout(() => this.trigger('hat', { count: false }), 270);
        window.setTimeout(() => this.trigger('kick'), 360);
        window.setTimeout(() => this.trigger('rim'), 450);
        this.writeBlock(`
          <div class="term-section-heading">🥁 6th-Grade Tabla → Self-Taught on a Tama Kit</div>
          <p class="term-prose">
            I started on tabla in 6th grade and moved to the drum kit purely by ear and feel. I’ve never owned a drum kit at home—I bring my ProMark sticks to jam pads and play on a Tama kit to Polyphia, Plini, Michael Jackson’s Beat It, Bon Jovi, and The Local Train.
          </p>
        `);
        break;

      case 'coffee':
        this.writeLine(
          '<span class="term-accent">☕ Brewing black coffee... Ready for another sheet of questions &amp; C99 pointers.</span>'
        );
        break;

      case 'ls':
      case 'dir':
        this.writeBlock(`
          <div class="term-ls-row">
            <span class="term-file-pill">about.md</span>
            <span class="term-file-pill">playlist.txt</span>
            <span class="term-file-pill">running.log</span>
            <span class="term-file-pill">skills.json</span>
            <span class="term-file-pill term-file-pill--dir">projects/</span>
          </div>
          <div class="term-dim">Tip: run <span class="term-accent">cat about.md</span>, <span class="term-accent">cat playlist.txt</span>, <span class="term-accent">cat running.log</span>, or <span class="term-accent">cat skills.json</span>.</div>
        `);
        break;

      case 'cat':
        if (!arg) {
          this.writeLine(
            '<span class="term-dim">Usage: cat &lt;about.md | playlist.txt | running.log | skills.json&gt;</span>'
          );
        } else if (VIRTUAL_FILES[arg]) {
          const entry = VIRTUAL_FILES[arg];
          if (entry.code) {
            this.writeBlock(`<pre class="term-code">${this.escape(entry.code)}</pre>`);
          } else {
            this.writeKeyValueRows(
              entry.title,
              entry.rows.map(([k, v]) => [this.escape(k), this.escape(v)])
            );
          }
        } else if (arg === 'cosmos.txt' || arg === 'olympus.txt' || arg === 'cadence.log') {
          const entry = VIRTUAL_FILES['running.log'];
          this.writeKeyValueRows(
            entry.title,
            entry.rows.map(([k, v]) => [this.escape(k), this.escape(v)])
          );
        } else if (arg === 'projects' || arg === 'projects/') {
          this.execute('projects');
        } else {
          this.writeLine(`<span class="term-error">cat: ${this.escape(arg)}: No such file</span>`);
        }
        break;

      case 'projects':
        this.writeKeyValueRows('Selected Projects (01 — 05)', [
          [
            '01 · <a href="https://github.com/rishav-netizen/c-image-filters" target="_blank" class="term-link">c-image-filters</a>',
            'Pure C99 2D spatial convolution & binary BMP engine built without OpenCV',
          ],
          [
            '02 · <a href="https://github.com/rishav-netizen/embedded-doppler-visualizer" target="_blank" class="term-link">doppler-visualizer</a>',
            'Arduino + C++17 Raylib supersonic Mach wave & Doppler simulator',
          ],
          [
            '03 · <a href="https://github.com/rishav-netizen/karen-emergency-ai-BitnBuild-26" target="_blank" class="term-link">karen-emergency-ai</a>',
            '6-phase AI emergency triage & 3D PyDeck geospatial dispatch map',
          ],
          [
            '04 · <a href="https://github.com/rishav-netizen/cpp-arduino-control" target="_blank" class="term-link">cpp-arduino-control</a>',
            'Zero-overhead POSIX termios serial bridge for microcontrollers',
          ],
          [
            '05 · <a href="https://github.com/rishav-netizen/3D-Snail" target="_blank" class="term-link">3D-Snail</a>',
            'Interactive CSS 3D logarithmic spiral & GSAP elastic spring sculpture',
          ],
        ]);
        break;

      case 'benchmarks':
      case 'leetcode':
      case 'github': {
        const stats = window.__LEETCODE_STATS || {
          totalSolved: 149,
          easySolved: 95,
          mediumSolved: 49,
          hardSolved: 5,
          acceptanceRate: '57.3%',
        };
        this.writeKeyValueRows('Coding Profiles & Problem Solving', [
          [
            'LeetCode',
            `<a href="https://leetcode.com/u/rishav_leet/" target="_blank" class="term-link">@rishav_leet</a> · ${stats.totalSolved} Solved (${stats.easySolved} Easy · ${stats.mediumSolved} Med · ${stats.hardSolved} Hard · ${stats.acceptanceRate} AC) in C99, C++17 & Python 3`,
          ],
          [
            'Project Euler',
            '<a href="https://github.com/rishav-netizen/Project-Euler" target="_blank" class="term-link">@lichu7_Euler</a> · 81 Solved in Python 3 with mathematical proofs',
          ],
          [
            'GitHub',
            '<a href="https://github.com/rishav-netizen" target="_blank" class="term-link">@rishav-netizen</a> · 50 Public Repositories · 380+ Commits',
          ],
        ]);
        break;
      }

      case 'euler':
        if (arg === '1') {
          this.writeBlock(`
            <div class="term-section-heading">Project Euler #001 · Multiples of 3 and 5 (Python 3)</div>
            <pre class="term-code"># Sum of arithmetic progression S(n, k) = k * m * (m + 1) // 2
def sum_multiples(limit=1000):
    S = lambda k: k * ((limit - 1) // k) * (((limit - 1) // k) + 1) // 2
    return S(3) + S(5) - S(15)
# Result: 233168 · Time: O(1) · Space: O(1)</pre>
          `);
        } else if (arg === '2') {
          this.writeBlock(`
            <div class="term-section-heading">Project Euler #002 · Even Fibonacci Numbers (Python 3)</div>
            <pre class="term-code"># Every 3rd Fibonacci number is even: E(n) = 4*E(n-1) + E(n-2)
def even_fib(limit=4_000_000):
    a, b, total = 2, 8, 0
    while a &lt;= limit:
        total += a
        a, b = b, 4 * b + a
    return total
# Result: 4613732 · Time: O(log N) · Space: O(1)</pre>
          `);
        } else {
          this.writeKeyValueRows('Project Euler Archive · @lichu7_Euler (Python 3)', [
            ['Solved', '81 mathematical problems solved and documented in Python 3'],
            ['Topics', 'Number theory, prime sieves, combinatorics & search-space reduction'],
            ['CLI Workflow', 'Custom scraper.py (BS4 + LaTeX parser) and folders.py scaffolder'],
            ['Repository', '<a href="https://github.com/rishav-netizen/Project-Euler" target="_blank" class="term-link">github.com/rishav-netizen/Project-Euler</a>'],
            ['Inspect Code', 'Run <span class="term-accent">euler 1</span> or <span class="term-accent">euler 2</span> to view sample O(1) / O(log N) proofs'],
          ]);
        }
        break;

      case 'skills':
      case 'stack': {
        const items = [
          ['Low-Level C99 / C++17', 92],
          ['Arduino & Robotics', 88],
          ['AR / 3D Web / Raylib', 86],
          ['Python 3 / AI & DSA', 88],
          ['Tama Drums & 5K/10K', 100],
        ];
        const rows = items
          .map(
            ([label, pct]) => `
            <div class="term-skill-row">
              <span class="term-skill-label">${label}</span>
              <span class="term-skill-track"><span class="term-skill-fill" style="width:${pct}%"></span></span>
              <span class="term-skill-pct">${pct}%</span>
            </div>`
          )
          .join('');
        this.writeBlock(`
          <div class="term-section-heading">Technical Stack &amp; Disciplines</div>
          <div class="term-skill-list">${rows}</div>
        `);
        break;
      }

      case 'play':
        if (arg === 'kick') {
          this.trigger('kick');
          this.writeLine('<span class="term-accent">› Kick drum triggered</span>');
        } else if (arg === 'snare' || arg === 'rim') {
          this.trigger('rim');
          this.writeLine('<span class="term-accent">› Snare hit triggered</span>');
        } else if (arg === 'hat') {
          this.trigger('hat');
          this.writeLine('<span class="term-accent">› Hi-hat triggered</span>');
        } else if (arg === 'groove') {
          this.sequencer?.start();
          this.writeLine('<span class="term-accent">› Started pocket drum groove</span>');
        } else if (arg === 'stop') {
          this.sequencer?.stop();
          this.writeLine('<span class="term-dim">› Paused drum groove</span>');
        } else {
          this.writeLine('<span class="term-dim">Usage: play [kick | snare | hat | groove | stop]</span>');
        }
        break;

      case 'bpm': {
        const val = Number(arg);
        if (!isNaN(val) && val >= 60 && val <= 220) {
          this.updateBpm?.(val);
          this.trigger('hat', { count: false, strength: 0.52 });
          this.writeLine(`<span class="term-accent">› Tempo set to ${val} BPM</span>`);
        } else {
          this.writeLine('<span class="term-dim">Usage: bpm &lt;60 - 220&gt; (e.g. "bpm 98")</span>');
        }
        break;
      }

      case 'theme':
        if (!arg) {
          this.writeLine(
            '<span class="term-dim">Usage: theme &lt;sunset | dark | ocean | midnight | light | rainforest | blue-gray | deep-dark&gt;</span>'
          );
        } else {
          this.setTheme?.(arg);
          this.writeLine(`<span class="term-accent">› Switched theme to "${this.escape(arg)}"</span>`);
        }
        break;

      case 'globe':
        this.onGlobeAction?.(arg || 'spin');
        this.trigger('kick', { count: false, strength: 0.9 });
        this.writeLine('<span class="term-accent">› Sent a ripple across the stage</span>');
        break;

      case 'ascii':
        if (['spring', 'vortex', 'strike', 'star'].includes(arg)) {
          this.onAsciiMode?.(arg);
          this.writeLine(
            `<span class="term-accent">› Portrait mode set to "${arg.toUpperCase()}"</span>`
          );
        } else {
          this.writeLine('<span class="term-dim">Usage: ascii &lt;spring | vortex | strike | star&gt;</span>');
        }
        break;

      case 'socials':
      case 'contact':
        this.writeKeyValueRows('Connect & Links', [
          ['GitHub', '<a href="https://github.com/rishav-netizen" target="_blank" class="term-link">github.com/rishav-netizen</a>'],
          ['LeetCode', '<a href="https://leetcode.com/u/rishav_leet/" target="_blank" class="term-link">leetcode.com/u/rishav_leet</a>'],
          ['Project Euler', '<a href="https://github.com/rishav-netizen/Project-Euler" target="_blank" class="term-link">github.com/rishav-netizen/Project-Euler</a> (@lichu7_Euler)'],
          ['Email', '<a href="mailto:rishavkumar2k07@gmail.com" class="term-link">rishavkumar2k07@gmail.com</a>'],
        ]);
        break;

      case 'weather':
        this.writeLine(
          '<span class="term-accent">Shimla → Bhubaneswar:</span> Missing the hill air, good evening for a 5K run.'
        );
        break;

      case 'fortune':
      case 'quote': {
        const pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        this.writeLine(`<span class="term-accent">${this.escape(pick)}</span>`);
        break;
      }

      case 'matrix':
      case 'party':
        this.trigger('kick');
        window.setTimeout(() => this.trigger('rim'), 140);
        window.setTimeout(() => this.trigger('hat'), 280);
        this.onGlobeAction?.('spin');
        this.writeLine('<span class="term-accent">⚡ Triggered a jam-pad drum fill!</span>');
        break;

      case 'sudo':
        this.writeLine(
          '<span class="term-error">Root access requires playing Polyphia’s Playing God or running a sub-28 5K.</span>'
        );
        break;

      case 'history':
        this.history.forEach((h, idx) => {
          this.writeLine(`  ${String(idx + 1).padStart(2, '0')}  ${this.escape(h)}`);
        });
        break;

      case 'date':
        this.writeLine(`  ${new Date().toUTCString()}`);
        break;

      case 'pwd':
        this.writeLine('  /Users/rishav/shimla-to-iiit-bh');
        break;

      case 'echo':
        this.writeLine(`  ${this.escape(rest)}`);
        break;

      case 'game':
      case 'arcade':
        this.writeLine('<span class="term-accent">› Opening Mini Arcade...</span>');
        this.onOpenGame?.(arg === 'rhythm' || arg === 'drums' ? 'rhythm' : 'runner');
        break;

      case 'warp':
        this.writeLine('<span class="term-accent">› Jumping to Selected Projects...</span>');
        this.launchWarp?.();
        break;

      case 'clear':
        if (this.container) this.container.innerHTML = '';
        this.printWelcome();
        break;

      case 'exit':
      case 'close':
        this.onCloseDrawer?.();
        break;

      default:
        this.writeLine(
          `<span class="term-error">Unknown command: "${this.escape(raw)}". Try <span class="term-highlight">help</span>, <span class="term-highlight">projects</span>, or <span class="term-highlight">drums</span>.</span>`
        );
        break;
    }
  }

  async handleWhoAmI() {
    const platform =
      navigator.userAgentData?.platform || navigator.platform || 'Client Host';
    const screenRes = `${window.screen?.width || window.innerWidth}×${window.screen?.height || window.innerHeight} (@${(window.devicePixelRatio || 1).toFixed(1)}x DPR)`;
    let timeZone = 'UTC';
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {}
    const localTime = new Date().toLocaleTimeString();
    const browserLang = navigator.languages
      ? navigator.languages.slice(0, 3).join(', ')
      : navigator.language || 'en-US';

    const probeEl = document.createElement('div');
    probeEl.className = 'term-line term-dim';
    probeEl.innerHTML = 'Querying client session & routing info...';
    this.container?.appendChild(probeEl);
    this.scrollBottom();

    let ip = '127.0.0.1';
    let location = 'Local Node';
    let isp = 'Local Interface';
    let ipType = 'IPv4';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://ipwho.is/', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false) {
          ip = data.ip || ip;
          ipType = data.type || (ip.includes(':') ? 'IPv6' : 'IPv4');
          const locParts = [data.city, data.region, data.country].filter(Boolean);
          if (locParts.length > 0) location = locParts.join(', ');
          isp =
            data.connection?.isp || data.connection?.org
              ? `${data.connection?.isp || data.connection?.org}${data.connection?.asn ? ` (AS${data.connection.asn})` : ''}`
              : 'Unknown ISP';
          if (data.timezone?.id) timeZone = data.timezone.id;
        }
      }
    } catch {
      try {
        const fallbackController = new AbortController();
        const fbTimer = setTimeout(() => fallbackController.abort(), 2000);
        const fbRes = await fetch('https://api.ipify.org?format=json', {
          credentials: 'omit',
          signal: fallbackController.signal,
        });
        clearTimeout(fbTimer);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData?.ip) {
            ip = fbData.ip;
            ipType = ip.includes(':') ? 'IPv6' : 'IPv4';
            location = timeZone.replace(/_/g, ' ');
            isp = 'Public Network Route';
          }
        }
      } catch {
        location = `${timeZone} (Local client network)`;
        isp = 'Private / Loopback Gateway';
      }
    }

    probeEl.remove();

    this.writeKeyValueRows('Session & Client Info', [
      ['Client IP', `<span class="term-highlight">${this.escape(ip)}</span> <span class="term-dim">(${this.escape(ipType)})</span>`],
      ['Location', this.escape(location)],
      ['Network / ISP', this.escape(isp)],
      ['System', `${this.escape(platform)} · ${this.escape(browserLang)}`],
      ['Viewport', this.escape(screenRes)],
      ['Local Time', `${this.escape(localTime)} (${this.escape(timeZone)})`],
      ['Session', '<span class="term-accent">Guest Explorer</span> (Read-Only Shell)'],
    ]);
    this.scrollBottom();
  }

  escape(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

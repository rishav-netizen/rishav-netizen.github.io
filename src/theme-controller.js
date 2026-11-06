const STORAGE_KEY = 'rhythm-dev-theme';
const THEMES = ['sunset', 'dark', 'ocean', 'light', 'midnight', 'rainforest', 'blue-gray', 'deep-dark'];

export class ThemeController {
  constructor({ button, menu, quickButtons = [], onChange } = {}) {
    this.button = button;
    this.menu = menu;
    this.options = [...(menu?.querySelectorAll('[data-set-theme]') || [])];
    this.quickButtons = [...quickButtons];
    this.onChange = onChange;
    this.theme = this.readStoredTheme() || document.documentElement.dataset.theme || 'sunset';
    this.apply(this.theme, false);
    this.bind();
  }

  readStoredTheme() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  bind() {
    this.button?.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = !this.menu?.classList.contains('open');
      this.menu?.classList.toggle('open', willOpen);
      this.button?.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        this.options.find((option) => option.dataset.setTheme === this.theme)?.focus();
      }
    });

    this.options.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        this.apply(option.dataset.setTheme);
        this.close();
      });
      option.setAttribute('role', 'menuitemradio');
    });

    this.quickButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.apply(btn.dataset.quickTheme);
      });
    });

    window.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.menu?.classList.contains('open')) {
        this.close();
        this.button?.focus();
      }
    });
  }

  close() {
    this.menu?.classList.remove('open');
    this.button?.setAttribute('aria-expanded', 'false');
  }

  apply(theme, notify = true) {
    if (!THEMES.includes(theme)) theme = 'sunset';
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    this.options.forEach((option) => {
      const active = option.dataset.setTheme === theme;
      option.classList.toggle('active', active);
      option.setAttribute('aria-checked', String(active));
      const check = option.querySelector('.check');
      if (check) check.textContent = active ? '✓' : '';
    });

    this.quickButtons.forEach((btn) => {
      const active = btn.dataset.quickTheme === theme;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies when storage is unavailable.
    }

    if (notify) this.onChange?.(theme);
  }
}

export { THEMES };

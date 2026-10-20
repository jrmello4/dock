import { PetType } from './types';

export class DockPetController {
  private el: HTMLElement;
  private spriteEl: HTMLElement;
  private bubbleEl: HTMLElement;
  private x = 80;
  private dir: 1 | -1 = 1;
  private frame = 0;
  private petType: PetType = 'cat';
  private cpuUsage = 24;
  private moodTimer: number | null = null;
  private rafId: number | null = null;
  private lastStepTime = 0;
  private barWidth = 640;

  constructor(host: HTMLElement, onPetClick: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'dock-pet';
    this.el.title = 'Clique para interagir com o mascote!';

    this.bubbleEl = document.createElement('span');
    this.bubbleEl.className = 'pet-bubble';
    this.bubbleEl.textContent = '♥';

    this.spriteEl = document.createElement('div');
    this.spriteEl.className = 'pet-sprite';

    this.el.appendChild(this.bubbleEl);
    this.el.appendChild(this.spriteEl);
    host.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerAffection();
      onPetClick();
    });

    this.renderSvg();
    this.startLoop();
  }

  public updateConfig(petType: PetType, cpuUsage: number, barWidth: number): void {
    this.petType = petType;
    this.cpuUsage = cpuUsage;
    this.barWidth = Math.max(220, barWidth - 48);
    if (this.x > this.barWidth) this.x = this.barWidth - 24;

    if (petType === 'none') {
      this.el.style.display = 'none';
    } else {
      this.el.style.display = 'flex';
      this.renderSvg();
    }
  }

  public triggerAffection(): void {
    const reactions = ['♥', '★', 'Purr~', '⚡', 'Miaau!', '♪'];
    this.bubbleEl.textContent = reactions[Math.floor(Math.random() * reactions.length)];
    this.bubbleEl.classList.add('show');
    this.el.classList.add('jump');
    if (this.moodTimer) window.clearTimeout(this.moodTimer);
    this.moodTimer = window.setTimeout(() => {
      this.bubbleEl.classList.remove('show');
      this.el.classList.remove('jump');
    }, 1200);
  }

  private getActivityMode(): 'stroll' | 'walk' | 'run' {
    if (this.cpuUsage > 55) return 'run';
    if (this.cpuUsage > 25) return 'walk';
    return 'stroll';
  }

  private startLoop(): void {
    const step = (now: number) => {
      if (this.petType !== 'none') {
        const mode = this.getActivityMode();
        // Always keeps moving along the dock bar!
        const speedPxPerFrame = mode === 'run' ? 2.1 : mode === 'walk' ? 1.15 : 0.72;

        this.x += speedPxPerFrame * this.dir;
        if (this.x >= this.barWidth) {
          this.x = this.barWidth;
          this.dir = -1;
        } else if (this.x <= 18) {
          this.x = 18;
          this.dir = 1;
        }

        const frameInterval = mode === 'run' ? 95 : mode === 'walk' ? 150 : 210;
        if (now - this.lastStepTime > frameInterval) {
          this.frame = (this.frame + 1) % 4;
          this.lastStepTime = now;
          this.renderSvg();
        }

        this.el.style.transform = `translate3d(${Math.round(this.x)}px, 0, 0)`;
        this.spriteEl.style.transform = `scaleX(${this.dir})`;
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private renderSvg(): void {
    const mode = this.getActivityMode();
    const phases = [-2.5, 0, 2.5, 0];
    const legOffset = phases[this.frame];
    const bounceY = this.frame % 2 === 0 ? 0 : -2;
    const tailWag = this.frame < 2 ? 9 : 15;

    if (this.petType === 'cat') {
      this.spriteEl.innerHTML = `
        <svg viewBox="0 0 36 28" width="36" height="28">
          <g transform="translate(0, ${bounceY})">
            <path d="M5 18 Q1 ${tailWag} 6 8" stroke="#f97316" stroke-width="3" fill="none" stroke-linecap="round"/>
            <rect x="8" y="12" width="16" height="10" rx="5" fill="#fb923c"/>
            <circle cx="24" cy="12" r="6.5" fill="#fb923c"/>
            <polygon points="19,8 21,2 24,7" fill="#ea580c"/>
            <polygon points="24,7 28,2 29,8" fill="#ea580c"/>
            <circle cx="24.5" cy="11.5" r="1.35" fill="#1e1b4b"/>
            <circle cx="28.2" cy="11.5" r="1.35" fill="#1e1b4b"/>
            <circle cx="26.8" cy="13.4" r="0.9" fill="#fda4af"/>
            <line x1="${11 + legOffset}" y1="21" x2="${11 - legOffset}" y2="26.5" stroke="#ea580c" stroke-width="2.6" stroke-linecap="round"/>
            <line x1="${15 - legOffset}" y1="21" x2="${15 + legOffset}" y2="26.5" stroke="#fb923c" stroke-width="2.6" stroke-linecap="round"/>
            <line x1="${19 + legOffset}" y1="21" x2="${19 - legOffset}" y2="26.5" stroke="#ea580c" stroke-width="2.6" stroke-linecap="round"/>
            <line x1="${22 - legOffset}" y1="21" x2="${22 + legOffset}" y2="26.5" stroke="#fb923c" stroke-width="2.6" stroke-linecap="round"/>
          </g>
        </svg>`;
    } else if (this.petType === 'dog') {
      this.spriteEl.innerHTML = `
        <svg viewBox="0 0 36 28" width="36" height="28">
          <g transform="translate(0, ${bounceY})">
            <path d="M6 15 Q2 ${tailWag} 5 7" stroke="#d97706" stroke-width="3" fill="none" stroke-linecap="round"/>
            <rect x="8" y="12" width="16" height="10" rx="4.5" fill="#fbbf24"/>
            <circle cx="24" cy="11.5" r="6" fill="#fbbf24"/>
            <rect x="25" y="10" width="6.5" height="4.5" rx="2.2" fill="#fde68a"/>
            <circle cx="30.5" cy="11.2" r="1.3" fill="#1f2937"/>
            <ellipse cx="20.5" cy="12.5" rx="2.2" ry="4.2" fill="#b45309"/>
            <circle cx="25.5" cy="9.8" r="1.35" fill="#1f2937"/>
            <line x1="${11 + legOffset}" y1="21" x2="${11 - legOffset}" y2="26.5" stroke="#d97706" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="${21 - legOffset}" y1="21" x2="${21 + legOffset}" y2="26.5" stroke="#d97706" stroke-width="2.8" stroke-linecap="round"/>
          </g>
        </svg>`;
    } else if (this.petType === 'dragon') {
      this.spriteEl.innerHTML = `
        <svg viewBox="0 0 38 28" width="38" height="28">
          <g transform="translate(0, ${bounceY})">
            <path d="M14 13 L8 ${this.frame % 2 === 0 ? 2 : 9} L19 10 Z" fill="#a855f7" opacity="0.92"/>
            <path d="M4 19 L9 17 L9 21 Z" fill="#10b981"/>
            <rect x="8" y="12" width="16" height="10" rx="5" fill="#10b981"/>
            <rect x="20" y="6" width="11" height="9" rx="4" fill="#10b981"/>
            <polygon points="21,6 19,1 24,5" fill="#facc15"/>
            <circle cx="27.5" cy="9.8" r="1.4" fill="#fef08a"/>
            ${mode === 'run' || this.frame === 0 ? '<path d="M31 11 Q36 9 37 12 Q35 14 31 12" fill="#f97316"/>' : ''}
            <line x1="${12 + legOffset}" y1="21" x2="${12 - legOffset}" y2="26.5" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
            <line x1="${20 - legOffset}" y1="21" x2="${20 + legOffset}" y2="26.5" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
          </g>
        </svg>`;
    } else if (this.petType === 'ghost') {
      const floatY = this.frame % 2 === 0 ? -2.5 : 1.5;
      this.spriteEl.innerHTML = `
        <svg viewBox="0 0 32 28" width="32" height="28">
          <g transform="translate(0, ${floatY})">
            <path d="M8 14 A8 8 0 0 1 24 14 L24 24 L21 21.5 L18 24 L16 21.5 L14 24 L11 21.5 L8 24 Z" fill="#f8fafc" fill-opacity="0.94" stroke="#38bdf8" stroke-width="1.2"/>
            <circle cx="14.5" cy="13.5" r="1.5" fill="#0f172a"/>
            <circle cx="19.5" cy="13.5" r="1.5" fill="#0f172a"/>
            <ellipse cx="17" cy="16.5" rx="1.6" ry="1.1" fill="#f43f5e" opacity="0.65"/>
          </g>
        </svg>`;
    }
  }
}

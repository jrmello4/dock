import { gameState, DashboardTab } from './services/gameState';
import { raceEngine } from './engine/raceEngine';
import { soundService } from './services/soundService';
import {
  renderF1CarSvg,
  renderOvrRingSvg,
  renderTrackMiniSvg,
  renderCompatibilityGaugeSvg,
  renderTireBadge,
} from './ui/f1CarWidget';
import { icon, renderFlagSvg, getRatingTier, LucideIconName } from './ui/icons';
import { TrackCanvasRenderer } from './ui/trackCanvas';
import { CarDevelopment, ERSMode, PaceStrategy, Team, TireCompound } from './models/types';

export type TeamSortMode = 'CAR' | 'BUDGET' | 'DIFFICULTY';

export class AppUI {
  private root: HTMLElement;
  private searchFilter = '';
  private engineFilter = 'ALL';
  private sortMode: TeamSortMode = 'CAR';
  private mobileDrawerOpen = false;
  private isTabTransitioning = false;
  private previousAnimatedValues: Map<string, number> = new Map();

  private marketTransferSlot: string | null = null;
  private academyPromoteSlot: string | null = null;

  // Controle da corrida ao vivo (idêntico ao MatchScreen do Brasfoot Reborn)
  private raceTimer: number | null = null;
  private racePaused = false;
  private raceSpeedMs = 950;
  private trackRenderer: TrackCanvasRenderer | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    gameState.subscribe(() => this.render());
  }

  public init() {
    this.render();
  }

  private showToast(msg: string) {
    const existing = document.querySelector('.toast-banner');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'toast-banner';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  private formatMoney(val: number): string {
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    }
    return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  }

  /**
   * Calcula a Dificuldade da escuderia com base no rating do carro e orçamento
   */
  private getTeamDifficulty(team: Team): {
    label: 'Fácil' | 'Média' | 'Difícil';
    cssClass: string;
    rank: number;
  } {
    const carOvr = gameState.getCarOverall(team);
    const score = carOvr * 0.7 + (team.budget / 1_000_000) * 0.6;
    if (score >= 92) {
      return { label: 'Fácil', cssClass: 'diff-easy', rank: 1 };
    }
    if (score >= 80) {
      return { label: 'Média', cssClass: 'diff-medium', rank: 2 };
    }
    return { label: 'Difícil', cssClass: 'diff-hard', rank: 3 };
  }

  private getDriverInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  public render() {
    if (gameState.screen !== 'LIVE_RACE') {
      this.stopRaceLoop();
    }

    if (gameState.screen === 'HOME') {
      this.renderHomeScreen();
    } else if (gameState.screen === 'DASHBOARD') {
      this.renderDashboardScreen();
    } else if (gameState.screen === 'QUALIFYING') {
      this.renderQualifyingScreen();
    } else if (gameState.screen === 'LIVE_RACE') {
      this.renderLiveRaceScreen();
    }

    this.runNumberAnimations();
  }

  /**
   * Anima números que mudam (orçamento, OVR, sinergia) em 400ms respeitando prefers-reduced-motion
   */
  private runNumberAnimations() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.root.querySelectorAll<HTMLElement>('[data-animate-money]').forEach((el) => {
      const key = el.dataset.animKey || 'money-default';
      const target = Number(el.dataset.animateMoney || 0);
      const prev = this.previousAnimatedValues.get(key);
      this.previousAnimatedValues.set(key, target);

      if (prev === undefined || prev === target) return;
      const start = performance.now();
      const duration = 400;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = prev + (target - prev) * eased;
        el.textContent = this.formatMoney(current);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // =========================================================================
  // 1. TELA 1 — "Escolha sua Escuderia para 2026"
  // =========================================================================
  private renderHomeScreen() {
    // <!-- CONECTAR DADO REAL: gameState.listarSaves() e gameState.teams -->
    const saves = gameState.listarSaves();
    const allTeams = gameState.teams;

    // Contagem de motores para os chips da sidebar
    const engineCounts = new Map<string, number>();
    allTeams.forEach((t) => {
      engineCounts.set(t.engineSupplier, (engineCounts.get(t.engineSupplier) || 0) + 1);
    });
    const engines = ['ALL', ...Array.from(engineCounts.keys())];

    // Filtro por busca textual e fornecedor de motor
    const filteredTeams = allTeams
      .filter((t) => {
        if (
          this.searchFilter &&
          !t.name.toLowerCase().includes(this.searchFilter.toLowerCase()) &&
          !t.fullName.toLowerCase().includes(this.searchFilter.toLowerCase())
        ) {
          return false;
        }
        if (this.engineFilter !== 'ALL' && t.engineSupplier !== this.engineFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (this.sortMode === 'BUDGET') return b.budget - a.budget;
        if (this.sortMode === 'DIFFICULTY') {
          return this.getTeamDifficulty(b).rank - this.getTeamDifficulty(a).rank;
        }
        return gameState.getCarOverall(b) - gameState.getCarOverall(a);
      });

    // Save em destaque no topo da sidebar (ação mais provável de quem volta ao jogo)
    const featuredSave = saves[0] ?? null;
    const featuredTeam = featuredSave
      ? allTeams.find((t) => t.id === featuredSave.myTeamId) ?? allTeams.find((t) => t.id === 'alpine')!
      : allTeams.find((t) => t.id === 'alpine')!;

    this.root.innerHTML = `
      <div class="mobile-backdrop ${this.mobileDrawerOpen ? 'drawer-open' : ''}" id="mobile-drawer-backdrop"></div>
      <div class="home-layout">
        <!-- SIDEBAR FIXA (280px) -->
        <aside class="home-sidebar ${this.mobileDrawerOpen ? 'drawer-open' : ''}" aria-label="Menu Lateral e Filtros">
          <div class="brand-header">
            <div class="logo-badge-lg" aria-hidden="true">F1</div>
            <div>
              <div class="brand-title">APEX GP MANAGER</div>
              <div class="brand-subtitle">SIMULADOR ESTILO BRASFOOT • ${gameState.season}</div>
            </div>
          </div>

          <!-- BLOCO "CARREIRAS SALVAS" NO TOPO DA SIDEBAR -->
          <section class="sidebar-section" aria-label="Carreiras Salvas">
            <div class="sidebar-section-header">
              <span class="label-upper">Carreiras Salvas (${saves.length})</span>
              <button class="btn btn-sm btn-secondary-outline" id="btn-open-save-dialog">
                ${icon('save', 16)}
                <span>Gerenciar</span>
              </button>
            </div>

            ${
              featuredSave
                ? `
                  <!-- CONECTAR DADO REAL: SaveSlotData em destaque (equipe, temporada, GP, orçamento) -->
                  <div class="saved-career-hero-card" style="--team: ${featuredTeam.primaryColor};">
                    <div class="saved-career-meta">
                      <div>
                        <div class="saved-career-team">
                          ${renderFlagSvg(featuredTeam.flag, featuredTeam.country)}
                          <span>${featuredSave.teamName}</span>
                        </div>
                        <div class="saved-career-progress">
                          Temp. ${featuredSave.season} · GP ${featuredSave.currentRound}/12
                        </div>
                      </div>
                      <div class="saved-career-budget tabular" title="Orçamento em caixa">
                        ${this.formatMoney(featuredSave.budget)}
                      </div>
                    </div>
                    <button class="btn btn-primary" style="width:100%;" data-load-slot="${featuredSave.slotId}">
                      ${icon('play', 16)}
                      <span>Continuar</span>
                    </button>
                  </div>
                `
                : `
                  <!-- Estado inicial quando ainda não há save no navegador -->
                  <div class="saved-career-hero-card" style="--team: ${featuredTeam.primaryColor};">
                    <div class="saved-career-meta">
                      <div>
                        <div class="saved-career-team">
                          ${renderFlagSvg(featuredTeam.flag, featuredTeam.country)}
                          <span>${featuredTeam.name}</span>
                        </div>
                        <div class="saved-career-progress">
                          Temp. ${gameState.season} · GP 1/12
                        </div>
                      </div>
                      <div class="saved-career-budget tabular">
                        ${this.formatMoney(featuredTeam.budget)}
                      </div>
                    </div>
                    <button class="btn btn-primary" style="width:100%;" data-start-team="${featuredTeam.id}">
                      ${icon('play', 16)}
                      <span>Continuar</span>
                    </button>
                  </div>
                `
            }
          </section>

          <!-- FILTRO POR MOTOR EM CHIPS COM CONTAGEM E ÍCONE -->
          <section class="sidebar-section" aria-label="Filtrar por Motor">
            <span class="label-upper">Filtrar por Motor / Fornecedor</span>
            <div class="engine-chips-wrap">
              ${engines
                .map((eng) => {
                  const count = eng === 'ALL' ? allTeams.length : engineCounts.get(eng) || 0;
                  const isActive = this.engineFilter === eng;
                  return `
                    <button
                      type="button"
                      class="chip-filter ${isActive ? 'active' : ''}"
                      data-engine="${eng}"
                      aria-pressed="${isActive}"
                    >
                      ${icon('cpu', 15)}
                      <span>${eng === 'ALL' ? 'Todos' : eng}</span>
                      <span class="chip-count">${count}</span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </section>

          <!-- RODAPÉ ALINHADO EMBAIXO -->
          <footer class="sidebar-footer">
            10 escuderias · 20 pilotos · 12 GPs
          </footer>
        </aside>

        <!-- ÁREA PRINCIPAL DA TELA 1 (padding 32px) -->
        <main class="home-main">
          <div class="home-topbar">
            <div style="display:flex;align-items:center;gap:12px;">
              <button
                type="button"
                class="btn btn-icon-only mobile-drawer-toggle"
                id="btn-toggle-home-drawer"
                aria-label="Abrir filtros e saves"
              >
                ${icon('menu', 18)}
              </button>
              <div>
                <h1 class="home-title">Escolha sua Escuderia para ${gameState.season}</h1>
                <p class="home-subtitle">
                  Assuma o Pit Wall, desenvolva o carro na fábrica, negocie pilotos e dispute o Mundial de Fórmula 1.
                </p>
              </div>
            </div>

            <div class="home-controls">
              <div class="search-box">
                ${icon('search', 18)}
                <input
                  type="search"
                  id="team-search-input"
                  class="search-input"
                  placeholder="Buscar equipe (ex: Ferrari, McLaren, Audi)..."
                  aria-label="Buscar equipe"
                  value="${this.searchFilter}"
                />
              </div>

              <select id="team-sort-select" class="sort-select" aria-label="Ordenar equipes por">
                <option value="CAR" ${this.sortMode === 'CAR' ? 'selected' : ''}>Ordenar por: Carro (Nível)</option>
                <option value="BUDGET" ${this.sortMode === 'BUDGET' ? 'selected' : ''}>Ordenar por: Orçamento</option>
                <option value="DIFFICULTY" ${this.sortMode === 'DIFFICULTY' ? 'selected' : ''}>Ordenar por: Dificuldade</option>
              </select>
            </div>
          </div>

          <!-- GRID DE CARDS DE ESCUDERIA (repeat(auto-fill, minmax(280px, 1fr)), gap 20px) -->
          <div class="teams-grid">
            ${filteredTeams
              .map((team) => {
                // <!-- CONECTAR DADO REAL: Pilotos titulares e overall do carro -->
                const drivers = gameState.getTeamDrivers(team.id);
                const carOvr = gameState.getCarOverall(team);
                const carTier = getRatingTier(carOvr);
                const diff = this.getTeamDifficulty(team);

                return `
                  <article
                    class="team-select-card"
                    style="--team: ${team.primaryColor};"
                    data-start-team="${team.id}"
                    tabindex="0"
                    role="button"
                    aria-label="Assumir Comando da ${team.name}"
                  >
                    <!-- Header: Bandeira SVG + Nome 20px Rajdhani + Nome Oficial 12px + Selo Dificuldade -->
                    <header class="team-card-header">
                      <div>
                        <h2 class="team-card-title">
                          ${renderFlagSvg(team.flag, team.country)}
                          <span>${team.name}</span>
                        </h2>
                        <div class="team-card-fullname">${team.fullName}</div>
                      </div>
                      <span class="difficulty-badge ${diff.cssClass}" title="Dificuldade calculada por carro e orçamento">
                        ${icon('gauge', 14)}
                        <span>${diff.label}</span>
                      </span>
                    </header>

                    <!-- Ilustração 2x do Carro (~90px altura) com linhas diagonais e glow --team -->
                    <div class="team-car-showcase">
                      ${renderF1CarSvg(team, 224, 84)}
                    </div>

                    <!-- Linha de Métricas em 3 Colunas: Carro | Orçamento | Motor -->
                    <div class="team-metrics-grid">
                      <div class="team-metric-col">
                        <span class="label-upper">Carro</span>
                        <div class="metric-val-lg" style="color:${carTier.color};">${carOvr}</div>
                        <div class="stat-bar-track" style="height:4px;">
                          <div class="stat-bar-fill" style="width:${carOvr}%;background:${carTier.color};"></div>
                        </div>
                      </div>

                      <div class="team-metric-col">
                        <span class="label-upper">Orçamento</span>
                        <div class="metric-val-lg" style="color:var(--gold);">${this.formatMoney(team.budget)}</div>
                      </div>

                      <div class="team-metric-col">
                        <span class="label-upper">Motor</span>
                        <div class="metric-engine-val">
                          ${icon('cpu', 15)}
                          <span>${team.engineSupplier}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Dupla de Pilotos (2 linhas de 40px com avatar circular --team, bandeira SVG e chip OVR) -->
                    <div class="team-drivers-list">
                      ${drivers
                        .slice(0, 2)
                        .map((d) => {
                          const ovr = gameState.getDriverOverall(d);
                          const tier = getRatingTier(ovr);
                          return `
                            <div class="team-driver-row">
                              <div class="driver-row-left">
                                <span class="driver-mini-avatar">${this.getDriverInitials(d.name)}</span>
                                <span class="driver-row-num">#${d.number}</span>
                                ${renderFlagSvg(d.flag, d.nationality)}
                                <span class="driver-row-name">${d.name}</span>
                              </div>
                              <span class="ovr-chip ${tier.tierClass}" title="Overall ${ovr} (${tier.label})">
                                OVR ${ovr}
                              </span>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>

                    <!-- CTA Outline na cor --team (preenche no hover/foco) -->
                    <button type="button" class="btn-team-cta" data-start-team="${team.id}">
                      <span>Assumir Comando da ${team.name}</span>
                      ${icon('chevron-right', 18)}
                    </button>
                  </article>
                `;
              })
              .join('')}
          </div>
        </main>
      </div>
      ${this.renderSaveDialogHtml()}
    `;

    this.bindHomeEvents();
    this.setupDialogLightDismiss();
  }

  private bindHomeEvents() {
    const searchInput = this.root.querySelector<HTMLInputElement>('#team-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = (e.target as HTMLInputElement).value;
        this.renderHomeScreen();
        const restored = this.root.querySelector<HTMLInputElement>('#team-search-input');
        if (restored) {
          restored.focus();
          restored.setSelectionRange(restored.value.length, restored.value.length);
        }
      });
    }

    const sortSelect = this.root.querySelector<HTMLSelectElement>('#team-sort-select');
    sortSelect?.addEventListener('change', () => {
      this.sortMode = (sortSelect.value as TeamSortMode) || 'CAR';
      this.renderHomeScreen();
    });

    const drawerBtn = this.root.querySelector('#btn-toggle-home-drawer');
    const backdrop = this.root.querySelector('#mobile-drawer-backdrop');
    drawerBtn?.addEventListener('click', () => {
      this.mobileDrawerOpen = !this.mobileDrawerOpen;
      this.renderHomeScreen();
    });
    backdrop?.addEventListener('click', () => {
      this.mobileDrawerOpen = false;
      this.renderHomeScreen();
    });

    this.root.querySelectorAll<HTMLElement>('[data-engine]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engineFilter = btn.dataset.engine || 'ALL';
        this.renderHomeScreen();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-start-team]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const teamId = el.dataset.startTeam;
        if (teamId) {
          this.mobileDrawerOpen = false;
          soundService.playLightsBeep(true);
          gameState.iniciarCarreira(teamId);
        }
      });
      if (el.tagName === 'ARTICLE') {
        el.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter' || ke.key === ' ') {
            ke.preventDefault();
            const teamId = el.dataset.startTeam;
            if (teamId) {
              soundService.playLightsBeep(true);
              gameState.iniciarCarreira(teamId);
            }
          }
        });
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-load-slot]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = btn.dataset.loadSlot;
        if (slot && gameState.carregarJogo(slot)) {
          this.showToast('Carreira carregada com sucesso!');
        }
      });
    });

    const openSaveBtn = this.root.querySelector('#btn-open-save-dialog');
    openSaveBtn?.addEventListener('click', () => {
      const dlg = document.getElementById('saveManagerDialog') as HTMLDialogElement | null;
      dlg?.showModal();
    });
  }

  // =========================================================================
  // 2. TELA 2 — HUB "PILOTOS & SETUP" E DEMAIS ABAS (11 Abas no Nível 2)
  // =========================================================================
  private renderDashboardScreen() {
    const team = gameState.myTeam;
    if (!team) {
      gameState.screen = 'HOME';
      this.renderHomeScreen();
      return;
    }

    // <!-- CONECTAR DADO REAL: Dados da equipe, pista atual, posição nos construtores e compatibilidade de setup -->
    const track = gameState.currentTrack;
    const sortedTeams = [...gameState.teams].sort((a, b) => b.points - a.points || b.wins - a.wins);
    const wccPos = sortedTeams.findIndex((t) => t.id === team.id) + 1;
    const carOvr = gameState.getCarOverall(team);
    const setupCompat = raceEngine.calcularCompatibilidadeSetup(team, track);

    // 11 Abas no Nível 2 com ícones Lucide (stroke 1.75, 18px)
    const tabs: { id: DashboardTab; label: string; iconName: LucideIconName }[] = [
      { id: 'GARAGE', label: 'Pilotos & Setup', iconName: 'sliders-horizontal' },
      { id: 'RD', label: 'Fábrica & P&D', iconName: 'cpu' },
      { id: 'WDC', label: 'Mundial Pilotos', iconName: 'trophy' },
      { id: 'WCC', label: 'Construtores', iconName: 'shield' },
      { id: 'CALENDAR', label: 'Calendário GP', iconName: 'calendar' },
      { id: 'MARKET', label: 'Mercado Pilotos', iconName: 'users' },
      { id: 'ACADEMY', label: 'Academia F2/F3', iconName: 'graduation-cap' },
      { id: 'FINANCE', label: 'Finanças', iconName: 'wallet' },
      { id: 'SPONSORS', label: 'Patrocinadores', iconName: 'award' },
      { id: 'TROPHIES', label: 'Sala de Troféus', iconName: 'medal' },
      { id: 'NEWS', label: 'Feed do Paddock', iconName: 'newspaper' },
    ];

    this.root.innerHTML = `
      <div class="dashboard-shell" style="--team: ${team.primaryColor};">
        <!-- HEADER FIXO (STICKY) DE 2 NÍVEIS -->
        <header class="dash-sticky-shell">
          <!-- Nível 1 (72px): Identidade da Escuderia + Orçamento + Próximo Compromisso + Ações -->
          <div class="dash-header-lvl1">
            <div class="dash-team-identity">
              <button
                type="button"
                class="btn btn-icon-only btn-secondary-outline"
                id="btn-back-home"
                title="Voltar ao Menu Inicial"
                aria-label="Voltar ao Menu Inicial"
              >
                ${icon('menu', 18)}
              </button>

              <div class="header-car-wrap" aria-hidden="true">
                ${renderF1CarSvg(team, 102, 38)}
              </div>

              <div>
                <div class="header-team-name">
                  ${renderFlagSvg(team.flag, team.country)}
                  <span>${team.name}</span>
                  <span class="chip" style="color:var(--text-1);border-color:var(--border-strong);">
                    ${wccPos}º nos Construtores (${team.points} pts)
                  </span>
                </div>
                <div class="header-team-sub">
                  Motor ${team.engineSupplier} · Carro Nível <strong>${carOvr}</strong> · Acerto p/ ${track.name} <strong style="color:var(--green);">${setupCompat}%</strong>
                </div>
              </div>
            </div>

            <div class="dash-kpis">
              <div class="kpi-pill">
                <span class="label">Orçamento em Caixa</span>
                <span
                  class="val"
                  style="color:var(--gold);"
                  data-animate-money="${team.budget}"
                  data-anim-key="header-budget"
                >${this.formatMoney(team.budget)}</span>
              </div>

              <div class="kpi-pill">
                <span class="label">Próximo Compromisso (${gameState.season})</span>
                <span class="val-next-gp">
                  ${
                    gameState.seasonFinished
                      ? `${icon('flag', 16)} <span>Fim da Temporada</span>`
                      : `${renderFlagSvg(track.flag, track.country)} <span>GP ${gameState.currentRound}/12 · ${track.name}</span>`
                  }
                </span>
              </div>

              <button
                type="button"
                class="btn btn-icon-only btn-secondary-outline"
                id="btn-open-save-dialog"
                title="Salvar / Carregar Carreira"
                aria-label="Salvar ou Carregar Carreira"
              >
                ${icon('save', 18)}
              </button>

              ${
                gameState.seasonFinished
                  ? `
                    <button type="button" class="btn btn-primary btn-primary-lg" id="btn-next-season">
                      ${icon('fast-forward', 18)}
                      <span>Iniciar Temporada ${gameState.season + 1}</span>
                    </button>
                  `
                  : `
                    <button type="button" class="btn btn-secondary-outline" id="btn-go-qualifying">
                      ${icon('timer', 18)}
                      <span>Disputar Qualifying (Q1/Q2/Q3)</span>
                    </button>
                    <button type="button" class="btn btn-primary btn-primary-lg" id="btn-go-race-direct">
                      ${icon('flag', 18)}
                      <span>Ir para o GP (${track.laps} Voltas)</span>
                    </button>
                  `
              }
            </div>
          </div>

          <!-- Nível 2 (48px): As 11 Abas com Ícone Lucide + Texto 14px -->
          <div class="dash-tabs-outer">
            <nav class="dash-tabs" role="tablist" aria-label="Seções de Gestão da Escuderia">
              ${tabs
                .map(
                  (t) => `
                <button
                  type="button"
                  class="tab-btn ${gameState.activeTab === t.id ? 'active' : ''}"
                  data-tab="${t.id}"
                  role="tab"
                  aria-selected="${gameState.activeTab === t.id}"
                >
                  ${icon(t.iconName, 18)}
                  <span>${t.label}</span>
                </button>
              `
                )
                .join('')}
            </nav>
          </div>
        </header>

        <!-- CONTEÚDO CENTRALIZADO (max-width 1440px) -->
        <main class="dash-content tab-panel-enter ${this.isTabTransitioning ? 'skeleton-shimmer' : ''}">
          ${this.renderActiveDashboardTab()}
        </main>
      </div>
      ${this.renderSaveDialogHtml()}
    `;

    this.isTabTransitioning = false;
    this.bindDashboardEvents();
    this.setupDialogLightDismiss();
  }

  private renderActiveDashboardTab(): string {
    switch (gameState.activeTab) {
      case 'GARAGE':
        return this.renderTabGarage();
      case 'RD':
        return this.renderTabRD();
      case 'WDC':
        return this.renderTabWDC();
      case 'WCC':
        return this.renderTabWCC();
      case 'CALENDAR':
        return this.renderTabCalendar();
      case 'MARKET':
        return this.renderTabMarket();
      case 'ACADEMY':
        return this.renderTabAcademy();
      case 'FINANCE':
        return this.renderTabFinance();
      case 'SPONSORS':
        return this.renderTabSponsorsOnly();
      case 'TROPHIES':
        return this.renderTabTrophiesAndNews();
      case 'NEWS':
        return this.renderTabNewsOnly();
    }
  }

  // =========================================================================
  // ABA 1: HUB "PILOTOS & SETUP" (Grid de 12 Colunas + Linha Inferior Completa)
  // =========================================================================
  private renderTabGarage(): string {
    // <!-- CONECTAR DADO REAL: Equipe do jogador, pista atual, pilotos e compatibilidade de setup -->
    const team = gameState.myTeam!;
    const track = gameState.currentTrack;
    const drivers = gameState.getTeamDrivers(team.id);
    const setupCompat = raceEngine.calcularCompatibilidadeSetup(team, track);

    // Top 5 do Mundial de Pilotos + meus pilotos destacados para o card inferior (a)
    const allRankedDrivers = [...gameState.drivers]
      .filter((d) => d.teamId !== null)
      .sort(
        (a, b) =>
          b.seasonStats.points - a.seasonStats.points ||
          b.seasonStats.wins - a.seasonStats.wins ||
          gameState.getDriverOverall(b) - gameState.getDriverOverall(a)
      );

    const top5Drivers = allRankedDrivers.slice(0, 5);
    const myDriversNotInTop5 = allRankedDrivers
      .map((d, idx) => ({ driver: d, pos: idx + 1 }))
      .filter((item) => item.driver.teamId === team.id && item.pos > 5);

    // Componentes para o card inferior (b) "Estado do carro"
    const carComponents = [
      { label: 'Aerodinâmica & Asas', val: team.car.aerodynamics },
      { label: 'Unidade de Potência (Motor)', val: team.car.powerUnit },
      { label: 'Chassi & Suspensão', val: team.car.chassis },
      { label: 'Freios & Confiabilidade', val: team.car.reliability },
    ];

    // Últimos 3 eventos para o card inferior (c) "Feed recente"
    const recentNews = gameState.news.slice(0, 3);

    return `
      <div class="hub-grid-12">
        <!-- COLUNA ESQUERDA (7/12): TITULARES NO COCKPIT -->
        <section class="bf-card col-span-7" aria-label="Titulares no Cockpit">
          <div class="section-card-header">
            <div>
              <h2 class="section-card-title">
                ${icon('users', 20)}
                <span>Titulares no Cockpit — ${team.name}</span>
              </h2>
              <p style="font-size:var(--fs-13);color:var(--text-2);margin-top:2px;">
                Gerencie seus pilotos titulares e o acerto aerodinâmico para o próximo Grande Prêmio.
              </p>
            </div>
            ${
              drivers.length >= 2
                ? `
                  <button type="button" class="btn btn-sm btn-secondary-outline" id="btn-swap-drivers">
                    ${icon('arrow-up-down', 16)}
                    <span>Inverter Carro #1 / #2</span>
                  </button>
                `
                : ''
            }
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--sp-16);flex:1;">
            ${drivers
              .map((d) => {
                // <!-- CONECTAR DADO REAL: Driver stats, OVR, potencial, energia e salário -->
                const ovr = gameState.getDriverOverall(d);
                const isCar1 = d.role === 'CAR_1';
                return `
                  <article class="cockpit-driver-card" style="--team: ${team.primaryColor};">
                    <div class="driver-top-grid">
                      <!-- Esquerda: Retrato/Avatar 88px com moldura --team e número Rajdhani 40px -->
                      <div class="driver-portrait-box" aria-hidden="true">
                        <span class="driver-portrait-initials">${this.getDriverInitials(d.name)}</span>
                        <span class="driver-portrait-number">#${d.number}</span>
                      </div>

                      <!-- Centro: Chip CARRO #1/#2, Nome 20px, Bandeira SVG, Idade, Potencial e Energia -->
                      <div class="driver-center-info">
                        <span class="driver-role-chip ${isCar1 ? 'role-car1' : 'role-car2'}">
                          ${isCar1 ? 'CARRO #1 (LÍDER)' : 'CARRO #2'}
                        </span>

                        <div class="driver-name-heading">
                          ${renderFlagSvg(d.flag, d.nationality)}
                          <span>${d.name}</span>
                          <span class="driver-age-label">(${d.age} anos)</span>
                        </div>

                        <div class="driver-sub-metrics">
                          <span style="display:inline-flex;align-items:center;gap:4px;color:var(--text-2);">
                            ${icon('trending-up', 15)}
                            <span>Potencial <strong style="color:var(--text-1);">${d.potential}</strong></span>
                          </span>

                          <span class="driver-energy-inline">
                            <span>Energia <strong style="color:var(--green);">${d.fitness}%</strong></span>
                            <span class="energy-mini-bar" aria-hidden="true">
                              <span class="energy-mini-fill" style="width:${d.fitness}%;"></span>
                            </span>
                          </span>
                        </div>
                      </div>

                      <!-- Direita: OVR dentro de um anel circular SVG de 72px -->
                      ${renderOvrRingSvg(ovr)}
                    </div>

                    <!-- Abaixo: 5 Atributos em grade de 5 colunas (cor da barra pelo VALOR) -->
                    <div class="driver-attrs-grid">
                      ${this.renderSemanticStat('Ritmo', d.stats.pace)}
                      ${this.renderSemanticStat('Ultrapassagem', d.stats.racecraft)}
                      ${this.renderSemanticStat('Consistência', d.stats.consistency)}
                      ${this.renderSemanticStat('Gestão Pneus', d.stats.tireMgmt)}
                      ${this.renderSemanticStat('Chuva', d.stats.wetSkill)}
                    </div>

                    <!-- Rodapé: Estatísticas da temporada à esquerda e Salário/GP em dourado à direita -->
                    <footer class="driver-card-footer">
                      <span>
                        Temporada: <strong style="color:var(--text-1);">${d.seasonStats.points} pts</strong>
                        (${d.seasonStats.wins} vitórias, ${d.seasonStats.podiums} pódios, ${d.seasonStats.poles} poles)
                      </span>
                      <span>
                        Salário/GP: <strong style="color:var(--gold);">${this.formatMoney(d.salary)}</strong>
                      </span>
                    </footer>
                  </article>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- COLUNA DIREITA (5/12): CARD "PRÓXIMA ETAPA" + CARD "ACERTO MECÂNICO" -->
        <div class="col-span-5">
          <!-- Card "Próxima etapa" com miniatura SVG do circuito -->
          <section class="bf-card bf-card-glow" aria-label="Próxima Etapa">
            <div class="next-stage-top">
              <div>
                <div class="label-upper" style="color:var(--green);">
                  Próxima Etapa · Rodada ${track.round}/12
                </div>
                <h3 class="section-card-title" style="margin-top:4px;">
                  ${renderFlagSvg(track.flag, track.country)}
                  <span>${track.name}</span>
                </h3>
                <div style="font-size:var(--fs-13);color:var(--text-2);margin-top:2px;">
                  ${track.circuitName} · <strong>${track.laps} voltas</strong>
                </div>
                <div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:var(--blue);font-size:var(--fs-13);font-weight:600;">
                  ${icon('cloud-rain', 16)}
                  <span>Chance de chuva ${track.rainProbability}%</span>
                </div>
              </div>

              <!-- Miniatura SVG do traçado do circuito em verde translúcido -->
              <div class="track-mini-box">
                ${renderTrackMiniSvg(track.svgPoints, 132, 80)}
              </div>
            </div>

            <!-- 3 Métricas como mini-gauges/barras com rótulo 12px e valor 16px -->
            <div class="track-demands-grid">
              <div class="demand-gauge-card">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span style="font-size:var(--fs-12);color:var(--text-2);">Exigência Aero</span>
                  <span class="demand-val">${Math.round(track.aeroWeight * 100)}%</span>
                </div>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width:${Math.min(100, Math.round(track.aeroWeight * 180))}%;background:var(--blue);"></div>
                </div>
              </div>

              <div class="demand-gauge-card">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span style="font-size:var(--fs-12);color:var(--text-2);">Exigência Motor</span>
                  <span class="demand-val">${Math.round(track.powerWeight * 100)}%</span>
                </div>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width:${Math.min(100, Math.round(track.powerWeight * 180))}%;background:var(--green);"></div>
                </div>
              </div>

              <div class="demand-gauge-card">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span style="font-size:var(--fs-12);color:var(--text-2);">Desgaste Pneus</span>
                  <span class="demand-val">${track.tireWearFactor.toFixed(2)}x</span>
                </div>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width:${Math.min(100, Math.round((track.tireWearFactor / 1.4) * 100))}%;background:var(--orange);"></div>
                </div>
              </div>
            </div>
          </section>

          <!-- Card "Acerto Mecânico" com Gauge Semicircular e Sliders com Marca Fantasma -->
          <section class="bf-card" style="flex:1;" aria-label="Acerto Mecânico">
            <div class="setup-header-row">
              <div>
                <h3 class="section-card-title">
                  ${icon('sliders-horizontal', 18)}
                  <span>Acerto Mecânico (Setup)</span>
                </h3>
                <p style="font-size:var(--fs-12);color:var(--text-2);">
                  Ajuste asas e suspensão para a exigência do traçado.
                </p>
              </div>
              <button type="button" class="btn btn-sm btn-secondary-outline" id="btn-auto-setup">
                ${icon('wand-sparkles', 16)}
                <span>Aplicar Setup do Engenheiro</span>
              </button>
            </div>

            <div class="setup-gauge-banner">
              <div>
                <div class="label-upper">Compatibilidade Atual</div>
                <div style="font-size:var(--fs-13);color:var(--text-2);margin-top:4px;">
                  Meta sugerida pelo engenheiro-chefe: Asa <strong>Nível ${track.idealWing}</strong> · Suspensão <strong>Nível ${track.idealSuspension}</strong>.
                </div>
              </div>
              ${renderCompatibilityGaugeSvg(setupCompat)}
            </div>

            <div class="setup-sliders-stack">
              ${this.renderCustomSetupSlider({
                id: 'setup-front-wing',
                label: 'Ângulo da Asa Dianteira',
                leftPole: 'Reta (Baixo Arrasto)',
                rightPole: 'Curvas (Alto Downforce)',
                currentVal: team.setup.frontWing,
                idealVal: track.idealWing,
              })}

              ${this.renderCustomSetupSlider({
                id: 'setup-rear-wing',
                label: 'Ângulo da Asa Traseira',
                leftPole: 'Reta (Velocidade Final)',
                rightPole: 'Curvas (Estabilidade)',
                currentVal: team.setup.rearWing,
                idealVal: track.idealWing,
              })}

              ${this.renderCustomSetupSlider({
                id: 'setup-suspension',
                label: 'Rigidez da Suspensão',
                leftPole: 'Macia / Zebras',
                rightPole: 'Rígida / Reativa',
                currentVal: team.setup.suspension,
                idealVal: track.idealSuspension,
              })}
            </div>
          </section>
        </div>

        <!-- LINHA INFERIOR (3 CARDS IGUAIS, 4/12 CADA) PARA PREENCHER A TELA INTEIRA -->

        <!-- (a) Classificação Resumida (4/12) -->
        <section class="bf-card col-span-4" aria-label="Classificação Resumida">
          <div class="section-card-header">
            <h3 class="section-card-title">
              ${icon('trophy', 18)}
              <span>Classificação Resumida</span>
            </h3>
            <button type="button" class="btn btn-sm btn-secondary-outline" data-goto-tab="WDC">
              <span>Ver WDC</span>
              ${icon('arrow-up-right', 15)}
            </button>
          </div>

          <div class="mini-list-stack">
            ${top5Drivers
              .map((d, idx) => {
                const t = gameState.teams.find((x) => x.id === d.teamId);
                const isMine = d.teamId === team.id;
                return `
                  <div class="mini-standing-row ${isMine ? 'is-mine' : ''}">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <strong class="font-display" style="font-size:var(--fs-16);width:24px;color:${
                        idx === 0 ? 'var(--gold)' : 'var(--text-2)'
                      };">${idx + 1}º</strong>
                      ${renderFlagSvg(d.flag, d.nationality)}
                      <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.name}</span>
                      <span style="font-size:var(--fs-12);color:var(--text-3);">(${t?.name ?? ''})</span>
                    </div>
                    <strong class="font-display" style="font-size:var(--fs-16);color:var(--green);">${d.seasonStats.points} pts</strong>
                  </div>
                `;
              })
              .join('')}

            ${myDriversNotInTop5
              .map(
                ({ driver: d, pos }) => `
                  <div class="mini-standing-row is-mine">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <strong class="font-display" style="font-size:var(--fs-16);width:24px;color:var(--green);">${pos}º</strong>
                      ${renderFlagSvg(d.flag, d.nationality)}
                      <span style="font-weight:600;">${d.name}</span>
                      <span class="chip" style="padding:1px 6px;">Seu Piloto</span>
                    </div>
                    <strong class="font-display" style="font-size:var(--fs-16);color:var(--green);">${d.seasonStats.points} pts</strong>
                  </div>
                `
              )
              .join('')}
          </div>
        </section>

        <!-- (b) Estado do Carro & Performance por Componente (4/12) -->
        <section class="bf-card col-span-4" aria-label="Estado do Carro">
          <div class="section-card-header">
            <h3 class="section-card-title">
              ${icon('cpu', 18)}
              <span>Estado do Carro</span>
            </h3>
            <button type="button" class="btn btn-sm btn-secondary-outline" data-goto-tab="RD">
              <span>Fábrica & P&D</span>
              ${icon('arrow-up-right', 15)}
            </button>
          </div>

          <div class="mini-list-stack" style="justify-content:space-between;">
            ${carComponents
              .map((comp) => {
                const tier = getRatingTier(comp.val);
                return `
                  <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-inner);padding:10px 12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                      <span style="font-size:var(--fs-13);font-weight:500;color:var(--text-2);">${comp.label}</span>
                      <strong class="font-display" style="font-size:var(--fs-16);color:${tier.color};">${comp.val}/99</strong>
                    </div>
                    <div class="stat-bar-track">
                      <div class="stat-bar-fill" style="width:${comp.val}%;background:${tier.color};"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- (c) Feed Recente do Paddock (4/12) -->
        <section class="bf-card col-span-4" aria-label="Feed Recente">
          <div class="section-card-header">
            <h3 class="section-card-title">
              ${icon('newspaper', 18)}
              <span>Feed Recente</span>
            </h3>
            <button type="button" class="btn btn-sm btn-secondary-outline" data-goto-tab="NEWS">
              <span>Ver Todos</span>
              ${icon('arrow-up-right', 15)}
            </button>
          </div>

          <div class="mini-list-stack">
            ${
              recentNews.length === 0
                ? `<div style="color:var(--text-3);font-size:var(--fs-13);padding:12px 0;">Nenhum comunicado registrado ainda.</div>`
                : recentNews
                    .map(
                      (n) => `
                  <article style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-inner);padding:10px 12px;display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;justify-content:space-between;font-size:var(--fs-12);color:var(--blue);font-weight:600;">
                      <span>${n.category}</span>
                      <span style="color:var(--text-3);">Temp. ${n.season} · GP ${n.round}</span>
                    </div>
                    <div style="font-size:var(--fs-13);font-weight:600;color:var(--text-1);">${n.title}</div>
                    <div style="font-size:var(--fs-12);color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                      ${n.body}
                    </div>
                  </article>
                `
                    )
                    .join('')
            }
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Renderiza um atributo individual do piloto onde a COR DA BARRA depende exclusivamente do VALOR:
   * >=90 dourado (#FFC83D), 85-89 verde (#00E58A), 80-84 azul (#3DA9FF), <80 cinza (#7D8BA5)
   */
  private renderSemanticStat(label: string, val: number): string {
    const tier = getRatingTier(val);
    return `
      <div class="driver-attr-box">
        <div class="driver-attr-top">
          <span class="driver-attr-label" title="${label}">${label}</span>
          <strong class="driver-attr-val" style="color:${tier.color};">${val}</strong>
        </div>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:${val}%;background:${tier.color};"></div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza slider customizado de Setup com marca fantasma do valor ideal sugerido pelo engenheiro
   */
  private renderCustomSetupSlider(opts: {
    id: string;
    label: string;
    leftPole: string;
    rightPole: string;
    currentVal: number;
    idealVal: number;
  }): string {
    const ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return `
      <div class="setup-slider-block">
        <div class="slider-top-row">
          <label for="${opts.id}" style="font-size:var(--fs-13);font-weight:600;color:var(--text-1);">
            ${opts.label}
          </label>
          <span class="chip" style="color:var(--text-1);border-color:var(--border-strong);font-weight:700;">
            Nível <strong id="${opts.id}-val-chip" style="color:var(--green);">${opts.currentVal}</strong>
          </span>
        </div>

        <div class="slider-pole-labels">
          <span>← ${opts.leftPole}</span>
          <span>${opts.rightPole} →</span>
        </div>

        <div class="slider-track-container">
          <div
            class="engineer-ghost-mark"
            style="left: calc(10px + (100% - 20px) * ${(opts.idealVal - 1) / 9});"
            title="Sugestão do Engenheiro: Nível ${opts.idealVal}"
          ></div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value="${opts.currentVal}"
            id="${opts.id}"
            class="f1-range-input"
          />
        </div>

        <div class="slider-ticks" aria-hidden="true">
          ${ticks
            .map(
              (n) => `<span class="${n === opts.idealVal ? 'is-ideal' : ''}" title="${n === opts.idealVal ? 'Ideal sugerido' : ''}">${n}</span>`
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // --- ABA 2: FÁBRICA & P&D DO CARRO ---
  private renderTabRD(): string {
    const team = gameState.myTeam!;
    const depts: { key: keyof CarDevelopment; title: string; desc: string; iconName: LucideIconName }[] = [
      {
        key: 'aerodynamics',
        title: 'Túnel de Vento & Aerodinâmica',
        desc: 'Aumenta a velocidade em curvas de média e alta velocidade e eficiência do DRS.',
        iconName: 'gauge',
      },
      {
        key: 'powerUnit',
        title: 'Unidade de Potência (ICE + MGU-K)',
        desc: 'Aumenta a velocidade final nas retas e a capacidade de retomada no modo Overtake.',
        iconName: 'zap',
      },
      {
        key: 'chassis',
        title: 'Chassi Monocoque & Suspensão',
        desc: 'Melhora a tração em curvas lentas (como Mônaco e Singapura) e preserva os pneus.',
        iconName: 'sliders-horizontal',
      },
      {
        key: 'reliability',
        title: 'Confiabilidade & Arrefecimento',
        desc: 'Reduz drasticamente o risco de quebras de motor ou câmbio durante a corrida.',
        iconName: 'shield',
      },
      {
        key: 'pitCrew',
        title: 'Equipe de Box & Pistolas Pneumáticas',
        desc: 'Reduz o tempo parado no Pit Stop para ~2.1s e evita falhas de roda presa.',
        iconName: 'wrench',
      },
    ];

    return `
      <div class="bf-card" style="margin-bottom:var(--sp-20);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 class="section-card-title">${icon('cpu', 20)} <span>Centro Tecnológico de P&D — Sede em ${team.baseCity}</span></h2>
          <p style="font-size:var(--fs-13);color:var(--text-2);">Invista o orçamento da equipe para evoluir o carro ao longo da temporada.</p>
        </div>
        <div class="font-display" style="font-size:var(--fs-20);color:var(--gold);">
          Saldo Disponível para Engenharia: ${this.formatMoney(team.budget)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:var(--sp-20);">
        ${depts
          .map((d) => {
            const val = team.car[d.key];
            const tier = getRatingTier(val);
            const cost = gameState.calcularCustoUpgradeCarro(val);
            const canAfford = team.budget >= cost && val < 99;
            return `
              <div class="bf-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:16px;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:var(--fs-16);font-weight:700;display:flex;align-items:center;gap:8px;">
                      ${icon(d.iconName, 18)}
                      <span>${d.title}</span>
                    </span>
                    <span class="font-display" style="font-size:var(--fs-20);color:${tier.color};">${val}/99</span>
                  </div>
                  <p style="font-size:var(--fs-13);color:var(--text-2);margin-bottom:12px;">${d.desc}</p>
                  <div class="stat-bar-track" style="height:8px;">
                    <div class="stat-bar-fill" style="width:${val}%;background:${tier.color};"></div>
                  </div>
                </div>

                <button class="btn ${canAfford ? 'btn-primary' : ''}" data-upgrade-dept="${d.key}" ${!canAfford ? 'disabled' : ''} style="width:100%;">
                  ${val >= 99 ? 'Nível Máximo Atingido' : `Desenvolver Especificação (${this.formatMoney(cost)})`}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  // --- ABA 3: CAMPEONATO MUNDIAL DE PILOTOS (WDC) ---
  private renderTabWDC(): string {
    const drivers = [...gameState.drivers]
      .filter((d) => d.teamId !== null)
      .sort(
        (a, b) =>
          b.seasonStats.points - a.seasonStats.points ||
          b.seasonStats.wins - a.seasonStats.wins ||
          b.seasonStats.podiums - a.seasonStats.podiums
      );

    return `
      <div class="bf-card">
        <h2 class="section-card-title" style="margin-bottom:16px;">
          ${icon('trophy', 20)}
          <span>Classificação do Mundial de Pilotos (WDC ${gameState.season})</span>
        </h2>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Piloto</th>
                <th>Escuderia</th>
                <th>OVR</th>
                <th>Vitórias</th>
                <th>Pódios</th>
                <th>Poles</th>
                <th>Voltas Rápidas</th>
                <th>DNFs</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              ${drivers
                .map((d, idx) => {
                  const t = gameState.teams.find((x) => x.id === d.teamId);
                  const isMine = d.teamId === gameState.myTeamId;
                  const ovr = gameState.getDriverOverall(d);
                  const tier = getRatingTier(ovr);
                  return `
                    <tr class="${isMine ? 'my-team-row' : ''}">
                      <td class="font-display" style="font-size:var(--fs-16);color:${
                        idx === 0 ? 'var(--gold)' : idx < 3 ? 'var(--green)' : 'var(--text-2)'
                      };">${idx + 1}º</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <strong class="font-display">#${d.number}</strong>
                          ${renderFlagSvg(d.flag, d.nationality)}
                          <strong>${d.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${
                          t?.primaryColor ?? '#fff'
                        };margin-right:6px;"></span>
                        ${t?.name ?? '—'}
                      </td>
                      <td><span class="ovr-chip ${tier.tierClass}">${ovr}</span></td>
                      <td>${d.seasonStats.wins}</td>
                      <td>${d.seasonStats.podiums}</td>
                      <td>${d.seasonStats.poles}</td>
                      <td>${d.seasonStats.fastestLaps}</td>
                      <td>${d.seasonStats.dnfs}</td>
                      <td class="font-display" style="font-size:var(--fs-16);color:var(--green);">${d.seasonStats.points}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- ABA 4: CAMPEONATO MUNDIAL DE CONSTRUTORES (WCC) ---
  private renderTabWCC(): string {
    const teams = [...gameState.teams].sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums);

    return `
      <div class="bf-card">
        <h2 class="section-card-title" style="margin-bottom:16px;">
          ${icon('shield', 20)}
          <span>Classificação do Mundial de Construtores (WCC ${gameState.season})</span>
        </h2>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Escuderia</th>
                <th>Motor</th>
                <th>Força do Carro</th>
                <th>Vitórias</th>
                <th>Pódios</th>
                <th>Poles</th>
                <th>Previsão Prêmio FIA</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              ${teams
                .map((t, idx) => {
                  const isMine = t.id === gameState.myTeamId;
                  const prize = Math.max(12_000_000, (10 - idx) * 6_500_000);
                  const carOvr = gameState.getCarOverall(t);
                  const tier = getRatingTier(carOvr);
                  return `
                    <tr class="${isMine ? 'my-team-row' : ''}">
                      <td class="font-display" style="font-size:var(--fs-16);color:${idx === 0 ? 'var(--gold)' : 'var(--text-2)'};">${
                        idx + 1
                      }º</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          ${renderF1CarSvg(t, 72, 28)}
                          ${renderFlagSvg(t.flag, t.country)}
                          <strong>${t.name}</strong>
                        </div>
                      </td>
                      <td>${t.engineSupplier}</td>
                      <td><span class="ovr-chip ${tier.tierClass}">${carOvr}</span></td>
                      <td>${t.wins}</td>
                      <td>${t.podiums}</td>
                      <td>${t.poles}</td>
                      <td class="font-display" style="color:var(--gold);font-size:var(--fs-16);">${this.formatMoney(prize)}</td>
                      <td class="font-display" style="font-size:var(--fs-16);color:var(--green);">${t.points}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- ABA 5: CALENDÁRIO DA TEMPORADA ---
  private renderTabCalendar(): string {
    return `
      <div class="bf-card">
        <h2 class="section-card-title" style="margin-bottom:16px;">
          ${icon('calendar', 20)}
          <span>Calendário Oficial FIA Formula 1 — Temporada ${gameState.season}</span>
        </h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:var(--sp-16);">
          ${gameState.tracks
            .map((tr) => {
              const isCurrent = tr.round === gameState.currentRound && !gameState.seasonFinished;
              const isPast = tr.round < gameState.currentRound || gameState.seasonFinished;
              return `
                <div class="bf-card ${isCurrent ? 'bf-card-glow' : ''}" style="background:var(--bg-1);opacity:${isPast ? '0.68' : '1'};">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span class="label-upper" style="color:${isCurrent ? 'var(--green)' : 'var(--text-3)'};">
                      ETAPA ${tr.round} ${isCurrent ? '· PRÓXIMA CORRIDA' : isPast ? '· CONCLUÍDA' : ''}
                    </span>
                    <span style="font-size:var(--fs-12);color:var(--blue);display:inline-flex;align-items:center;gap:4px;">
                      ${icon('cloud-rain', 14)} ${tr.rainProbability}%
                    </span>
                  </div>
                  <div class="font-display" style="font-size:var(--fs-20);display:flex;align-items:center;gap:8px;">
                    ${renderFlagSvg(tr.flag, tr.country)}
                    <span>${tr.name}</span>
                  </div>
                  <div style="font-size:var(--fs-12);color:var(--text-2);margin-bottom:10px;">${tr.circuitName}</div>
                  <div style="display:flex;justify-content:space-between;font-size:var(--fs-12);color:var(--text-3);border-top:1px solid var(--border);padding-top:8px;">
                    <span>${tr.laps} Voltas</span>
                    <span>Asa Ideal: Nível ${tr.idealWing}</span>
                    <span>Desgaste: ${tr.tireWearFactor}x</span>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // --- ABA 6: MERCADO DE PILOTOS ---
  private renderTabMarket(): string {
    const myTeam = gameState.myTeam!;
    const myDrivers = gameState.getTeamDrivers(myTeam.id);
    if (!this.marketTransferSlot && myDrivers[1]) {
      this.marketTransferSlot = myDrivers[1].id;
    }

    const availableDrivers = gameState.drivers
      .filter((d) => d.teamId !== myTeam.id)
      .sort((a, b) => gameState.getDriverOverall(b) - gameState.getDriverOverall(a));

    return `
      <div class="bf-card" style="margin-bottom:var(--sp-16);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 class="section-card-title">${icon('users', 20)} <span>Mercado Internacional de Pilotos (Paddock Transfers)</span></h2>
          <p style="font-size:var(--fs-13);color:var(--text-2);">Contrate agentes livres pagando luvas (35% do valor) ou pague a multa rescisória para tirar estrelas de equipes rivais.</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label for="market-replace-select" style="font-size:var(--fs-13);color:var(--text-2);">Substituir no meu time:</label>
          <select id="market-replace-select" class="sort-select">
            ${myDrivers
              .map(
                (d) => `
              <option value="${d.id}" ${this.marketTransferSlot === d.id ? 'selected' : ''}>
                ${d.role === 'CAR_1' ? 'Carro #1' : 'Carro #2'}: ${d.name} (OVR ${gameState.getDriverOverall(d)})
              </option>
            `
              )
              .join('')}
          </select>
        </div>
      </div>

      <div class="bf-card">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Piloto</th>
                <th>Idade</th>
                <th>Status / Equipe Atual</th>
                <th>OVR (Pot)</th>
                <th>Pace / Chuva</th>
                <th>Salário / GP</th>
                <th>Custo da Contratação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              ${availableDrivers
                .map((d) => {
                  const currTeam = gameState.teams.find((t) => t.id === d.teamId);
                  const isFree = d.teamId === null;
                  const fee = isFree ? Math.round(d.marketValue * 0.35) : d.marketValue;
                  const canAfford = myTeam.budget >= fee;
                  const ovr = gameState.getDriverOverall(d);
                  const tier = getRatingTier(ovr);
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <strong class="font-display">#${d.number}</strong>
                          ${renderFlagSvg(d.flag, d.nationality)}
                          <strong>${d.name}</strong>
                        </div>
                      </td>
                      <td>${d.age}</td>
                      <td>
                        ${
                          isFree
                            ? `<span style="color:var(--green);font-weight:600;">Livre no Mercado</span>`
                            : `<span style="display:inline-flex;align-items:center;gap:6px;">${
                                currTeam ? renderFlagSvg(currTeam.flag, currTeam.country) : ''
                              } ${currTeam?.name ?? ''}</span>`
                        }
                      </td>
                      <td>
                        <span class="ovr-chip ${tier.tierClass}">${ovr}</span>
                        <span style="color:var(--text-3);font-size:var(--fs-12);margin-left:4px;">(Pot ${d.potential})</span>
                      </td>
                      <td>${d.stats.pace} / ${d.stats.wetSkill}</td>
                      <td style="color:var(--gold);font-weight:600;">${this.formatMoney(d.salary)}</td>
                      <td style="font-weight:700;color:${canAfford ? 'var(--gold)' : 'var(--red)'};">${this.formatMoney(fee)}</td>
                      <td>
                        <button class="btn btn-sm ${canAfford ? 'btn-primary' : ''}" data-hire-driver="${d.id}" ${!canAfford ? 'disabled' : ''}>
                          Contratar
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- ABA 7: ACADEMIA DE JOVENS PILOTOS (F2 / F3 & OLHEIRO) ---
  private renderTabAcademy(): string {
    const myTeam = gameState.myTeam!;
    const myDrivers = gameState.getTeamDrivers(myTeam.id);
    if (!this.academyPromoteSlot && myDrivers[1]) {
      this.academyPromoteSlot = myDrivers[1].id;
    }

    return `
      <div class="bf-card" style="margin-bottom:var(--sp-16);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 class="section-card-title">${icon('graduation-cap', 20)} <span>Academia de Jovens Pilotos (F2 / F3) & Olheiro</span></h2>
          <p style="font-size:var(--fs-13);color:var(--text-2);">Descubra futuros campeões mundiais, treine-os no simulador da equipe e promova-os ao cockpit titular da F1.</p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <select id="academy-replace-select" class="sort-select" aria-label="Selecionar vaga para promoção">
            ${myDrivers
              .map(
                (d) => `
              <option value="${d.id}" ${this.academyPromoteSlot === d.id ? 'selected' : ''}>
                Promover na vaga de: ${d.name} (${d.role === 'CAR_1' ? 'Carro #1' : 'Carro #2'})
              </option>
            `
              )
              .join('')}
          </select>
          <button class="btn btn-secondary-outline" id="btn-scout-talent">
            ${icon('compass', 16)}
            <span>Enviar Olheiro à F2/F3 ($1.50M)</span>
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(330px, 1fr));gap:var(--sp-16);">
        ${gameState.academyDrivers
          .map((y) => {
            const ovr = gameState.getDriverOverall(y);
            const tier = getRatingTier(ovr);
            return `
              <div class="bf-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="font-display" style="font-size:var(--fs-20);display:flex;align-items:center;gap:8px;">
                      ${renderFlagSvg(y.flag, y.nationality)}
                      <span>${y.name}</span>
                    </span>
                    <span class="ovr-chip ${tier.tierClass}">OVR ${ovr} · Pot ${y.potential}</span>
                  </div>
                  <div style="font-size:var(--fs-12);color:var(--text-2);margin:6px 0 12px;">
                    Idade: ${y.age} anos · Salário F1 futuro: <strong style="color:var(--gold);">${this.formatMoney(y.salary)}</strong>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${this.renderSemanticStat('Ritmo', y.stats.pace)}
                    ${this.renderSemanticStat('Ultrapassagem', y.stats.racecraft)}
                    ${this.renderSemanticStat('Consistência', y.stats.consistency)}
                    ${this.renderSemanticStat('Chuva', y.stats.wetSkill)}
                  </div>
                </div>

                <div style="display:flex;gap:8px;">
                  <button class="btn btn-sm btn-secondary-outline" style="flex:1;" data-train-young="${y.id}">
                    ${icon('gamepad-2', 16)}
                    <span>Simulador ($1.20M)</span>
                  </button>
                  <button class="btn btn-sm btn-primary" style="flex:1;" data-promote-young="${y.id}">
                    ${icon('trending-up', 16)}
                    <span>Promover à F1</span>
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  // --- ABA 8: FINANÇAS & PATROCÍNIO ---
  private renderTabFinance(): string {
    const team = gameState.myTeam!;
    const totalIncome = gameState.transactions.filter((t) => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const totalExpense = gameState.transactions.filter((t) => t.amount < 0).reduce((a, b) => a + b.amount, 0);

    return `
      <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:var(--sp-20);">
        ${this.renderSponsorsCardInternal(team)}

        <div class="bf-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h2 class="section-card-title">${icon('wallet', 20)} <span>Balanço Financeiro & Extrato</span></h2>
            <div style="display:flex;gap:14px;font-size:var(--fs-13);">
              <span>Receitas: <strong style="color:var(--green);">${this.formatMoney(totalIncome)}</strong></span>
              <span>Despesas: <strong style="color:var(--red);">${this.formatMoney(totalExpense)}</strong></span>
            </div>
          </div>

          <div style="max-height:440px;overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>GP</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                ${gameState.transactions
                  .map(
                    (tx) => `
                  <tr>
                    <td>#${tx.round}</td>
                    <td>${tx.description}</td>
                    <td><span class="chip">${tx.category}</span></td>
                    <td style="font-weight:700;color:${tx.amount >= 0 ? 'var(--green)' : 'var(--red)'};">
                      ${tx.amount >= 0 ? '+' : ''}${this.formatMoney(tx.amount)}
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- ABA 9: PATROCINADORES MASTER ---
  private renderTabSponsorsOnly(): string {
    const team = gameState.myTeam!;
    return this.renderSponsorsCardInternal(team);
  }

  private renderSponsorsCardInternal(team: Team): string {
    return `
      <div class="bf-card">
        <h2 class="section-card-title" style="margin-bottom:6px;">
          ${icon('award', 20)}
          <span>Contratos de Patrocínio Master</span>
        </h2>
        <p style="font-size:var(--fs-13);color:var(--text-2);margin-bottom:16px;">
          Escolha o patrocinador principal para os próximos Grandes Prêmios de acordo com a ambição da sua equipe.
        </p>

        <div style="display:flex;flex-direction:column;gap:12px;">
          ${gameState.sponsors
            .map((sp) => {
              const isActive = team.activeSponsorId === sp.id;
              return `
                <div style="background:var(--bg-1);border:1.5px solid ${
                  isActive ? 'var(--green)' : 'var(--border)'
                };border-radius:var(--radius-inner);padding:14px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="font-size:var(--fs-16);">${sp.name} <span style="font-size:var(--fs-12);color:var(--gold);">[${sp.tier}]</span></strong>
                    ${
                      isActive
                        ? `<span class="chip" style="color:var(--green);border-color:var(--green);">ATIVO</span>`
                        : `<button class="btn btn-sm btn-secondary-outline" data-select-sponsor="${sp.id}">Assinar</button>`
                    }
                  </div>
                  <div style="font-size:var(--fs-13);color:var(--text-2);margin-bottom:8px;">Meta: ${sp.goalDescription}</div>
                  <div style="display:flex;gap:16px;font-size:var(--fs-13);">
                    <span>Fixo/GP: <strong style="color:var(--gold);">${this.formatMoney(sp.perRaceBase)}</strong></span>
                    <span>Bônus de Meta: <strong style="color:var(--green);">+${this.formatMoney(sp.goalBonus)}</strong></span>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // --- ABA 10: SALA DE TROFÉUS & FEED ---
  private renderTabTrophiesAndNews(): string {
    return `
      <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:var(--sp-20);">
        <div class="bf-card">
          <h2 class="section-card-title" style="margin-bottom:14px;">
            ${icon('medal', 20)}
            <span>Galeria de Troféus da Carreira (${gameState.trophies.length})</span>
          </h2>
          ${
            gameState.trophies.length === 0
              ? `<div style="color:var(--text-3);font-size:var(--fs-13);padding:16px 0;">Nenhum troféu conquistado ainda. Vença Grandes Prêmios ou o Mundial para preencher a galeria!</div>`
              : `<div style="display:flex;flex-direction:column;gap:10px;">
                  ${gameState.trophies
                    .map(
                      (tr) => `
                    <div style="background:var(--bg-1);border:1px solid rgba(255,200,61,.35);border-radius:var(--radius-inner);padding:12px;display:flex;align-items:center;gap:12px;">
                      <span style="color:var(--gold);">${icon('trophy', 24)}</span>
                      <div>
                        <div style="font-weight:700;color:var(--gold);">${tr.title}</div>
                        <div style="font-size:var(--fs-12);color:var(--text-2);">Temporada ${tr.season} · ${
                          tr.driverName ? `${tr.driverName} (${tr.teamName})` : tr.teamName
                        }</div>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>

        ${this.renderNewsCardInternal()}
      </div>
    `;
  }

  // --- ABA 11: FEED DO PADDOCK ---
  private renderTabNewsOnly(): string {
    return this.renderNewsCardInternal();
  }

  private renderNewsCardInternal(): string {
    return `
      <div class="bf-card">
        <h2 class="section-card-title" style="margin-bottom:14px;">
          ${icon('newspaper', 20)}
          <span>Paddock News & Boletins FIA</span>
        </h2>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto;">
          ${gameState.news
            .map(
              (n) => `
            <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-inner);padding:14px;">
              <div style="display:flex;justify-content:space-between;font-size:var(--fs-12);color:var(--blue);font-weight:700;margin-bottom:4px;">
                <span>[${n.category}]</span>
                <span style="color:var(--text-3);">Temporada ${n.season} · Etapa ${n.round}</span>
              </div>
              <div style="font-weight:700;font-size:var(--fs-14);margin-bottom:4px;color:var(--text-1);">${n.title}</div>
              <div style="font-size:var(--fs-13);color:var(--text-2);">${n.body}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private bindDashboardEvents() {
    this.root.querySelector('#btn-back-home')?.addEventListener('click', () => {
      gameState.screen = 'HOME';
      gameState.notify();
    });

    this.root.querySelector('#btn-open-save-dialog')?.addEventListener('click', () => {
      const dlg = document.getElementById('saveManagerDialog') as HTMLDialogElement | null;
      dlg?.showModal();
    });

    this.root.querySelector('#btn-go-qualifying')?.addEventListener('click', () => {
      soundService.playLightsBeep(false);
      gameState.iniciarQualifyingFimDeSemana();
    });

    this.root.querySelector('#btn-go-race-direct')?.addEventListener('click', () => {
      soundService.playLightsBeep(true);
      gameState.iniciarCorridaAoVivo();
    });

    this.root.querySelector('#btn-next-season')?.addEventListener('click', () => {
      soundService.playChequeredFlag();
      gameState.iniciarNovaTemporada();
      this.showToast(`Bem-vindo à Temporada ${gameState.season}!`);
    });

    // Navegação de abas com skeleton loading shimmer
    const switchTab = (tab: DashboardTab) => {
      if (gameState.activeTab === tab) return;
      this.isTabTransitioning = true;
      gameState.activeTab = tab;
      gameState.notify();
    };

    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as DashboardTab;
        if (tab) switchTab(tab);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-goto-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.gotoTab as DashboardTab;
        if (tab) switchTab(tab);
      });
    });

    // Eventos da aba Garagem / Setup
    this.root.querySelector('#btn-swap-drivers')?.addEventListener('click', () => {
      const drivers = gameState.getTeamDrivers(gameState.myTeamId!);
      if (drivers.length >= 2) {
        gameState.alternarTitularidadePilotos(drivers[0].id, drivers[1].id);
        this.showToast('Hierarquia de carros #1 e #2 invertida!');
      }
    });

    this.root.querySelector('#btn-auto-setup')?.addEventListener('click', () => {
      gameState.aplicarSetupIdealEngenheiro();
      this.showToast('Acerto ideal de túnel de vento aplicado para a pista!');
    });

    const bindSetupRange = (id: string, prop: 'frontWing' | 'rearWing' | 'suspension') => {
      const input = this.root.querySelector<HTMLInputElement>(`#${id}`);
      const chip = this.root.querySelector<HTMLElement>(`#${id}-val-chip`);
      input?.addEventListener('input', () => {
        if (chip) chip.textContent = input.value;
      });
      input?.addEventListener('change', () => {
        gameState.atualizarSetupCarro({ [prop]: Number(input.value) });
      });
    };

    bindSetupRange('setup-front-wing', 'frontWing');
    bindSetupRange('setup-rear-wing', 'rearWing');
    bindSetupRange('setup-suspension', 'suspension');

    // Eventos P&D
    this.root.querySelectorAll<HTMLElement>('[data-upgrade-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dept = btn.dataset.upgradeDept as keyof CarDevelopment;
        const res = gameState.desenvolverDepartamentoCarro(dept);
        if (res.ok) soundService.playFastestLap();
        this.showToast(res.msg);
      });
    });

    // Eventos Mercado
    const mktSelect = this.root.querySelector<HTMLSelectElement>('#market-replace-select');
    mktSelect?.addEventListener('change', () => {
      this.marketTransferSlot = mktSelect.value;
    });

    this.root.querySelectorAll<HTMLElement>('[data-hire-driver]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const driverId = btn.dataset.hireDriver;
        if (driverId && this.marketTransferSlot) {
          const res = gameState.contratarPilotoMercado(driverId, this.marketTransferSlot);
          if (res.ok) soundService.playOvertake(true);
          this.showToast(res.msg);
        }
      });
    });

    // Eventos Academia
    const acadSelect = this.root.querySelector<HTMLSelectElement>('#academy-replace-select');
    acadSelect?.addEventListener('change', () => {
      this.academyPromoteSlot = acadSelect.value;
    });

    this.root.querySelector('#btn-scout-talent')?.addEventListener('click', () => {
      const res = gameState.buscarNovoTalentoOlheiro();
      this.showToast(res.msg);
    });

    this.root.querySelectorAll<HTMLElement>('[data-train-young]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.trainYoung!;
        const res = gameState.treinarJovemAcademia(id);
        this.showToast(res.msg);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-promote-young]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.promoteYoung!;
        if (this.academyPromoteSlot) {
          const res = gameState.promoverJovemAcademia(id, this.academyPromoteSlot);
          this.showToast(res.msg);
        }
      });
    });

    // Eventos Finanças / Patrocinador
    this.root.querySelectorAll<HTMLElement>('[data-select-sponsor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.selectSponsor!;
        gameState.selecionarPatrocinador(id);
        this.showToast('Novo patrocinador master ativo!');
      });
    });
  }

  // =========================================================================
  // 3. TELA DE QUALIFYING (Q1 / Q2 / Q3)
  // =========================================================================
  private renderQualifyingScreen() {
    const grid = gameState.currentQualifyingGrid ?? [];
    const track = gameState.currentTrack;
    const poleTime = grid[0]?.bestTime ?? 0;

    this.root.innerHTML = `
      <header class="dash-sticky-shell">
        <div class="dash-header-lvl1">
          <div>
            <div class="label-upper" style="color:var(--green);">Classificação Oficial FIA (Q1 · Q2 · Q3)</div>
            <h1 class="section-card-title" style="margin-top:2px;">
              ${renderFlagSvg(track.flag, track.country)}
              <span>${track.name} — Grid de Largada Definido</span>
            </h1>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary-outline" id="btn-qualy-back">
              ${icon('arrow-left', 16)}
              <span>Voltar à Garagem</span>
            </button>
            <button class="btn btn-primary btn-primary-lg" id="btn-start-gp-from-qualy">
              ${icon('flag', 18)}
              <span>Alinhar no Grid e Largada (${track.laps} Voltas)</span>
            </button>
          </div>
        </div>
      </header>

      <main class="dash-content">
        <div class="bf-card">
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Grid</th>
                  <th>Piloto</th>
                  <th>Escuderia</th>
                  <th>Q1</th>
                  <th>Q2</th>
                  <th>Q3 (Shootout)</th>
                  <th>Gap p/ Pole</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${grid
                  .map((e) => {
                    const d = gameState.drivers.find((x) => x.id === e.driverId)!;
                    const t = gameState.teams.find((x) => x.id === e.teamId)!;
                    const isMine = e.teamId === gameState.myTeamId;
                    const delta = e.gridPosition === 1 ? 'POLE POSITION' : `+${(e.bestTime - poleTime).toFixed(3)}s`;
                    return `
                      <tr class="${isMine ? 'my-team-row' : ''}">
                        <td class="font-display" style="font-size:var(--fs-16);color:${
                          e.gridPosition === 1 ? 'var(--gold)' : e.gridPosition <= 3 ? 'var(--green)' : 'var(--text-2)'
                        };">
                          P${e.gridPosition}
                        </td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px;">
                            <strong class="font-display">#${d.number}</strong>
                            ${renderFlagSvg(d.flag, d.nationality)}
                            <strong>${d.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.primaryColor};margin-right:6px;"></span>
                          ${t.name}
                        </td>
                        <td>${e.q1Time ? raceEngine.formatarTempo(e.q1Time) : '—'}</td>
                        <td>${e.q2Time ? raceEngine.formatarTempo(e.q2Time) : '—'}</td>
                        <td style="font-weight:700;color:var(--green);">${e.q3Time ? raceEngine.formatarTempo(e.q3Time) : '—'}</td>
                        <td style="font-weight:700;">${delta}</td>
                        <td>
                          ${
                            e.eliminatedIn
                              ? `<span style="color:var(--red);font-size:var(--fs-12);font-weight:600;">Eliminado no ${e.eliminatedIn}</span>`
                              : `<span style="color:var(--green);font-size:var(--fs-12);font-weight:600;">Top 10 Shootout</span>`
                          }
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    `;

    this.root.querySelector('#btn-qualy-back')?.addEventListener('click', () => {
      gameState.screen = 'DASHBOARD';
      gameState.notify();
    });

    this.root.querySelector('#btn-start-gp-from-qualy')?.addEventListener('click', () => {
      soundService.playLightsBeep(true);
      gameState.iniciarCorridaAoVivo();
    });
  }

  // =========================================================================
  // 4. TELA DE CORRIDA AO VIVO (Pit Wall, Autódromo 2D, Telemetria Volta a Volta)
  // =========================================================================
  private renderLiveRaceScreen() {
    const session = gameState.activeRaceSession;
    const track = gameState.currentTrack;
    if (!session) return;

    this.root.innerHTML = `
      <header class="dash-sticky-shell">
        <div class="dash-header-lvl1">
          <div style="display:flex;align-items:center;gap:12px;">
            ${renderFlagSvg(track.flag, track.country)}
            <div>
              <div class="section-card-title">${track.name} · ${track.circuitName}</div>
              <div style="font-size:var(--fs-12);color:var(--text-2);" id="live-race-header-sub">
                Volta ${session.currentLap}/${session.totalLaps}
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary-outline" id="btn-race-pause">
              ${this.racePaused ? `${icon('play', 15)} <span>Retomar</span>` : `${icon('pause', 15)} <span>Pausar</span>`}
            </button>
            <button class="btn btn-sm ${this.raceSpeedMs === 950 ? 'btn-primary' : 'btn-secondary-outline'}" data-speed="950">1x</button>
            <button class="btn btn-sm ${this.raceSpeedMs === 480 ? 'btn-primary' : 'btn-secondary-outline'}" data-speed="480">2x</button>
            <button class="btn btn-sm ${this.raceSpeedMs === 180 ? 'btn-primary' : 'btn-secondary-outline'}" data-speed="180">5x</button>
            <button class="btn btn-sm btn-secondary-outline" id="btn-skip-to-end">
              ${icon('fast-forward', 15)}
              <span>Simular até a Bandeirada</span>
            </button>
            <button class="btn btn-sm btn-primary" id="btn-finish-weekend" style="display:${session.isFinished ? 'inline-flex' : 'none'};">
              ${icon('flag', 15)}
              <span>Concluir Fim de Semana e Ver Pódio</span>
            </button>
          </div>
        </div>
      </header>

      <div class="race-screen-grid">
        <!-- Coluna 1: Autódromo 2D Interativo + Pit Wall de Comando dos 2 Carros -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div class="bf-card" style="padding:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:700;font-size:var(--fs-13);display:flex;align-items:center;gap:6px;">
                ${icon('compass', 16)}
                <span>Radar GPS do Circuito (2D Ao Vivo)</span>
              </span>
              <span id="live-weather-badge" style="font-size:var(--fs-12);font-weight:700;color:var(--blue);"></span>
            </div>
            <canvas id="race-circuit-canvas" style="width:100%;height:255px;border-radius:10px;display:block;"></canvas>
          </div>

          <div id="pitwall-controls-container" class="pitwall-card"></div>
        </div>

        <!-- Coluna 2: Torre de Cronometragem FIA (20 Carros) -->
        <div class="bf-card" style="padding:14px;overflow-x:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="section-card-title" style="font-size:var(--fs-16);">
              ${icon('timer', 18)}
              <span>Live Timing Tower (Classificação & Pneus)</span>
            </span>
            <span id="fastest-lap-banner" style="font-size:var(--fs-12);color:var(--gold);font-weight:700;"></span>
          </div>
          <table class="data-table" id="live-timing-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Piloto</th>
                <th>Pneu</th>
                <th>Desgaste</th>
                <th>ERS</th>
                <th>Última Volta</th>
                <th>Gap / Intervalo</th>
                <th>Pit</th>
              </tr>
            </thead>
            <tbody id="live-timing-tbody"></tbody>
          </table>
        </div>

        <!-- Coluna 3: Narração Volta a Volta e Rádio da Equipe -->
        <div class="bf-card" style="display:flex;flex-direction:column;gap:10px;">
          <div class="section-card-title" style="font-size:var(--fs-16);">
            ${icon('radio', 18)}
            <span>Rádio de Corrida & Direção de Prova</span>
          </div>
          <div class="feed-list" id="live-race-feed"></div>
        </div>
      </div>
    `;

    const canvas = this.root.querySelector<HTMLCanvasElement>('#race-circuit-canvas');
    if (canvas) {
      this.trackRenderer = new TrackCanvasRenderer(canvas);
      this.trackRenderer.start(
        () => gameState.currentTrack,
        () => gameState.activeRaceSession,
        () => gameState.teams,
        () => gameState.drivers,
        () => gameState.myTeamId
      );
    }

    this.bindLiveRaceEvents();
    this.updateLiveRaceDOM();
    this.startRaceLoop();
  }

  private updateLiveRaceDOM() {
    const session = gameState.activeRaceSession;
    if (!session) return;

    const sub = this.root.querySelector('#live-race-header-sub');
    if (sub) {
      sub.innerHTML = `Volta <strong>${session.currentLap}/${session.totalLaps}</strong> · Umidade da Pista: <strong>${session.trackWetness}%</strong> ${
        session.safetyCarLaps > 0
          ? `· <span style="color:var(--orange);font-weight:700;">SAFETY CAR NA PISTA</span>`
          : ''
      }`;
    }

    const weatherBadge = this.root.querySelector('#live-weather-badge');
    if (weatherBadge) {
      weatherBadge.innerHTML =
        session.weather === 'DRY'
          ? `${icon('sun', 15)} Pista Seca (Slick)`
          : session.weather === 'LIGHT_RAIN'
          ? `${icon('cloud-rain', 15)} Chuva Leve (Inter)`
          : `${icon('cloud-lightning', 15)} Tempestade (Full Wet)`;
    }

    const flBanner = this.root.querySelector('#fastest-lap-banner');
    if (flBanner) {
      const flDriver = gameState.drivers.find((d) => d.id === session.fastestLapDriverId);
      flBanner.textContent = flDriver
        ? `Volta Rápida: ${flDriver.shortCode} (${raceEngine.formatarTempo(session.fastestLapTimeSec)})`
        : '';
    }

    const finishBtn = this.root.querySelector<HTMLElement>('#btn-finish-weekend');
    if (finishBtn) {
      finishBtn.style.display = session.isFinished ? 'inline-flex' : 'none';
    }

    const tbody = this.root.querySelector('#live-timing-tbody');
    if (tbody) {
      tbody.innerHTML = session.cars
        .map((c) => {
          const d = gameState.drivers.find((x) => x.id === c.driverId)!;
          const t = gameState.teams.find((x) => x.id === c.teamId)!;
          const isMine = c.teamId === gameState.myTeamId;
          const wearColor = c.tireWear > 55 ? 'var(--green)' : c.tireWear > 28 ? 'var(--orange)' : 'var(--red)';

          return `
            <tr class="${isMine ? 'my-team-row' : ''}" style="${c.status === 'DNF' ? 'opacity:0.45;' : ''}">
              <td class="font-display" style="font-size:var(--fs-14);">${c.status === 'DNF' ? 'DNF' : `P${c.position}`}</td>
              <td>
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.primaryColor};margin-right:5px;"></span>
                <strong>${d.shortCode}</strong> <span style="font-size:var(--fs-12);color:var(--text-2);">${d.name.split(' ').pop()}</span>
              </td>
              <td>${renderTireBadge(c.tireCompound)} <span style="font-size:var(--fs-12);color:var(--text-3);">${c.tireAgeLaps}v</span></td>
              <td style="min-width:75px;">
                <div style="font-size:var(--fs-12);font-weight:700;color:${wearColor};">${Math.round(c.tireWear)}%</div>
                <div class="stat-bar-track" style="height:5px;">
                  <div class="stat-bar-fill" style="width:${c.tireWear}%;background:${wearColor};"></div>
                </div>
              </td>
              <td style="font-size:var(--fs-12);">${Math.round(c.ersBattery)}%</td>
              <td style="font-size:var(--fs-12);">${c.lastLapTimeSec > 0 ? raceEngine.formatarTempo(c.lastLapTimeSec) : '—'}</td>
              <td style="font-size:var(--fs-12);font-weight:700;">
                ${
                  c.status === 'DNF'
                    ? `<span style="color:var(--red);">${c.dnfReason ?? 'OUT'}</span>`
                    : c.position === 1
                    ? 'LÍDER'
                    : `+${c.gapToLeaderSec.toFixed(1)}s`
                }
              </td>
              <td>${c.pitStops}</td>
            </tr>
          `;
        })
        .join('');
    }

    const pitContainer = this.root.querySelector('#pitwall-controls-container');
    if (pitContainer) {
      const myCars = session.cars.filter((c) => c.teamId === gameState.myTeamId);
      pitContainer.innerHTML = myCars
        .map((c) => {
          const d = gameState.drivers.find((x) => x.id === c.driverId)!;
          return `
            <div class="bf-card" style="padding:14px;border-left:4px solid var(--green);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <strong style="font-size:var(--fs-14);">P${c.position} · ${d.name} (${d.shortCode})</strong>
                  <span style="margin-left:6px;">${renderTireBadge(c.tireCompound)} (${Math.round(c.tireWear)}%)</span>
                </div>
                <span style="font-size:var(--fs-12);color:var(--blue);font-weight:700;">ERS ${Math.round(c.ersBattery)}%</span>
              </div>

              ${
                c.status === 'DNF'
                  ? `<div style="color:var(--red);font-weight:700;font-size:var(--fs-13);">Fora da prova: ${c.dnfReason}</div>`
                  : `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                      <div>
                        <div style="font-size:var(--fs-12);color:var(--text-2);margin-bottom:4px;">Modo de Bateria ERS</div>
                        <div style="display:flex;gap:4px;">
                          ${(['CONSERVE', 'BALANCED', 'OVERTAKE'] as ERSMode[])
                            .map(
                              (mode) => `
                            <button class="btn btn-sm ${c.ersMode === mode ? 'btn-primary' : 'btn-secondary-outline'}" style="flex:1;padding:4px 6px;" data-car-ers="${c.driverId}:${mode}">
                              ${mode === 'CONSERVE' ? 'Carga' : mode === 'BALANCED' ? 'Normal' : 'Ataque'}
                            </button>
                          `
                            )
                            .join('')}
                        </div>
                      </div>

                      <div>
                        <div style="font-size:var(--fs-12);color:var(--text-2);margin-bottom:4px;">Ritmo de Pilotagem</div>
                        <div style="display:flex;gap:4px;">
                          ${(['CONSERVATIVE', 'STANDARD', 'AGGRESSIVE'] as PaceStrategy[])
                            .map(
                              (pace) => `
                            <button class="btn btn-sm ${c.paceStrategy === pace ? 'btn-gold' : 'btn-secondary-outline'}" style="flex:1;padding:4px 6px;" data-car-pace="${c.driverId}:${pace}">
                              ${pace === 'CONSERVATIVE' ? 'Poupar' : pace === 'STANDARD' ? 'Padrão' : 'Push'}
                            </button>
                          `
                            )
                            .join('')}
                        </div>
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap;">
                      <div style="display:flex;gap:4px;align-items:center;">
                        <span style="font-size:var(--fs-12);color:var(--text-2);">Próx. Pneu:</span>
                        ${(['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET'] as TireCompound[])
                          .map(
                            (comp) => `
                          <button class="btn btn-sm ${c.nextPitCompound === comp ? 'btn-primary' : 'btn-secondary-outline'}" style="padding:4px 8px;" data-car-compound="${c.driverId}:${comp}">
                            ${comp[0]}
                          </button>
                        `
                          )
                          .join('')}
                      </div>

                      <button class="btn btn-sm ${c.pitStopRequested ? 'btn-red' : 'btn-secondary-outline'}" data-car-box="${c.driverId}">
                        ${c.pitStopRequested ? 'BOX CHAMADO (Cancelar)' : 'Chamar Box nesta Volta'}
                      </button>
                    </div>
                  `
              }
            </div>
          `;
        })
        .join('');

      this.bindPitwallCardEvents();
    }

    const feedEl = this.root.querySelector('#live-race-feed');
    if (feedEl) {
      const reversed = [...session.events].reverse().slice(0, 35);
      feedEl.innerHTML = reversed
        .map(
          (ev) => `
        <div class="feed-item ${ev.isHighlight ? 'highlight' : ''}">
          <span style="font-size:var(--fs-12);font-weight:700;color:var(--green);margin-right:6px;">[V${ev.lap}]</span>
          <span>${ev.message}</span>
        </div>
      `
        )
        .join('');
    }
  }

  private bindPitwallCardEvents() {
    const session = gameState.activeRaceSession;
    if (!session) return;

    this.root.querySelectorAll<HTMLElement>('[data-car-ers]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [driverId, mode] = (btn.dataset.carErs ?? '').split(':');
        const car = session.cars.find((c) => c.driverId === driverId);
        if (car) {
          car.ersMode = mode as ERSMode;
          this.updateLiveRaceDOM();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-car-pace]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [driverId, pace] = (btn.dataset.carPace ?? '').split(':');
        const car = session.cars.find((c) => c.driverId === driverId);
        if (car) {
          car.paceStrategy = pace as PaceStrategy;
          this.updateLiveRaceDOM();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-car-compound]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [driverId, comp] = (btn.dataset.carCompound ?? '').split(':');
        const car = session.cars.find((c) => c.driverId === driverId);
        if (car) {
          car.nextPitCompound = comp as TireCompound;
          this.updateLiveRaceDOM();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-car-box]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const driverId = btn.dataset.carBox;
        const car = session.cars.find((c) => c.driverId === driverId);
        if (car) {
          car.pitStopRequested = !car.pitStopRequested;
          soundService.playTeamRadioBeep();
          this.updateLiveRaceDOM();
        }
      });
    });
  }

  private bindLiveRaceEvents() {
    this.root.querySelector('#btn-race-pause')?.addEventListener('click', (e) => {
      this.racePaused = !this.racePaused;
      (e.currentTarget as HTMLElement).innerHTML = this.racePaused
        ? `${icon('play', 15)} <span>Retomar</span>`
        : `${icon('pause', 15)} <span>Pausar</span>`;
    });

    this.root.querySelectorAll<HTMLElement>('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.raceSpeedMs = Number(btn.dataset.speed || 950);
        this.root.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary-outline');
        });
        btn.classList.remove('btn-secondary-outline');
        btn.classList.add('btn-primary');
        this.startRaceLoop();
      });
    });

    this.root.querySelector('#btn-skip-to-end')?.addEventListener('click', () => {
      const session = gameState.activeRaceSession;
      if (!session) return;
      this.stopRaceLoop();
      while (!session.isFinished) {
        raceEngine.simularVolta(
          session,
          gameState.currentTrack,
          gameState.teams,
          gameState.drivers,
          gameState.myTeamId ?? undefined,
          true
        );
      }
      soundService.playChequeredFlag();
      this.updateLiveRaceDOM();
    });

    this.root.querySelector('#btn-finish-weekend')?.addEventListener('click', () => {
      this.stopRaceLoop();
      gameState.finalizarCorridaEComputarResultados();
      this.showToast('Resultados oficiais e premiações computados!');
    });
  }

  private startRaceLoop() {
    this.stopRaceTimersOnly();
    this.raceTimer = window.setInterval(() => {
      const session = gameState.activeRaceSession;
      if (!session || this.racePaused || session.isFinished) return;

      const lapEvents = raceEngine.simularVolta(
        session,
        gameState.currentTrack,
        gameState.teams,
        gameState.drivers,
        gameState.myTeamId ?? undefined
      );

      for (const ev of lapEvents) {
        if (ev.type === 'FINISH') soundService.playChequeredFlag();
        else if (ev.type === 'SAFETY_CAR') soundService.playSafetyCarAlert();
        else if (ev.type === 'PIT_STOP' && ev.teamId === gameState.myTeamId) soundService.playPitStop();
        else if (ev.type === 'OVERTAKE' && ev.teamId === gameState.myTeamId) soundService.playOvertake(true);
        else if (ev.type === 'RADIO_CALL') soundService.playTeamRadioBeep();
        else if ((ev.type === 'CRASH' || ev.type === 'MECHANICAL_DNF') && ev.teamId === gameState.myTeamId) {
          soundService.playDNFAlert();
        }
      }

      this.updateLiveRaceDOM();
    }, this.raceSpeedMs);
  }

  private stopRaceTimersOnly() {
    if (this.raceTimer !== null) {
      clearInterval(this.raceTimer);
      this.raceTimer = null;
    }
  }

  private stopRaceLoop() {
    this.stopRaceTimersOnly();
    if (this.trackRenderer) {
      this.trackRenderer.stop();
      this.trackRenderer = null;
    }
  }

  // =========================================================================
  // 5. DIALOG DE GERENCIAMENTO DE SAVES (Com closedby="any" + Fallback Safari)
  // =========================================================================
  private renderSaveDialogHtml(): string {
    const saves = gameState.listarSaves();
    return `
      <dialog id="saveManagerDialog" closedby="any" aria-labelledby="saveDialogTitle">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 id="saveDialogTitle" class="section-card-title">
            ${icon('save', 20)}
            <span>Gerenciador de Carreira & Saves</span>
          </h2>
          <form method="dialog">
            <button type="submit" class="btn btn-sm btn-secondary-outline" aria-label="Fechar modal">
              ${icon('x', 16)}
              <span>Fechar</span>
            </button>
          </form>
        </div>

        ${
          gameState.myTeamId
            ? `
          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
            <input
              type="text"
              id="new-save-label"
              class="search-input"
              style="flex:1;padding-left:12px;"
              placeholder="Nome do Save (ex: Temporada Ferrari)"
            />
            <button class="btn btn-primary" id="btn-create-manual-save">
              ${icon('check', 16)}
              <span>Salvar Agora</span>
            </button>
            <button class="btn btn-secondary-outline" id="btn-export-json">
              ${icon('download', 16)}
              <span>Exportar JSON</span>
            </button>
          </div>
        `
            : ''
        }

        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
          ${
            saves.length === 0
              ? `<div style="color:var(--text-3);font-size:var(--fs-13);padding:12px 0;">Nenhum slot salvo ainda.</div>`
              : saves
                  .map(
                    (s) => `
                <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-inner);padding:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                  <div>
                    <div style="font-weight:700;color:var(--text-1);">${s.label} — ${s.teamName}</div>
                    <div style="font-size:var(--fs-12);color:var(--text-2);">
                      Temporada ${s.season} · Etapa ${s.currentRound}/12 · <strong style="color:var(--gold);">${this.formatMoney(s.budget)}</strong> · Salvo em ${s.savedAt}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-primary" data-dialog-load="${s.slotId}">Carregar</button>
                </div>
              `
                  )
                  .join('')
          }
        </div>
      </dialog>
    `;
  }

  private setupDialogLightDismiss() {
    const dialog = document.getElementById('saveManagerDialog') as HTMLDialogElement | null;
    if (!dialog) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }

    const createBtn = dialog.querySelector('#btn-create-manual-save');
    createBtn?.addEventListener('click', () => {
      const input = dialog.querySelector<HTMLInputElement>('#new-save-label');
      const label = input?.value.trim() || `Save Manual (${gameState.myTeam?.name})`;
      gameState.salvarJogo(`slot_${Date.now()}`, label);
      dialog.close();
      this.showToast('Jogo salvo com sucesso!');
      this.render();
    });

    const exportBtn = dialog.querySelector('#btn-export-json');
    exportBtn?.addEventListener('click', () => {
      const jsonStr = gameState.exportarSaveJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex_gp_${gameState.myTeamId}_${gameState.season}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    dialog.querySelectorAll<HTMLElement>('[data-dialog-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.dialogLoad;
        if (slot && gameState.carregarJogo(slot)) {
          dialog.close();
          this.showToast('Save carregado!');
        }
      });
    });
  }
}

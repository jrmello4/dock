import {
  Team,
  Driver,
  Track,
  Sponsor,
  QualifyingEntry,
  LiveRaceSession,
  NewsItem,
  TransactionRecord,
  TrophyRecord,
  SeasonHistoryEntry,
  CarDevelopment,
  CarSetup,
} from '../models/types';
import { INITIAL_TEAMS, INITIAL_DRIVERS, INITIAL_TRACKS, INITIAL_SPONSORS } from '../data/f1Database';
import { raceEngine } from '../engine/raceEngine';

export type ScreenMode = 'HOME' | 'DASHBOARD' | 'QUALIFYING' | 'LIVE_RACE';
export type DashboardTab =
  | 'GARAGE'
  | 'RD'
  | 'WDC'
  | 'WCC'
  | 'CALENDAR'
  | 'MARKET'
  | 'ACADEMY'
  | 'FINANCE'
  | 'SPONSORS'
  | 'TROPHIES'
  | 'NEWS';

const POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SAVE_STORAGE_KEY = 'apex_gp_manager_saves_v1';

export interface SaveSlotData {
  slotId: string;
  label: string;
  savedAt: string;
  season: number;
  currentRound: number;
  myTeamId: string;
  teamName: string;
  budget: number;
  teams: Team[];
  drivers: Driver[];
  academyDrivers: Driver[];
  news: NewsItem[];
  transactions: TransactionRecord[];
  trophies: TrophyRecord[];
  history: SeasonHistoryEntry[];
  lastQualifyingGrid: QualifyingEntry[] | null;
}

type Listener = () => void;

export class GameStateService {
  private listeners: Set<Listener> = new Set();

  public screen: ScreenMode = 'HOME';
  public activeTab: DashboardTab = 'GARAGE';
  public season: number = 2026;
  public currentRound: number = 1; // 1 a 12
  public seasonFinished: boolean = false;

  public myTeamId: string | null = null;
  public teams: Team[] = [];
  public drivers: Driver[] = [];
  public tracks: Track[] = structuredClone(INITIAL_TRACKS);
  public sponsors: Sponsor[] = structuredClone(INITIAL_SPONSORS);

  // Academia de Jovens Pilotos (F2/F3 Scouting)
  public academyDrivers: Driver[] = [];
  public scoutLevel: number = 1; // 1 a 5

  // Resultados do fim de semana atual
  public currentQualifyingGrid: QualifyingEntry[] | null = null;
  public activeRaceSession: LiveRaceSession | null = null;

  // Histórico, Finanças e Notícias
  public news: NewsItem[] = [];
  public transactions: TransactionRecord[] = [];
  public trophies: TrophyRecord[] = [];
  public history: SeasonHistoryEntry[] = [];

  constructor() {
    this.resetDatabase();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify() {
    this.listeners.forEach((fn) => fn());
  }

  public resetDatabase() {
    this.teams = structuredClone(INITIAL_TEAMS);
    this.drivers = structuredClone(INITIAL_DRIVERS);
    this.tracks = structuredClone(INITIAL_TRACKS);
    this.sponsors = structuredClone(INITIAL_SPONSORS);
    this.season = 2026;
    this.currentRound = 1;
    this.seasonFinished = false;
    this.currentQualifyingGrid = null;
    this.activeRaceSession = null;
    this.news = [];
    this.transactions = [];
    this.trophies = [];
    this.history = [];
    this.gerarJovensAcademiaInicial();
  }

  public get myTeam(): Team | null {
    return this.teams.find((t) => t.id === this.myTeamId) ?? null;
  }

  public get currentTrack(): Track {
    const idx = Math.max(0, Math.min(this.tracks.length - 1, this.currentRound - 1));
    return this.tracks[idx];
  }

  public getTeamDrivers(teamId: string): Driver[] {
    return this.drivers
      .filter((d) => d.teamId === teamId)
      .sort((a, b) => {
        const order = { CAR_1: 1, CAR_2: 2, RESERVE: 3, ACADEMY: 4 };
        return order[a.role] - order[b.role];
      });
  }

  public getDriverOverall(d: Driver): number {
    return Math.round(
      d.stats.pace * 0.30 +
      d.stats.racecraft * 0.25 +
      d.stats.consistency * 0.20 +
      d.stats.tireMgmt * 0.15 +
      d.stats.wetSkill * 0.10
    );
  }

  public getCarOverall(t: Team): number {
    return Math.round(
      t.car.aerodynamics * 0.30 +
      t.car.powerUnit * 0.30 +
      t.car.chassis * 0.25 +
      t.car.reliability * 0.15
    );
  }

  public iniciarCarreira(teamId: string) {
    this.resetDatabase();
    this.myTeamId = teamId;
    const team = this.myTeam!;
    const sponsor = this.sponsors.find((s) => s.id === team.activeSponsorId) ?? this.sponsors[0];

    this.adicionarNoticia(
      'RACE',
      `Novo Chefe de Equipe assume a ${team.fullName}`,
      `A diretoria da ${team.name} anunciou seu novo comando técnico para a temporada ${this.season}. A abertura acontece no ${this.currentTrack.name} (${this.currentTrack.circuitName}).`,
      team.id
    );

    this.registrarTransacao(
      1,
      `Bônus de Assinatura — Patrocinador ${sponsor.name}`,
      sponsor.signingBonus,
      'SPONSOR'
    );
    team.budget += sponsor.signingBonus;

    this.screen = 'DASHBOARD';
    this.activeTab = 'GARAGE';
    this.salvarJogo('autosave', 'Auto-Save da Carreira');
    this.notify();
  }

  public atualizarSetupCarro(partial: Partial<CarSetup>) {
    const team = this.myTeam;
    if (!team) return;
    team.setup = { ...team.setup, ...partial };
    this.notify();
  }

  public aplicarSetupIdealEngenheiro() {
    const team = this.myTeam;
    if (!team) return;
    const track = this.currentTrack;
    team.setup = {
      frontWing: track.idealWing,
      rearWing: track.idealWing,
      suspension: track.idealSuspension,
      brakeBias: 56,
    };
    this.notify();
  }

  /**
   * Investe em P&D de um subsistema do carro
   */
  public desenvolverDepartamentoCarro(dept: keyof CarDevelopment): { ok: boolean; msg: string } {
    const team = this.myTeam;
    if (!team) return { ok: false, msg: 'Nenhuma equipe selecionada.' };

    const currentVal = team.car[dept];
    if (currentVal >= 99) {
      return { ok: false, msg: 'Este departamento já atingiu o nível máximo da geração atual (99).' };
    }

    const cost = this.calcularCustoUpgradeCarro(currentVal);
    if (team.budget < cost) {
      return { ok: false, msg: `Orçamento insuficiente. Necessário: $${(cost / 1_000_000).toFixed(2)}M.` };
    }

    team.budget -= cost;
    const gain = currentVal >= 92 ? 1 : 2;
    team.car[dept] = Math.min(99, currentVal + gain);

    const labels: Record<keyof CarDevelopment, string> = {
      aerodynamics: 'Túnel de Vento & Aerodinâmica',
      powerUnit: 'Unidade de Potência (ERS/ICE)',
      chassis: 'Chassi & Redução de Peso',
      reliability: 'Confiabilidade & Arrefecimento',
      pitCrew: 'Equipamento de Pit Stop & Treino',
    };

    this.registrarTransacao(
      this.currentRound,
      `P&D: Upgrade em ${labels[dept]} (+${gain} pts)`,
      -cost,
      'RD'
    );

    this.adicionarNoticia(
      'TECH',
      `${team.name} traz pacote de atualização em ${labels[dept]}`,
      `Os engenheiros em ${team.baseCity} concluíram a nova especificação (+${gain} pts, nível ${team.car[dept]}).`,
      team.id
    );

    this.salvarJogo('autosave', 'Auto-Save da Carreira');
    this.notify();
    return { ok: true, msg: `Upgrade concluído! ${labels[dept]} subiu para ${team.car[dept]}.` };
  }

  public calcularCustoUpgradeCarro(currentLevel: number): number {
    // Escala de $2.2M (nível 80) até ~$8.5M (nível 96+)
    const base = 1_800_000;
    const factor = Math.max(1, currentLevel - 75);
    return Math.round((base + factor * factor * 14_500) / 50_000) * 50_000;
  }

  /**
   * Troca a função entre pilotos da própria equipe (Ex: Reserva <-> Carro 2)
   */
  public alternarTitularidadePilotos(driverAId: string, driverBId: string) {
    const a = this.drivers.find((d) => d.id === driverAId);
    const b = this.drivers.find((d) => d.id === driverBId);
    if (!a || !b || a.teamId !== this.myTeamId || b.teamId !== this.myTeamId) return;

    const tempRole = a.role;
    a.role = b.role;
    b.role = tempRole;
    this.notify();
  }

  /**
   * Contrata um piloto do mercado (Free Agent ou pagando multa rescisória de outra equipe)
   */
  public contratarPilotoMercado(targetDriverId: string, replaceDriverId: string): { ok: boolean; msg: string } {
    const myTeam = this.myTeam;
    if (!myTeam) return { ok: false, msg: 'Equipe inválida.' };

    const target = this.drivers.find((d) => d.id === targetDriverId);
    const replaced = this.drivers.find((d) => d.id === replaceDriverId);
    if (!target || !replaced || replaced.teamId !== myTeam.id) {
      return { ok: false, msg: 'Piloto inválido para substituição.' };
    }

    // Se tem contrato com outra equipe, custa 100% do marketValue; se Free Agent, custa luvas (35% do marketValue)
    const isFreeAgent = target.teamId === null;
    const fee = isFreeAgent ? Math.round(target.marketValue * 0.35) : target.marketValue;

    if (myTeam.budget < fee) {
      return {
        ok: false,
        msg: `Saldo insuficiente para pagar ${isFreeAgent ? 'as luvas de assinatura' : 'a multa rescisória'} ($${(fee / 1_000_000).toFixed(2)}M).`,
      };
    }

    const oldTeamId = target.teamId;
    const oldTeam = this.teams.find((t) => t.id === oldTeamId);

    myTeam.budget -= fee;
    if (oldTeam) {
      oldTeam.budget += fee;
    }

    // Se o piloto contratado veio de outra equipe, o piloto dispensado assume a vaga lá para manter 20 carros no grid!
    const targetRole = replaced.role;
    if (oldTeam) {
      replaced.teamId = oldTeam.id;
      replaced.role = target.role;
    } else {
      replaced.teamId = null;
      replaced.role = 'RESERVE';
    }

    target.teamId = myTeam.id;
    target.role = targetRole;
    target.contractYears = 3;
    target.morale = 94;

    this.registrarTransacao(
      this.currentRound,
      `Contratação de ${target.name} (${isFreeAgent ? 'Agente Livre' : `Ex-${oldTeam?.name}`})`,
      -fee,
      'TRANSFER'
    );

    this.adicionarNoticia(
      'MARKET',
      `BOMBA NO PADDOCK: ${target.name} assina com a ${myTeam.name}!`,
      `Negociação de $${(fee / 1_000_000).toFixed(2)}M coloca ${target.name} no ${targetRole === 'CAR_1' ? 'Carro #1' : 'Carro #2'} no lugar de ${replaced.name}.`,
      myTeam.id
    );

    this.salvarJogo('autosave', 'Auto-Save da Carreira');
    this.notify();
    return { ok: true, msg: `${target.name} agora é piloto oficial da ${myTeam.name}!` };
  }

  /**
   * Academia de Jovens Pilotos (equivalente à Base e Olheiro do Brasfoot)
   */
  private gerarJovensAcademiaInicial() {
    this.academyDrivers = [
      {
        id: 'acad_1', name: 'Lucas Moraes', shortCode: 'MOR', number: 91,
        nationality: 'Brasil', flag: '🇧🇷', age: 17, role: 'ACADEMY', teamId: null,
        stats: { pace: 76, racecraft: 74, consistency: 72, tireMgmt: 73, wetSkill: 77 },
        potential: 94, morale: 90, fitness: 98, salary: 180_000, marketValue: 3_500_000,
        contractYears: 3, seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 },
        careerWins: 0, careerTitles: 0,
      },
      {
        id: 'acad_2', name: 'Matteo Rossini', shortCode: 'ROS', number: 92,
        nationality: 'Itália', flag: '🇮🇹', age: 18, role: 'ACADEMY', teamId: null,
        stats: { pace: 78, racecraft: 76, consistency: 74, tireMgmt: 75, wetSkill: 74 },
        potential: 92, morale: 88, fitness: 97, salary: 210_000, marketValue: 4_200_000,
        contractYears: 3, seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 },
        careerWins: 0, careerTitles: 0,
      },
      {
        id: 'acad_3', name: 'Oliver Lindqvist', shortCode: 'LIN', number: 95,
        nationality: 'Suécia', flag: '🇸🇪', age: 18, role: 'ACADEMY', teamId: null,
        stats: { pace: 75, racecraft: 77, consistency: 76, tireMgmt: 74, wetSkill: 80 },
        potential: 91, morale: 89, fitness: 98, salary: 190_000, marketValue: 3_800_000,
        contractYears: 3, seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 },
        careerWins: 0, careerTitles: 0,
      },
    ];
  }

  public treinarJovemAcademia(driverId: string): { ok: boolean; msg: string } {
    const team = this.myTeam;
    if (!team) return { ok: false, msg: 'Equipe inválida.' };
    const young = this.academyDrivers.find((d) => d.id === driverId);
    if (!young) return { ok: false, msg: 'Jovem piloto não encontrado.' };

    const cost = 1_200_000;
    if (team.budget < cost) {
      return { ok: false, msg: 'Saldo insuficiente para sessão no simulador ($1.20M).' };
    }

    const ovr = this.getDriverOverall(young);
    if (ovr >= young.potential) {
      return { ok: false, msg: `${young.name} já atingiu todo o seu potencial na base (${young.potential}). Promova-o!` };
    }

    team.budget -= cost;
    young.stats.pace = Math.min(99, young.stats.pace + 2);
    young.stats.racecraft = Math.min(99, young.stats.racecraft + 2);
    young.stats.consistency = Math.min(99, young.stats.consistency + 2);
    young.stats.tireMgmt = Math.min(99, young.stats.tireMgmt + 1);
    young.stats.wetSkill = Math.min(99, young.stats.wetSkill + 1);

    this.registrarTransacao(
      this.currentRound,
      `Academia F2/F3: Programa de Simulador para ${young.name}`,
      -cost,
      'ACADEMY'
    );

    this.notify();
    return { ok: true, msg: `${young.name} evoluiu no simulador! Novo Overall: ${this.getDriverOverall(young)}.` };
  }

  public promoverJovemAcademia(youngId: string, replaceDriverId: string): { ok: boolean; msg: string } {
    const team = this.myTeam;
    if (!team) return { ok: false, msg: 'Equipe inválida.' };

    const idx = this.academyDrivers.findIndex((d) => d.id === youngId);
    const replaced = this.drivers.find((d) => d.id === replaceDriverId && d.teamId === team.id);
    if (idx === -1 || !replaced) return { ok: false, msg: 'Piloto inválido.' };

    const young = this.academyDrivers[idx];
    this.academyDrivers.splice(idx, 1);

    young.teamId = team.id;
    young.role = replaced.role;
    replaced.teamId = null;
    replaced.role = 'RESERVE';

    this.drivers.push(young);

    this.adicionarNoticia(
      'ACADEMY',
      `Jovem talento ${young.name} promovido ao grid da F1 pela ${team.name}!`,
      `Aos ${young.age} anos, a joia da academia assume o cockpit titular no lugar de ${replaced.name}.`,
      team.id
    );

    this.notify();
    return { ok: true, msg: `${young.name} foi promovido para a equipe principal da ${team.name}!` };
  }

  public buscarNovoTalentoOlheiro(): { ok: boolean; msg: string } {
    const team = this.myTeam;
    if (!team) return { ok: false, msg: 'Equipe inválida.' };
    const cost = 1_500_000;
    if (team.budget < cost) return { ok: false, msg: 'Saldo insuficiente para missão de scouting ($1.50M).' };

    team.budget -= cost;

    const pool = [
      { name: 'Enzo Fittipaldi Jr.', code: 'FIT', nat: 'Brasil', flag: '🇧🇷' },
      { name: 'Arthur Leclerc-Vasseur', code: 'LEV', nat: 'França', flag: '🇫🇷' },
      { name: 'Kenji Sato', code: 'SAT', nat: 'Japão', flag: '🇯🇵' },
      { name: 'Sebastian Weber', code: 'WEB', nat: 'Alemanha', flag: '🇩🇪' },
      { name: 'Liam Norris-Hunt', code: 'HUN', nat: 'Reino Unido', flag: '🇬🇧' },
    ];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const baseSkill = 74 + Math.floor(Math.random() * 6);
    const pot = 90 + Math.floor(Math.random() * 8);

    const newTalent: Driver = {
      id: `acad_${Date.now()}`,
      name: pick.name,
      shortCode: pick.code,
      number: 50 + Math.floor(Math.random() * 48),
      nationality: pick.nat,
      flag: pick.flag,
      age: 17 + Math.floor(Math.random() * 2),
      role: 'ACADEMY',
      teamId: null,
      stats: {
        pace: baseSkill + 2,
        racecraft: baseSkill,
        consistency: baseSkill - 1,
        tireMgmt: baseSkill - 1,
        wetSkill: baseSkill + 1,
      },
      potential: pot,
      morale: 92,
      fitness: 99,
      salary: 185_000,
      marketValue: 3_900_000,
      contractYears: 3,
      seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 },
      careerWins: 0,
      careerTitles: 0,
    };

    this.academyDrivers.push(newTalent);
    this.registrarTransacao(this.currentRound, `Olheiro F2/F3: Descoberta de ${newTalent.name}`, -cost, 'ACADEMY');
    this.notify();
    return { ok: true, msg: `Olheiro encontrou ${newTalent.name} (${newTalent.flag}) com potencial ${newTalent.potential}!` };
  }

  public selecionarPatrocinador(sponsorId: string) {
    const team = this.myTeam;
    if (!team) return;
    const sp = this.sponsors.find((s) => s.id === sponsorId);
    if (!sp || team.activeSponsorId === sponsorId) return;

    team.activeSponsorId = sponsorId;
    this.notify();
  }

  /**
   * Inicia o fim de semana de Grande Prêmio (Qualifying Q1/Q2/Q3)
   */
  public iniciarQualifyingFimDeSemana() {
    if (this.seasonFinished) return;
    this.currentQualifyingGrid = raceEngine.simularQualifying(
      this.currentTrack,
      this.teams,
      this.drivers,
      this.myTeamId ?? undefined
    );

    // Registra a Pole Position nas estatísticas
    const poleEntry = this.currentQualifyingGrid[0];
    if (poleEntry) {
      const poleDriver = this.drivers.find((d) => d.id === poleEntry.driverId);
      const poleTeam = this.teams.find((t) => t.id === poleEntry.teamId);
      if (poleDriver) poleDriver.seasonStats.poles += 1;
      if (poleTeam) poleTeam.poles += 1;
    }

    this.screen = 'QUALIFYING';
    this.notify();
  }

  /**
   * Vai do Qualifying (ou direto do Dashboard) para a Corrida Ao Vivo
   */
  public iniciarCorridaAoVivo() {
    if (!this.currentQualifyingGrid) {
      this.currentQualifyingGrid = raceEngine.simularQualifying(
        this.currentTrack,
        this.teams,
        this.drivers,
        this.myTeamId ?? undefined
      );
      const poleEntry = this.currentQualifyingGrid[0];
      if (poleEntry) {
        const poleDriver = this.drivers.find((d) => d.id === poleEntry.driverId);
        const poleTeam = this.teams.find((t) => t.id === poleEntry.teamId);
        if (poleDriver) poleDriver.seasonStats.poles += 1;
        if (poleTeam) poleTeam.poles += 1;
      }
    }

    this.activeRaceSession = raceEngine.criarSessaoCorrida(
      this.currentTrack,
      this.teams,
      this.drivers,
      this.currentQualifyingGrid,
      this.myTeamId ?? undefined
    );
    this.screen = 'LIVE_RACE';
    this.notify();
  }

  /**
   * Finaliza a corrida, computa pontos da FIA, prêmios financeiros, salários e avança o calendário
   */
  public finalizarCorridaEComputarResultados() {
    const session = this.activeRaceSession;
    const myTeam = this.myTeam;
    if (!session || !myTeam) return;

    const track = this.currentTrack;

    // 1. Pontos de Pilotos e Construtores (Top 10 + 1 pt de Volta Mais Rápida se no Top 10)
    session.cars.forEach((car) => {
      const driver = this.drivers.find((d) => d.id === car.driverId);
      const team = this.teams.find((t) => t.id === car.teamId);
      if (!driver || !team) return;

      driver.seasonStats.races += 1;
      if (car.status === 'DNF') {
        driver.seasonStats.dnfs += 1;
        return;
      }

      let pts = 0;
      if (car.position >= 1 && car.position <= 10) {
        pts += POINTS_SYSTEM[car.position - 1];
      }
      if (session.fastestLapDriverId === driver.id) {
        driver.seasonStats.fastestLaps += 1;
        if (car.position <= 10) {
          pts += 1;
        }
      }

      driver.seasonStats.points += pts;
      team.points += pts;

      if (car.position === 1) {
        driver.seasonStats.wins += 1;
        driver.careerWins += 1;
        team.wins += 1;

        if (team.id === myTeam.id) {
          this.trophies.push({
            season: this.season,
            title: `Vencedor do ${track.name}`,
            category: 'GP_WIN',
            driverName: driver.name,
            teamName: team.name,
            roundName: track.name,
          });
        }
      }
      if (car.position <= 3) {
        driver.seasonStats.podiums += 1;
        team.podiums += 1;
      }

      // Desgaste físico leve pós-GP e recuperação dos demais
      driver.fitness = Math.max(74, driver.fitness - 3);
    });

    // 2. Finanças da Equipe do Jogador (Patrocinador + Premiação FOM + Salários)
    const sponsor = this.sponsors.find((s) => s.id === myTeam.activeSponsorId) ?? this.sponsors[0];
    const myCars = session.cars.filter((c) => c.teamId === myTeam.id);
    const bestPos = Math.min(...myCars.map((c) => (c.status === 'DNF' ? 20 : c.position)));
    const bothFinished = myCars.every((c) => c.status !== 'DNF');

    let goalAchieved = false;
    if (sponsor.goalType === 'TOP_3' && bestPos <= 3) goalAchieved = true;
    if (sponsor.goalType === 'TOP_6' && bestPos <= 6) goalAchieved = true;
    if (sponsor.goalType === 'TOP_10' && bestPos <= 10) goalAchieved = true;
    if (sponsor.goalType === 'FINISH_BOTH' && bothFinished) goalAchieved = true;

    const sponsorPay = sponsor.perRaceBase + (goalAchieved ? sponsor.goalBonus : 0);
    myTeam.budget += sponsorPay;
    this.registrarTransacao(
      this.currentRound,
      `Receita de Patrocínio (${sponsor.name})${goalAchieved ? ' + Bônus de Meta!' : ''}`,
      sponsorPay,
      'SPONSOR'
    );

    // Bônus da FOM por pontos conquistados no GP ($350k por ponto + $1.5M se pódio)
    const myPointsThisRace = myCars.reduce((acc, c) => {
      if (c.status === 'DNF' || c.position > 10) return acc;
      return acc + POINTS_SYSTEM[c.position - 1];
    }, 0);
    const fomPrize = myPointsThisRace * 350_000 + (bestPos <= 3 ? 1_500_000 : 250_000);
    myTeam.budget += fomPrize;
    this.registrarTransacao(
      this.currentRound,
      `Premiação FOM — ${track.name} (Melhor posição: P${bestPos})`,
      fomPrize,
      'PRIZE'
    );

    // Pagamento da folha salarial dos pilotos
    const myDrivers = this.getTeamDrivers(myTeam.id);
    const totalSalary = myDrivers.reduce((acc, d) => acc + d.salary, 0);
    myTeam.budget -= totalSalary;
    this.registrarTransacao(
      this.currentRound,
      `Folha Salarial de Pilotos e Operação de Pista (${track.name})`,
      -totalSalary,
      'SALARY'
    );

    // Evolução automática das equipes de IA a cada 3 corridas
    if (this.currentRound % 3 === 0) {
      this.teams.forEach((t) => {
        if (t.id !== myTeam.id) {
          const depts: (keyof CarDevelopment)[] = ['aerodynamics', 'powerUnit', 'chassis', 'reliability'];
          const pick = depts[Math.floor(Math.random() * depts.length)];
          if (t.car[pick] < 98) t.car[pick] += 1;
        }
      });
    }

    // Notícia do Resumo do GP
    const winnerCar = session.cars.find((c) => c.position === 1);
    const winDriver = this.drivers.find((d) => d.id === winnerCar?.driverId);
    const winTeam = this.teams.find((t) => t.id === winnerCar?.teamId);

    this.adicionarNoticia(
      'RACE',
      `${winDriver?.name ?? 'Piloto'} vence o ${track.name}!`,
      `A ${winTeam?.name ?? 'equipe'} triunfou em ${track.circuitName}. A ${myTeam.name} fechou o fim de semana com P${bestPos} como melhor resultado (+$${((sponsorPay + fomPrize) / 1_000_000).toFixed(2)}M em receitas).`,
      winTeam?.id
    );

    // 3. Avança rodada ou conclui temporada
    this.currentQualifyingGrid = null;
    this.activeRaceSession = null;

    if (this.currentRound >= this.tracks.length) {
      this.encerrarTemporada();
    } else {
      this.currentRound += 1;
    }

    this.screen = 'DASHBOARD';
    this.salvarJogo('autosave', 'Auto-Save da Carreira');
    this.notify();
  }

  private encerrarTemporada() {
    this.seasonFinished = true;
    const myTeam = this.myTeam!;

    const sortedDrivers = [...this.drivers]
      .filter((d) => d.teamId !== null)
      .sort((a, b) => b.seasonStats.points - a.seasonStats.points || b.seasonStats.wins - a.seasonStats.wins);

    const sortedTeams = [...this.teams].sort((a, b) => b.points - a.points || b.wins - a.wins);

    const wdcWinner = sortedDrivers[0];
    const wccWinner = sortedTeams[0];
    const myConstructorPos = sortedTeams.findIndex((t) => t.id === myTeam.id) + 1;

    if (wdcWinner) {
      wdcWinner.careerTitles += 1;
      if (wdcWinner.teamId === myTeam.id) {
        this.trophies.push({
          season: this.season,
          title: `Campeão Mundial de Pilotos (WDC ${this.season})`,
          category: 'WDC',
          driverName: wdcWinner.name,
          teamName: myTeam.name,
        });
      }
    }

    if (wccWinner && wccWinner.id === myTeam.id) {
      this.trophies.push({
        season: this.season,
        title: `Campeão Mundial de Construtores (WCC ${this.season})`,
        category: 'WCC',
        teamName: myTeam.name,
      });
    }

    // Premiação bilionária da FIA/FOM de fim de temporada
    const seasonPrize = Math.max(12_000_000, (11 - myConstructorPos) * 6_500_000);
    myTeam.budget += seasonPrize;
    this.registrarTransacao(
      this.currentRound,
      `Premiação Oficial FIA de Construtores (${myConstructorPos}º lugar na Temporada ${this.season})`,
      seasonPrize,
      'PRIZE'
    );

    this.history.unshift({
      season: this.season,
      teamId: myTeam.id,
      teamName: myTeam.name,
      constructorPos: myConstructorPos,
      constructorPoints: myTeam.points,
      championDriverName: wdcWinner?.name ?? '—',
      championTeamName: wccWinner?.name ?? '—',
      wins: myTeam.wins,
      podiums: myTeam.podiums,
    });

    this.adicionarNoticia(
      'RACE',
      `Temporada ${this.season} Encerrada! ${wdcWinner?.name} é Campeão Mundial!`,
      `A ${wccWinner?.name} conquistou o Mundial de Construtores. A ${myTeam.name} terminou em ${myConstructorPos}º lugar e recebeu $${(seasonPrize / 1_000_000).toFixed(1)}M de premiação da FIA.`,
      myTeam.id
    );
  }

  public iniciarNovaTemporada() {
    if (!this.seasonFinished) return;
    this.season += 1;
    this.currentRound = 1;
    this.seasonFinished = false;
    this.currentQualifyingGrid = null;
    this.activeRaceSession = null;

    this.teams.forEach((t) => {
      t.points = 0;
      t.wins = 0;
      t.podiums = 0;
      t.poles = 0;
    });

    this.drivers.forEach((d) => {
      d.age += 1;
      d.fitness = 98;
      d.seasonStats = { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 };
      // Evolução de jovens pilotos na virada de ano
      if (d.age <= 24 && this.getDriverOverall(d) < d.potential) {
        d.stats.pace = Math.min(99, d.stats.pace + 1);
        d.stats.consistency = Math.min(99, d.stats.consistency + 1);
      }
    });

    this.adicionarNoticia(
      'RACE',
      `Começa a Temporada ${this.season} da Fórmula 1!`,
      `Carros revisados na fábrica e motores prontos para a abertura no ${this.currentTrack.name}.`,
      this.myTeamId ?? undefined
    );

    this.salvarJogo('autosave', 'Auto-Save da Carreira');
    this.notify();
  }

  public adicionarNoticia(
    category: NewsItem['category'],
    title: string,
    body: string,
    teamId?: string
  ) {
    this.news.unshift({
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      round: this.currentRound,
      season: this.season,
      category,
      title,
      body,
      teamId,
    });
    if (this.news.length > 40) this.news.pop();
  }

  public registrarTransacao(
    round: number,
    description: string,
    amount: number,
    category: TransactionRecord['category']
  ) {
    this.transactions.unshift({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      round,
      description,
      amount,
      category,
    });
    if (this.transactions.length > 60) this.transactions.pop();
  }

  /**
   * Sistema de Save / Load (localStorage + Exportação/Importação JSON)
   */
  public listarSaves(): SaveSlotData[] {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as SaveSlotData[];
    } catch {
      return [];
    }
  }

  public salvarJogo(slotId: string, label: string) {
    if (!this.myTeamId || !this.myTeam) return;
    try {
      const saves = this.listarSaves().filter((s) => s.slotId !== slotId);
      const payload: SaveSlotData = {
        slotId,
        label,
        savedAt: new Date().toLocaleString('pt-BR'),
        season: this.season,
        currentRound: this.currentRound,
        myTeamId: this.myTeamId,
        teamName: this.myTeam.name,
        budget: this.myTeam.budget,
        teams: this.teams,
        drivers: this.drivers,
        academyDrivers: this.academyDrivers,
        news: this.news,
        transactions: this.transactions,
        trophies: this.trophies,
        history: this.history,
        lastQualifyingGrid: this.currentQualifyingGrid,
      };
      saves.unshift(payload);
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saves));
    } catch {
      // Ignora erro de quota
    }
  }

  public carregarJogo(slotId: string): boolean {
    const saves = this.listarSaves();
    const target = saves.find((s) => s.slotId === slotId);
    if (!target) return false;

    this.season = target.season;
    this.currentRound = target.currentRound;
    this.myTeamId = target.myTeamId;
    this.teams = structuredClone(target.teams);
    this.drivers = structuredClone(target.drivers);
    this.academyDrivers = structuredClone(target.academyDrivers ?? []);
    this.news = structuredClone(target.news ?? []);
    this.transactions = structuredClone(target.transactions ?? []);
    this.trophies = structuredClone(target.trophies ?? []);
    this.history = structuredClone(target.history ?? []);
    this.currentQualifyingGrid = target.lastQualifyingGrid ?? null;
    this.seasonFinished = false;
    this.screen = 'DASHBOARD';
    this.activeTab = 'GARAGE';
    this.notify();
    return true;
  }

  public exportarSaveJSON(): string {
    return JSON.stringify(
      {
        season: this.season,
        currentRound: this.currentRound,
        myTeamId: this.myTeamId,
        teams: this.teams,
        drivers: this.drivers,
        academyDrivers: this.academyDrivers,
        trophies: this.trophies,
        history: this.history,
      },
      null,
      2
    );
  }
}

export const gameState = new GameStateService();

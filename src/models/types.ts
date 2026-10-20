// Modelos principais do Apex GP Manager (inspirado na arquitetura do Brasfoot Reborn)

export type TireCompound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTER' | 'WET';
export type ERSMode = 'CONSERVE' | 'BALANCED' | 'OVERTAKE';
export type PaceStrategy = 'CONSERVATIVE' | 'STANDARD' | 'AGGRESSIVE';
export type WeatherCondition = 'DRY' | 'LIGHT_RAIN' | 'HEAVY_RAIN';
export type DriverRole = 'CAR_1' | 'CAR_2' | 'RESERVE' | 'ACADEMY';

export interface DriverStats {
  pace: number;        // Velocidade pura em volta lançada (1-99)
  racecraft: number;   // Ultrapassagem e defesa de posição (1-99)
  consistency: number; // Evitar erros e manter ritmo constante (1-99)
  tireMgmt: number;    // Economia de pneus (1-99)
  wetSkill: number;    // Desempenho na chuva (1-99)
}

export interface DriverSeasonStats {
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
  races: number;
}

export interface Driver {
  id: string;
  name: string;
  shortCode: string; // Ex: VER, HAM, BOR
  number: number;
  nationality: string;
  flag: string;
  age: number;
  role: DriverRole;
  teamId: string | null; // null se livre no mercado
  stats: DriverStats;
  potential: number;
  morale: number;   // 0-100
  fitness: number;  // 0-100 (energia física, igual no Brasfoot)
  salary: number;   // Salário por corrida em $
  marketValue: number; // Valor de passe/rescisão em $
  contractYears: number;
  seasonStats: DriverSeasonStats;
  careerWins: number;
  careerTitles: number;
}

export interface CarDevelopment {
  aerodynamics: number; // 60-99 (força em curvas de alta/média)
  powerUnit: number;    // 60-99 (velocidade de reta e retomada)
  chassis: number;      // 60-99 (curvas de baixa e desgaste de pneu)
  reliability: number;  // 60-99 (chance de evitar quebra mecânica)
  pitCrew: number;      // 60-99 (velocidade do pit stop e menor erro)
}

export interface CarSetup {
  frontWing: number;  // 1 (Baixo Downforce / Velocidade) a 10 (Alto Downforce / Curvas)
  rearWing: number;   // 1 a 10
  suspension: number; // 1 (Macia / Zebras) a 10 (Rígida / Reatividade)
  brakeBias: number;  // 50% a 62%
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'MASTER' | 'OFFICIAL' | 'TECHNICAL';
  signingBonus: number;
  perRaceBase: number;
  goalDescription: string;
  goalType: 'TOP_3' | 'TOP_6' | 'TOP_10' | 'FINISH_BOTH';
  goalBonus: number;
}

export interface Team {
  id: string;
  name: string;
  fullName: string;
  country: string;
  flag: string;
  baseCity: string;
  engineSupplier: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  budget: number; // Saldo em caixa ($)
  prestige: number; // 1-5 estrelas (70-99)
  car: CarDevelopment;
  setup: CarSetup;
  activeSponsorId: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
}

export interface Point2D {
  x: number; // 0.0 a 1.0 normalizado no canvas
  y: number; // 0.0 a 1.0 normalizado no canvas
}

export interface Track {
  id: string;
  round: number;
  name: string;
  circuitName: string;
  country: string;
  flag: string;
  laps: number;
  baseLapTimeSec: number; // Ex: 78.5s em Mônaco, 90.0s em Spa
  aeroWeight: number;     // 0.2 a 0.5
  powerWeight: number;    // 0.2 a 0.5
  chassisWeight: number;  // 0.2 a 0.5
  idealWing: number;      // 1 a 10 (para cálculo de bônus de Setup)
  idealSuspension: number;// 1 a 10
  tireWearFactor: number; // 0.8 (baixo) a 1.4 (alto)
  rainProbability: number;// 0 a 100%
  overtakeDifficulty: number; // 1 (fácil) a 10 (Mônaco)
  svgPoints: Point2D[];   // Traçado 2D para o Mini-Autódromo
}

export interface QualifyingEntry {
  driverId: string;
  teamId: string;
  q1Time: number | null;
  q2Time: number | null;
  q3Time: number | null;
  bestTime: number;
  eliminatedIn: 'Q1' | 'Q2' | null;
  gridPosition: number;
  compound: TireCompound;
}

export type RaceEventType =
  | 'START'
  | 'OVERTAKE'
  | 'PIT_STOP'
  | 'FASTEST_LAP'
  | 'SPIN'
  | 'CRASH'
  | 'MECHANICAL_DNF'
  | 'SAFETY_CAR'
  | 'WEATHER_CHANGE'
  | 'RADIO_CALL'
  | 'FINISH';

export interface RaceEvent {
  lap: number;
  type: RaceEventType;
  driverId?: string;
  targetDriverId?: string;
  teamId?: string;
  message: string;
  isHighlight?: boolean;
}

export interface LiveCarState {
  driverId: string;
  teamId: string;
  gridPosition: number;
  position: number;
  totalTimeSec: number;
  lastLapTimeSec: number;
  bestLapTimeSec: number;
  gapToLeaderSec: number;
  intervalToAheadSec: number;
  tireCompound: TireCompound;
  tireWear: number; // 100% (novo) até 0% (estourado)
  tireAgeLaps: number;
  ersBattery: number; // 0% a 100%
  ersMode: ERSMode;
  paceStrategy: PaceStrategy;
  pitStops: number;
  pitStopRequested: boolean;
  nextPitCompound: TireCompound;
  usedCompounds: TireCompound[];
  status: 'RACING' | 'PIT' | 'DNF';
  dnfReason?: string;
  trackProgress: number; // 0.0 a 1.0 na volta atual para animação no canvas
}

export interface LiveRaceSession {
  trackId: string;
  round: number;
  currentLap: number;
  totalLaps: number;
  weather: WeatherCondition;
  trackWetness: number; // 0 (seco) a 100 (dilúvio)
  safetyCarLaps: number; // > 0 quando SC está na pista
  fastestLapDriverId: string | null;
  fastestLapTimeSec: number;
  cars: LiveCarState[];
  events: RaceEvent[];
  isFinished: boolean;
}

export interface NewsItem {
  id: string;
  round: number;
  season: number;
  category: 'RACE' | 'MARKET' | 'TECH' | 'FINANCE' | 'ACADEMY';
  title: string;
  body: string;
  teamId?: string;
}

export interface TransactionRecord {
  id: string;
  round: number;
  description: string;
  amount: number; // Positivo = receita, Negativo = despesa
  category: 'SPONSOR' | 'PRIZE' | 'SALARY' | 'RD' | 'TRANSFER' | 'ACADEMY';
}

export interface TrophyRecord {
  season: number;
  title: string;
  category: 'WDC' | 'WCC' | 'GP_WIN';
  driverName?: string;
  teamName: string;
  roundName?: string;
}

export interface SeasonHistoryEntry {
  season: number;
  teamId: string;
  teamName: string;
  constructorPos: number;
  constructorPoints: number;
  championDriverName: string;
  championTeamName: string;
  wins: number;
  podiums: number;
}

import { Team, Driver, Track, Sponsor } from '../models/types';

export const INITIAL_SPONSORS: Sponsor[] = [
  {
    id: 'sp_aramco_prime',
    name: 'Global Petrotech Corp',
    tier: 'MASTER',
    signingBonus: 12_000_000,
    perRaceBase: 2_800_000,
    goalDescription: 'Pódio (Top 3) com pelo menos um carro na corrida',
    goalType: 'TOP_3',
    goalBonus: 2_500_000,
  },
  {
    id: 'sp_oracle_cloud',
    name: 'HyperCloud AI Systems',
    tier: 'MASTER',
    signingBonus: 10_000_000,
    perRaceBase: 2_400_000,
    goalDescription: 'Terminar no Top 6 com pelo menos um carro',
    goalType: 'TOP_6',
    goalBonus: 1_650_000,
  },
  {
    id: 'sp_santander_fin',
    name: 'NovaBanco Internacional',
    tier: 'OFFICIAL',
    signingBonus: 7_500_000,
    perRaceBase: 1_950_000,
    goalDescription: 'Pontuar no Top 10 com pelo menos um carro',
    goalType: 'TOP_10',
    goalBonus: 1_100_000,
  },
  {
    id: 'sp_pirelli_tech',
    name: 'Vortex Telemetry & Logistics',
    tier: 'TECHNICAL',
    signingBonus: 5_000_000,
    perRaceBase: 1_550_000,
    goalDescription: 'Cruzar a linha de chegada com ambos os carros (sem DNF)',
    goalType: 'FINISH_BOTH',
    goalBonus: 750_000,
  },
];

export const INITIAL_TEAMS: Team[] = [
  {
    id: 'mclaren',
    name: 'McLaren',
    fullName: 'McLaren Formula 1 Team',
    country: 'Reino Unido',
    flag: '🇬🇧',
    baseCity: 'Woking, UK',
    engineSupplier: 'Mercedes',
    primaryColor: '#FF8000',
    secondaryColor: '#111827',
    accentColor: '#38BDF8',
    budget: 48_000_000,
    prestige: 95,
    car: { aerodynamics: 94, powerUnit: 92, chassis: 93, reliability: 91, pitCrew: 92 },
    setup: { frontWing: 6, rearWing: 6, suspension: 6, brakeBias: 56 },
    activeSponsorId: 'sp_aramco_prime',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    fullName: 'Scuderia Ferrari HP',
    country: 'Itália',
    flag: '🇮🇹',
    baseCity: 'Maranello, Itália',
    engineSupplier: 'Ferrari',
    primaryColor: '#E8002D',
    secondaryColor: '#1F1216',
    accentColor: '#FBBF24',
    budget: 52_000_000,
    prestige: 98,
    car: { aerodynamics: 92, powerUnit: 94, chassis: 92, reliability: 89, pitCrew: 89 },
    setup: { frontWing: 6, rearWing: 5, suspension: 6, brakeBias: 55 },
    activeSponsorId: 'sp_aramco_prime',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing',
    fullName: 'Oracle Red Bull Racing',
    country: 'Áustria',
    flag: '🇦🇹',
    baseCity: 'Milton Keynes, UK',
    engineSupplier: 'Honda RBPT',
    primaryColor: '#3671C6',
    secondaryColor: '#0F172A',
    accentColor: '#EF4444',
    budget: 50_000_000,
    prestige: 96,
    car: { aerodynamics: 93, powerUnit: 92, chassis: 91, reliability: 90, pitCrew: 95 },
    setup: { frontWing: 7, rearWing: 6, suspension: 7, brakeBias: 56 },
    activeSponsorId: 'sp_oracle_cloud',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    fullName: 'Mercedes-AMG PETRONAS F1 Team',
    country: 'Alemanha',
    flag: '🇩🇪',
    baseCity: 'Brackley, UK',
    engineSupplier: 'Mercedes',
    primaryColor: '#27F4D2',
    secondaryColor: '#111827',
    accentColor: '#94A3B8',
    budget: 46_000_000,
    prestige: 93,
    car: { aerodynamics: 90, powerUnit: 93, chassis: 90, reliability: 92, pitCrew: 91 },
    setup: { frontWing: 6, rearWing: 6, suspension: 6, brakeBias: 56 },
    activeSponsorId: 'sp_oracle_cloud',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'astonmartin',
    name: 'Aston Martin',
    fullName: 'Aston Martin Aramco F1 Team',
    country: 'Reino Unido',
    flag: '🇬🇧',
    baseCity: 'Silverstone, UK',
    engineSupplier: 'Mercedes',
    primaryColor: '#229971',
    secondaryColor: '#0B241C',
    accentColor: '#D4AF37',
    budget: 38_000_000,
    prestige: 84,
    car: { aerodynamics: 85, powerUnit: 89, chassis: 84, reliability: 87, pitCrew: 85 },
    setup: { frontWing: 6, rearWing: 6, suspension: 5, brakeBias: 55 },
    activeSponsorId: 'sp_santander_fin',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'williams',
    name: 'Williams',
    fullName: 'Atlassian Williams Racing',
    country: 'Reino Unido',
    flag: '🇬🇧',
    baseCity: 'Grove, UK',
    engineSupplier: 'Mercedes',
    primaryColor: '#1868DB',
    secondaryColor: '#0B172A',
    accentColor: '#38BDF8',
    budget: 34_000_000,
    prestige: 83,
    car: { aerodynamics: 83, powerUnit: 90, chassis: 83, reliability: 86, pitCrew: 84 },
    setup: { frontWing: 4, rearWing: 4, suspension: 5, brakeBias: 55 },
    activeSponsorId: 'sp_santander_fin',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'alpine',
    name: 'Alpine',
    fullName: 'BWT Alpine F1 Team',
    country: 'França',
    flag: '🇫🇷',
    baseCity: 'Enstone, UK',
    engineSupplier: 'Renault',
    primaryColor: '#0093CC',
    secondaryColor: '#17162B',
    accentColor: '#FF69B4',
    budget: 32_000_000,
    prestige: 80,
    car: { aerodynamics: 83, powerUnit: 82, chassis: 83, reliability: 83, pitCrew: 84 },
    setup: { frontWing: 5, rearWing: 5, suspension: 5, brakeBias: 55 },
    activeSponsorId: 'sp_santander_fin',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'rb',
    name: 'Racing Bulls',
    fullName: 'Visa Cash App Racing Bulls F1 Team',
    country: 'Itália',
    flag: '🇮🇹',
    baseCity: 'Faenza, Itália',
    engineSupplier: 'Honda RBPT',
    primaryColor: '#6692FF',
    secondaryColor: '#111A30',
    accentColor: '#FFFFFF',
    budget: 29_000_000,
    prestige: 78,
    car: { aerodynamics: 82, powerUnit: 88, chassis: 82, reliability: 85, pitCrew: 83 },
    setup: { frontWing: 6, rearWing: 6, suspension: 6, brakeBias: 56 },
    activeSponsorId: 'sp_pirelli_tech',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'haas',
    name: 'Haas F1 Team',
    fullName: 'MoneyGram Haas F1 Team',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    baseCity: 'Kannapolis, USA',
    engineSupplier: 'Ferrari',
    primaryColor: '#E6002B',
    secondaryColor: '#1E2229',
    accentColor: '#FFFFFF',
    budget: 27_000_000,
    prestige: 76,
    car: { aerodynamics: 80, powerUnit: 89, chassis: 81, reliability: 84, pitCrew: 81 },
    setup: { frontWing: 5, rearWing: 5, suspension: 5, brakeBias: 55 },
    activeSponsorId: 'sp_pirelli_tech',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
  {
    id: 'sauber',
    name: 'Kick Sauber / Audi',
    fullName: 'Stake F1 Team Kick Sauber',
    country: 'Suíça',
    flag: '🇨🇭',
    baseCity: 'Hinwil, Suíça',
    engineSupplier: 'Ferrari',
    primaryColor: '#52E252',
    secondaryColor: '#0E1F14',
    accentColor: '#00E676',
    budget: 30_000_000,
    prestige: 77,
    car: { aerodynamics: 80, powerUnit: 88, chassis: 80, reliability: 83, pitCrew: 80 },
    setup: { frontWing: 6, rearWing: 6, suspension: 5, brakeBias: 55 },
    activeSponsorId: 'sp_pirelli_tech',
    points: 0, wins: 0, podiums: 0, poles: 0,
  },
];

function emptySeasonStats() {
  return { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, races: 0 };
}

export const INITIAL_DRIVERS: Driver[] = [
  // McLaren
  {
    id: 'norris', name: 'Lando Norris', shortCode: 'NOR', number: 4,
    nationality: 'Reino Unido', flag: '🇬🇧', age: 26, role: 'CAR_1', teamId: 'mclaren',
    stats: { pace: 94, racecraft: 91, consistency: 91, tireMgmt: 92, wetSkill: 93 },
    potential: 96, morale: 92, fitness: 96, salary: 1_350_000, marketValue: 42_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 8, careerTitles: 0,
  },
  {
    id: 'piastri', name: 'Oscar Piastri', shortCode: 'PIA', number: 81,
    nationality: 'Austrália', flag: '🇦🇺', age: 24, role: 'CAR_2', teamId: 'mclaren',
    stats: { pace: 92, racecraft: 93, consistency: 92, tireMgmt: 89, wetSkill: 90 },
    potential: 96, morale: 90, fitness: 97, salary: 1_100_000, marketValue: 38_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 4, careerTitles: 0,
  },
  // Ferrari
  {
    id: 'leclerc', name: 'Charles Leclerc', shortCode: 'LEC', number: 16,
    nationality: 'Mônaco', flag: '🇲🇨', age: 28, role: 'CAR_1', teamId: 'ferrari',
    stats: { pace: 96, racecraft: 92, consistency: 89, tireMgmt: 90, wetSkill: 91 },
    potential: 96, morale: 91, fitness: 96, salary: 1_500_000, marketValue: 46_000_000,
    contractYears: 4, seasonStats: emptySeasonStats(), careerWins: 9, careerTitles: 0,
  },
  {
    id: 'hamilton', name: 'Lewis Hamilton', shortCode: 'HAM', number: 44,
    nationality: 'Reino Unido', flag: '🇬🇧', age: 40, role: 'CAR_2', teamId: 'ferrari',
    stats: { pace: 92, racecraft: 95, consistency: 94, tireMgmt: 96, wetSkill: 97 },
    potential: 94, morale: 93, fitness: 92, salary: 1_800_000, marketValue: 40_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 105, careerTitles: 7,
  },
  // Red Bull
  {
    id: 'verstappen', name: 'Max Verstappen', shortCode: 'VER', number: 1,
    nationality: 'Holanda', flag: '🇳🇱', age: 28, role: 'CAR_1', teamId: 'redbull',
    stats: { pace: 98, racecraft: 97, consistency: 96, tireMgmt: 95, wetSkill: 98 },
    potential: 99, morale: 95, fitness: 98, salary: 2_100_000, marketValue: 60_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 64, careerTitles: 4,
  },
  {
    id: 'lawson', name: 'Liam Lawson', shortCode: 'LAW', number: 30,
    nationality: 'Nova Zelândia', flag: '🇳🇿', age: 23, role: 'CAR_2', teamId: 'redbull',
    stats: { pace: 84, racecraft: 86, consistency: 83, tireMgmt: 82, wetSkill: 84 },
    potential: 90, morale: 86, fitness: 96, salary: 480_000, marketValue: 14_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Mercedes
  {
    id: 'russell', name: 'George Russell', shortCode: 'RUS', number: 63,
    nationality: 'Reino Unido', flag: '🇬🇧', age: 27, role: 'CAR_1', teamId: 'mercedes',
    stats: { pace: 93, racecraft: 90, consistency: 91, tireMgmt: 89, wetSkill: 91 },
    potential: 94, morale: 90, fitness: 96, salary: 1_150_000, marketValue: 35_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 3, careerTitles: 0,
  },
  {
    id: 'antonelli', name: 'Kimi Antonelli', shortCode: 'ANT', number: 12,
    nationality: 'Itália', flag: '🇮🇹', age: 19, role: 'CAR_2', teamId: 'mercedes',
    stats: { pace: 86, racecraft: 84, consistency: 80, tireMgmt: 81, wetSkill: 87 },
    potential: 96, morale: 92, fitness: 98, salary: 420_000, marketValue: 18_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Aston Martin
  {
    id: 'alonso', name: 'Fernando Alonso', shortCode: 'ALO', number: 14,
    nationality: 'Espanha', flag: '🇪🇸', age: 44, role: 'CAR_1', teamId: 'astonmartin',
    stats: { pace: 90, racecraft: 96, consistency: 94, tireMgmt: 94, wetSkill: 95 },
    potential: 91, morale: 88, fitness: 91, salary: 1_200_000, marketValue: 26_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 32, careerTitles: 2,
  },
  {
    id: 'stroll', name: 'Lance Stroll', shortCode: 'STR', number: 18,
    nationality: 'Canadá', flag: '🇨🇦', age: 27, role: 'CAR_2', teamId: 'astonmartin',
    stats: { pace: 79, racecraft: 80, consistency: 77, tireMgmt: 81, wetSkill: 86 },
    potential: 82, morale: 82, fitness: 94, salary: 450_000, marketValue: 9_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Williams
  {
    id: 'sainz', name: 'Carlos Sainz', shortCode: 'SAI', number: 55,
    nationality: 'Espanha', flag: '🇪🇸', age: 31, role: 'CAR_1', teamId: 'williams',
    stats: { pace: 91, racecraft: 92, consistency: 93, tireMgmt: 91, wetSkill: 90 },
    potential: 92, morale: 90, fitness: 96, salary: 1_050_000, marketValue: 32_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 4, careerTitles: 0,
  },
  {
    id: 'albon', name: 'Alexander Albon', shortCode: 'ALB', number: 23,
    nationality: 'Tailândia', flag: '🇹🇭', age: 29, role: 'CAR_2', teamId: 'williams',
    stats: { pace: 87, racecraft: 88, consistency: 87, tireMgmt: 89, wetSkill: 86 },
    potential: 89, morale: 88, fitness: 95, salary: 700_000, marketValue: 20_000_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Alpine
  {
    id: 'gasly', name: 'Pierre Gasly', shortCode: 'GAS', number: 10,
    nationality: 'França', flag: '🇫🇷', age: 29, role: 'CAR_1', teamId: 'alpine',
    stats: { pace: 88, racecraft: 88, consistency: 87, tireMgmt: 86, wetSkill: 89 },
    potential: 89, morale: 86, fitness: 95, salary: 750_000, marketValue: 21_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 1, careerTitles: 0,
  },
  {
    id: 'colapinto', name: 'Franco Colapinto', shortCode: 'COL', number: 43,
    nationality: 'Argentina', flag: '🇦🇷', age: 22, role: 'CAR_2', teamId: 'alpine',
    stats: { pace: 83, racecraft: 85, consistency: 81, tireMgmt: 82, wetSkill: 83 },
    potential: 91, morale: 90, fitness: 96, salary: 380_000, marketValue: 13_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Racing Bulls
  {
    id: 'tsunoda', name: 'Yuki Tsunoda', shortCode: 'TSU', number: 22,
    nationality: 'Japão', flag: '🇯🇵', age: 25, role: 'CAR_1', teamId: 'rb',
    stats: { pace: 86, racecraft: 85, consistency: 83, tireMgmt: 83, wetSkill: 84 },
    potential: 88, morale: 86, fitness: 96, salary: 580_000, marketValue: 16_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  {
    id: 'hadjar', name: 'Isack Hadjar', shortCode: 'HAD', number: 6,
    nationality: 'França', flag: '🇫🇷', age: 21, role: 'CAR_2', teamId: 'rb',
    stats: { pace: 82, racecraft: 83, consistency: 79, tireMgmt: 80, wetSkill: 81 },
    potential: 89, morale: 87, fitness: 97, salary: 320_000, marketValue: 10_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Haas
  {
    id: 'ocon', name: 'Esteban Ocon', shortCode: 'OCO', number: 31,
    nationality: 'França', flag: '🇫🇷', age: 29, role: 'CAR_1', teamId: 'haas',
    stats: { pace: 86, racecraft: 87, consistency: 86, tireMgmt: 85, wetSkill: 89 },
    potential: 87, morale: 85, fitness: 95, salary: 650_000, marketValue: 18_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 1, careerTitles: 0,
  },
  {
    id: 'bearman', name: 'Oliver Bearman', shortCode: 'BEA', number: 87,
    nationality: 'Reino Unido', flag: '🇬🇧', age: 20, role: 'CAR_2', teamId: 'haas',
    stats: { pace: 83, racecraft: 84, consistency: 81, tireMgmt: 81, wetSkill: 83 },
    potential: 91, morale: 89, fitness: 97, salary: 360_000, marketValue: 12_500_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  // Kick Sauber / Audi
  {
    id: 'hulkenberg', name: 'Nico Hülkenberg', shortCode: 'HUL', number: 27,
    nationality: 'Alemanha', flag: '🇩🇪', age: 38, role: 'CAR_1', teamId: 'sauber',
    stats: { pace: 87, racecraft: 86, consistency: 89, tireMgmt: 86, wetSkill: 89 },
    potential: 87, morale: 86, fitness: 93, salary: 680_000, marketValue: 16_000_000,
    contractYears: 2, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  {
    id: 'bortoleto', name: 'Gabriel Bortoleto', shortCode: 'BOR', number: 5,
    nationality: 'Brasil', flag: '🇧🇷', age: 21, role: 'CAR_2', teamId: 'sauber',
    stats: { pace: 85, racecraft: 86, consistency: 85, tireMgmt: 84, wetSkill: 86 },
    potential: 95, morale: 94, fitness: 98, salary: 420_000, marketValue: 17_500_000,
    contractYears: 3, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },

  // Pilotos Livres no Mercado (Free Agents & Reservas de Luxo)
  {
    id: 'perez', name: 'Sergio Pérez', shortCode: 'PER', number: 11,
    nationality: 'México', flag: '🇲🇽', age: 35, role: 'RESERVE', teamId: null,
    stats: { pace: 84, racecraft: 88, consistency: 83, tireMgmt: 92, wetSkill: 84 },
    potential: 85, morale: 80, fitness: 92, salary: 720_000, marketValue: 14_000_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 6, careerTitles: 0,
  },
  {
    id: 'bottas', name: 'Valtteri Bottas', shortCode: 'BOT', number: 77,
    nationality: 'Finlândia', flag: '🇫🇮', age: 36, role: 'RESERVE', teamId: null,
    stats: { pace: 86, racecraft: 84, consistency: 88, tireMgmt: 86, wetSkill: 85 },
    potential: 86, morale: 82, fitness: 94, salary: 620_000, marketValue: 13_000_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 10, careerTitles: 0,
  },
  {
    id: 'drugovich', name: 'Felipe Drugovich', shortCode: 'DRU', number: 34,
    nationality: 'Brasil', flag: '🇧🇷', age: 25, role: 'RESERVE', teamId: null,
    stats: { pace: 83, racecraft: 83, consistency: 85, tireMgmt: 84, wetSkill: 83 },
    potential: 89, morale: 86, fitness: 96, salary: 390_000, marketValue: 9_500_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  {
    id: 'ricciardo', name: 'Daniel Ricciardo', shortCode: 'RIC', number: 3,
    nationality: 'Austrália', flag: '🇦🇺', age: 36, role: 'RESERVE', teamId: null,
    stats: { pace: 83, racecraft: 87, consistency: 82, tireMgmt: 85, wetSkill: 84 },
    potential: 84, morale: 85, fitness: 92, salary: 580_000, marketValue: 11_000_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 8, careerTitles: 0,
  },
  {
    id: 'magnussen', name: 'Kevin Magnussen', shortCode: 'MAG', number: 20,
    nationality: 'Dinamarca', flag: '🇩🇰', age: 33, role: 'RESERVE', teamId: null,
    stats: { pace: 82, racecraft: 87, consistency: 81, tireMgmt: 80, wetSkill: 84 },
    potential: 83, morale: 81, fitness: 93, salary: 480_000, marketValue: 8_500_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  {
    id: 'doohan', name: 'Jack Doohan', shortCode: 'DOO', number: 7,
    nationality: 'Austrália', flag: '🇦🇺', age: 22, role: 'RESERVE', teamId: null,
    stats: { pace: 80, racecraft: 80, consistency: 80, tireMgmt: 79, wetSkill: 80 },
    potential: 87, morale: 83, fitness: 95, salary: 310_000, marketValue: 7_500_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
  {
    id: 'camara', name: 'Rafael Câmara', shortCode: 'CAM', number: 88,
    nationality: 'Brasil', flag: '🇧🇷', age: 20, role: 'RESERVE', teamId: null,
    stats: { pace: 81, racecraft: 82, consistency: 80, tireMgmt: 80, wetSkill: 82 },
    potential: 92, morale: 90, fitness: 97, salary: 290_000, marketValue: 8_000_000,
    contractYears: 0, seasonStats: emptySeasonStats(), careerWins: 0, careerTitles: 0,
  },
];

export const INITIAL_TRACKS: Track[] = [
  {
    id: 'australia', round: 1, name: 'GP da Austrália', circuitName: 'Albert Park, Melbourne',
    country: 'Austrália', flag: '🇦🇺', laps: 58, baseLapTimeSec: 79.2,
    aeroWeight: 0.35, powerWeight: 0.35, chassisWeight: 0.30,
    idealWing: 6, idealSuspension: 6, tireWearFactor: 1.05, rainProbability: 20, overtakeDifficulty: 5,
    svgPoints: [
      { x: 0.20, y: 0.78 }, { x: 0.58, y: 0.80 }, { x: 0.78, y: 0.72 }, { x: 0.86, y: 0.52 },
      { x: 0.75, y: 0.30 }, { x: 0.52, y: 0.22 }, { x: 0.34, y: 0.26 }, { x: 0.20, y: 0.42 },
      { x: 0.14, y: 0.62 }
    ]
  },
  {
    id: 'bahrain', round: 2, name: 'GP do Bahrein', circuitName: 'Sakhir International Circuit',
    country: 'Bahrein', flag: '🇧🇭', laps: 57, baseLapTimeSec: 91.4,
    aeroWeight: 0.30, powerWeight: 0.40, chassisWeight: 0.30,
    idealWing: 5, idealSuspension: 5, tireWearFactor: 1.30, rainProbability: 2, overtakeDifficulty: 3,
    svgPoints: [
      { x: 0.18, y: 0.82 }, { x: 0.76, y: 0.82 }, { x: 0.84, y: 0.64 }, { x: 0.65, y: 0.48 },
      { x: 0.82, y: 0.25 }, { x: 0.48, y: 0.18 }, { x: 0.35, y: 0.45 }, { x: 0.22, y: 0.25 },
      { x: 0.15, y: 0.55 }
    ]
  },
  {
    id: 'suzuka', round: 3, name: 'GP do Japão', circuitName: 'Suzuka International Racing Course',
    country: 'Japão', flag: '🇯🇵', laps: 53, baseLapTimeSec: 90.8,
    aeroWeight: 0.48, powerWeight: 0.27, chassisWeight: 0.25,
    idealWing: 8, idealSuspension: 8, tireWearFactor: 1.25, rainProbability: 35, overtakeDifficulty: 6,
    svgPoints: [
      { x: 0.25, y: 0.72 }, { x: 0.52, y: 0.76 }, { x: 0.65, y: 0.55 }, { x: 0.85, y: 0.48 },
      { x: 0.82, y: 0.24 }, { x: 0.56, y: 0.28 }, { x: 0.44, y: 0.48 }, { x: 0.22, y: 0.25 },
      { x: 0.14, y: 0.48 }
    ]
  },
  {
    id: 'imola', round: 4, name: 'GP da Emília-Romanha', circuitName: 'Autodromo Enzo e Dino Ferrari',
    country: 'Itália', flag: '🇮🇹', laps: 63, baseLapTimeSec: 76.5,
    aeroWeight: 0.38, powerWeight: 0.30, chassisWeight: 0.32,
    idealWing: 7, idealSuspension: 6, tireWearFactor: 0.95, rainProbability: 30, overtakeDifficulty: 7,
    svgPoints: [
      { x: 0.16, y: 0.65 }, { x: 0.55, y: 0.75 }, { x: 0.85, y: 0.68 }, { x: 0.86, y: 0.42 },
      { x: 0.64, y: 0.28 }, { x: 0.40, y: 0.32 }, { x: 0.20, y: 0.42 }
    ]
  },
  {
    id: 'monaco', round: 5, name: 'GP de Mônaco', circuitName: 'Circuit de Monaco, Monte Carlo',
    country: 'Mônaco', flag: '🇲🇨', laps: 78, baseLapTimeSec: 72.3,
    aeroWeight: 0.45, powerWeight: 0.10, chassisWeight: 0.45,
    idealWing: 10, idealSuspension: 3, tireWearFactor: 0.80, rainProbability: 20, overtakeDifficulty: 10,
    svgPoints: [
      { x: 0.22, y: 0.76 }, { x: 0.52, y: 0.80 }, { x: 0.80, y: 0.62 }, { x: 0.84, y: 0.32 },
      { x: 0.62, y: 0.22 }, { x: 0.48, y: 0.42 }, { x: 0.30, y: 0.35 }, { x: 0.16, y: 0.55 }
    ]
  },
  {
    id: 'canada', round: 6, name: 'GP do Canadá', circuitName: 'Circuit Gilles-Villeneuve, Montreal',
    country: 'Canadá', flag: '🇨🇦', laps: 70, baseLapTimeSec: 73.8,
    aeroWeight: 0.25, powerWeight: 0.42, chassisWeight: 0.33,
    idealWing: 4, idealSuspension: 4, tireWearFactor: 0.95, rainProbability: 40, overtakeDifficulty: 4,
    svgPoints: [
      { x: 0.15, y: 0.62 }, { x: 0.62, y: 0.76 }, { x: 0.86, y: 0.65 }, { x: 0.80, y: 0.38 },
      { x: 0.45, y: 0.26 }, { x: 0.18, y: 0.36 }
    ]
  },
  {
    id: 'silverstone', round: 7, name: 'GP da Grã-Bretanha', circuitName: 'Silverstone Circuit',
    country: 'Reino Unido', flag: '🇬🇧', laps: 52, baseLapTimeSec: 87.9,
    aeroWeight: 0.46, powerWeight: 0.32, chassisWeight: 0.22,
    idealWing: 7, idealSuspension: 8, tireWearFactor: 1.30, rainProbability: 45, overtakeDifficulty: 4,
    svgPoints: [
      { x: 0.24, y: 0.80 }, { x: 0.68, y: 0.82 }, { x: 0.85, y: 0.58 }, { x: 0.76, y: 0.24 },
      { x: 0.50, y: 0.18 }, { x: 0.38, y: 0.40 }, { x: 0.20, y: 0.32 }, { x: 0.15, y: 0.58 }
    ]
  },
  {
    id: 'spa', round: 8, name: 'GP da Bélgica', circuitName: 'Circuit de Spa-Francorchamps',
    country: 'Bélgica', flag: '🇧🇪', laps: 44, baseLapTimeSec: 104.5,
    aeroWeight: 0.38, powerWeight: 0.42, chassisWeight: 0.20,
    idealWing: 4, idealSuspension: 7, tireWearFactor: 1.25, rainProbability: 55, overtakeDifficulty: 3,
    svgPoints: [
      { x: 0.18, y: 0.78 }, { x: 0.46, y: 0.84 }, { x: 0.84, y: 0.68 }, { x: 0.82, y: 0.26 },
      { x: 0.54, y: 0.18 }, { x: 0.40, y: 0.38 }, { x: 0.22, y: 0.34 }
    ]
  },
  {
    id: 'monza', round: 9, name: 'GP da Itália', circuitName: 'Autodromo Nazionale Monza',
    country: 'Itália', flag: '🇮🇹', laps: 53, baseLapTimeSec: 80.4,
    aeroWeight: 0.18, powerWeight: 0.58, chassisWeight: 0.24,
    idealWing: 1, idealSuspension: 5, tireWearFactor: 0.95, rainProbability: 15, overtakeDifficulty: 3,
    svgPoints: [
      { x: 0.18, y: 0.78 }, { x: 0.82, y: 0.78 }, { x: 0.86, y: 0.46 }, { x: 0.62, y: 0.22 },
      { x: 0.32, y: 0.28 }, { x: 0.15, y: 0.52 }
    ]
  },
  {
    id: 'singapore', round: 10, name: 'GP de Singapura', circuitName: 'Marina Bay Street Circuit',
    country: 'Singapura', flag: '🇸🇬', laps: 62, baseLapTimeSec: 91.2,
    aeroWeight: 0.42, powerWeight: 0.18, chassisWeight: 0.40,
    idealWing: 9, idealSuspension: 4, tireWearFactor: 1.15, rainProbability: 25, overtakeDifficulty: 8,
    svgPoints: [
      { x: 0.20, y: 0.76 }, { x: 0.65, y: 0.80 }, { x: 0.84, y: 0.65 }, { x: 0.82, y: 0.30 },
      { x: 0.56, y: 0.24 }, { x: 0.45, y: 0.42 }, { x: 0.24, y: 0.28 }, { x: 0.16, y: 0.52 }
    ]
  },
  {
    id: 'interlagos', round: 11, name: 'GP de São Paulo', circuitName: 'Autódromo José Carlos Pace (Interlagos)',
    country: 'Brasil', flag: '🇧🇷', laps: 71, baseLapTimeSec: 70.8,
    aeroWeight: 0.36, powerWeight: 0.36, chassisWeight: 0.28,
    idealWing: 6, idealSuspension: 6, tireWearFactor: 1.15, rainProbability: 50, overtakeDifficulty: 3,
    svgPoints: [
      { x: 0.20, y: 0.80 }, { x: 0.74, y: 0.76 }, { x: 0.84, y: 0.44 }, { x: 0.62, y: 0.20 },
      { x: 0.35, y: 0.26 }, { x: 0.54, y: 0.48 }, { x: 0.32, y: 0.62 }, { x: 0.16, y: 0.50 }
    ]
  },
  {
    id: 'abudhabi', round: 12, name: 'GP de Abu Dhabi', circuitName: 'Yas Marina Circuit',
    country: 'Emirados Árabes', flag: '🇦🇪', laps: 58, baseLapTimeSec: 85.6,
    aeroWeight: 0.34, powerWeight: 0.36, chassisWeight: 0.30,
    idealWing: 6, idealSuspension: 6, tireWearFactor: 1.05, rainProbability: 1, overtakeDifficulty: 5,
    svgPoints: [
      { x: 0.22, y: 0.78 }, { x: 0.78, y: 0.80 }, { x: 0.84, y: 0.50 }, { x: 0.60, y: 0.46 },
      { x: 0.66, y: 0.22 }, { x: 0.30, y: 0.22 }, { x: 0.16, y: 0.52 }
    ]
  },
];

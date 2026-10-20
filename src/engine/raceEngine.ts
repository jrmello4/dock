import {
  Team,
  Driver,
  Track,
  QualifyingEntry,
  LiveRaceSession,
  LiveCarState,
  TireCompound,
  WeatherCondition,
  RaceEvent,
} from '../models/types';

export class RaceEngine {
  /**
   * Calcula a nota de acerto (Setup) do carro para uma pista específica (0 a 100%)
   */
  public calcularCompatibilidadeSetup(team: Team, track: Track): number {
    const mediaAsa = (team.setup.frontWing + team.setup.rearWing) / 2;
    const diffAsa = Math.abs(mediaAsa - track.idealWing);
    const diffSusp = Math.abs(team.setup.suspension - track.idealSuspension);
    const diffBrake = Math.abs(team.setup.brakeBias - 56) * 0.4;

    const penalidade = diffAsa * 4.2 + diffSusp * 2.8 + diffBrake;
    return Math.max(60, Math.min(100, Math.round(100 - penalidade)));
  }

  /**
   * Calcula a força ponderada do carro para a pista (0 a 100)
   */
  public calcularForcaCarroPista(team: Team, track: Track): number {
    const base =
      team.car.aerodynamics * track.aeroWeight +
      team.car.powerUnit * track.powerWeight +
      team.car.chassis * track.chassisWeight;

    const setupPct = this.calcularCompatibilidadeSetup(team, track);
    // Se setupPct for 100%, ganha +1.8 pts de performance; se 65%, perde -2.5 pts
    const bonusSetup = (setupPct - 82) * 0.11;
    return base + bonusSetup;
  }

  /**
   * Simula o Treino Classificatório completo (Q1, Q2 e Q3)
   */
  public simularQualifying(
    track: Track,
    teams: Team[],
    drivers: Driver[],
    myTeamId?: string
  ): QualifyingEntry[] {
    // Prepara o setup das equipes de IA automaticamente para ficar próximo ao ideal da pista
    teams.forEach((t) => {
      if (t.id !== myTeamId) {
        t.setup.frontWing = Math.max(1, Math.min(10, track.idealWing + (Math.random() > 0.5 ? 1 : 0)));
        t.setup.rearWing = Math.max(1, Math.min(10, track.idealWing));
        t.setup.suspension = Math.max(1, Math.min(10, track.idealSuspension));
      }
    });

    const titulares = drivers.filter((d) => d.teamId !== null && (d.role === 'CAR_1' || d.role === 'CAR_2'));

    const entries: QualifyingEntry[] = titulares.map((d) => ({
      driverId: d.id,
      teamId: d.teamId!,
      q1Time: null,
      q2Time: null,
      q3Time: null,
      bestTime: 999,
      eliminatedIn: null,
      gridPosition: 0,
      compound: 'SOFT',
    }));

    const calcFlyingLap = (driver: Driver, team: Team, sessionBoost: number): number => {
      const carPerf = this.calcularForcaCarroPista(team, track);
      const fitnessFactor = 0.85 + (driver.fitness / 100) * 0.15;
      const driverPace = driver.stats.pace * fitnessFactor;

      // Delta em segundos: cada ponto abaixo de 95 adiciona ~0.048s
      const carDelta = (95 - carPerf) * 0.052;
      const driverDelta = (95 - driverPace) * 0.036;
      const consistencyNoise = ((100 - driver.stats.consistency) / 100) * (Math.random() * 0.45 - 0.18);
      const randomJitter = (Math.random() - 0.5) * 0.26;

      return Number(
        (track.baseLapTimeSec + carDelta + driverDelta - sessionBoost + consistencyNoise + randomJitter).toFixed(3)
      );
    };

    // Q1: Todos os 20 carros correm, os 5 mais lentos (16º a 20º) são eliminados
    entries.forEach((e) => {
      const d = titulares.find((x) => x.id === e.driverId)!;
      const t = teams.find((x) => x.id === e.teamId)!;
      e.q1Time = calcFlyingLap(d, t, 0.0);
      e.bestTime = e.q1Time;
    });
    entries.sort((a, b) => (a.q1Time ?? 999) - (b.q1Time ?? 999));

    entries.slice(15).forEach((e, idx) => {
      e.eliminatedIn = 'Q1';
      e.gridPosition = 16 + idx;
    });

    // Q2: Top 15 correm, do 11º ao 15º são eliminados
    const q2Runners = entries.slice(0, 15);
    q2Runners.forEach((e) => {
      const d = titulares.find((x) => x.id === e.driverId)!;
      const t = teams.find((x) => x.id === e.teamId)!;
      e.q2Time = calcFlyingLap(d, t, 0.25);
      e.bestTime = e.q2Time;
    });
    q2Runners.sort((a, b) => (a.q2Time ?? 999) - (b.q2Time ?? 999));

    q2Runners.slice(10).forEach((e, idx) => {
      e.eliminatedIn = 'Q2';
      e.gridPosition = 11 + idx;
    });

    // Q3: Top 10 disputam a Pole Position
    const q3Runners = q2Runners.slice(0, 10);
    q3Runners.forEach((e) => {
      const d = titulares.find((x) => x.id === e.driverId)!;
      const t = teams.find((x) => x.id === e.teamId)!;
      e.q3Time = calcFlyingLap(d, t, 0.52);
      e.bestTime = e.q3Time;
    });
    q3Runners.sort((a, b) => (a.q3Time ?? 999) - (b.q3Time ?? 999));

    q3Runners.forEach((e, idx) => {
      e.gridPosition = idx + 1;
    });

    const finalGrid = [...q3Runners, ...q2Runners.slice(10), ...entries.slice(15)];
    finalGrid.sort((a, b) => a.gridPosition - b.gridPosition);
    return finalGrid;
  }

  /**
   * Inicializa uma sessão de corrida ao vivo a partir do grid de largada
   */
  public criarSessaoCorrida(
    track: Track,
    teams: Team[],
    drivers: Driver[],
    grid: QualifyingEntry[],
    myTeamId?: string
  ): LiveRaceSession {
    const startsRaining = Math.random() * 100 < track.rainProbability * 0.65;
    const weather: WeatherCondition = startsRaining ? 'LIGHT_RAIN' : 'DRY';
    const wetness = startsRaining ? 42 : 0;

    const cars: LiveCarState[] = grid.map((entry, idx) => {
      let startTire: TireCompound = 'MEDIUM';
      if (weather !== 'DRY') {
        startTire = 'INTER';
      } else if (entry.gridPosition <= 10) {
        startTire = idx % 3 === 0 ? 'SOFT' : 'MEDIUM';
      } else {
        startTire = idx % 2 === 0 ? 'MEDIUM' : 'HARD';
      }

      // Diferença inicial de largada (0.25s por colchete no grid)
      const startOffset = idx * 0.25;

      return {
        driverId: entry.driverId,
        teamId: entry.teamId,
        gridPosition: entry.gridPosition,
        position: entry.gridPosition,
        totalTimeSec: startOffset,
        lastLapTimeSec: 0,
        bestLapTimeSec: 999,
        gapToLeaderSec: startOffset,
        intervalToAheadSec: idx === 0 ? 0 : 0.25,
        tireCompound: startTire,
        tireWear: 100,
        tireAgeLaps: 0,
        ersBattery: 100,
        ersMode: 'BALANCED',
        paceStrategy: 'STANDARD',
        pitStops: 0,
        pitStopRequested: false,
        nextPitCompound: weather !== 'DRY' ? 'INTER' : 'HARD',
        usedCompounds: [startTire],
        status: 'RACING',
        trackProgress: Math.max(0, 1 - idx * 0.012),
      };
    });

    const poleDriver = drivers.find((d) => d.id === grid[0]?.driverId);

    const initialEvents: RaceEvent[] = [
      {
        lap: 0,
        type: 'START',
        driverId: poleDriver?.id,
        teamId: poleDriver?.teamId ?? undefined,
        message: `Luzes alinhadas para o ${track.name}! ${poleDriver?.name ?? 'Líder'} larga na Pole Position (${weather === 'DRY' ? 'Pista Seca' : 'Pista Úmida'}).`,
        isHighlight: true,
      },
    ];

    return {
      trackId: track.id,
      round: track.round,
      currentLap: 0,
      totalLaps: track.laps,
      weather,
      trackWetness: wetness,
      safetyCarLaps: 0,
      fastestLapDriverId: null,
      fastestLapTimeSec: 999,
      cars,
      events: initialEvents,
      isFinished: false,
    };
  }

  /**
   * Simula uma única volta na corrida ao vivo e retorna os eventos ocorridos na volta
   */
  public simularVolta(
    session: LiveRaceSession,
    track: Track,
    teams: Team[],
    drivers: Driver[],
    myTeamId?: string,
    autoStrategyForPlayer = false
  ): RaceEvent[] {
    if (session.isFinished) return [];

    session.currentLap += 1;
    const lap = session.currentLap;
    const lapEvents: RaceEvent[] = [];

    // 1. Evolução dinâmica do clima a cada volta
    this.atualizarClima(session, track, lapEvents);

    // 2. Reduz contagem de Safety Car se ativo
    const underSC = session.safetyCarLaps > 0;
    if (underSC) {
      session.safetyCarLaps -= 1;
      if (session.safetyCarLaps === 0) {
        lapEvents.push({
          lap,
          type: 'SAFETY_CAR',
          message: `Bandeira Verde! O Safety Car retorna aos boxes na volta ${lap}. Relargada autorizada!`,
          isHighlight: true,
        });
      }
    }

    // Ordenação antes da volta para referência de ultrapassagens
    const previousOrder = session.cars
      .filter((c) => c.status !== 'DNF')
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);

    // 3. Processa cada carro ativo
    for (const car of session.cars) {
      if (car.status === 'DNF') continue;

      const driver = drivers.find((d) => d.id === car.driverId)!;
      const team = teams.find((t) => t.id === car.teamId)!;
      const isMyCar = car.teamId === myTeamId;

      car.status = 'RACING';

      // Estratégia automática da IA (e alertas de rádio para o jogador, ou auto-box em simulação rápida)
      if (!isMyCar || autoStrategyForPlayer) {
        this.decidirEstrategiaIA(car, session, track);
      } else {
        // Rádio do engenheiro caso o pneu esteja crítico ou clima tenha mudado
        if (car.tireWear < 28 && !car.pitStopRequested && lap < session.totalLaps - 1) {
          lapEvents.push({
            lap,
            type: 'RADIO_CALL',
            driverId: driver.id,
            teamId: team.id,
            message: `📻 Rádio (${driver.shortCode}): "Pneus críticos (${Math.round(car.tireWear)}%)! Chame o Box agora ou perderemos aderência!"`,
            isHighlight: true,
          });
        }
        // Auto-proteção de emergência: se o pneu chegar a <= 8%, o engenheiro chama o box para evitar estouro
        if (car.tireWear <= 8 && !car.pitStopRequested && lap < session.totalLaps - 1) {
          this.decidirEstrategiaIA(car, session, track);
        }
      }

      // Checagem de quebra mecânica ou acidente (apenas fora de Safety Car)
      if (!underSC && lap > 1) {
        const reliabilityRisk = (100 - team.car.reliability) * 0.00055;
        if (Math.random() < reliabilityRisk) {
          car.status = 'DNF';
          car.dnfReason = 'Falha na Unidade de Potência';
          lapEvents.push({
            lap,
            type: 'MECHANICAL_DNF',
            driverId: driver.id,
            teamId: team.id,
            message: `⚠️ Fim de prova para ${driver.name} (${team.name})! Fumaça no motor na volta ${lap}.`,
            isHighlight: true,
          });
          if (Math.random() < 0.45 && session.safetyCarLaps === 0 && lap < session.totalLaps - 3) {
            session.safetyCarLaps = 3;
            lapEvents.push({
              lap,
              type: 'SAFETY_CAR',
              message: `🟡 SAFETY CAR NA PISTA! Fiscais removendo o carro de ${driver.shortCode}. Janela de Pit Stop mais barata!`,
              isHighlight: true,
            });
          }
          continue;
        }

        // Risco de rodada/erro de piloto (maior na chuva ou com pneu gasto ou ritmo agressivo)
        const paceRiskBoost = car.paceStrategy === 'AGGRESSIVE' ? 1.45 : car.paceStrategy === 'CONSERVATIVE' ? 0.6 : 1.0;
        const tireCrisisBoost = car.tireWear < 20 ? 2.8 : 1.0;
        const mistakeProb = ((100 - driver.stats.consistency) * 0.0005) * paceRiskBoost * tireCrisisBoost;

        if (Math.random() < mistakeProb) {
          if (Math.random() < 0.25) {
            car.status = 'DNF';
            car.dnfReason = 'Colisão na barreira';
            lapEvents.push({
              lap,
              type: 'CRASH',
              driverId: driver.id,
              teamId: team.id,
              message: `💥 BATIDA! ${driver.name} perde a traseira e abandona a corrida na volta ${lap}!`,
              isHighlight: true,
            });
            if (session.safetyCarLaps === 0 && lap < session.totalLaps - 3) {
              session.safetyCarLaps = 3;
              lapEvents.push({
                lap,
                type: 'SAFETY_CAR',
                message: `🟡 SAFETY CAR ACIONADO após o acidente de ${driver.shortCode}!`,
                isHighlight: true,
              });
            }
            continue;
          } else {
            // Travada de roda ou escapada leve (+3.8s na volta)
            car.totalTimeSec += 3.8;
            lapEvents.push({
              lap,
              type: 'SPIN',
              driverId: driver.id,
              teamId: team.id,
              message: `🛞 ${driver.name} trava tudo na freada, passa pela brita e perde ~3.8s!`,
            });
          }
        }
      }

      // Cálculo do tempo de volta
      const lapTime = this.calcularTempoVoltaCorrida(car, driver, team, track, session, underSC);
      car.lastLapTimeSec = lapTime;
      car.totalTimeSec += lapTime;
      car.tireAgeLaps += 1;

      // Desgaste de pneu e bateria ERS
      this.aplicarDesgastePneuEBateria(car, driver, track, session, underSC);

      // Processa parada nos boxes (Pit Stop) se solicitada
      if (car.pitStopRequested && lap < session.totalLaps) {
        this.executarPitStop(car, driver, team, session, underSC, lapEvents);
      }

      // Volta mais rápida da corrida
      if (!underSC && car.status === 'RACING' && lapTime < session.fastestLapTimeSec) {
        session.fastestLapTimeSec = lapTime;
        session.fastestLapDriverId = driver.id;
        if (lap > 2) {
          lapEvents.push({
            lap,
            type: 'FASTEST_LAP',
            driverId: driver.id,
            teamId: team.id,
            message: `🟣 Volta Mais Rápida de ${driver.name} (${team.name}): ${this.formatarTempo(lapTime)}`,
          });
        }
      }
    }

    // 4. Reordena classificação e verifica disputas de posição / DRS
    const activeCars = session.cars.filter((c) => c.status !== 'DNF');
    const dnfCars = session.cars.filter((c) => c.status === 'DNF');

    // Se Safety Car estiver na pista, os carros agrupam o gap!
    if (underSC && activeCars.length > 1) {
      activeCars.sort((a, b) => a.totalTimeSec - b.totalTimeSec);
      const leaderTime = activeCars[0].totalTimeSec;
      activeCars.forEach((c, idx) => {
        c.totalTimeSec = leaderTime + idx * 0.45;
      });
    } else {
      activeCars.sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    }

    const leaderTime = activeCars[0]?.totalTimeSec ?? 0;
    activeCars.forEach((c, idx) => {
      c.position = idx + 1;
      c.gapToLeaderSec = Number((c.totalTimeSec - leaderTime).toFixed(3));
      c.intervalToAheadSec = idx === 0 ? 0 : Number((c.totalTimeSec - activeCars[idx - 1].totalTimeSec).toFixed(3));
      // Progresso visual normalizado na pista para o Canvas 2D
      const gapPenalty = Math.min(0.85, c.gapToLeaderSec / track.baseLapTimeSec);
      c.trackProgress = ((lap * 0.17 - gapPenalty) % 1 + 1) % 1;
    });

    dnfCars.forEach((c, idx) => {
      c.position = activeCars.length + idx + 1;
    });

    session.cars.sort((a, b) => a.position - b.position);

    // Detecta ultrapassagens importantes no Top 10 ou envolvendo a equipe do jogador
    if (!underSC) {
      activeCars.forEach((c) => {
        const oldIdx = previousOrder.indexOf(c.driverId);
        const newIdx = c.position - 1;
        if (oldIdx > newIdx && (newIdx < 8 || c.teamId === myTeamId)) {
          const driver = drivers.find((d) => d.id === c.driverId)!;
          const overtakenId = previousOrder[newIdx];
          const overtakenDriver = drivers.find((d) => d.id === overtakenId);
          if (overtakenDriver && overtakenDriver.id !== driver.id && c.status !== 'PIT') {
            // Evita flood de eventos: registra até 2 ultrapassagens de destaque por volta
            const overtakesThisLap = lapEvents.filter((e) => e.type === 'OVERTAKE').length;
            if (overtakesThisLap < 2 || c.teamId === myTeamId) {
              lapEvents.push({
                lap,
                type: 'OVERTAKE',
                driverId: driver.id,
                targetDriverId: overtakenDriver.id,
                teamId: c.teamId,
                message: `🔥 Ultrapassagem! ${driver.name} mergulha por dentro e assume o P${c.position} de ${overtakenDriver.shortCode}!`,
                isHighlight: c.teamId === myTeamId || c.position <= 3,
              });
            }
          }
        }
      });
    }

    // 5. Fim da corrida
    if (session.currentLap >= session.totalLaps) {
      session.isFinished = true;
      const winner = activeCars[0];
      const winDriver = drivers.find((d) => d.id === winner?.driverId);
      const winTeam = teams.find((t) => t.id === winner?.teamId);
      lapEvents.push({
        lap,
        type: 'FINISH',
        driverId: winDriver?.id,
        teamId: winTeam?.id,
        message: `🏁 BANDEIRA QUADRICULADA! ${winDriver?.name ?? 'Piloto'} vence o ${track.name} pela ${winTeam?.name ?? 'Equipe'}!`,
        isHighlight: true,
      });
    }

    session.events.push(...lapEvents);
    return lapEvents;
  }

  private calcularTempoVoltaCorrida(
    car: LiveCarState,
    driver: Driver,
    team: Team,
    track: Track,
    session: LiveRaceSession,
    underSC: boolean
  ): number {
    if (underSC) {
      return Number((track.baseLapTimeSec * 1.32 + Math.random() * 0.2).toFixed(3));
    }

    const carPerf = this.calcularForcaCarroPista(team, track);
    const isWet = session.weather !== 'DRY';
    const driverSkill = isWet
      ? driver.stats.pace * 0.55 + driver.stats.wetSkill * 0.45
      : driver.stats.pace * 0.7 + driver.stats.racecraft * 0.3;

    const carDelta = (95 - carPerf) * 0.048;
    const driverDelta = (95 - driverSkill) * 0.034;

    // Delta do Composto de Pneu vs Umidade da Pista
    let compoundDelta = 0;
    const w = session.trackWetness;
    if (w < 20) {
      // Pista seca
      if (car.tireCompound === 'SOFT') compoundDelta = -0.45;
      else if (car.tireCompound === 'MEDIUM') compoundDelta = 0.0;
      else if (car.tireCompound === 'HARD') compoundDelta = 0.42;
      else if (car.tireCompound === 'INTER') compoundDelta = 2.6;
      else if (car.tireCompound === 'WET') compoundDelta = 5.2;
    } else if (w < 65) {
      // Pista úmida (Intermediário é o ideal)
      if (car.tireCompound === 'INTER') compoundDelta = -0.6;
      else if (car.tireCompound === 'WET') compoundDelta = 1.1;
      else compoundDelta = 4.4; // Slick na chuva escorrega muito!
    } else {
      // Chuva forte (Wet é o ideal)
      if (car.tireCompound === 'WET') compoundDelta = -0.8;
      else if (car.tireCompound === 'INTER') compoundDelta = 1.9;
      else compoundDelta = 8.5; // Slick no dilúvio
    }

    // Penalidade por desgaste do pneu
    let wearDelta = (100 - car.tireWear) * 0.018;
    if (car.tireWear < 30) {
      // "The Cliff" (queda brusca de aderência abaixo de 30%)
      wearDelta += (30 - car.tireWear) * 0.095;
    }

    // Modos de ERS e Ritmo
    let ersDelta = 0;
    if (car.ersMode === 'OVERTAKE' && car.ersBattery >= 15) ersDelta = -0.42;
    else if (car.ersMode === 'CONSERVE') ersDelta = 0.28;

    let paceDelta = 0;
    if (car.paceStrategy === 'AGGRESSIVE') paceDelta = -0.32;
    else if (car.paceStrategy === 'CONSERVATIVE') paceDelta = 0.32;

    const jitter = (Math.random() - 0.5) * 0.28;

    return Number(
      (track.baseLapTimeSec + carDelta + driverDelta + compoundDelta + wearDelta + ersDelta + paceDelta + jitter).toFixed(3)
    );
  }

  private aplicarDesgastePneuEBateria(
    car: LiveCarState,
    driver: Driver,
    track: Track,
    session: LiveRaceSession,
    underSC: boolean
  ) {
    let baseWear = 2.1 * track.tireWearFactor;
    if (car.tireCompound === 'SOFT') baseWear *= 1.42;
    else if (car.tireCompound === 'MEDIUM') baseWear *= 1.0;
    else if (car.tireCompound === 'HARD') baseWear *= 0.72;
    else if (car.tireCompound === 'INTER') baseWear *= session.trackWetness < 15 ? 1.85 : 0.95;
    else if (car.tireCompound === 'WET') baseWear *= session.trackWetness < 35 ? 2.1 : 0.85;

    if (car.paceStrategy === 'AGGRESSIVE') baseWear *= 1.28;
    else if (car.paceStrategy === 'CONSERVATIVE') baseWear *= 0.76;

    if (underSC) baseWear *= 0.35;

    // Habilidade do piloto em poupar pneus (reduz desgaste em até 22%)
    const mgmtSave = 1 - ((driver.stats.tireMgmt - 70) / 100) * 0.55;
    const finalWear = baseWear * Math.max(0.75, Math.min(1.15, mgmtSave));

    car.tireWear = Math.max(1, Number((car.tireWear - finalWear).toFixed(1)));

    // Bateria ERS
    if (underSC || car.ersMode === 'CONSERVE') {
      car.ersBattery = Math.min(100, car.ersBattery + 22);
    } else if (car.ersMode === 'OVERTAKE') {
      car.ersBattery = Math.max(0, car.ersBattery - 26);
      if (car.ersBattery === 0) {
        car.ersMode = 'BALANCED'; // Volta para neutro quando descarrega
      }
    } else {
      car.ersBattery = Math.min(100, Math.max(0, car.ersBattery - 3));
    }
  }

  private executarPitStop(
    car: LiveCarState,
    driver: Driver,
    team: Team,
    session: LiveRaceSession,
    underSC: boolean,
    lapEvents: RaceEvent[]
  ) {
    car.status = 'PIT';
    car.pitStopRequested = false;
    car.pitStops += 1;

    // Tempo de pit lane: ~20s normal, ou ~12s sob Safety Car!
    const pitLaneLoss = underSC ? 12.2 : 19.8;
    // Tempo da parada em si (2.0s a 3.5s baseado no Pit Crew da equipe)
    const stationaryTime = 2.0 + ((100 - team.car.pitCrew) / 100) * 1.4 + Math.random() * 0.35;
    const hasSlowStop = Math.random() < (100 - team.car.pitCrew) * 0.0025;
    const extraDelay = hasSlowStop ? 2.6 : 0;

    const totalPitLoss = Number((pitLaneLoss + stationaryTime + extraDelay).toFixed(2));
    car.totalTimeSec += totalPitLoss;
    car.lastLapTimeSec = Number((car.lastLapTimeSec + totalPitLoss).toFixed(3));

    const oldTire = car.tireCompound;
    car.tireCompound = car.nextPitCompound;
    car.tireWear = 100;
    car.tireAgeLaps = 0;
    car.usedCompounds.push(car.tireCompound);

    lapEvents.push({
      lap: session.currentLap,
      type: 'PIT_STOP',
      driverId: driver.id,
      teamId: team.id,
      message: `🔧 BOX: ${driver.name} (${team.name}) troca ${oldTire} ➡️ ${car.tireCompound} em ${(stationaryTime + extraDelay).toFixed(1)}s${hasSlowStop ? ' (Porca presa!)' : ''}.`,
    });
  }

  private decidirEstrategiaIA(car: LiveCarState, session: LiveRaceSession, track: Track) {
    const remainingLaps = session.totalLaps - session.currentLap;
    if (remainingLaps <= 2) return;

    const isWetTrack = session.trackWetness >= 25;
    const onWetTire = car.tireCompound === 'INTER' || car.tireCompound === 'WET';

    // Troca imediata se o clima virou
    if (isWetTrack && !onWetTire) {
      car.pitStopRequested = true;
      car.nextPitCompound = session.trackWetness >= 68 ? 'WET' : 'INTER';
      return;
    }
    if (!isWetTrack && onWetTire) {
      car.pitStopRequested = true;
      car.nextPitCompound = remainingLaps < 18 ? 'SOFT' : 'MEDIUM';
      return;
    }

    // Parada por desgaste de pneu ou aproveitando Safety Car
    const scWindow = session.safetyCarLaps > 0 && car.tireWear < 55 && remainingLaps > 10;
    if (car.tireWear < 27 || scWindow) {
      car.pitStopRequested = true;
      if (isWetTrack) {
        car.nextPitCompound = session.trackWetness >= 68 ? 'WET' : 'INTER';
      } else if (remainingLaps <= 16) {
        car.nextPitCompound = 'SOFT';
      } else if (car.tireCompound === 'SOFT') {
        car.nextPitCompound = remainingLaps > 26 ? 'HARD' : 'MEDIUM';
      } else {
        car.nextPitCompound = car.usedCompounds.includes('HARD') ? 'MEDIUM' : 'HARD';
      }
    }

    // Uso inteligente de ERS pela IA
    if (car.intervalToAheadSec > 0 && car.intervalToAheadSec < 1.2 && car.ersBattery > 45) {
      car.ersMode = 'OVERTAKE';
    } else if (car.ersBattery < 25) {
      car.ersMode = 'CONSERVE';
    } else {
      car.ersMode = 'BALANCED';
    }
  }

  private atualizarClima(session: LiveRaceSession, track: Track, lapEvents: RaceEvent[]) {
    if (session.currentLap % 5 !== 0) return;

    const roll = Math.random() * 100;
    const prevWeather = session.weather;

    if (session.weather === 'DRY') {
      if (roll < track.rainProbability * 0.28) {
        session.weather = 'LIGHT_RAIN';
        session.trackWetness = 35;
      } else {
        session.trackWetness = Math.max(0, session.trackWetness - 10);
      }
    } else if (session.weather === 'LIGHT_RAIN') {
      if (roll < 25) {
        session.weather = 'HEAVY_RAIN';
        session.trackWetness = 78;
      } else if (roll > 72) {
        session.weather = 'DRY';
        session.trackWetness = 12;
      } else {
        session.trackWetness = 45;
      }
    } else {
      if (roll > 55) {
        session.weather = 'LIGHT_RAIN';
        session.trackWetness = 48;
      } else {
        session.trackWetness = 85;
      }
    }

    if (session.weather !== prevWeather) {
      const label =
        session.weather === 'DRY'
          ? '☀️ A chuva parou e o trilho seco começa a se formar! Pneus Slick (Soft/Med/Hard) já são mais rápidos!'
          : session.weather === 'LIGHT_RAIN'
          ? '🌧️ Começa a chover no circuito! Pneus Intermediários (INTER) recomendados!'
          : '⛈️ Tempestade intensa na pista! Pneus de Chuva Extrema (WET) necessários!';

      lapEvents.push({
        lap: session.currentLap,
        type: 'WEATHER_CHANGE',
        message: label,
        isHighlight: true,
      });
    }
  }

  public formatarTempo(sec: number): string {
    if (!isFinite(sec) || sec <= 0 || sec >= 900) return '—';
    const mins = Math.floor(sec / 60);
    const rem = sec - mins * 60;
    const secStr = rem < 10 ? `0${rem.toFixed(3)}` : rem.toFixed(3);
    return `${mins}:${secStr}`;
  }
}

export const raceEngine = new RaceEngine();

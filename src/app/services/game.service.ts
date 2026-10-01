import { Injectable, signal, computed, effect } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { 
  GameState, 
  ConnectionStatus, 
  RoundStateDto, 
  RoundCrashDto, 
  RoundHistoryItem, 
  ActiveBet, 
  CashoutResultDto, 
  BetDto, 
  CashoutRequestDto,
  ProvablyFairVerifyRequest,
  ProvablyFairVerifyResponse
} from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private hubConnection: signalR.HubConnection | null = null;
  private readonly baseUrl = 'https://gameserver20260822235345-fffadja8b6ayfxea.canadacentral-01.azurewebsites.net'; // Default .NET 10 API URL

  // User Identity & Balance Signals
  readonly userId = signal<string>(this.getOrCreateUserId());
  readonly userName = signal<string>('Pilot_' + this.userId().substring(0, 5));
  readonly userBalance = signal<number>(0.00);

  // Connection & Game State Signals
  readonly connectionState = signal<ConnectionStatus>('disconnected');
  readonly gameState = signal<GameState>(GameState.WaitingForBets);
  readonly currentMultiplier = signal<number>(1.00);
  readonly flightSeconds = signal<number>(0.0);
  readonly remainingCountdown = signal<number>(10.0);
  readonly currentRoundId = signal<string>('');
  readonly preCommitmentHash = signal<string>('');
  
  // Last Crash & Round History
  readonly lastCrash = signal<RoundCrashDto | null>(null);
  readonly roundHistory = signal<RoundHistoryItem[]>([]);
  readonly activeBets = signal<ActiveBet[]>([]);
  readonly latestCashouts = signal<CashoutResultDto[]>([]);

  // Sound Effects & Haptics Toggle
  readonly soundEnabled = signal<boolean>(true);

  // Computed state helpers
  readonly isFlying = computed(() => this.gameState() === GameState.Flying);
  readonly isWaiting = computed(() => this.gameState() === GameState.WaitingForBets);
  readonly isCrashed = computed(() => this.gameState() === GameState.Crashed);
  readonly isConnected = computed(() => this.connectionState() === 'connected');

  constructor() {
    this.initSignalR();
    this.fetchInitialHistory();
  }

  private getOrCreateUserId(): string {
    const key = 'smartbet_aviator_user_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }

  public async initSignalR(): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connectionState.set('connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/game?userId=${this.userId()}`, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.registerSignalREvents();

    try {
      await this.hubConnection.start();
      this.connectionState.set('connected');
      console.log('SignalR connected to GameHub successfully.');
      
      // Request active history and round snapshot
      await this.refreshHistory();
    } catch (err) {
      console.error('Failed to establish SignalR connection:', err);
      this.connectionState.set('disconnected');
      // Retry in 3s
      setTimeout(() => this.initSignalR(), 3000);
    }
  }

  private registerSignalREvents(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set('reconnecting');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionState.set('connected');
      this.refreshHistory();
    });

    this.hubConnection.onclose(() => {
      this.connectionState.set('disconnected');
      setTimeout(() => this.initSignalR(), 3000);
    });

    // 1. Round Starting (Countdown Window)
    this.hubConnection.on('RoundStarting', (state: RoundStateDto) => {
      this.gameState.set(GameState.WaitingForBets);
      this.currentRoundId.set(state.roundId);
      this.preCommitmentHash.set(state.preCommitmentHash);
      this.remainingCountdown.set(state.remainingCountdownSeconds);
      this.currentMultiplier.set(1.00);
      this.flightSeconds.set(0.0);
      this.activeBets.set(state.activeBets || []);
    });

    // 2. Round Started (Flying Phase)
    this.hubConnection.on('RoundStarted', (state: RoundStateDto) => {
      this.gameState.set(GameState.Flying);
      this.currentRoundId.set(state.roundId);
      this.currentMultiplier.set(1.00);
      this.flightSeconds.set(0.0);
      this.activeBets.set(state.activeBets || []);
    });

    // 3. Multiplier Tick (20Hz broadcast)
    this.hubConnection.on('MultiplierTick', (multiplier: number, elapsedSec: number) => {
      this.currentMultiplier.set(multiplier);
      this.flightSeconds.set(elapsedSec);
    });

    // 4. Round Crashed
    this.hubConnection.on('RoundCrashed', (crashData: RoundCrashDto) => {
      this.gameState.set(GameState.Crashed);
      this.lastCrash.set(crashData);
      this.currentMultiplier.set(crashData.crashMultiplier);

      // Prepend to history strip
      this.roundHistory.update(prev => {
        const item: RoundHistoryItem = {
          roundId: crashData.roundId,
          crashMultiplier: crashData.crashMultiplier,
          preCommitmentHash: crashData.preCommitmentHash,
          serverSeed: crashData.serverSeed,
          clientSeed: crashData.clientSeed,
          endedAtUtc: crashData.crashedAtUtc
        };
        return [item, ...prev.slice(0, 19)];
      });
    });

    // 5. Player Bet Placed
    this.hubConnection.on('PlayerBetPlaced', (bet: ActiveBet) => {
      this.activeBets.update(current => {
        const exists = current.some(b => b.betId === bet.betId);
        return exists ? current : [bet, ...current];
      });
    });

    // 6. Player Cashed Out
    this.hubConnection.on('PlayerCashedOut', (result: CashoutResultDto) => {
      this.latestCashouts.update(list => [result, ...list.slice(0, 14)]);
      
      // Update bet in active bets array
      this.activeBets.update(bets => bets.map(b => {
        if (b.betId === result.betId) {
          return {
            ...b,
            cashoutMultiplier: result.multiplier,
            winAmount: result.winAmount,
            cashedOutAtUtc: result.timestampUtc
          };
        }
        return b;
      }));
    });

    // 7. Balance Updated
    this.hubConnection.on('BalanceUpdated', (newBalance: number) => {
      this.userBalance.set(newBalance);
    });

    // 8. Error Notification
    this.hubConnection.on('ErrorNotification', (error: string) => {
      console.warn('Backend Game Server notification:', error);
    });
  }

  public async placeBet(amount: number, autoCashoutMultiplier: number | null, panelIndex: number): Promise<string> {
    const betId = 'bet_' + Math.random().toString(36).substring(2, 10);
    const dto: BetDto = {
      betId,
      userId: this.userId(),
      userName: this.userName(),
      amount,
      autoCashoutMultiplier,
      panelIndex
    };

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('PlaceBet', dto);
    } else {
      throw new Error('Not connected to game server.');
    }

    return betId;
  }

  public async requestCashout(betId: string, panelIndex: number): Promise<void> {
    const dto: CashoutRequestDto = {
      betId,
      userId: this.userId(),
      panelIndex
    };

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('RequestCashout', dto);
    } else {
      throw new Error('Not connected to game server.');
    }
  }

  public async refreshHistory(): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      try {
        const history = await this.hubConnection.invoke<RoundHistoryItem[]>('GetLatestHistory');
        if (history && history.length > 0) {
          this.roundHistory.set(history);
        }
      } catch (err) {
        console.error('Failed to invoke GetLatestHistory:', err);
      }
    }
  }

  private async fetchInitialHistory(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/game/history?limit=20`);
      if (res.ok) {
        const data = await res.json();
        this.roundHistory.set(data);
      }
    } catch {
      // Gracefully silent on initial offline load
    }
  }

  public async verifyRound(serverSeed: string, clientSeed: string, roundId: string): Promise<ProvablyFairVerifyResponse> {
    const res = await fetch(`${this.baseUrl}/api/provably-fair/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverSeed, clientSeed, roundId })
    });

    if (!res.ok) {
      throw new Error('Verification request failed');
    }
    return await res.json();
  }

  public setUserProfile(userId: string, userName: string, balance: number): void {
    this.userId.set(userId);
    this.userName.set(userName);
    this.userBalance.set(balance);
    localStorage.setItem('smartbet_aviator_user_id', userId);
  }

  public updateBalance(newBalance: number): void {
    this.userBalance.set(newBalance);
  }

  public async fetchUserBalance(userId?: string): Promise<void> {
    const id = userId || this.userId();
    try {
      const res = await fetch(`${this.baseUrl}/api/user/${id}/balance`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.balance === 'number') {
          this.userBalance.set(data.balance);
        }
      }
    } catch {
      // Graceful offline fallback
    }
  }

  public toggleSound(): void {
    this.soundEnabled.update(s => !s);
  }
}


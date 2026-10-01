import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ViewChild, 
  ChangeDetectionStrategy, 
  signal, 
  computed, 
  effect 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';
import { AuthService } from '../../services/auth.service';
import { AviatorCanvasRenderer } from './canvas-renderer';
import { 
  GameState, 
  BettingPanelState, 
  RoundHistoryItem, 
  ProvablyFairVerifyResponse, 
  ActiveBet 
} from '../../models/game.models';
import { AuthModalComponent, AuthTab } from '../auth-modal/auth-modal.component';
import { DepositModalComponent } from '../deposit-modal/deposit-modal.component';
import { WithdrawModalComponent } from '../withdraw-modal/withdraw-modal.component';

@Component({
  selector: 'app-aviator-game',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AuthModalComponent, 
    DepositModalComponent, 
    WithdrawModalComponent
  ],
  templateUrl: './aviator-game.component.html',
  styleUrls: ['./aviator-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AviatorGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer = new AviatorCanvasRenderer();
  private resizeObserver: ResizeObserver | null = null;

  // Modal Dialogs State
  readonly isAuthModalOpen = signal<boolean>(false);
  readonly authInitialTab = signal<AuthTab>('login');
  readonly isDepositModalOpen = signal<boolean>(false);
  readonly isWithdrawModalOpen = signal<boolean>(false);
  readonly isUserMenuOpen = signal<boolean>(false);


  // Active Bet Board Tab Filter
  readonly activeTab = signal<'all' | 'my' | 'top'>('all');

  // Dual Betting Panels State
  readonly panel1 = signal<BettingPanelState>({
    amount: 100,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.00,
    isPlaced: false,
    activeBetId: null,
    hasCashedOut: false,
    lastWinAmount: null
  });

  readonly panel2 = signal<BettingPanelState>({
    amount: 50,
    autoCashoutEnabled: true,
    autoCashoutMultiplier: 1.50,
    isPlaced: false,
    activeBetId: null,
    hasCashedOut: false,
    lastWinAmount: null
  });

  // Provably Fair Verifier Modal State
  readonly isVerifyModalOpen = signal<boolean>(false);
  readonly selectedHistoryItem = signal<RoundHistoryItem | null>(null);
  readonly verifyServerSeed = signal<string>('');
  readonly verifyClientSeed = signal<string>('');
  readonly verifyRoundId = signal<string>('');
  readonly verifyResult = signal<ProvablyFairVerifyResponse | null>(null);
  readonly isVerifying = signal<boolean>(false);

  // Quick Bet Presets
  readonly quickBets = [10, 50, 100, 500];

  // Filtered bets for the multiplayer board
  readonly displayedBets = computed(() => {
    const tab = this.activeTab();
    const allBets = this.gameService.activeBets();
    const myId = this.gameService.userId();

    if (tab === 'my') {
      return allBets.filter(b => b.userId === myId);
    } else if (tab === 'top') {
      return [...allBets]
        .filter(b => b.winAmount && b.winAmount > 0)
        .sort((a, b) => (b.winAmount || 0) - (a.winAmount || 0));
    }
    return allBets;
  });

  // Total wagered & total active players count
  readonly activePlayerCount = computed(() => this.gameService.activeBets().length);
  readonly totalRoundWagered = computed(() => 
    this.gameService.activeBets().reduce((sum, b) => sum + b.amount, 0)
  );

  constructor(
    public gameService: GameService,
    public authService: AuthService
  ) {
    // Synchronize Canvas Renderer with Signal updates
    effect(() => {
      const state = this.gameService.gameState();
      const mult = this.gameService.currentMultiplier();
      const flightSec = this.gameService.flightSeconds();
      const countdown = this.gameService.remainingCountdown();

      this.renderer.updateState(state, mult, flightSec, countdown);

      // Handle round state transitions for bet panels
      if (state === GameState.WaitingForBets) {
        this.resetPanelRoundEnd(0);
        this.resetPanelRoundEnd(1);
      } else if (state === GameState.Crashed) {
        this.handleCrashSettlement(0);
        this.handleCrashSettlement(1);
      }
    });

    // Watch latest cashouts to mark player's panels as cashed out
    effect(() => {
      const cashouts = this.gameService.latestCashouts();
      if (cashouts.length === 0) return;
      const myId = this.gameService.userId();

      const latest = cashouts[0];
      if (latest.userId === myId) {
        if (latest.panelIndex === 0) {
          this.panel1.update(p => ({
            ...p,
            hasCashedOut: true,
            lastWinAmount: latest.winAmount
          }));
        } else if (latest.panelIndex === 1) {
          this.panel2.update(p => ({
            ...p,
            hasCashedOut: true,
            lastWinAmount: latest.winAmount
          }));
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.canvasRef?.nativeElement) {
      this.renderer.init(this.canvasRef.nativeElement);

      this.resizeObserver = new ResizeObserver(() => {
        this.renderer.handleResize();
      });
      this.resizeObserver.observe(this.canvasRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.renderer.destroy();
  }

  // --- Betting Panel Actions ---

  public async onPanelActionClick(panelIndex: number): Promise<void> {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    const state = this.gameService.gameState();

    // 1. Place Bet (Allowed during Waiting phase)
    if (state === GameState.WaitingForBets && !panel.isPlaced) {
      if (panel.amount <= 0 || panel.amount > this.gameService.userBalance()) {
        alert('Invalid bet amount or insufficient balance.');
        return;
      }

      try {
        const autoMult = panel.autoCashoutEnabled ? panel.autoCashoutMultiplier : null;
        const betId = await this.gameService.placeBet(panel.amount, autoMult, panelIndex);

        this.updatePanel(panelIndex, {
          isPlaced: true,
          activeBetId: betId,
          hasCashedOut: false,
          lastWinAmount: null
        });
      } catch (err: any) {
        alert(err.message || 'Failed to place bet');
      }
      return;
    }

    // 2. Cashout (Allowed during Flying phase when bet is active and not yet cashed out)
    if (state === GameState.Flying && panel.isPlaced && !panel.hasCashedOut && panel.activeBetId) {
      try {
        await this.gameService.requestCashout(panel.activeBetId, panelIndex);
      } catch (err: any) {
        console.error('Cashout failed:', err);
      }
    }
  }

  public adjustAmount(panelIndex: number, delta: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    if (panel.isPlaced) return;
    const newAmount = Math.max(1, panel.amount + delta);
    this.updatePanel(panelIndex, { amount: newAmount });
  }

  public multiplyAmount(panelIndex: number, factor: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    if (panel.isPlaced) return;
    const newAmount = Math.max(1, Math.round(panel.amount * factor));
    this.updatePanel(panelIndex, { amount: newAmount });
  }

  public setMaxAmount(panelIndex: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    if (panel.isPlaced) return;
    const balance = this.gameService.userBalance();
    this.updatePanel(panelIndex, { amount: Math.max(1, Math.floor(balance)) });
  }

  public toggleAutoCashout(panelIndex: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    this.updatePanel(panelIndex, { autoCashoutEnabled: !panel.autoCashoutEnabled });
  }

  public setAutoCashoutMultiplier(panelIndex: number, mult: number): void {
    this.updatePanel(panelIndex, { autoCashoutMultiplier: Math.max(1.01, mult) });
  }

  private updatePanel(panelIndex: number, partial: Partial<BettingPanelState>): void {
    if (panelIndex === 0) {
      this.panel1.update(p => ({ ...p, ...partial }));
    } else {
      this.panel2.update(p => ({ ...p, ...partial }));
    }
  }

  private resetPanelRoundEnd(panelIndex: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    if (panel.isPlaced && panel.hasCashedOut) {
      this.updatePanel(panelIndex, {
        isPlaced: false,
        activeBetId: null,
        hasCashedOut: false
      });
    }
  }

  private handleCrashSettlement(panelIndex: number): void {
    const panel = panelIndex === 0 ? this.panel1() : this.panel2();
    if (panel.isPlaced && !panel.hasCashedOut) {
      this.updatePanel(panelIndex, {
        isPlaced: false,
        activeBetId: null,
        hasCashedOut: false,
        lastWinAmount: null
      });
    }
  }

  // --- Multiplier Badge Styling ---

  public getMultiplierBadgeClass(multiplier: number): string {
    if (multiplier >= 10.0) return 'badge-gold';
    if (multiplier >= 2.0) return 'badge-purple';
    return 'badge-blue';
  }

  // --- Provably Fair Verifier Dialog ---

  public openVerifyModal(item?: RoundHistoryItem): void {
    if (item) {
      this.selectedHistoryItem.set(item);
      this.verifyServerSeed.set(item.serverSeed);
      this.verifyClientSeed.set(item.clientSeed);
      this.verifyRoundId.set(item.roundId);
    } else {
      const last = this.gameService.lastCrash();
      if (last) {
        this.verifyServerSeed.set(last.serverSeed);
        this.verifyClientSeed.set(last.clientSeed);
        this.verifyRoundId.set(last.roundId);
      }
    }
    this.verifyResult.set(null);
    this.isVerifyModalOpen.set(true);
  }

  public closeVerifyModal(): void {
    this.isVerifyModalOpen.set(false);
  }

  public async runProvablyFairVerification(): Promise<void> {
    const sSeed = this.verifyServerSeed();
    const cSeed = this.verifyClientSeed();
    const rId = this.verifyRoundId();

    if (!sSeed || !cSeed || !rId) {
      alert('Please fill in all seeds and Round ID.');
      return;
    }

    this.isVerifying.set(true);
    try {
      const res = await this.gameService.verifyRound(sSeed, cSeed, rId);
      this.verifyResult.set(res);
    } catch (err: any) {
      alert('Verification failed: ' + err.message);
    } finally {
      this.isVerifying.set(false);
    }
  }

  // --- Auth & Wallet Modal Controllers ---

  public openAuthModal(tab: AuthTab = 'login'): void {
    this.authInitialTab.set(tab);
    this.isAuthModalOpen.set(true);
    this.isUserMenuOpen.set(false);
  }

  public closeAuthModal(): void {
    this.isAuthModalOpen.set(false);
  }

  public openDepositModal(): void {
    this.isDepositModalOpen.set(true);
    this.isUserMenuOpen.set(false);
  }

  public closeDepositModal(): void {
    this.isDepositModalOpen.set(false);
  }

  public openWithdrawModal(): void {
    this.isWithdrawModalOpen.set(true);
    this.isUserMenuOpen.set(false);
  }

  public closeWithdrawModal(): void {
    this.isWithdrawModalOpen.set(false);
  }

  public toggleUserMenu(): void {
    this.isUserMenuOpen.update(v => !v);
  }

  public logoutUser(): void {
    this.authService.logout();
    this.isUserMenuOpen.set(false);
  }
}


import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  signal, 
  computed, 
  inject, 
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { GameService } from '../../services/game.service';
import { AuthService } from '../../services/auth.service';
import { WithdrawalMethodType } from '../../models/game.models';

interface WithdrawOption {
  id: WithdrawalMethodType;
  name: string;
  badge: string;
  minAmount: number;
  processingTime: string;
}

@Component({
  selector: 'app-withdraw-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './withdraw-modal.component.html',
  styleUrls: ['./withdraw-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WithdrawModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  public walletService = inject(WalletService);
  public gameService = inject(GameService);
  public authService = inject(AuthService);

  readonly selectedMethod = signal<WithdrawalMethodType>('EFT_BANK');
  readonly withdrawAmount = signal<number>(50);
  readonly customAmount = signal<string>('50');

  // Form Fields
  readonly bankName = signal<string>('Capitec Bank');
  readonly accountNumber = signal<string>('');
  readonly accountHolder = signal<string>('');
  readonly mobileNumber = signal<string>('');
  readonly cryptoAddress = signal<string>('');

  readonly isSuccessModal = signal<boolean>(false);
  readonly lastWithdrawDetails = signal<{ amount: number; method: string; destination: string; txId: string } | null>(null);

  readonly withdrawalMethods: WithdrawOption[] = [
    {
      id: 'EFT_BANK',
      name: 'Instant Bank EFT (Direct to Bank)',
      badge: 'POPULAR',
      minAmount: 50,
      processingTime: 'Within 1-2 Hours'
    },
    {
      id: 'EWALLET_FNB',
      name: 'FNB eWallet / Instant Money',
      badge: 'CASH SEND',
      minAmount: 50,
      processingTime: 'Within 15 Mins'
    },
    {
      id: 'CRYPTO_USDT',
      name: 'Crypto USDT (TRC-20)',
      badge: 'GLOBAL',
      minAmount: 100,
      processingTime: 'Instant'
    }
  ];

  readonly southAfricanBanks = [
    'Capitec Bank',
    'FNB (First National Bank)',
    'Standard Bank',
    'Nedbank',
    'ABSA Bank',
    'TymeBank',
    'Discovery Bank',
    'African Bank',
    'Investec'
  ];

  public selectMethod(method: WithdrawalMethodType): void {
    this.selectedMethod.set(method);
  }

  public setPercentage(pct: number): void {
    const balance = this.gameService.userBalance();
    if (balance <= 0) {
      this.withdrawAmount.set(0);
      this.customAmount.set('0');
      return;
    }
    const calculated = Math.floor((balance * pct) / 100);
    this.withdrawAmount.set(calculated);
    this.customAmount.set(calculated.toString());
  }

  public onCustomAmountChange(val: string): void {
    this.customAmount.set(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      this.withdrawAmount.set(parsed);
    }
  }

  public async onWithdrawSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const amt = this.withdrawAmount();
    const balance = this.gameService.userBalance();

    if (amt <= 0) return;

    if (amt > balance) {
      this.walletService.operationError.set(`Insufficient balance. You currently have R${balance.toFixed(2)}`);
      return;
    }

    if (amt < 50) {
      this.walletService.operationError.set('Minimum withdrawal amount is R50.00.');
      return;
    }

    const method = this.selectedMethod();
    let destination = '';

    if (method === 'EFT_BANK') {
      if (!this.accountNumber().trim()) {
        this.walletService.operationError.set('Please provide your bank account number.');
        return;
      }
      destination = `${this.bankName()} - ${this.accountNumber().trim()}`;
    } else if (method === 'EWALLET_FNB' || method === 'INSTANT_MONEY') {
      if (!this.mobileNumber().trim()) {
        this.walletService.operationError.set('Please enter your valid cellphone number for Cash Send.');
        return;
      }
      destination = this.mobileNumber().trim();
    } else if (method === 'CRYPTO_USDT') {
      if (!this.cryptoAddress().trim()) {
        this.walletService.operationError.set('Please provide your USDT TRC-20 wallet address.');
        return;
      }
      destination = this.cryptoAddress().trim();
    }

    const result = await this.walletService.withdraw({
      userId: this.gameService.userId(),
      amount: amt,
      withdrawMethod: method,
      destinationAccount: destination,
      bankName: method === 'EFT_BANK' ? this.bankName() : undefined,
      accountHolder: this.accountHolder() || this.authService.currentUser()?.userName || 'Pilot'
    });

    if (result.success) {
      this.lastWithdrawDetails.set({
        amount: amt,
        method: method,
        destination: destination,
        txId: result.transactionId || 'WDR_' + Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      this.isSuccessModal.set(true);
    }
  }

  public finishWithdraw(): void {
    this.isSuccessModal.set(false);
    this.close.emit();
  }

  public closeModal(): void {
    this.isSuccessModal.set(false);
    this.close.emit();
  }
}

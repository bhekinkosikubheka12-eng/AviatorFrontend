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
import { PaymentMethodType } from '../../models/game.models';

interface PaymentOption {
  id: PaymentMethodType;
  name: string;
  badge: string;
  fee: string;
  processingTime: string;
  iconType: string;
}

@Component({
  selector: 'app-deposit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deposit-modal.component.html',
  styleUrls: ['./deposit-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepositModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  public walletService = inject(WalletService);
  public gameService = inject(GameService);
  public authService = inject(AuthService);

  readonly selectedMethod = signal<PaymentMethodType>('OZOW_EFT');
  readonly depositAmount = signal<number>(100);
  readonly customAmount = signal<string>('100');
  readonly voucherPin = signal<string>('');
  readonly userPhone = signal<string>('');
  readonly isSuccessModal = signal<boolean>(false);
  readonly lastDepositDetails = signal<{ amount: number; method: string; txId: string } | null>(null);

  readonly quickAmounts = [50, 100, 250, 500, 1000, 2500];

  readonly paymentMethods: PaymentOption[] = [
    {
      id: 'OZOW_EFT',
      name: 'Instant EFT (Ozow / SiD)',
      badge: 'POPULAR',
      fee: '0% Fee',
      processingTime: 'Instant',
      iconType: 'bank'
    },
    {
      id: 'CAPITEC_PAY',
      name: 'Capitec Pay',
      badge: 'FASTEST',
      fee: '0% Fee',
      processingTime: 'Instant',
      iconType: 'mobile'
    },
    {
      id: 'CARD',
      name: 'Visa / Mastercard',
      badge: 'SECURE',
      fee: '0% Fee',
      processingTime: 'Instant',
      iconType: 'card'
    },
    {
      id: 'VOUCHER_1V',
      name: '1Voucher / OTT Voucher',
      badge: 'CASH',
      fee: '0% Fee',
      processingTime: 'Instant',
      iconType: 'voucher'
    },
    {
      id: 'CRYPTO_USDT',
      name: 'Crypto (USDT TRC20 / BTC)',
      badge: 'WEB3',
      fee: 'Network Fee',
      processingTime: '~1 min',
      iconType: 'crypto'
    }
  ];

  public selectMethod(method: PaymentMethodType): void {
    this.selectedMethod.set(method);
  }

  public setQuickAmount(amt: number): void {
    this.depositAmount.set(amt);
    this.customAmount.set(amt.toString());
  }

  public onCustomAmountChange(val: string): void {
    this.customAmount.set(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      this.depositAmount.set(parsed);
    }
  }

  public async onDepositSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const amt = this.depositAmount();
    if (amt <= 0) return;

    const method = this.selectedMethod();
    const result = await this.walletService.deposit({
      userId: this.gameService.userId(),
      amount: amt,
      paymentMethod: method,
      reference: 'DEP_' + Date.now(),
      voucherCode: this.voucherPin() || undefined
    });

    if (result.success) {
      this.lastDepositDetails.set({
        amount: amt,
        method: method,
        txId: result.transactionId || 'TX_' + Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      this.isSuccessModal.set(true);
    }
  }

  public finishDeposit(): void {
    this.isSuccessModal.set(false);
    this.close.emit();
  }

  public closeModal(): void {
    this.isSuccessModal.set(false);
    this.close.emit();
  }
}

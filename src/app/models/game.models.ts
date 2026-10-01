export enum GameState {
  WaitingForBets = 'WaitingForBets',
  Flying = 'Flying',
  Crashed = 'Crashed'
}

export enum BetStatus {
  Active = 'Active',
  CashedOut = 'CashedOut',
  Lost = 'Lost'
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface BetDto {
  betId: string;
  userId: string;
  userName: string;
  amount: number;
  autoCashoutMultiplier: number | null;
  panelIndex: number;
}

export interface ActiveBet {
  betId: string;
  userId: string;
  userName: string;
  amount: number;
  autoCashoutMultiplier: number | null;
  panelIndex: number;
  placedAtUtc: string;
  status: BetStatus;
  cashoutMultiplier: number | null;
  winAmount: number | null;
  cashedOutAtUtc: string | null;
}

export interface CashoutRequestDto {
  betId: string;
  userId: string;
  panelIndex: number;
}

export interface CashoutResultDto {
  betId: string;
  userId: string;
  userName: string;
  multiplier: number;
  betAmount: number;
  winAmount: number;
  panelIndex: number;
  timestampUtc: string;
}

export interface RoundStateDto {
  roundId: string;
  state: GameState;
  currentMultiplier: number;
  elapsedSeconds: number;
  preCommitmentHash: string;
  stateStartedAtUtc: string;
  remainingCountdownSeconds: number;
  activeBets: ActiveBet[];
}

export interface RoundCrashDto {
  roundId: string;
  crashMultiplier: number;
  serverSeed: string;
  clientSeed: string;
  preCommitmentHash: string;
  crashedAtUtc: string;
}

export interface RoundHistoryItem {
  roundId: string;
  crashMultiplier: number;
  preCommitmentHash: string;
  serverSeed: string;
  clientSeed: string;
  endedAtUtc: string;
}

export interface BettingPanelState {
  amount: number;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  isPlaced: boolean;
  activeBetId: string | null;
  hasCashedOut: boolean;
  lastWinAmount: number | null;
}

export interface ProvablyFairVerifyRequest {
  serverSeed: string;
  clientSeed: string;
  roundId: string;
}

export interface ProvablyFairVerifyResponse {
  isValid: boolean;
  preCommitmentHash: string;
  combinedHash: string;
  multiplier: number;
  isInstantCrash: boolean;
}

// --- Auth Interfaces ---
export interface UserProfile {
  userId: string;
  userName: string;
  email: string;
  balance: number;
  createdAtUtc?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword?: string;
  resetCode?: string;
}

// --- Wallet & Payment Interfaces ---
export type PaymentMethodType = 'OZOW_EFT' | 'CAPITEC_PAY' | 'CARD' | 'VOUCHER_1V' | 'VOUCHER_OTT' | 'CRYPTO_USDT' | 'CRYPTO_BTC';
export type WithdrawalMethodType = 'EFT_BANK' | 'EWALLET_FNB' | 'INSTANT_MONEY' | 'CRYPTO_USDT';

export interface DepositRequest {
  userId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  voucherCode?: string;
}

export interface WithdrawRequest {
  userId: string;
  amount: number;
  withdrawMethod: string;
  destinationAccount: string;
  bankName?: string;
  accountHolder?: string;
}

export interface WalletOperationResult {
  success: boolean;
  message: string;
  newBalance: number;
  transactionId?: string;
}

export interface WalletTransaction {
  transactionId: string;
  userId: string;
  roundId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  timestampUtc: string;
}


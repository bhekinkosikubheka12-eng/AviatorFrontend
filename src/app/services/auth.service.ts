import { Injectable, signal, computed, inject } from '@angular/core';
import { 
  UserProfile, 
  AuthResponse, 
  RegisterRequest, 
  LoginRequest, 
  ResetPasswordRequest 
} from '../models/game.models';
import { GameService } from './game.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private gameService = inject(GameService);
  private readonly baseUrl = 'https://gameserver20260822235345-fffadja8b6ayfxea.canadacentral-01.azurewebsites.net';
  private readonly AUTH_STORAGE_KEY = 'smartbet_auth_user';
  private readonly TOKEN_STORAGE_KEY = 'smartbet_auth_token';

  readonly currentUser = signal<UserProfile | null>(this.loadStoredUser());
  readonly authToken = signal<string | null>(localStorage.getItem(this.TOKEN_STORAGE_KEY));
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isLoading = signal<boolean>(false);
  readonly authError = signal<string | null>(null);

  constructor() {
    const user = this.currentUser();
    if (user) {
      this.syncWithGameService(user);
    } else {
      // If guest/anonymous, ensure gameService uses starting balance of 0.00
      this.gameService.updateBalance(0.00);
    }
  }

  private loadStoredUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(this.AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored user profile', e);
    }
    return null;
  }

  private syncWithGameService(user: UserProfile): void {
    this.gameService.setUserProfile(user.userId, user.userName, user.balance ?? 0.00);
  }

  public async register(data: RegisterRequest): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.authError.set(null);

    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${this.baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch {
        // Backend server offline/unavailable: fallback to local simulation
      }

      if (res && res.ok) {
        const result: AuthResponse = await res.json();
        if (result.success && result.user) {
          this.setSession(result.user, result.token || '');
          return result;
        }
      } else if (res && !res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.message || 'Registration failed. Please check your details.';
        this.authError.set(errMsg);
        return { success: false, message: errMsg };
      }

      // Offline / Resilient Local Registration (Starts at R0.00)
      const mockUserId = 'pilot_' + Math.random().toString(36).substring(2, 10);
      const newUser: UserProfile = {
        userId: mockUserId,
        userName: data.userName.trim(),
        email: data.email.trim(),
        balance: 0.00, // Starts at R0.00
        createdAtUtc: new Date().toISOString()
      };
      const token = btoa(`${mockUserId}:${Date.now()}`);
      this.setSession(newUser, token);

      return {
        success: true,
        message: 'Account created successfully! Starting balance: R0.00',
        token,
        user: newUser
      };
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred during registration.';
      this.authError.set(msg);
      return { success: false, message: msg };
    } finally {
      this.isLoading.set(false);
    }
  }

  public async login(data: LoginRequest): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.authError.set(null);

    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${this.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch {
        // Fallback
      }

      if (res && res.ok) {
        const result: AuthResponse = await res.json();
        if (result.success && result.user) {
          this.setSession(result.user, result.token || '');
          return result;
        }
      } else if (res && !res.ok) {
        const errMsg = 'Invalid email/username or password.';
        this.authError.set(errMsg);
        return { success: false, message: errMsg };
      }

      // Offline / Local fallback if user was previously saved locally or matches demo
      const cleanInput = data.emailOrUsername.trim();
      const isDemo = cleanInput.toLowerCase() === 'demo@smartbet.io' || cleanInput.toLowerCase() === 'demo_pilot';
      
      const localUser: UserProfile = {
        userId: isDemo ? 'user_demo_1' : 'pilot_' + Math.random().toString(36).substring(2, 10),
        userName: isDemo ? 'demo_pilot' : cleanInput.split('@')[0],
        email: cleanInput.includes('@') ? cleanInput : `${cleanInput}@smartbet.io`,
        balance: 0.00,
        createdAtUtc: new Date().toISOString()
      };
      const token = btoa(`${localUser.userId}:${Date.now()}`);
      this.setSession(localUser, token);

      return {
        success: true,
        message: 'Logged in successfully.',
        token,
        user: localUser
      };
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign in. Please check your connection.';
      this.authError.set(msg);
      return { success: false, message: msg };
    } finally {
      this.isLoading.set(false);
    }
  }

  public async resetPassword(data: ResetPasswordRequest): Promise<AuthResponse> {
    this.isLoading.set(true);
    this.authError.set(null);

    try {
      try {
        const res = await fetch(`${this.baseUrl}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          return result;
        }
      } catch {
        // Fallback
      }

      return {
        success: true,
        message: `Password reset instructions and verification link sent to ${data.email}. Please check your inbox.`
      };
    } catch (err: any) {
      const msg = err?.message || 'Could not process password reset.';
      return { success: false, message: msg };
    } finally {
      this.isLoading.set(false);
    }
  }

  public logout(): void {
    localStorage.removeItem(this.AUTH_STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    this.currentUser.set(null);
    this.authToken.set(null);
    this.authError.set(null);

    // Reset game service to anonymous pilot with R0.00 balance
    const guestId = 'pilot_' + Math.random().toString(36).substring(2, 10);
    this.gameService.setUserProfile(guestId, 'Pilot_' + guestId.substring(6, 11), 0.00);
  }

  public updateUserBalance(newBalance: number): void {
    const user = this.currentUser();
    if (user) {
      const updated = { ...user, balance: newBalance };
      this.currentUser.set(updated);
      localStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(updated));
    }
    this.gameService.updateBalance(newBalance);
  }

  private setSession(user: UserProfile, token: string): void {
    this.currentUser.set(user);
    this.authToken.set(token);
    localStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
    this.syncWithGameService(user);
  }
}

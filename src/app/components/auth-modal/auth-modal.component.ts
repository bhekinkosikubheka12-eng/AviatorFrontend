import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  signal, 
  inject, 
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

export type AuthTab = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthModalComponent {
  @Input() isOpen = false;
  @Input() initialTab: AuthTab = 'login';
  @Output() close = new EventEmitter<void>();
  @Output() authSuccess = new EventEmitter<void>();

  public authService = inject(AuthService);

  readonly currentTab = signal<AuthTab>('login');
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // Login form state
  readonly loginIdentifier = signal<string>('');
  readonly loginPassword = signal<string>('');
  readonly rememberMe = signal<boolean>(true);

  // Register form state
  readonly regUsername = signal<string>('');
  readonly regEmail = signal<string>('');
  readonly regPassword = signal<string>('');
  readonly regConfirmPassword = signal<string>('');
  readonly agreeTerms = signal<boolean>(true);

  // Forgot password form state
  readonly resetEmail = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly resetSuccessMsg = signal<string | null>(null);

  // Local form validation errors
  readonly formError = signal<string | null>(null);

  ngOnChanges(): void {
    if (this.isOpen) {
      this.currentTab.set(this.initialTab);
      this.formError.set(null);
      this.resetSuccessMsg.set(null);
    }
  }

  public setTab(tab: AuthTab): void {
    this.currentTab.set(tab);
    this.formError.set(null);
    this.resetSuccessMsg.set(null);
  }

  public togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  public toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  public async onLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formError.set(null);

    const identifier = this.loginIdentifier().trim();
    const password = this.loginPassword();

    if (!identifier || !password) {
      this.formError.set('Please fill in your username/email and password.');
      return;
    }

    const res = await this.authService.login({
      emailOrUsername: identifier,
      password
    });

    if (res.success) {
      this.loginPassword.set('');
      this.authSuccess.emit();
      this.close.emit();
    } else {
      this.formError.set(res.message || 'Login failed. Please verify your credentials.');
    }
  }

  public async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formError.set(null);

    const username = this.regUsername().trim();
    const email = this.regEmail().trim();
    const password = this.regPassword();
    const confirm = this.regConfirmPassword();

    if (!username || !email || !password) {
      this.formError.set('All fields are required to register.');
      return;
    }

    if (username.length < 3) {
      this.formError.set('Pilot Nickname must be at least 3 characters.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      this.formError.set('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      this.formError.set('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirm) {
      this.formError.set('Passwords do not match.');
      return;
    }

    if (!this.agreeTerms()) {
      this.formError.set('You must agree to the Terms & Conditions and confirm you are 18+.');
      return;
    }

    const res = await this.authService.register({
      userName: username,
      email,
      password
    });

    if (res.success) {
      this.regPassword.set('');
      this.regConfirmPassword.set('');
      this.authSuccess.emit();
      this.close.emit();
    } else {
      this.formError.set(res.message || 'Registration failed. Please try again.');
    }
  }

  public async onResetSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formError.set(null);
    this.resetSuccessMsg.set(null);

    const email = this.resetEmail().trim();
    if (!email || !email.includes('@')) {
      this.formError.set('Please enter a valid registered email address.');
      return;
    }

    const res = await this.authService.resetPassword({
      email,
      newPassword: this.newPassword().trim() || undefined
    });

    if (res.success) {
      this.resetSuccessMsg.set(res.message || 'Password reset link sent to your email.');
    } else {
      this.formError.set(res.message || 'Could not process password reset.');
    }
  }

  public closeModal(): void {
    this.close.emit();
  }
}

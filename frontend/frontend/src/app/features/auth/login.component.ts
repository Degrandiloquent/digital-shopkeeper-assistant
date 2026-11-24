import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { toFriendlyError } from '../../core/utils/http-error.util';
import { BrandMarkComponent } from '../../shared/components/brand-mark.component';
import { icons } from '../../shared/icons';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FaIconComponent, BrandMarkComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly icons = icons;
  protected readonly showDemo = environment.showDemoAccounts;
  protected readonly hidePassword = signal(true);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly sessionEnded = this.route.snapshot.queryParamMap.get('expired') === '1';

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  protected useDemo(role: 'owner' | 'staff'): void {
    const account = environment.demoAccounts[role];
    this.form.patchValue({ email: account.email, password: account.password });
    this.errorMessage.set('');
  }

  protected submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, rememberMe } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.login(email, password, rememberMe).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Only follow a return address inside this app, never an external link.
        const safe = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null;
        this.router.navigateByUrl(safe ?? this.auth.homeRoute());
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(toFriendlyError(error, 'We could not sign you in. Try again.').message);
      }
    });
  }
}

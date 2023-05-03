
import {  inject } from '@angular/core';
import { Router } from '@angular/router';

import { AngularTokenService } from './lib/angular-token.service';
import {  of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';


export const AuthGuard = () => {
  const authService = inject(AngularTokenService);
  const router = inject(Router);
  const localStorage: Storage | any = {};
  return authService.validateToken().pipe(
    map((res) => {
      if (authService.haveAuthParams()) {
        return true;
      }
      if (authService.tokenOptions.signInStoredUrlStorageKey) {
        localStorage.setItem(
          authService.tokenOptions.signInStoredUrlStorageKey,
          router.url
        );
      }
      return router.parseUrl(
        authService.tokenOptions.signInPath || 'auth/sign-in'
      );
    }),
    catchError((error) => {
      if (authService.tokenOptions.signInStoredUrlStorageKey) {
        localStorage.setItem(
          authService.tokenOptions.signInStoredUrlStorageKey,
          router.url
        );
      }
      return of(
        router.parseUrl(authService.tokenOptions.signInPath || 'auth/sign-in')
      );
    })
  );
};

export const IsLoginGuard = () => {
  const authService = inject(AngularTokenService);
  const router = inject(Router);

  if (!authService.haveAuthParams()) {
    return true;
  }
  if (authService.tokenOptions.signInStoredUrlStorageKey) {
    return localStorage.getItem(
      authService.tokenOptions.signInStoredUrlStorageKey
    );
  }
  return router.parseUrl(authService.fetchSignInRedirect() || '');
};

export {
  SignInData,
  RegisterData,
  UpdatePasswordData,
  ResetPasswordData,
  UserType,
  UserData,
  AuthData,
  ApiResponse,
  AngularTokenOptions,
} from './lib/angular-token.model';

export { ANGULAR_TOKEN_OPTIONS } from './lib/angular-token.token';

export { AngularTokenService } from './lib/angular-token.service';

export { AngularTokenModule } from './lib/angular-token.module'; 
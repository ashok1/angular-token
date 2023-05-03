import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpRequest,
  HttpInterceptor,
  HttpHandler,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';

import { AngularTokenService } from './angular-token.service';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AngularTokenInterceptor implements HttpInterceptor {
  constructor(private tokenService: AngularTokenService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Get auth data from local storage
    this.tokenService.getAuthDataFromStorage();

    // Add the headers if the request is going to the configured server
    const authData = this.tokenService.authData.value;
    if (
      authData &&
      (this.tokenService.tokenOptions.apiBase === undefined ||
        req.url.match(String(this.tokenService.tokenOptions.apiBase)))
    ) {
      const headers = {
        'access-token': authData.accessToken,
        client: authData.client,
        expiry: authData.expiry,
        'token-type': authData.tokenType,
        uid: authData.uid,
      };

      const filteredObject = Object.entries(headers).reduce<{
        [key: string]: any;
      }>((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});
      req = req.clone({
        setHeaders: filteredObject,
      });
    }

    return next.handle(req).pipe(
      tap(
        (res) => this.handleResponse(res),
        (err) => this.handleResponse(err)
      )
    );
  }

  // Parse Auth data from response
  private handleResponse(
    res: HttpResponse<any> | HttpErrorResponse | HttpEvent<any>
  ): void {
    if (res instanceof HttpResponse || res instanceof HttpErrorResponse) {
      if (
        this.tokenService.tokenOptions.apiBase === undefined ||
        (res.url && res.url.match(this.tokenService.tokenOptions.apiBase))
      ) {
        this.tokenService.getAuthHeadersFromResponse(res);
      }
    }
  }
}

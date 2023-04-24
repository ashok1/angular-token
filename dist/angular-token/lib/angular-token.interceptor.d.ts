import { HttpEvent, HttpRequest, HttpInterceptor, HttpHandler } from '@angular/common/http';
import { AngularTokenService } from './angular-token.service';
import { Observable } from 'rxjs';
import * as i0 from "@angular/core";
export declare class AngularTokenInterceptor implements HttpInterceptor {
    private tokenService;
    constructor(tokenService: AngularTokenService);
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
    private handleResponse;
    static ɵfac: i0.ɵɵFactoryDeclaration<AngularTokenInterceptor, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AngularTokenInterceptor>;
}

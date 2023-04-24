import { Injectable } from '@angular/core';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import * as i0 from "@angular/core";
import * as i1 from "./angular-token.service";
export class AngularTokenInterceptor {
    constructor(tokenService) {
        this.tokenService = tokenService;
    }
    intercept(req, next) {
        // Get auth data from local storage
        this.tokenService.getAuthDataFromStorage();
        // Add the headers if the request is going to the configured server
        const authData = this.tokenService.authData.value;
        if (authData &&
            (this.tokenService.tokenOptions.apiBase === null || req.url.match(this.tokenService.tokenOptions.apiBase))) {
            const headers = {
                'access-token': authData.accessToken,
                'client': authData.client,
                'expiry': authData.expiry,
                'token-type': authData.tokenType,
                'uid': authData.uid
            };
            req = req.clone({
                setHeaders: headers
            });
        }
        return next.handle(req).pipe(tap(res => this.handleResponse(res), err => this.handleResponse(err)));
    }
    // Parse Auth data from response
    handleResponse(res) {
        if (res instanceof HttpResponse || res instanceof HttpErrorResponse) {
            if (this.tokenService.tokenOptions.apiBase === null || (res.url && res.url.match(this.tokenService.tokenOptions.apiBase))) {
                this.tokenService.getAuthHeadersFromResponse(res);
            }
        }
    }
}
AngularTokenInterceptor.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenInterceptor, deps: [{ token: i1.AngularTokenService }], target: i0.ɵɵFactoryTarget.Injectable });
AngularTokenInterceptor.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenInterceptor });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenInterceptor, decorators: [{
            type: Injectable
        }], ctorParameters: function () { return [{ type: i1.AngularTokenService }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci10b2tlbi5pbnRlcmNlcHRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItdG9rZW4vc3JjL2xpYi9hbmd1bGFyLXRva2VuLmludGVyY2VwdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUF3RCxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUs3SCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7OztBQUdyQyxNQUFNLE9BQU8sdUJBQXVCO0lBRWxDLFlBQXFCLFlBQWlDO1FBQWpDLGlCQUFZLEdBQVosWUFBWSxDQUFxQjtJQUFLLENBQUM7SUFFNUQsU0FBUyxDQUFDLEdBQXFCLEVBQUUsSUFBaUI7UUFFaEQsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxZQUFZLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUUzQyxtRUFBbUU7UUFDbkUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBRWxELElBQUksUUFBUTtZQUNWLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsT0FBTyxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFO1lBRTVHLE1BQU0sT0FBTyxHQUFHO2dCQUNkLGNBQWMsRUFBRSxRQUFRLENBQUMsV0FBVztnQkFDcEMsUUFBUSxFQUFRLFFBQVEsQ0FBQyxNQUFNO2dCQUMvQixRQUFRLEVBQVEsUUFBUSxDQUFDLE1BQU07Z0JBQy9CLFlBQVksRUFBSSxRQUFRLENBQUMsU0FBUztnQkFDbEMsS0FBSyxFQUFXLFFBQVEsQ0FBQyxHQUFHO2FBQzdCLENBQUM7WUFFRixHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztnQkFDZCxVQUFVLEVBQUUsT0FBTzthQUNwQixDQUFDLENBQUM7U0FDSjtRQUVELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUM1QixHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQy9CLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUdELGdDQUFnQztJQUN4QixjQUFjLENBQUMsR0FBMkQ7UUFDaEYsSUFBSSxHQUFHLFlBQVksWUFBWSxJQUFJLEdBQUcsWUFBWSxpQkFBaUIsRUFBRTtZQUNuRSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLE9BQU8sS0FBSyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pILElBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDbkQ7U0FDRjtJQUNILENBQUM7O29IQTFDVSx1QkFBdUI7d0hBQXZCLHVCQUF1QjsyRkFBdkIsdUJBQXVCO2tCQURuQyxVQUFVIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgSHR0cEV2ZW50LCBIdHRwUmVxdWVzdCwgSHR0cEludGVyY2VwdG9yLCBIdHRwSGFuZGxlciwgSHR0cFJlc3BvbnNlLCBIdHRwRXJyb3JSZXNwb25zZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcblxuaW1wb3J0IHsgQW5ndWxhclRva2VuU2VydmljZSB9IGZyb20gJy4vYW5ndWxhci10b2tlbi5zZXJ2aWNlJztcblxuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5ASW5qZWN0YWJsZSgpXG5leHBvcnQgY2xhc3MgQW5ndWxhclRva2VuSW50ZXJjZXB0b3IgaW1wbGVtZW50cyBIdHRwSW50ZXJjZXB0b3Ige1xuXG4gIGNvbnN0cnVjdG9yKCBwcml2YXRlIHRva2VuU2VydmljZTogQW5ndWxhclRva2VuU2VydmljZSApIHsgfVxuXG4gIGludGVyY2VwdChyZXE6IEh0dHBSZXF1ZXN0PGFueT4sIG5leHQ6IEh0dHBIYW5kbGVyKTogT2JzZXJ2YWJsZTxIdHRwRXZlbnQ8YW55Pj4ge1xuXG4gICAgLy8gR2V0IGF1dGggZGF0YSBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICB0aGlzLnRva2VuU2VydmljZS5nZXRBdXRoRGF0YUZyb21TdG9yYWdlKCk7XG5cbiAgICAvLyBBZGQgdGhlIGhlYWRlcnMgaWYgdGhlIHJlcXVlc3QgaXMgZ29pbmcgdG8gdGhlIGNvbmZpZ3VyZWQgc2VydmVyXG4gICAgY29uc3QgYXV0aERhdGEgPSB0aGlzLnRva2VuU2VydmljZS5hdXRoRGF0YS52YWx1ZTtcblxuICAgIGlmIChhdXRoRGF0YSAmJlxuICAgICAgKHRoaXMudG9rZW5TZXJ2aWNlLnRva2VuT3B0aW9ucy5hcGlCYXNlID09PSBudWxsIHx8IHJlcS51cmwubWF0Y2godGhpcy50b2tlblNlcnZpY2UudG9rZW5PcHRpb25zLmFwaUJhc2UpKSkge1xuXG4gICAgICBjb25zdCBoZWFkZXJzID0ge1xuICAgICAgICAnYWNjZXNzLXRva2VuJzogYXV0aERhdGEuYWNjZXNzVG9rZW4sXG4gICAgICAgICdjbGllbnQnOiAgICAgICBhdXRoRGF0YS5jbGllbnQsXG4gICAgICAgICdleHBpcnknOiAgICAgICBhdXRoRGF0YS5leHBpcnksXG4gICAgICAgICd0b2tlbi10eXBlJzogICBhdXRoRGF0YS50b2tlblR5cGUsXG4gICAgICAgICd1aWQnOiAgICAgICAgICBhdXRoRGF0YS51aWRcbiAgICAgIH07XG5cbiAgICAgIHJlcSA9IHJlcS5jbG9uZSh7XG4gICAgICAgIHNldEhlYWRlcnM6IGhlYWRlcnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXh0LmhhbmRsZShyZXEpLnBpcGUodGFwKFxuICAgICAgICByZXMgPT4gdGhpcy5oYW5kbGVSZXNwb25zZShyZXMpLFxuICAgICAgICBlcnIgPT4gdGhpcy5oYW5kbGVSZXNwb25zZShlcnIpXG4gICAgKSk7XG4gIH1cblxuXG4gIC8vIFBhcnNlIEF1dGggZGF0YSBmcm9tIHJlc3BvbnNlXG4gIHByaXZhdGUgaGFuZGxlUmVzcG9uc2UocmVzOiBIdHRwUmVzcG9uc2U8YW55PiB8IEh0dHBFcnJvclJlc3BvbnNlIHwgSHR0cEV2ZW50PGFueT4pOiB2b2lkIHtcbiAgICBpZiAocmVzIGluc3RhbmNlb2YgSHR0cFJlc3BvbnNlIHx8IHJlcyBpbnN0YW5jZW9mIEh0dHBFcnJvclJlc3BvbnNlKSB7XG4gICAgICBpZiAodGhpcy50b2tlblNlcnZpY2UudG9rZW5PcHRpb25zLmFwaUJhc2UgPT09IG51bGwgfHwgKHJlcy51cmwgJiYgcmVzLnVybC5tYXRjaCh0aGlzLnRva2VuU2VydmljZS50b2tlbk9wdGlvbnMuYXBpQmFzZSkpKSB7XG4gICAgICAgIHRoaXMudG9rZW5TZXJ2aWNlLmdldEF1dGhIZWFkZXJzRnJvbVJlc3BvbnNlKHJlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=
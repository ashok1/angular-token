import { Injectable, Optional, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, fromEvent, interval, BehaviorSubject } from 'rxjs';
import { pluck, filter, share, finalize } from 'rxjs/operators';
import { ANGULAR_TOKEN_OPTIONS } from './angular-token.token';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
import * as i2 from "@angular/router";
export class AngularTokenService {
    get currentUserType() {
        if (this.userType.value != null) {
            return this.userType.value.name;
        }
        else {
            return undefined;
        }
    }
    get currentUserData() {
        return this.userData.value;
    }
    get currentAuthData() {
        return this.authData.value;
    }
    get apiBase() {
        console.warn('[angular-token] The attribute .apiBase will be removed in the next major release, please use' +
            '.tokenOptions.apiBase instead');
        return this.options.apiBase;
    }
    get tokenOptions() {
        return this.options;
    }
    set tokenOptions(options) {
        this.options = Object.assign(this.options, options);
    }
    constructor(http, 
    // "any" used here to assuage environments where type Window does not exist at build time.
    // It's assigned to global in the constructor which has the proper typing.
    window, config, platformId, activatedRoute, router) {
        this.http = http;
        this.window = window;
        this.platformId = platformId;
        this.activatedRoute = activatedRoute;
        this.router = router;
        this.userType = new BehaviorSubject(null);
        this.authData = new BehaviorSubject(null);
        this.userData = new BehaviorSubject(null);
        this.localStorage = {};
        this.global = (typeof this.window !== 'undefined') ? this.window : {};
        if (isPlatformServer(this.platformId)) {
            // Bad pratice, needs fixing
            this.global = {
                open: () => null,
                location: {
                    href: '/',
                    origin: '/'
                }
            };
            // Bad pratice, needs fixing
            this.localStorage.setItem = () => null;
            this.localStorage.getItem = () => null;
            this.localStorage.removeItem = () => null;
        }
        else {
            this.localStorage = localStorage;
        }
        const defaultOptions = {
            apiPath: null,
            apiBase: null,
            signInPath: 'auth/sign_in',
            signInRedirect: null,
            signInStoredUrlStorageKey: null,
            signOutPath: 'auth/sign_out',
            validateTokenPath: 'auth/validate_token',
            signOutFailedValidate: false,
            registerAccountPath: 'auth',
            deleteAccountPath: 'auth',
            registerAccountCallback: this.global.location.href,
            updatePasswordPath: 'auth',
            resetPasswordPath: 'auth/password',
            resetPasswordCallback: this.global.location.href,
            userTypes: null,
            loginField: 'email',
            oAuthBase: this.global.location.origin,
            oAuthPaths: {
                github: 'auth/github'
            },
            oAuthCallbackPath: 'oauth_callback',
            oAuthWindowType: 'newWindow',
            oAuthWindowOptions: null,
            oAuthBrowserCallbacks: {
                github: 'auth/github/callback',
            },
        };
        const mergedOptions = Object.assign(defaultOptions, config);
        this.options = mergedOptions;
        if (this.options.apiBase === null) {
            console.warn(`[angular-token] You have not configured 'apiBase', which may result in security issues. ` +
                `Please refer to the documentation at https://github.com/neroniaky/angular-token/wiki`);
        }
        this.tryLoadAuthData();
    }
    userSignedIn() {
        if (this.authData.value == null) {
            return false;
        }
        else {
            return true;
        }
    }
    canActivate(route, state) {
        if (this.userSignedIn()) {
            return true;
        }
        else {
            // Store current location in storage (usefull for redirection after signing in)
            if (this.options.signInStoredUrlStorageKey) {
                this.localStorage.setItem(this.options.signInStoredUrlStorageKey, state.url);
            }
            // Redirect user to sign in if signInRedirect is set
            if (this.router && this.options.signInRedirect) {
                this.router.navigate([this.options.signInRedirect]);
            }
            return false;
        }
    }
    /**
     *
     * Actions
     *
     */
    // Register request
    registerAccount(registerData, additionalData) {
        registerData = Object.assign({}, registerData);
        if (registerData.userType == null) {
            this.userType.next(null);
        }
        else {
            this.userType.next(this.getUserTypeByName(registerData.userType));
            delete registerData.userType;
        }
        if (registerData.password_confirmation == null &&
            registerData.passwordConfirmation != null) {
            registerData.password_confirmation = registerData.passwordConfirmation;
            delete registerData.passwordConfirmation;
        }
        if (additionalData !== undefined) {
            registerData.additionalData = additionalData;
        }
        const login = registerData.login;
        delete registerData.login;
        registerData[this.options.loginField] = login;
        registerData.confirm_success_url = this.options.registerAccountCallback;
        return this.http.post(this.getServerPath() + this.options.registerAccountPath, registerData);
    }
    // Delete Account
    deleteAccount() {
        return this.http.delete(this.getServerPath() + this.options.deleteAccountPath);
    }
    // Sign in request and set storage
    signIn(signInData, additionalData) {
        this.userType.next((signInData.userType == null) ? null : this.getUserTypeByName(signInData.userType));
        const body = {
            [this.options.loginField]: signInData.login,
            password: signInData.password
        };
        if (additionalData !== undefined) {
            body['additionalData'] = additionalData;
        }
        const observ = this.http.post(this.getServerPath() + this.options.signInPath, body).pipe(share());
        observ.subscribe(res => this.userData.next(res.data));
        return observ;
    }
    signInOAuth(oAuthType, inAppBrowser, platform) {
        const oAuthPath = this.getOAuthPath(oAuthType);
        const callbackUrl = new URL(this.options.oAuthCallbackPath, this.global.location.origin).href;
        const oAuthWindowType = this.options.oAuthWindowType;
        const authUrl = this.getOAuthUrl(oAuthPath, callbackUrl, oAuthWindowType);
        if (oAuthWindowType === 'newWindow' ||
            (oAuthWindowType == 'inAppBrowser' && (!platform || !platform.is('cordova') || !(platform.is('ios') || platform.is('android'))))) {
            const oAuthWindowOptions = this.options.oAuthWindowOptions;
            let windowOptions = '';
            if (oAuthWindowOptions) {
                for (const key in oAuthWindowOptions) {
                    if (oAuthWindowOptions.hasOwnProperty(key)) {
                        windowOptions += `,${key}=${oAuthWindowOptions[key]}`;
                    }
                }
            }
            const popup = this.window.open(authUrl, '_blank', `closebuttoncaption=Cancel${windowOptions}`);
            return this.requestCredentialsViaPostMessage(popup);
        }
        else if (oAuthWindowType == 'inAppBrowser') {
            let oAuthBrowserCallback = this.options.oAuthBrowserCallbacks[oAuthType];
            if (!oAuthBrowserCallback) {
                throw new Error(`To login with oAuth provider ${oAuthType} using inAppBrowser the callback (in oAuthBrowserCallbacks) is required.`);
            }
            // let oAuthWindowOptions = this.options.oAuthWindowOptions;
            // let windowOptions = '';
            //  if (oAuthWindowOptions) {
            //     for (let key in oAuthWindowOptions) {
            //         windowOptions += `,${key}=${oAuthWindowOptions[key]}`;
            //     }
            // }
            let browser = inAppBrowser.create(authUrl, '_blank', 'location=no');
            return new Observable((observer) => {
                browser.on('loadstop').subscribe((ev) => {
                    if (ev.url.indexOf(oAuthBrowserCallback) > -1) {
                        browser.executeScript({ code: "requestCredentials();" }).then((credentials) => {
                            this.getAuthDataFromPostMessage(credentials[0]);
                            let pollerObserv = interval(400);
                            let pollerSubscription = pollerObserv.subscribe(() => {
                                if (this.userSignedIn()) {
                                    observer.next(this.authData);
                                    observer.complete();
                                    pollerSubscription.unsubscribe();
                                    browser.close();
                                }
                            }, (error) => {
                                observer.error(error);
                                observer.complete();
                            });
                        }, (error) => {
                            observer.error(error);
                            observer.complete();
                        });
                    }
                }, (error) => {
                    observer.error(error);
                    observer.complete();
                });
            });
        }
        else if (oAuthWindowType === 'sameWindow') {
            this.global.location.href = authUrl;
            return undefined;
        }
        else {
            throw new Error(`Unsupported oAuthWindowType "${oAuthWindowType}"`);
        }
    }
    processOAuthCallback() {
        this.getAuthDataFromParams();
    }
    // Sign out request and delete storage
    signOut() {
        return this.http.delete(this.getServerPath() + this.options.signOutPath)
            // Only remove the localStorage and clear the data after the call
            .pipe(finalize(() => {
            this.localStorage.removeItem('accessToken');
            this.localStorage.removeItem('client');
            this.localStorage.removeItem('expiry');
            this.localStorage.removeItem('tokenType');
            this.localStorage.removeItem('uid');
            this.authData.next(null);
            this.userType.next(null);
            this.userData.next(null);
        }));
    }
    // Validate token request
    validateToken() {
        const observ = this.http.get(this.getServerPath() + this.options.validateTokenPath).pipe(share());
        observ.subscribe((res) => this.userData.next(res.data), (error) => {
            if (error.status === 401 && this.options.signOutFailedValidate) {
                this.signOut();
            }
        });
        return observ;
    }
    // Update password request
    updatePassword(updatePasswordData) {
        if (updatePasswordData.userType != null) {
            this.userType.next(this.getUserTypeByName(updatePasswordData.userType));
        }
        let args;
        if (updatePasswordData.passwordCurrent == null) {
            args = {
                password: updatePasswordData.password,
                password_confirmation: updatePasswordData.passwordConfirmation
            };
        }
        else {
            args = {
                current_password: updatePasswordData.passwordCurrent,
                password: updatePasswordData.password,
                password_confirmation: updatePasswordData.passwordConfirmation
            };
        }
        if (updatePasswordData.resetPasswordToken) {
            args.reset_password_token = updatePasswordData.resetPasswordToken;
        }
        const body = args;
        return this.http.put(this.getServerPath() + this.options.updatePasswordPath, body);
    }
    // Reset password request
    resetPassword(resetPasswordData, additionalData) {
        if (additionalData !== undefined) {
            resetPasswordData.additionalData = additionalData;
        }
        this.userType.next((resetPasswordData.userType == null) ? null : this.getUserTypeByName(resetPasswordData.userType));
        const body = {
            [this.options.loginField]: resetPasswordData.login,
            redirect_url: this.options.resetPasswordCallback
        };
        return this.http.post(this.getServerPath() + this.options.resetPasswordPath, body);
    }
    /**
     *
     * Construct Paths / Urls
     *
     */
    getUserPath() {
        return (this.userType.value == null) ? '' : this.userType.value.path + '/';
    }
    addTrailingSlashIfNeeded(url) {
        const lastChar = url[url.length - 1];
        return lastChar === '/' ? url : url + '/';
    }
    getApiPath() {
        let constructedPath = '';
        if (this.options.apiBase != null) {
            constructedPath += this.addTrailingSlashIfNeeded(this.options.apiBase);
        }
        if (this.options.apiPath != null) {
            constructedPath += this.addTrailingSlashIfNeeded(this.options.apiPath);
        }
        return constructedPath;
    }
    getServerPath() {
        return this.getApiPath() + this.getUserPath();
    }
    getOAuthPath(oAuthType) {
        let oAuthPath;
        oAuthPath = this.options.oAuthPaths[oAuthType];
        if (oAuthPath == null) {
            oAuthPath = `/auth/${oAuthType}`;
        }
        return oAuthPath;
    }
    getOAuthUrl(oAuthPath, callbackUrl, windowType) {
        let url = new URL(`${oAuthPath}?omniauth_window_type=${windowType}&auth_origin_url=${encodeURIComponent(callbackUrl)}`, this.options.oAuthBase).href;
        if (this.userType.value != null) {
            url += `&resource_class=${this.userType.value.name}`;
        }
        return url;
    }
    /**
     *
     * Get Auth Data
     *
     */
    // Try to load auth data
    tryLoadAuthData() {
        const userType = this.getUserTypeByName(this.localStorage.getItem('userType'));
        if (userType) {
            this.userType.next(userType);
        }
        this.getAuthDataFromStorage();
        if (this.activatedRoute) {
            this.getAuthDataFromParams();
        }
        // if (this.authData) {
        //     this.validateToken();
        // }
    }
    // Parse Auth data from response
    getAuthHeadersFromResponse(data) {
        const headers = data.headers;
        const authData = {
            accessToken: headers.get('access-token'),
            client: headers.get('client'),
            expiry: headers.get('expiry'),
            tokenType: headers.get('token-type'),
            uid: headers.get('uid')
        };
        this.setAuthData(authData);
    }
    // Parse Auth data from post message
    getAuthDataFromPostMessage(data) {
        const authData = {
            accessToken: data['auth_token'],
            client: data['client_id'],
            expiry: data['expiry'],
            tokenType: 'Bearer',
            uid: data['uid']
        };
        this.setAuthData(authData);
    }
    // Try to get auth data from storage.
    getAuthDataFromStorage() {
        const authData = {
            accessToken: this.localStorage.getItem('accessToken'),
            client: this.localStorage.getItem('client'),
            expiry: this.localStorage.getItem('expiry'),
            tokenType: this.localStorage.getItem('tokenType'),
            uid: this.localStorage.getItem('uid')
        };
        if (this.checkAuthData(authData)) {
            this.authData.next(authData);
        }
    }
    // Try to get auth data from url parameters.
    getAuthDataFromParams() {
        this.activatedRoute.queryParams.subscribe(queryParams => {
            const authData = {
                accessToken: queryParams['token'] || queryParams['auth_token'],
                client: queryParams['client_id'],
                expiry: queryParams['expiry'],
                tokenType: 'Bearer',
                uid: queryParams['uid']
            };
            if (this.checkAuthData(authData)) {
                this.authData.next(authData);
            }
        });
    }
    /**
     *
     * Set Auth Data
     *
     */
    // Write auth data to storage
    setAuthData(authData) {
        if (this.checkAuthData(authData)) {
            this.authData.next(authData);
            this.localStorage.setItem('accessToken', authData.accessToken);
            this.localStorage.setItem('client', authData.client);
            this.localStorage.setItem('expiry', authData.expiry);
            this.localStorage.setItem('tokenType', authData.tokenType);
            this.localStorage.setItem('uid', authData.uid);
            if (this.userType.value != null) {
                this.localStorage.setItem('userType', this.userType.value.name);
            }
        }
    }
    /**
     *
     * Validate Auth Data
     *
     */
    // Check if auth data complete and if response token is newer
    checkAuthData(authData) {
        if (authData.accessToken != null &&
            authData.client != null &&
            authData.expiry != null &&
            authData.tokenType != null &&
            authData.uid != null) {
            if (this.authData.value != null) {
                return authData.expiry >= this.authData.value.expiry;
            }
            return true;
        }
        return false;
    }
    /**
     *
     * OAuth
     *
     */
    requestCredentialsViaPostMessage(authWindow) {
        const pollerObserv = interval(500);
        const responseObserv = fromEvent(this.global, 'message').pipe(pluck('data'), filter(this.oAuthWindowResponseFilter));
        responseObserv.subscribe(this.getAuthDataFromPostMessage.bind(this));
        const pollerSubscription = pollerObserv.subscribe(() => {
            if (authWindow.closed) {
                pollerSubscription.unsubscribe();
            }
            else {
                authWindow.postMessage('requestCredentials', '*');
            }
        });
        return responseObserv;
    }
    oAuthWindowResponseFilter(data) {
        if (data.message === 'deliverCredentials' || data.message === 'authFailure') {
            return data;
        }
    }
    /**
     *
     * Utilities
     *
     */
    // Match user config by user config name
    getUserTypeByName(name) {
        if (name == null || this.options.userTypes == null) {
            return null;
        }
        return this.options.userTypes.find(userType => userType.name === name);
    }
}
AngularTokenService.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenService, deps: [{ token: i1.HttpClient }, { token: 'Window' }, { token: ANGULAR_TOKEN_OPTIONS }, { token: PLATFORM_ID }, { token: i2.ActivatedRoute, optional: true }, { token: i2.Router, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
AngularTokenService.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenService, providedIn: 'root' });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "15.2.8", ngImport: i0, type: AngularTokenService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root',
                }]
        }], ctorParameters: function () { return [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: ['Window']
                }] }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [ANGULAR_TOKEN_OPTIONS]
                }] }, { type: Object, decorators: [{
                    type: Inject,
                    args: [PLATFORM_ID]
                }] }, { type: i2.ActivatedRoute, decorators: [{
                    type: Optional
                }] }, { type: i2.Router, decorators: [{
                    type: Optional
                }] }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci10b2tlbi5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvYW5ndWxhci10b2tlbi9zcmMvbGliL2FuZ3VsYXItdG9rZW4uc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRzFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRW5ELE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDeEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRWhFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDOzs7O0FBc0I5RCxNQUFNLE9BQU8sbUJBQW1CO0lBRTlCLElBQUksZUFBZTtRQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxJQUFJLElBQUksRUFBRTtZQUMvQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztTQUNqQzthQUFNO1lBQ0wsT0FBTyxTQUFTLENBQUM7U0FDbEI7SUFDSCxDQUFDO0lBRUQsSUFBSSxlQUFlO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDN0IsQ0FBQztJQUVELElBQUksZUFBZTtRQUNqQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0lBQzdCLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDVCxPQUFPLENBQUMsSUFBSSxDQUFDLDhGQUE4RjtZQUN6RywrQkFBK0IsQ0FBQyxDQUFDO1FBQ25DLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxP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QUksSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxJQUFJLElBQUksRUFBRTtZQUNsRCxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQ2hDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLENBQ25DLENBQUM7SUFDSixDQUFDOztnSEFsb0JVLG1CQUFtQiw0Q0E0Q3BCLFFBQVEsYUFDUixxQkFBcUIsYUFDckIsV0FBVztvSEE5Q1YsbUJBQW1CLGNBRmxCLE1BQU07MkZBRVAsbUJBQW1CO2tCQUgvQixVQUFVO21CQUFDO29CQUNWLFVBQVUsRUFBRSxNQUFNO2lCQUNuQjs7MEJBNkNJLE1BQU07MkJBQUMsUUFBUTs7MEJBQ2YsTUFBTTsyQkFBQyxxQkFBcUI7OzBCQUM1QixNQUFNOzJCQUFDLFdBQVc7OzBCQUNsQixRQUFROzswQkFDUixRQUFRIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgT3B0aW9uYWwsIEluamVjdCwgUExBVEZPUk1fSUQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEFjdGl2YXRlZFJvdXRlLCBSb3V0ZXIsIENhbkFjdGl2YXRlLCBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90LCBSb3V0ZXJTdGF0ZVNuYXBzaG90IH0gZnJvbSAnQGFuZ3VsYXIvcm91dGVyJztcbmltcG9ydCB7IEh0dHBDbGllbnQsIEh0dHBSZXNwb25zZSwgSHR0cEVycm9yUmVzcG9uc2UgfSBmcm9tICdAYW5ndWxhci9jb21tb24vaHR0cCc7XG5pbXBvcnQgeyBpc1BsYXRmb3JtU2VydmVyIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcblxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbUV2ZW50LCBpbnRlcnZhbCwgQmVoYXZpb3JTdWJqZWN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBwbHVjaywgZmlsdGVyLCBzaGFyZSwgZmluYWxpemUgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7IEFOR1VMQVJfVE9LRU5fT1BUSU9OUyB9IGZyb20gJy4vYW5ndWxhci10b2tlbi50b2tlbic7XG5cbmltcG9ydCB7XG4gIFNpZ25JbkRhdGEsXG4gIFJlZ2lzdGVyRGF0YSxcbiAgVXBkYXRlUGFzc3dvcmREYXRhLFxuICBSZXNldFBhc3N3b3JkRGF0YSxcblxuICBVc2VyVHlwZSxcbiAgVXNlckRhdGEsXG4gIEF1dGhEYXRhLFxuICBBcGlSZXNwb25zZSxcblxuICBBbmd1bGFyVG9rZW5PcHRpb25zLFxuXG4gIFRva2VuUGxhdGZvcm0sXG4gIFRva2VuSW5BcHBCcm93c2VyLFxufSBmcm9tICcuL2FuZ3VsYXItdG9rZW4ubW9kZWwnO1xuXG5ASW5qZWN0YWJsZSh7XG4gIHByb3ZpZGVkSW46ICdyb290Jyxcbn0pXG5leHBvcnQgY2xhc3MgQW5ndWxhclRva2VuU2VydmljZSBpbXBsZW1lbnRzIENhbkFjdGl2YXRlIHtcblxuICBnZXQgY3VycmVudFVzZXJUeXBlKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMudXNlclR5cGUudmFsdWUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMudXNlclR5cGUudmFsdWUubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICBnZXQgY3VycmVudFVzZXJEYXRhKCk6IFVzZXJEYXRhIHtcbiAgICByZXR1cm4gdGhpcy51c2VyRGF0YS52YWx1ZTtcbiAgfVxuXG4gIGdldCBjdXJyZW50QXV0aERhdGEoKTogQXV0aERhdGEge1xuICAgIHJldHVybiB0aGlzLmF1dGhEYXRhLnZhbHVlO1xuICB9XG5cbiAgZ2V0IGFwaUJhc2UoKTogc3RyaW5nIHtcbiAgICBjb25zb2xlLndhcm4oJ1thbmd1bGFyLXRva2VuXSBUaGUgYXR0cmlidXRlIC5hcGlCYXNlIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciByZWxlYXNlLCBwbGVhc2UgdXNlJyArXG4gICAgICAnLnRva2VuT3B0aW9ucy5hcGlCYXNlIGluc3RlYWQnKTtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLmFwaUJhc2U7XG4gIH1cblxuICBnZXQgdG9rZW5PcHRpb25zKCk6IEFuZ3VsYXJUb2tlbk9wdGlvbnMge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbnM7XG4gIH1cblxuICBzZXQgdG9rZW5PcHRpb25zKG9wdGlvbnM6IEFuZ3VsYXJUb2tlbk9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSAoPGFueT5PYmplY3QpLmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBvcHRpb25zOiBBbmd1bGFyVG9rZW5PcHRpb25zO1xuICBwdWJsaWMgdXNlclR5cGU6IEJlaGF2aW9yU3ViamVjdDxVc2VyVHlwZT4gPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFVzZXJUeXBlPihudWxsKTtcbiAgcHVibGljIGF1dGhEYXRhOiBCZWhhdmlvclN1YmplY3Q8QXV0aERhdGE+ID0gbmV3IEJlaGF2aW9yU3ViamVjdDxBdXRoRGF0YT4obnVsbCk7XG4gIHB1YmxpYyB1c2VyRGF0YTogQmVoYXZpb3JTdWJqZWN0PFVzZXJEYXRhPiA9IG5ldyBCZWhhdmlvclN1YmplY3Q8VXNlckRhdGE+KG51bGwpO1xuICBwcml2YXRlIGdsb2JhbDogUGFydGlhbDxXaW5kb3c+O1xuXG4gIHByaXZhdGUgbG9jYWxTdG9yYWdlOiBTdG9yYWdlIHwgYW55ID0ge307XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxuICAgIC8vIFwiYW55XCIgdXNlZCBoZXJlIHRvIGFzc3VhZ2UgZW52aXJvbm1lbnRzIHdoZXJlIHR5cGUgV2luZG93IGRvZXMgbm90IGV4aXN0IGF0IGJ1aWxkIHRpbWUuXG4gICAgLy8gSXQncyBhc3NpZ25lZCB0byBnbG9iYWwgaW4gdGhlIGNvbnN0cnVjdG9yIHdoaWNoIGhhcyB0aGUgcHJvcGVyIHR5cGluZy5cbiAgICBASW5qZWN0KCdXaW5kb3cnKSBwcml2YXRlIHdpbmRvdzogYW55LFxuICAgIEBJbmplY3QoQU5HVUxBUl9UT0tFTl9PUFRJT05TKSBjb25maWc6IGFueSxcbiAgICBASW5qZWN0KFBMQVRGT1JNX0lEKSBwcml2YXRlIHBsYXRmb3JtSWQ6IE9iamVjdCxcbiAgICBAT3B0aW9uYWwoKSBwcml2YXRlIGFjdGl2YXRlZFJvdXRlOiBBY3RpdmF0ZWRSb3V0ZSxcbiAgICBAT3B0aW9uYWwoKSBwcml2YXRlIHJvdXRlcjogUm91dGVyXG4gICkge1xuICAgIHRoaXMuZ2xvYmFsID0gKHR5cGVvZiB0aGlzLndpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gdGhpcy53aW5kb3cgOiB7fTtcblxuICAgIGlmIChpc1BsYXRmb3JtU2VydmVyKHRoaXMucGxhdGZvcm1JZCkpIHtcblxuICAgICAgLy8gQmFkIHByYXRpY2UsIG5lZWRzIGZpeGluZ1xuICAgICAgdGhpcy5nbG9iYWwgPSB7XG4gICAgICAgIG9wZW46ICgpOiBXaW5kb3cgPT4gbnVsbCxcbiAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICBocmVmOiAnLycsXG4gICAgICAgICAgb3JpZ2luOiAnLydcbiAgICAgICAgfSBhcyBhbnlcbiAgICAgIH07XG5cbiAgICAgIC8vIEJhZCBwcmF0aWNlLCBuZWVkcyBmaXhpbmdcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0gPSAoKTogdm9pZCA9PiBudWxsO1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSA9ICgpOiB2b2lkID0+IG51bGw7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtID0gKCk6IHZvaWQgPT4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7XG4gICAgfVxuXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnM6IEFuZ3VsYXJUb2tlbk9wdGlvbnMgPSB7XG4gICAgICBhcGlQYXRoOiBudWxsLFxuICAgICAgYXBpQmFzZTogbnVsbCxcblxuICAgICAgc2lnbkluUGF0aDogJ2F1dGgvc2lnbl9pbicsXG4gICAgICBzaWduSW5SZWRpcmVjdDogbnVsbCxcbiAgICAgIHNpZ25JblN0b3JlZFVybFN0b3JhZ2VLZXk6IG51bGwsXG5cbiAgICAgIHNpZ25PdXRQYXRoOiAnYXV0aC9zaWduX291dCcsXG4gICAgICB2YWxpZGF0ZVRva2VuUGF0aDogJ2F1dGgvdmFsaWRhdGVfdG9rZW4nLFxuICAgICAgc2lnbk91dEZhaWxlZFZhbGlkYXRlOiBmYWxzZSxcblxuICAgICAgcmVnaXN0ZXJBY2NvdW50UGF0aDogJ2F1dGgnLFxuICAgICAgZGVsZXRlQWNjb3VudFBhdGg6ICdhdXRoJyxcbiAgICAgIHJlZ2lzdGVyQWNjb3VudENhbGxiYWNrOiB0aGlzLmdsb2JhbC5sb2NhdGlvbi5ocmVmLFxuXG4gICAgICB1cGRhdGVQYXNzd29yZFBhdGg6ICdhdXRoJyxcblxuICAgICAgcmVzZXRQYXNzd29yZFBhdGg6ICdhdXRoL3Bhc3N3b3JkJyxcbiAgICAgIHJlc2V0UGFzc3dvcmRDYWxsYmFjazogdGhpcy5nbG9iYWwubG9jYXRpb24uaHJlZixcblxuICAgICAgdXNlclR5cGVzOiBudWxsLFxuICAgICAgbG9naW5GaWVsZDogJ2VtYWlsJyxcblxuICAgICAgb0F1dGhCYXNlOiB0aGlzLmdsb2JhbC5sb2NhdGlvbi5vcmlnaW4sXG4gICAgICBvQXV0aFBhdGhzOiB7XG4gICAgICAgIGdpdGh1YjogJ2F1dGgvZ2l0aHViJ1xuICAgICAgfSxcbiAgICAgIG9BdXRoQ2FsbGJhY2tQYXRoOiAnb2F1dGhfY2FsbGJhY2snLFxuICAgICAgb0F1dGhXaW5kb3dUeXBlOiAnbmV3V2luZG93JyxcbiAgICAgIG9BdXRoV2luZG93T3B0aW9uczogbnVsbCxcblxuICAgICAgb0F1dGhCcm93c2VyQ2FsbGJhY2tzOiB7XG4gICAgICAgIGdpdGh1YjogJ2F1dGgvZ2l0aHViL2NhbGxiYWNrJyxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IG1lcmdlZE9wdGlvbnMgPSAoPGFueT5PYmplY3QpLmFzc2lnbihkZWZhdWx0T3B0aW9ucywgY29uZmlnKTtcbiAgICB0aGlzLm9wdGlvbnMgPSBtZXJnZWRPcHRpb25zO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hcGlCYXNlID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFthbmd1bGFyLXRva2VuXSBZb3UgaGF2ZSBub3QgY29uZmlndXJlZCAnYXBpQmFzZScsIHdoaWNoIG1heSByZXN1bHQgaW4gc2VjdXJpdHkgaXNzdWVzLiBgICtcbiAgICAgICAgYFBsZWFzZSByZWZlciB0byB0aGUgZG9jdW1lbnRhdGlvbiBhdCBodHRwczovL2dpdGh1Yi5jb20vbmVyb25pYWt5L2FuZ3VsYXItdG9rZW4vd2lraWApO1xuICAgIH1cblxuICAgIHRoaXMudHJ5TG9hZEF1dGhEYXRhKCk7XG4gIH1cblxuICB1c2VyU2lnbmVkSW4oKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuYXV0aERhdGEudmFsdWUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBjYW5BY3RpdmF0ZShyb3V0ZTogQWN0aXZhdGVkUm91dGVTbmFwc2hvdCwgc3RhdGU6IFJvdXRlclN0YXRlU25hcHNob3QpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy51c2VyU2lnbmVkSW4oKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN0b3JlIGN1cnJlbnQgbG9jYXRpb24gaW4gc3RvcmFnZSAodXNlZnVsbCBmb3IgcmVkaXJlY3Rpb24gYWZ0ZXIgc2lnbmluZyBpbilcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuc2lnbkluU3RvcmVkVXJsU3RvcmFnZUtleSkge1xuICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKFxuICAgICAgICAgIHRoaXMub3B0aW9ucy5zaWduSW5TdG9yZWRVcmxTdG9yYWdlS2V5LFxuICAgICAgICAgIHN0YXRlLnVybFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBSZWRpcmVjdCB1c2VyIHRvIHNpZ24gaW4gaWYgc2lnbkluUmVkaXJlY3QgaXMgc2V0XG4gICAgICBpZiAodGhpcy5yb3V0ZXIgJiYgdGhpcy5vcHRpb25zLnNpZ25JblJlZGlyZWN0KSB7XG4gICAgICAgIHRoaXMucm91dGVyLm5hdmlnYXRlKFt0aGlzLm9wdGlvbnMuc2lnbkluUmVkaXJlY3RdKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqXG4gICAqIEFjdGlvbnNcbiAgICpcbiAgICovXG5cbiAgLy8gUmVnaXN0ZXIgcmVxdWVzdFxuICByZWdpc3RlckFjY291bnQocmVnaXN0ZXJEYXRhOiBSZWdpc3RlckRhdGEsIGFkZGl0aW9uYWxEYXRhPzogYW55KTogT2JzZXJ2YWJsZTxBcGlSZXNwb25zZT4ge1xuXG4gICAgcmVnaXN0ZXJEYXRhID0gT2JqZWN0LmFzc2lnbih7fSwgcmVnaXN0ZXJEYXRhKTtcblxuICAgIGlmIChyZWdpc3RlckRhdGEudXNlclR5cGUgPT0gbnVsbCkge1xuICAgICAgdGhpcy51c2VyVHlwZS5uZXh0KG51bGwpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVzZXJUeXBlLm5leHQodGhpcy5nZXRVc2VyVHlwZUJ5TmFtZShyZWdpc3RlckRhdGEudXNlclR5cGUpKTtcbiAgICAgIGRlbGV0ZSByZWdpc3RlckRhdGEudXNlclR5cGU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgcmVnaXN0ZXJEYXRhLnBhc3N3b3JkX2NvbmZpcm1hdGlvbiA9PSBudWxsICYmXG4gICAgICByZWdpc3RlckRhdGEucGFzc3dvcmRDb25maXJtYXRpb24gIT0gbnVsbFxuICAgICkge1xuICAgICAgcmVnaXN0ZXJEYXRhLnBhc3N3b3JkX2NvbmZpcm1hdGlvbiA9IHJlZ2lzdGVyRGF0YS5wYXNzd29yZENvbmZpcm1hdGlvbjtcbiAgICAgIGRlbGV0ZSByZWdpc3RlckRhdGEucGFzc3dvcmRDb25maXJtYXRpb247XG4gICAgfVxuXG4gICAgaWYgKGFkZGl0aW9uYWxEYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlZ2lzdGVyRGF0YS5hZGRpdGlvbmFsRGF0YSA9IGFkZGl0aW9uYWxEYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGxvZ2luID0gcmVnaXN0ZXJEYXRhLmxvZ2luO1xuICAgIGRlbGV0ZSByZWdpc3RlckRhdGEubG9naW47XG4gICAgcmVnaXN0ZXJEYXRhW3RoaXMub3B0aW9ucy5sb2dpbkZpZWxkXSA9IGxvZ2luO1xuXG4gICAgcmVnaXN0ZXJEYXRhLmNvbmZpcm1fc3VjY2Vzc191cmwgPSB0aGlzLm9wdGlvbnMucmVnaXN0ZXJBY2NvdW50Q2FsbGJhY2s7XG5cbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8QXBpUmVzcG9uc2U+KFxuICAgICAgdGhpcy5nZXRTZXJ2ZXJQYXRoKCkgKyB0aGlzLm9wdGlvbnMucmVnaXN0ZXJBY2NvdW50UGF0aCwgcmVnaXN0ZXJEYXRhXG4gICAgKTtcbiAgfVxuXG4gIC8vIERlbGV0ZSBBY2NvdW50XG4gIGRlbGV0ZUFjY291bnQoKTogT2JzZXJ2YWJsZTxBcGlSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAuZGVsZXRlPEFwaVJlc3BvbnNlPih0aGlzLmdldFNlcnZlclBhdGgoKSArIHRoaXMub3B0aW9ucy5kZWxldGVBY2NvdW50UGF0aCk7XG4gIH1cblxuICAvLyBTaWduIGluIHJlcXVlc3QgYW5kIHNldCBzdG9yYWdlXG4gIHNpZ25JbihzaWduSW5EYXRhOiBTaWduSW5EYXRhLCBhZGRpdGlvbmFsRGF0YT86IGFueSk6IE9ic2VydmFibGU8QXBpUmVzcG9uc2U+IHtcbiAgICB0aGlzLnVzZXJUeXBlLm5leHQoKHNpZ25JbkRhdGEudXNlclR5cGUgPT0gbnVsbCkgPyBudWxsIDogdGhpcy5nZXRVc2VyVHlwZUJ5TmFtZShzaWduSW5EYXRhLnVzZXJUeXBlKSk7XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAgW3RoaXMub3B0aW9ucy5sb2dpbkZpZWxkXTogc2lnbkluRGF0YS5sb2dpbixcbiAgICAgIHBhc3N3b3JkOiBzaWduSW5EYXRhLnBhc3N3b3JkXG4gICAgfTtcblxuICAgIGlmIChhZGRpdGlvbmFsRGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBib2R5WydhZGRpdGlvbmFsRGF0YSddID0gYWRkaXRpb25hbERhdGE7XG4gICAgfVxuXG4gICAgY29uc3Qgb2JzZXJ2ID0gdGhpcy5odHRwLnBvc3Q8QXBpUmVzcG9uc2U+KFxuICAgICAgdGhpcy5nZXRTZXJ2ZXJQYXRoKCkgKyB0aGlzLm9wdGlvbnMuc2lnbkluUGF0aCwgYm9keVxuICAgICkucGlwZShzaGFyZSgpKTtcblxuICAgIG9ic2Vydi5zdWJzY3JpYmUocmVzID0+IHRoaXMudXNlckRhdGEubmV4dChyZXMuZGF0YSkpO1xuXG4gICAgcmV0dXJuIG9ic2VydjtcbiAgfVxuXG4gIHNpZ25Jbk9BdXRoKG9BdXRoVHlwZTogc3RyaW5nLCBpbkFwcEJyb3dzZXI/OiBUb2tlbkluQXBwQnJvd3NlcjxhbnksIGFueT4sIHBsYXRmb3JtPzogVG9rZW5QbGF0Zm9ybSkge1xuXG4gICAgY29uc3Qgb0F1dGhQYXRoOiBzdHJpbmcgPSB0aGlzLmdldE9BdXRoUGF0aChvQXV0aFR5cGUpO1xuICAgIGNvbnN0IGNhbGxiYWNrVXJsOiBzdHJpbmcgPSBuZXcgVVJMKHRoaXMub3B0aW9ucy5vQXV0aENhbGxiYWNrUGF0aCwgdGhpcy5nbG9iYWwubG9jYXRpb24ub3JpZ2luKS5ocmVmO1xuICAgIGNvbnN0IG9BdXRoV2luZG93VHlwZTogc3RyaW5nID0gdGhpcy5vcHRpb25zLm9BdXRoV2luZG93VHlwZTtcbiAgICBjb25zdCBhdXRoVXJsOiBzdHJpbmcgPSB0aGlzLmdldE9BdXRoVXJsKG9BdXRoUGF0aCwgY2FsbGJhY2tVcmwsIG9BdXRoV2luZG93VHlwZSk7XG5cbiAgICBpZiAob0F1dGhXaW5kb3dUeXBlID09PSAnbmV3V2luZG93JyB8fFxuICAgICAgKG9BdXRoV2luZG93VHlwZSA9PSAnaW5BcHBCcm93c2VyJyAmJiAoIXBsYXRmb3JtIHx8ICFwbGF0Zm9ybS5pcygnY29yZG92YScpIHx8ICEocGxhdGZvcm0uaXMoJ2lvcycpIHx8IHBsYXRmb3JtLmlzKCdhbmRyb2lkJykpKSkpIHtcbiAgICAgIGNvbnN0IG9BdXRoV2luZG93T3B0aW9ucyA9IHRoaXMub3B0aW9ucy5vQXV0aFdpbmRvd09wdGlvbnM7XG4gICAgICBsZXQgd2luZG93T3B0aW9ucyA9ICcnO1xuXG4gICAgICBpZiAob0F1dGhXaW5kb3dPcHRpb25zKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIG9BdXRoV2luZG93T3B0aW9ucykge1xuICAgICAgICAgIGlmIChvQXV0aFdpbmRvd09wdGlvbnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgd2luZG93T3B0aW9ucyArPSBgLCR7a2V5fT0ke29BdXRoV2luZG93T3B0aW9uc1trZXldfWA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBvcHVwID0gdGhpcy53aW5kb3cub3BlbihcbiAgICAgICAgYXV0aFVybCxcbiAgICAgICAgJ19ibGFuaycsXG4gICAgICAgIGBjbG9zZWJ1dHRvbmNhcHRpb249Q2FuY2VsJHt3aW5kb3dPcHRpb25zfWBcbiAgICAgICk7XG4gICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0Q3JlZGVudGlhbHNWaWFQb3N0TWVzc2FnZShwb3B1cCk7XG4gICAgfSBlbHNlIGlmIChvQXV0aFdpbmRvd1R5cGUgPT0gJ2luQXBwQnJvd3NlcicpIHtcbiAgICAgIGxldCBvQXV0aEJyb3dzZXJDYWxsYmFjayA9IHRoaXMub3B0aW9ucy5vQXV0aEJyb3dzZXJDYWxsYmFja3Nbb0F1dGhUeXBlXTtcbiAgICAgIGlmICghb0F1dGhCcm93c2VyQ2FsbGJhY2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUbyBsb2dpbiB3aXRoIG9BdXRoIHByb3ZpZGVyICR7b0F1dGhUeXBlfSB1c2luZyBpbkFwcEJyb3dzZXIgdGhlIGNhbGxiYWNrIChpbiBvQXV0aEJyb3dzZXJDYWxsYmFja3MpIGlzIHJlcXVpcmVkLmApO1xuICAgICAgfVxuICAgICAgLy8gbGV0IG9BdXRoV2luZG93T3B0aW9ucyA9IHRoaXMub3B0aW9ucy5vQXV0aFdpbmRvd09wdGlvbnM7XG4gICAgICAvLyBsZXQgd2luZG93T3B0aW9ucyA9ICcnO1xuXG4gICAgICAvLyAgaWYgKG9BdXRoV2luZG93T3B0aW9ucykge1xuICAgICAgLy8gICAgIGZvciAobGV0IGtleSBpbiBvQXV0aFdpbmRvd09wdGlvbnMpIHtcbiAgICAgIC8vICAgICAgICAgd2luZG93T3B0aW9ucyArPSBgLCR7a2V5fT0ke29BdXRoV2luZG93T3B0aW9uc1trZXldfWA7XG4gICAgICAvLyAgICAgfVxuICAgICAgLy8gfVxuXG4gICAgICBsZXQgYnJvd3NlciA9IGluQXBwQnJvd3Nlci5jcmVhdGUoXG4gICAgICAgIGF1dGhVcmwsXG4gICAgICAgICdfYmxhbmsnLFxuICAgICAgICAnbG9jYXRpb249bm8nXG4gICAgICApO1xuXG4gICAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XG4gICAgICAgIGJyb3dzZXIub24oJ2xvYWRzdG9wJykuc3Vic2NyaWJlKChldjogYW55KSA9PiB7XG4gICAgICAgICAgaWYgKGV2LnVybC5pbmRleE9mKG9BdXRoQnJvd3NlckNhbGxiYWNrKSA+IC0xKSB7XG4gICAgICAgICAgICBicm93c2VyLmV4ZWN1dGVTY3JpcHQoeyBjb2RlOiBcInJlcXVlc3RDcmVkZW50aWFscygpO1wiIH0pLnRoZW4oKGNyZWRlbnRpYWxzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5nZXRBdXRoRGF0YUZyb21Qb3N0TWVzc2FnZShjcmVkZW50aWFsc1swXSk7XG5cbiAgICAgICAgICAgICAgbGV0IHBvbGxlck9ic2VydiA9IGludGVydmFsKDQwMCk7XG5cbiAgICAgICAgICAgICAgbGV0IHBvbGxlclN1YnNjcmlwdGlvbiA9IHBvbGxlck9ic2Vydi5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZXJTaWduZWRJbigpKSB7XG4gICAgICAgICAgICAgICAgICBvYnNlcnZlci5uZXh0KHRoaXMuYXV0aERhdGEpO1xuICAgICAgICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcblxuICAgICAgICAgICAgICAgICAgcG9sbGVyU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XG4gICAgICAgICAgICAgICAgICBicm93c2VyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LCAoZXJyb3I6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIChlcnJvcjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgKGVycm9yOiBhbnkpID0+IHtcbiAgICAgICAgICBvYnNlcnZlci5lcnJvcihlcnJvcik7XG4gICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgIH0gZWxzZSBpZiAob0F1dGhXaW5kb3dUeXBlID09PSAnc2FtZVdpbmRvdycpIHtcbiAgICAgIHRoaXMuZ2xvYmFsLmxvY2F0aW9uLmhyZWYgPSBhdXRoVXJsO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBvQXV0aFdpbmRvd1R5cGUgXCIke29BdXRoV2luZG93VHlwZX1cImApO1xuICAgIH1cbiAgfVxuXG4gIHByb2Nlc3NPQXV0aENhbGxiYWNrKCk6IHZvaWQge1xuICAgIHRoaXMuZ2V0QXV0aERhdGFGcm9tUGFyYW1zKCk7XG4gIH1cblxuICAvLyBTaWduIG91dCByZXF1ZXN0IGFuZCBkZWxldGUgc3RvcmFnZVxuICBzaWduT3V0KCk6IE9ic2VydmFibGU8QXBpUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLmRlbGV0ZTxBcGlSZXNwb25zZT4odGhpcy5nZXRTZXJ2ZXJQYXRoKCkgKyB0aGlzLm9wdGlvbnMuc2lnbk91dFBhdGgpXG4gICAgICAvLyBPbmx5IHJlbW92ZSB0aGUgbG9jYWxTdG9yYWdlIGFuZCBjbGVhciB0aGUgZGF0YSBhZnRlciB0aGUgY2FsbFxuICAgICAgLnBpcGUoXG4gICAgICAgIGZpbmFsaXplKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhY2Nlc3NUb2tlbicpO1xuICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2NsaWVudCcpO1xuICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2V4cGlyeScpO1xuICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3Rva2VuVHlwZScpO1xuICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VpZCcpO1xuXG4gICAgICAgICAgdGhpcy5hdXRoRGF0YS5uZXh0KG51bGwpO1xuICAgICAgICAgIHRoaXMudXNlclR5cGUubmV4dChudWxsKTtcbiAgICAgICAgICB0aGlzLnVzZXJEYXRhLm5leHQobnVsbCk7XG4gICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHRva2VuIHJlcXVlc3RcbiAgdmFsaWRhdGVUb2tlbigpOiBPYnNlcnZhYmxlPEFwaVJlc3BvbnNlPiB7XG4gICAgY29uc3Qgb2JzZXJ2ID0gdGhpcy5odHRwLmdldDxBcGlSZXNwb25zZT4oXG4gICAgICB0aGlzLmdldFNlcnZlclBhdGgoKSArIHRoaXMub3B0aW9ucy52YWxpZGF0ZVRva2VuUGF0aFxuICAgICkucGlwZShzaGFyZSgpKTtcblxuICAgIG9ic2Vydi5zdWJzY3JpYmUoXG4gICAgICAocmVzKSA9PiB0aGlzLnVzZXJEYXRhLm5leHQocmVzLmRhdGEpLFxuICAgICAgKGVycm9yKSA9PiB7XG4gICAgICAgIGlmIChlcnJvci5zdGF0dXMgPT09IDQwMSAmJiB0aGlzLm9wdGlvbnMuc2lnbk91dEZhaWxlZFZhbGlkYXRlKSB7XG4gICAgICAgICAgdGhpcy5zaWduT3V0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgcmV0dXJuIG9ic2VydjtcbiAgfVxuXG4gIC8vIFVwZGF0ZSBwYXNzd29yZCByZXF1ZXN0XG4gIHVwZGF0ZVBhc3N3b3JkKHVwZGF0ZVBhc3N3b3JkRGF0YTogVXBkYXRlUGFzc3dvcmREYXRhKTogT2JzZXJ2YWJsZTxBcGlSZXNwb25zZT4ge1xuXG4gICAgaWYgKHVwZGF0ZVBhc3N3b3JkRGF0YS51c2VyVHlwZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnVzZXJUeXBlLm5leHQodGhpcy5nZXRVc2VyVHlwZUJ5TmFtZSh1cGRhdGVQYXNzd29yZERhdGEudXNlclR5cGUpKTtcbiAgICB9XG5cbiAgICBsZXQgYXJnczogYW55O1xuXG4gICAgaWYgKHVwZGF0ZVBhc3N3b3JkRGF0YS5wYXNzd29yZEN1cnJlbnQgPT0gbnVsbCkge1xuICAgICAgYXJncyA9IHtcbiAgICAgICAgcGFzc3dvcmQ6IHVwZGF0ZVBhc3N3b3JkRGF0YS5wYXNzd29yZCxcbiAgICAgICAgcGFzc3dvcmRfY29uZmlybWF0aW9uOiB1cGRhdGVQYXNzd29yZERhdGEucGFzc3dvcmRDb25maXJtYXRpb25cbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ3MgPSB7XG4gICAgICAgIGN1cnJlbnRfcGFzc3dvcmQ6IHVwZGF0ZVBhc3N3b3JkRGF0YS5wYXNzd29yZEN1cnJlbnQsXG4gICAgICAgIHBhc3N3b3JkOiB1cGRhdGVQYXNzd29yZERhdGEucGFzc3dvcmQsXG4gICAgICAgIHBhc3N3b3JkX2NvbmZpcm1hdGlvbjogdXBkYXRlUGFzc3dvcmREYXRhLnBhc3N3b3JkQ29uZmlybWF0aW9uXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmICh1cGRhdGVQYXNzd29yZERhdGEucmVzZXRQYXNzd29yZFRva2VuKSB7XG4gICAgICBhcmdzLnJlc2V0X3Bhc3N3b3JkX3Rva2VuID0gdXBkYXRlUGFzc3dvcmREYXRhLnJlc2V0UGFzc3dvcmRUb2tlbjtcbiAgICB9XG5cbiAgICBjb25zdCBib2R5ID0gYXJncztcbiAgICByZXR1cm4gdGhpcy5odHRwLnB1dDxBcGlSZXNwb25zZT4odGhpcy5nZXRTZXJ2ZXJQYXRoKCkgKyB0aGlzLm9wdGlvbnMudXBkYXRlUGFzc3dvcmRQYXRoLCBib2R5KTtcbiAgfVxuXG4gIC8vIFJlc2V0IHBhc3N3b3JkIHJlcXVlc3RcbiAgcmVzZXRQYXNzd29yZChyZXNldFBhc3N3b3JkRGF0YTogUmVzZXRQYXNzd29yZERhdGEsIGFkZGl0aW9uYWxEYXRhPzogYW55KTogT2JzZXJ2YWJsZTxBcGlSZXNwb25zZT4ge1xuXG5cbiAgICBpZiAoYWRkaXRpb25hbERhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzZXRQYXNzd29yZERhdGEuYWRkaXRpb25hbERhdGEgPSBhZGRpdGlvbmFsRGF0YTtcbiAgICB9XG5cbiAgICB0aGlzLnVzZXJUeXBlLm5leHQoXG4gICAgICAocmVzZXRQYXNzd29yZERhdGEudXNlclR5cGUgPT0gbnVsbCkgPyBudWxsIDogdGhpcy5nZXRVc2VyVHlwZUJ5TmFtZShyZXNldFBhc3N3b3JkRGF0YS51c2VyVHlwZSlcbiAgICApO1xuXG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIFt0aGlzLm9wdGlvbnMubG9naW5GaWVsZF06IHJlc2V0UGFzc3dvcmREYXRhLmxvZ2luLFxuICAgICAgcmVkaXJlY3RfdXJsOiB0aGlzLm9wdGlvbnMucmVzZXRQYXNzd29yZENhbGxiYWNrXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxBcGlSZXNwb25zZT4odGhpcy5nZXRTZXJ2ZXJQYXRoKCkgKyB0aGlzLm9wdGlvbnMucmVzZXRQYXNzd29yZFBhdGgsIGJvZHkpO1xuICB9XG5cblxuICAvKipcbiAgICpcbiAgICogQ29uc3RydWN0IFBhdGhzIC8gVXJsc1xuICAgKlxuICAgKi9cblxuICBwcml2YXRlIGdldFVzZXJQYXRoKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICh0aGlzLnVzZXJUeXBlLnZhbHVlID09IG51bGwpID8gJycgOiB0aGlzLnVzZXJUeXBlLnZhbHVlLnBhdGggKyAnLyc7XG4gIH1cblxuICBwcml2YXRlIGFkZFRyYWlsaW5nU2xhc2hJZk5lZWRlZCh1cmw6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgbGFzdENoYXIgPSB1cmxbdXJsLmxlbmd0aCAtIDFdO1xuXG4gICAgcmV0dXJuIGxhc3RDaGFyID09PSAnLycgPyB1cmwgOiB1cmwgKyAnLyc7XG4gIH1cblxuICBwcml2YXRlIGdldEFwaVBhdGgoKTogc3RyaW5nIHtcbiAgICBsZXQgY29uc3RydWN0ZWRQYXRoID0gJyc7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmFwaUJhc2UgIT0gbnVsbCkge1xuICAgICAgY29uc3RydWN0ZWRQYXRoICs9IHRoaXMuYWRkVHJhaWxpbmdTbGFzaElmTmVlZGVkKHRoaXMub3B0aW9ucy5hcGlCYXNlKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmFwaVBhdGggIT0gbnVsbCkge1xuICAgICAgY29uc3RydWN0ZWRQYXRoICs9IHRoaXMuYWRkVHJhaWxpbmdTbGFzaElmTmVlZGVkKHRoaXMub3B0aW9ucy5hcGlQYXRoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uc3RydWN0ZWRQYXRoO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRTZXJ2ZXJQYXRoKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QXBpUGF0aCgpICsgdGhpcy5nZXRVc2VyUGF0aCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRPQXV0aFBhdGgob0F1dGhUeXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCBvQXV0aFBhdGg6IHN0cmluZztcblxuICAgIG9BdXRoUGF0aCA9IHRoaXMub3B0aW9ucy5vQXV0aFBhdGhzW29BdXRoVHlwZV07XG5cbiAgICBpZiAob0F1dGhQYXRoID09IG51bGwpIHtcbiAgICAgIG9BdXRoUGF0aCA9IGAvYXV0aC8ke29BdXRoVHlwZX1gO1xuICAgIH1cblxuICAgIHJldHVybiBvQXV0aFBhdGg7XG4gIH1cblxuICBwcml2YXRlIGdldE9BdXRoVXJsKG9BdXRoUGF0aDogc3RyaW5nLCBjYWxsYmFja1VybDogc3RyaW5nLCB3aW5kb3dUeXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCB1cmwgPSBuZXcgVVJMKFxuICAgICAgYCR7b0F1dGhQYXRofT9vbW5pYXV0aF93aW5kb3dfdHlwZT0ke3dpbmRvd1R5cGV9JmF1dGhfb3JpZ2luX3VybD0ke2VuY29kZVVSSUNvbXBvbmVudChjYWxsYmFja1VybCl9YCxcbiAgICAgIHRoaXMub3B0aW9ucy5vQXV0aEJhc2VcbiAgICApLmhyZWZcblxuICAgIGlmICh0aGlzLnVzZXJUeXBlLnZhbHVlICE9IG51bGwpIHtcbiAgICAgIHVybCArPSBgJnJlc291cmNlX2NsYXNzPSR7dGhpcy51c2VyVHlwZS52YWx1ZS5uYW1lfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqXG4gICAqIEdldCBBdXRoIERhdGFcbiAgICpcbiAgICovXG5cbiAgLy8gVHJ5IHRvIGxvYWQgYXV0aCBkYXRhXG4gIHByaXZhdGUgdHJ5TG9hZEF1dGhEYXRhKCk6IHZvaWQge1xuXG4gICAgY29uc3QgdXNlclR5cGUgPSB0aGlzLmdldFVzZXJUeXBlQnlOYW1lKHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3VzZXJUeXBlJykpO1xuXG4gICAgaWYgKHVzZXJUeXBlKSB7XG4gICAgICB0aGlzLnVzZXJUeXBlLm5leHQodXNlclR5cGUpO1xuICAgIH1cblxuICAgIHRoaXMuZ2V0QXV0aERhdGFGcm9tU3RvcmFnZSgpO1xuXG4gICAgaWYgKHRoaXMuYWN0aXZhdGVkUm91dGUpIHtcbiAgICAgIHRoaXMuZ2V0QXV0aERhdGFGcm9tUGFyYW1zKCk7XG4gICAgfVxuXG4gICAgLy8gaWYgKHRoaXMuYXV0aERhdGEpIHtcbiAgICAvLyAgICAgdGhpcy52YWxpZGF0ZVRva2VuKCk7XG4gICAgLy8gfVxuICB9XG5cbiAgLy8gUGFyc2UgQXV0aCBkYXRhIGZyb20gcmVzcG9uc2VcbiAgcHVibGljIGdldEF1dGhIZWFkZXJzRnJvbVJlc3BvbnNlKGRhdGE6IEh0dHBSZXNwb25zZTxhbnk+IHwgSHR0cEVycm9yUmVzcG9uc2UpOiB2b2lkIHtcbiAgICBjb25zdCBoZWFkZXJzID0gZGF0YS5oZWFkZXJzO1xuXG4gICAgY29uc3QgYXV0aERhdGE6IEF1dGhEYXRhID0ge1xuICAgICAgYWNjZXNzVG9rZW46IGhlYWRlcnMuZ2V0KCdhY2Nlc3MtdG9rZW4nKSxcbiAgICAgIGNsaWVudDogaGVhZGVycy5nZXQoJ2NsaWVudCcpLFxuICAgICAgZXhwaXJ5OiBoZWFkZXJzLmdldCgnZXhwaXJ5JyksXG4gICAgICB0b2tlblR5cGU6IGhlYWRlcnMuZ2V0KCd0b2tlbi10eXBlJyksXG4gICAgICB1aWQ6IGhlYWRlcnMuZ2V0KCd1aWQnKVxuICAgIH07XG5cbiAgICB0aGlzLnNldEF1dGhEYXRhKGF1dGhEYXRhKTtcbiAgfVxuXG4gIC8vIFBhcnNlIEF1dGggZGF0YSBmcm9tIHBvc3QgbWVzc2FnZVxuICBwcml2YXRlIGdldEF1dGhEYXRhRnJvbVBvc3RNZXNzYWdlKGRhdGE6IGFueSk6IHZvaWQge1xuICAgIGNvbnN0IGF1dGhEYXRhOiBBdXRoRGF0YSA9IHtcbiAgICAgIGFjY2Vzc1Rva2VuOiBkYXRhWydhdXRoX3Rva2VuJ10sXG4gICAgICBjbGllbnQ6IGRhdGFbJ2NsaWVudF9pZCddLFxuICAgICAgZXhwaXJ5OiBkYXRhWydleHBpcnknXSxcbiAgICAgIHRva2VuVHlwZTogJ0JlYXJlcicsXG4gICAgICB1aWQ6IGRhdGFbJ3VpZCddXG4gICAgfTtcblxuICAgIHRoaXMuc2V0QXV0aERhdGEoYXV0aERhdGEpO1xuICB9XG5cbiAgLy8gVHJ5IHRvIGdldCBhdXRoIGRhdGEgZnJvbSBzdG9yYWdlLlxuICBwdWJsaWMgZ2V0QXV0aERhdGFGcm9tU3RvcmFnZSgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGF1dGhEYXRhOiBBdXRoRGF0YSA9IHtcbiAgICAgIGFjY2Vzc1Rva2VuOiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhY2Nlc3NUb2tlbicpLFxuICAgICAgY2xpZW50OiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjbGllbnQnKSxcbiAgICAgIGV4cGlyeTogdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZXhwaXJ5JyksXG4gICAgICB0b2tlblR5cGU6IHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Rva2VuVHlwZScpLFxuICAgICAgdWlkOiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCd1aWQnKVxuICAgIH07XG5cbiAgICBpZiAodGhpcy5jaGVja0F1dGhEYXRhKGF1dGhEYXRhKSkge1xuICAgICAgdGhpcy5hdXRoRGF0YS5uZXh0KGF1dGhEYXRhKTtcbiAgICB9XG4gIH1cblxuICAvLyBUcnkgdG8gZ2V0IGF1dGggZGF0YSBmcm9tIHVybCBwYXJhbWV0ZXJzLlxuICBwcml2YXRlIGdldEF1dGhEYXRhRnJvbVBhcmFtcygpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2YXRlZFJvdXRlLnF1ZXJ5UGFyYW1zLnN1YnNjcmliZShxdWVyeVBhcmFtcyA9PiB7XG4gICAgICBjb25zdCBhdXRoRGF0YTogQXV0aERhdGEgPSB7XG4gICAgICAgIGFjY2Vzc1Rva2VuOiBxdWVyeVBhcmFtc1sndG9rZW4nXSB8fCBxdWVyeVBhcmFtc1snYXV0aF90b2tlbiddLFxuICAgICAgICBjbGllbnQ6IHF1ZXJ5UGFyYW1zWydjbGllbnRfaWQnXSxcbiAgICAgICAgZXhwaXJ5OiBxdWVyeVBhcmFtc1snZXhwaXJ5J10sXG4gICAgICAgIHRva2VuVHlwZTogJ0JlYXJlcicsXG4gICAgICAgIHVpZDogcXVlcnlQYXJhbXNbJ3VpZCddXG4gICAgICB9O1xuXG4gICAgICBpZiAodGhpcy5jaGVja0F1dGhEYXRhKGF1dGhEYXRhKSkge1xuICAgICAgICB0aGlzLmF1dGhEYXRhLm5leHQoYXV0aERhdGEpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIFNldCBBdXRoIERhdGFcbiAgICpcbiAgICovXG5cbiAgLy8gV3JpdGUgYXV0aCBkYXRhIHRvIHN0b3JhZ2VcbiAgcHJpdmF0ZSBzZXRBdXRoRGF0YShhdXRoRGF0YTogQXV0aERhdGEpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jaGVja0F1dGhEYXRhKGF1dGhEYXRhKSkge1xuXG4gICAgICB0aGlzLmF1dGhEYXRhLm5leHQoYXV0aERhdGEpO1xuXG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhY2Nlc3NUb2tlbicsIGF1dGhEYXRhLmFjY2Vzc1Rva2VuKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2NsaWVudCcsIGF1dGhEYXRhLmNsaWVudCk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdleHBpcnknLCBhdXRoRGF0YS5leHBpcnkpO1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW5UeXBlJywgYXV0aERhdGEudG9rZW5UeXBlKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3VpZCcsIGF1dGhEYXRhLnVpZCk7XG5cbiAgICAgIGlmICh0aGlzLnVzZXJUeXBlLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndXNlclR5cGUnLCB0aGlzLnVzZXJUeXBlLnZhbHVlLm5hbWUpO1xuICAgICAgfVxuXG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICpcbiAgICogVmFsaWRhdGUgQXV0aCBEYXRhXG4gICAqXG4gICAqL1xuXG4gIC8vIENoZWNrIGlmIGF1dGggZGF0YSBjb21wbGV0ZSBhbmQgaWYgcmVzcG9uc2UgdG9rZW4gaXMgbmV3ZXJcbiAgcHJpdmF0ZSBjaGVja0F1dGhEYXRhKGF1dGhEYXRhOiBBdXRoRGF0YSk6IGJvb2xlYW4ge1xuXG4gICAgaWYgKFxuICAgICAgYXV0aERhdGEuYWNjZXNzVG9rZW4gIT0gbnVsbCAmJlxuICAgICAgYXV0aERhdGEuY2xpZW50ICE9IG51bGwgJiZcbiAgICAgIGF1dGhEYXRhLmV4cGlyeSAhPSBudWxsICYmXG4gICAgICBhdXRoRGF0YS50b2tlblR5cGUgIT0gbnVsbCAmJlxuICAgICAgYXV0aERhdGEudWlkICE9IG51bGxcbiAgICApIHtcbiAgICAgIGlmICh0aGlzLmF1dGhEYXRhLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGF1dGhEYXRhLmV4cGlyeSA+PSB0aGlzLmF1dGhEYXRhLnZhbHVlLmV4cGlyeTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuXG4gIC8qKlxuICAgKlxuICAgKiBPQXV0aFxuICAgKlxuICAgKi9cblxuICBwcml2YXRlIHJlcXVlc3RDcmVkZW50aWFsc1ZpYVBvc3RNZXNzYWdlKGF1dGhXaW5kb3c6IGFueSk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgY29uc3QgcG9sbGVyT2JzZXJ2ID0gaW50ZXJ2YWwoNTAwKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlT2JzZXJ2ID0gZnJvbUV2ZW50KHRoaXMuZ2xvYmFsIGFzIGFueSwgJ21lc3NhZ2UnKS5waXBlKFxuICAgICAgcGx1Y2soJ2RhdGEnKSxcbiAgICAgIGZpbHRlcih0aGlzLm9BdXRoV2luZG93UmVzcG9uc2VGaWx0ZXIpXG4gICAgKTtcblxuICAgIHJlc3BvbnNlT2JzZXJ2LnN1YnNjcmliZShcbiAgICAgIHRoaXMuZ2V0QXV0aERhdGFGcm9tUG9zdE1lc3NhZ2UuYmluZCh0aGlzKVxuICAgICk7XG5cbiAgICBjb25zdCBwb2xsZXJTdWJzY3JpcHRpb24gPSBwb2xsZXJPYnNlcnYuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgIGlmIChhdXRoV2luZG93LmNsb3NlZCkge1xuICAgICAgICBwb2xsZXJTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF1dGhXaW5kb3cucG9zdE1lc3NhZ2UoJ3JlcXVlc3RDcmVkZW50aWFscycsICcqJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzcG9uc2VPYnNlcnY7XG4gIH1cblxuICBwcml2YXRlIG9BdXRoV2luZG93UmVzcG9uc2VGaWx0ZXIoZGF0YTogYW55KTogYW55IHtcbiAgICBpZiAoZGF0YS5tZXNzYWdlID09PSAnZGVsaXZlckNyZWRlbnRpYWxzJyB8fCBkYXRhLm1lc3NhZ2UgPT09ICdhdXRoRmFpbHVyZScpIHtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqXG4gICAqIFV0aWxpdGllc1xuICAgKlxuICAgKi9cblxuICAvLyBNYXRjaCB1c2VyIGNvbmZpZyBieSB1c2VyIGNvbmZpZyBuYW1lXG4gIHByaXZhdGUgZ2V0VXNlclR5cGVCeU5hbWUobmFtZTogc3RyaW5nKTogVXNlclR5cGUge1xuICAgIGlmIChuYW1lID09IG51bGwgfHwgdGhpcy5vcHRpb25zLnVzZXJUeXBlcyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLnVzZXJUeXBlcy5maW5kKFxuICAgICAgdXNlclR5cGUgPT4gdXNlclR5cGUubmFtZSA9PT0gbmFtZVxuICAgICk7XG4gIH1cbn1cbiJdfQ==
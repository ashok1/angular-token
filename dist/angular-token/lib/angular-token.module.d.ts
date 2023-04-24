import { ModuleWithProviders } from '@angular/core';
import { AngularTokenOptions } from './angular-token.model';
import * as i0 from "@angular/core";
export * from './angular-token.service';
export declare class AngularTokenModule {
    constructor(parentModule: AngularTokenModule);
    static forRoot(options: AngularTokenOptions): ModuleWithProviders<AngularTokenModule>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AngularTokenModule, [{ optional: true; skipSelf: true; }]>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<AngularTokenModule, never, never, never>;
    static ɵinj: i0.ɵɵInjectorDeclaration<AngularTokenModule>;
}

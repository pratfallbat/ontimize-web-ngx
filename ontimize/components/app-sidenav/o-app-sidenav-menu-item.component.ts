import {
  // Optional,
  // Inject,
  // forwardRef,
  Injector,
  NgModule,
  Component,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { InputConverter } from '../../decorators';
import { OSharedModule } from '../../shared';
import {
  OTranslateService,
  LoginService,
  // AppMenuService,
  MenuItem,
  MenuItemAction,
  MenuItemLocale
} from '../../services';

// import { OAppSidenavComponent } from './o-app-sidenav.component';

export const DEFAULT_INPUTS_O_APP_SIDENAV_MENU_ITEM = [
  'menuItem : menu-item',
  'menuItemType : menu-item-type',
  'sidenavOpened : sidenav-opened'
];

export const DEFAULT_OUTPUTS_O_APP_SIDENAV_MENU_ITEM = [];

@Component({
  selector: 'o-app-sidenav-menu-item',
  inputs: DEFAULT_INPUTS_O_APP_SIDENAV_MENU_ITEM,
  outputs: DEFAULT_OUTPUTS_O_APP_SIDENAV_MENU_ITEM,
  templateUrl: './o-app-sidenav-menu-item.component.html',
  styleUrls: ['./o-app-sidenav-menu-item.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class OAppSidenavMenuItemComponent implements OnInit {
  public static DEFAULT_INPUTS_O_APP_SIDENAV_MENU_ITEM = DEFAULT_INPUTS_O_APP_SIDENAV_MENU_ITEM;
  public static DEFAULT_OUTPUTS_O_APP_SIDENAV_MENU_ITEM = DEFAULT_OUTPUTS_O_APP_SIDENAV_MENU_ITEM;

  protected translateService: OTranslateService;
  protected loginService: LoginService;
  // protected appMenuService: AppMenuService;

  @InputConverter()
  sidenavOpened: boolean = true;
  public menuItem: MenuItem;
  public menuItemType: string;

  // private _menuItemType: string;

  constructor(
    protected injector: Injector
    // @Optional() @Inject(forwardRef(() => OAppSidenavComponent)) protected oAppSidenavComponent: OAppSidenavComponent,
  ) {
    this.translateService = this.injector.get(OTranslateService);
    this.loginService = this.injector.get(LoginService);
    // this.appMenuService = this.injector.get(AppMenuService);
  }

  // set menuItemType(val: string) {
  //   this._menuItemType = val;
  // }

  // get menuItemType() {
  //   return this._menuItemType;
  // }

  ngOnInit() {
    // this.menuItemType = this.appMenuService.getMenuItemType(this.menuItem);
  }

  executeItemAction() {
    const actionItem = (this.menuItem as MenuItemAction);
    actionItem.action();
  }

  configureI18n() {
    const localeItem = (this.menuItem as MenuItemLocale);
    if (this.isConfiguredLang()) {
      return;
    }
    if (this.translateService) {
      this.translateService.use(localeItem.locale);
    }
  }

  isConfiguredLang() {
    const localeItem = (this.menuItem as MenuItemLocale);
    if (this.translateService) {
      return (this.translateService.getCurrentLang() === localeItem.locale);
    }
    return false;

  }

  logout() {
    this.loginService.logoutWithConfirmationAndRedirect();
  }

  onClick() {
    switch (this.menuItemType) {
      case 'action':
        this.executeItemAction();
        break;
      case 'locale':
        this.configureI18n();
        break;
      case 'logout':
        this.logout();
        break;
      default:
        break;
    }
  }
}

@NgModule({
  imports: [
    CommonModule,
    OSharedModule,
    RouterModule
  ],
  declarations: [
    OAppSidenavMenuItemComponent
  ],
  exports: [OAppSidenavMenuItemComponent]
})
export class OAppSidenavMenuItemModule { }

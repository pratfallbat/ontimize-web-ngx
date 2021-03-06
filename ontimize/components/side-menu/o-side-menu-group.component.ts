import { Component, Inject, forwardRef, NgModule, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OSharedModule } from '../../shared';
import { OSideMenuModule, OSideMenuComponent } from './o-side-menu.component';

export const DEFAULT_INPUTS_O_SIDE_MENU_GROUP = [
  // title [string]: menu group title. Default: no value.
  'title',
  // icon [string]: material icon. Default: no value.
  'icon'
];

/**
 * @deprecated This component will be removed in following versions
 */
@Component({
  moduleId: module.id,
  selector: 'o-side-menu-group',
  templateUrl: './o-side-menu-group.component.html',
  styleUrls: ['./o-side-menu-group.component.scss'],
  inputs: DEFAULT_INPUTS_O_SIDE_MENU_GROUP,
  encapsulation: ViewEncapsulation.None
})
export class OSideMenuGroupComponent {

  public static DEFAULT_INPUTS_O_SIDE_MENU_GROUP = DEFAULT_INPUTS_O_SIDE_MENU_GROUP;

  protected menu: OSideMenuComponent;

  protected title: string;

  constructor( @Inject(forwardRef(() => OSideMenuComponent)) menu: OSideMenuComponent) {
    this.menu = menu;
  }

}

@NgModule({
  declarations: [OSideMenuGroupComponent],
  imports: [OSharedModule, CommonModule, OSideMenuModule],
  exports: [OSideMenuGroupComponent]
})
export class OSideMenuGroupModule {
}

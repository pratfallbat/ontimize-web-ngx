import {Component, OnInit, OnDestroy, EventEmitter,
  Injector, NgZone, ChangeDetectorRef,
  NgModule, ContentChildren, QueryList,
  ModuleWithProviders,
  ViewEncapsulation} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, ActivatedRoute } from '@angular/router';
import {FormGroup, ReactiveFormsModule, FormControl, FormsModule} from '@angular/forms';
import {Observable} from 'rxjs/Observable';

import { MdProgressBarModule } from '@angular2-material/progress-bar';
import { MdTabGroup } from '@angular2-material/tabs';

import {OntimizeService, DialogService,
  dataServiceFactory} from '../../services';
import {InputConverter} from '../../decorators';
import { IFormComponent, IFormControlComponent, IFormDataTypeComponent} from '../../interfaces';
import {OFormToolbarModule, OFormToolbarComponent} from './o-form-toolbar.component';
import {OFormValue} from './OFormValue';
import {Util, SQLTypes} from '../../utils';

export const enum Mode {
  QUERY,
  INSERT,
  UPDATE,
  INITIAL
};

export const DEFAULT_INPUTS_O_FORM = [
  // showHeader [boolean]: visibility of form toolbar. Default: yes.
  'showHeader: show-header',

  // labelheader [string]: displayable text on form toolbar. Default: ''.
  'labelheader: label-header',

  // headeractions [string]: available action buttons on form toolbar of standard CRUD operations, separated by ';'. Available options are R;I;U;D (Refresh, Insert, Update, Delete). Default: R;I;U;D
  'headeractions: header-actions',

   // entity [string]: entity of the service. Default: no value.
  'entity',

  // keys [string]: entity keys, separated by ';'. Default: no value.
  'keys',

  // columns [string]: columns of the entity, separated by ';'. Default: no value.
  'columns',

  // service [string]: JEE service path. Default: no value.
  'service',

  // showDetailAfterInsert [string][yes|no|true|false]: shows detail form after insert new record. Default: false;
  'stayInRecordAfterInsert: stay-in-record-after-insert'
];

export const DEFAULT_OUTPUTS_O_FORM = [
  'onFormDataLoaded',
  'beforeCloseDetail'
];


@Component({
  selector: 'o-form',
  providers: [
    { provide: OntimizeService, useFactory: dataServiceFactory, deps:[Injector] }
  ],
  templateUrl: '/form/o-form.component.html',
  styleUrls: ['/form/o-form.component.css'],
  inputs: [
    ...DEFAULT_INPUTS_O_FORM
  ],
  outputs: [
    ...DEFAULT_OUTPUTS_O_FORM
  ],
  encapsulation: ViewEncapsulation.None
})
export class OFormComponent implements OnInit, OnDestroy {

  public static BACK_ACTION: string = 'BACK';
  public static CLOSE_DETAIL_ACTION: string = 'CLOSE';
  public static RELOAD_ACTION: string = 'RELOAD';
  public static GO_EDIT_ACTION: string = 'GO_EDIT';
  public static EDIT_ACTION: string = 'EDIT';
  public static INSERT_ACTION: string = 'INSERT';
  public static GO_INSERT_ACTION: string = 'GO_INSERT';
  public static DELETE_ACTION: string = 'DELETE';

  public static DEFAULT_INPUTS_O_FORM = DEFAULT_INPUTS_O_FORM;
  public static DEFAULT_OUTPUTS_O_FORM = DEFAULT_OUTPUTS_O_FORM;

  @InputConverter()
  showHeader: boolean = true;
  labelheader: string = '';
  headeractions: string = '';
  entity: string;
  keys: string = '';
  columns: string = '';
  service: string;
  @InputConverter()
  stayInRecordAfterInsert: boolean = false;

  isDetailForm: boolean = false;
  keysArray: string[] = [];
  colsArray: string[] = [];
  dataService: OntimizeService;

  formGroup: FormGroup;
  onFormDataLoaded: EventEmitter<Object> = new EventEmitter<Object>();
  beforeCloseDetail: EventEmitter<any> = new EventEmitter<any>();
  beforeGoEditMode: EventEmitter<any> = new EventEmitter<any>();

  public loading: boolean = false;
  public formData: Object = {};/* Array<any> = [];*/
  public navigationData: Array<any> = [];
  public currentIndex = 0;
  public mode: Mode = Mode.INITIAL;

  protected dialogService: DialogService;

  protected _formToolbar: OFormToolbarComponent;

  @ContentChildren(MdTabGroup)
  protected tabGroupChildren: QueryList<MdTabGroup>;

  protected _components: Object = {};
  protected _compSQLTypes: Object = {};

  protected qParamSub: any;
  protected queryParams: any;

  protected urlParamSub: any;
  protected urlParams: Object;

  protected urlSub: any;
  protected urlSegments: any;

  protected formDataCache: Object;
  protected tabSelectChangeFired: boolean = false;

  constructor(
    protected router: Router,
    protected actRoute: ActivatedRoute,
    protected zone: NgZone,
    protected cd: ChangeDetectorRef,
    protected injector: Injector) {

    this.dialogService = injector.get(DialogService);
  }

  registerFormComponent(comp: any) {
    if (comp) {
      let attr = comp.getAttribute();
      if (attr && attr.length > 0) {
        this._components[attr] = comp;
        /*
        * TODO. Check it!!!
        * En un formulario con tabs, cuando se cambia de uno a otro, se destruyen las vistas
        * de los componentes hijo del formulario.
        * formDataCache contiene los valores (originales ó editados) de los campos del formulario.
        * La idea es asignar ese valor al campo cuando se registre de nuevo (Hay que asegurar el proceso
        * para que sólo sea cuando se registra de nuevo ;) )
        */
        if (this.formDataCache
          && this.formDataCache.hasOwnProperty(comp.getAttribute())
          && this.getDataValues()
          && this._components.hasOwnProperty(comp.getAttribute())) {
          let cachedValue = this.formDataCache[comp.getAttribute()];
          if (cachedValue !== null) {
            this._components[attr].setValue(cachedValue);
          }
        }
      }
    }
  }

  registerSQLTypeFormComponent(comp: IFormDataTypeComponent) {
    if (comp) {
      let type = comp.getSQLType();
      if (type !== SQLTypes.OTHER) {
        // Right now just store values different of 'OTHER'
        this._compSQLTypes[comp.getAttribute()] = type;
      }
    }
  }

  registerFormControlComponent(comp: IFormControlComponent) {
    if (comp) {
      let control: FormControl = comp.getControl();
      if (control) {
        this.formGroup.addControl(comp.getAttribute(), control);
      }
    }
  }

  unregisterFormComponent(comp: IFormComponent) {
    if (comp) {
      let attr = comp.getAttribute();
      if (attr && attr.length > 0) {
        delete this._components[attr];
      }
    }
  }

  unregisterFormControlComponent(comp: IFormControlComponent) {
    if (comp) {
      let control: FormControl = comp.getControl();
      if (control) {
        this.formGroup.removeControl(comp.getAttribute());
      }
    }
  }

  unregisterSQLTypeFormComponent(comp: IFormDataTypeComponent) {
    if (comp) {
      let attr = comp.getAttribute();
      if (attr && attr.length > 0) {
        delete this._compSQLTypes[attr];
      }
    }
  }

  registerToolbar(fToolbar: OFormToolbarComponent) {
    if (fToolbar) {
      this._formToolbar = fToolbar;
      this._formToolbar.isDetail = this.isDetailForm;
    }
  }

  public getComponents(): Object {
    return this._components;
  }

  public load(): any {
    var self = this;
    var loadObservable = new Observable(observer => {
      var timer = window.setTimeout(() => {
        observer.next(true);
      }, 250);

      return () => {
        window.clearTimeout(timer);
        self.loading = false;
      };

    });
    var subscription = loadObservable.subscribe(val => {
      self.loading = val as boolean;
    });
    return subscription;
  }

  getDataValue(attr: string) {

    if (this.mode === Mode.INITIAL) {
      let data = this.formData;
      if (data && data.hasOwnProperty(attr)) {
        return data[attr];
      }
    } else if (this.mode === Mode.INSERT) {
      let val = this.formGroup.value[attr];
      return new OFormValue(val);
    } else if (this.mode === Mode.UPDATE) {
      if (this.formData && Object.keys(this.formData).length > 0 ) {
        // Checking if field value is stored in form cache...
        // if (this.formGroup.controls[attr] &&
        // this.formGroup.controls[attr].dirty === true) {
        //   let val = this.formGroup.value[attr];
        //   return new OFormValue(val);
        // } else {
        if (this.formGroup.dirty && this.formDataCache &&
            this.formDataCache.hasOwnProperty(attr)) {
          let val = this.formDataCache[attr];
          if (val instanceof OFormValue) {
            return val;
          }
          return new OFormValue(val);
        } else {
          // Return original value stored into form data...
          let data = this.formData;
          if (data && data.hasOwnProperty(attr)) {
            return data[attr];
          }
        }
      }
    }
    return new OFormValue();
  }

  getDataValues() {
    return this.formData;
  }

  clearData() {
    let filter = {};
    if (this.urlParams) {
      for (let key in this.urlParams) {
          if (this.urlParams.hasOwnProperty(key)) {
            filter[key] = this.urlParams[key];
          }
      }
    }
    setTimeout(() => {
      this._setData(filter);
    }, 0);
  }

  executeToolbarAction(action: string, ...args: any[]) {

    switch (action) {
      case OFormComponent.BACK_ACTION: this._backAction(); break;
      case OFormComponent.CLOSE_DETAIL_ACTION: this._closeDetailAction(); break;
      case OFormComponent.RELOAD_ACTION: this._reloadAction(true); break;
      case OFormComponent.GO_INSERT_ACTION: this._goInsertMode(); break;
      case OFormComponent.INSERT_ACTION: this._insertAction(); break;
      case OFormComponent.GO_EDIT_ACTION: this._goEditMode(); break;
      case OFormComponent.EDIT_ACTION: this._editAction(); break;
      case OFormComponent.DELETE_ACTION: return this._deleteAction();
      default: break;
    }
    return;
  }

  /**
   * Angular methods
   */
  ngOnInit() {
    this.formGroup = new FormGroup({});
    var self = this;
    /*
    * Keeping updated a cache of form data values
    */
    this.formGroup.valueChanges
      .subscribe((value: any) => {
        if (!self.tabSelectChangeFired) {
          if (self.formDataCache === undefined) {
            // initialize cache
            self.formDataCache = {};
          }
          Object.assign(self.formDataCache, value);
        }
      });

    if (this.headeractions === 'all') {
      this.headeractions = 'R;I;U;D';
    }
    this.keysArray = Util.parseArray(this.keys);
    this.colsArray = Util.parseArray(this.columns);

    this.configureService();

    let qParamObs = this.actRoute.queryParams;
    this.qParamSub = qParamObs.subscribe(params => {
      if (params) {
        this.queryParams = params;
        let isDetail = params['isdetail'];
        if (isDetail === 'true') {
          this.isDetailForm = true;
        } else {
          this.isDetailForm = false;
        }
      }
    });

    this.urlParamSub = this.actRoute
      .params
      .subscribe(params => {
        self.urlParams = params;
        // //TODO Obtain 'datatype' of each key contained into urlParams for
        // // for building correctly query filter!!!!
        // if (self.urlParams && Object.keys(self.urlParams).length > 0) {
        //   self._reloadAction();
        // }
      });

    this.urlSub = this.actRoute
      .url
      .subscribe(urlSegments => {
        self.urlSegments = urlSegments;
      });

    this.mode = Mode.INITIAL;
  }

  configureService() {
    this.dataService = this.injector.get(OntimizeService);

    if (Util.isDataService(this.dataService)) {
      let serviceCfg = this.dataService.getDefaultServiceConfiguration(this.service);
      if (this.entity) {
        serviceCfg['entity'] = this.entity;
      }
      this.dataService.configureService(serviceCfg);
    }
  }

  ngAfterViewChecked() {
    if (this.tabGroupChildren && this.tabSelectChangeFired) {
      this.tabSelectChangeFired = false;
      // reload tab content...
      this._reloadTabContent();
    }
  }

  ngOnDestroy() {
    if (this.urlParamSub) {
      this.urlParamSub.unsubscribe();
    }
    if (this.qParamSub) {
      this.qParamSub.unsubscribe();
    }
    if (this.urlParamSub) {
      this.urlParamSub.unsubscribe();
    }
    this.formDataCache = undefined;
  }

  ngAfterViewInit() {
      var _path = '';
      let segment = this.urlSegments[this.urlSegments.length - 1];
      _path = segment['path'];

      if (_path === 'new') {
        //insert mode
        this.setFormMode(Mode.INSERT);
        return;
      } else if (_path === 'edit') {
        //edit mode
        this.setFormMode(Mode.UPDATE);
      } else {
        this.setFormMode(Mode.INITIAL);
      }


    //TODO Obtain 'datatype' of each key contained into urlParams for
    // for building correctly query filter!!!!
    if (this.urlParams && Object.keys(this.urlParams).length > 0) {
      this._reloadAction();
      }

    if (this.tabGroupChildren) {
      var self = this;
      this.tabGroupChildren.forEach((item: MdTabGroup, index: number) => {
        item.selectChange.subscribe((evt: any) => {
          self.tabSelectChangeFired = true;
        });
      });
    }

  }

  /**
   * Inner methods
   * */

  _setComponentsEditable(state: boolean) {
    let comps: any = this.getComponents();
    if (comps) {
      let keys = Object.keys(comps);
      keys.forEach(element => {
        comps[element].isReadOnly = !state;
      });
    }
  }


  /**
   * Sets form operation mode.
   * @param  {Mode} mode The mode to be established
   */
  setFormMode(mode: Mode) {
    switch (mode) {
      case Mode.INITIAL:
        this.mode = Mode.INITIAL;
        if (this._formToolbar) {
          this._formToolbar.setInitialMode();
        }
        break;
      case Mode.INSERT:
        this.mode = Mode.INSERT;
        if (this._formToolbar) {
          this._formToolbar.setInsertMode();
        }
        break;
      case Mode.UPDATE:
        this.mode = Mode.UPDATE;
        if (this._formToolbar) {
          this._formToolbar.setEditMode();
        }
      default:
        break;
    }
  }

  move(index) {
    this.queryByIndex(index);
  }

  _setData(data) {
    if (Util.isArray(data)) {
      this.navigationData = <Array<Object>>this.toFormValueData(data);
      this.syncCurrentIndex();
      this.queryByIndex(this.currentIndex);
    } else if(Util.isObject(data)) {
      this._updateFormData(this.toFormValueData(data));
      this._emitData(data);
    } else {
      console.warn('Form has received not supported service data. Supported data are Array or Object');
      this._updateFormData({});
    }
  }

  protected queryByIndex(index: number) {
    var self = this;
    this._query(index).subscribe(resp => {
      if (resp.code === 0) {
        let currentData = resp.data[0];
        self._updateFormData(self.toFormValueData(currentData));
        self._emitData(currentData);
      } else {
        console.log('error ');
      }
    }, err => {
      console.log(err);
    });
  }

  protected _updateFormData(newFormData: Object) {
    this.formData = newFormData;
    if (this._components) {
      var self = this;
      Object.keys(this._components).forEach(key => {
        let comp = this._components[key];
        if (Util.isFormDataComponent(comp) && comp.isAutoBinding()) {
          try {
            comp.data = self.getDataValue(key);
          } catch (error) {
            console.error(error);
          }
        }
      });
    }
  }

  _emitData(data) {
    this.onFormDataLoaded.emit(data);
  }

  _backAction(...args: any[]) {
    this.router.navigate(['../../'], { relativeTo: this.actRoute })
      .catch(err => {
        console.error(err.message);
      });
  }

  _closeDetailAction() {

    this.beforeCloseDetail.emit();

    // Copy current url segments array...
    let urlArray = this.urlSegments.slice(0);
    //TODO do it better (maybe propagation nested level number?)
    let nestedLevel = urlArray.length > 3;

    // Extract segments for proper navigation...
    if (nestedLevel) {
      if ( this.mode === Mode.UPDATE /*action === 'edit'*/) {
        urlArray.pop();
      // } else if (action === undefined || action === 'new') {
      } else if (this.mode === Mode.INITIAL || this.mode === Mode.INSERT) {
        urlArray.pop();
        urlArray.pop();
      }
    } else {
      urlArray.pop();
    }
    // If we are in nested detail form we have to go up two levels
    // home/:key/subhome/:key2

    let urlText = '';
    if (urlArray) {
      urlArray.forEach( (item, index) => {
        urlText += item['path'];
        if (index < urlArray.length - 1) {
          urlText += '/';
        }
      });
    }

    let extras = {};
    if (nestedLevel || (urlArray.length > 1 && this.isDetailForm)) {
      extras['queryParams'] = {'isdetail' : 'true'};
    }
    this.router.navigate([urlText], extras)
    .catch(err => {
      console.error(err.message);
    });
  }

  _stayInRecordAfterInsert(insertedKeys: Object) {

    // Copy current url segments array...
    let urlArray = this.urlSegments.slice(0);
    //TODO do it better (maybe propagation nested level number?)
    let nestedLevel = urlArray.length > 3;

    // Extract segments for proper navigation...
    if (nestedLevel) {
      urlArray.pop();
      urlArray.pop();
    } else {
      urlArray.pop();
    }

    let urlText = '';
    if (urlArray) {
      urlArray.forEach( (item, index) => {
        urlText += item['path'];
        if (index < urlArray.length - 1) {
          urlText += '/';
        }
      });
    }
    if (this.keysArray && insertedKeys) {
      urlText += '/';
      this.keysArray.forEach((current, index) => {
        if (insertedKeys[current]) {
          urlText += insertedKeys[current];
          if (index < this.keysArray.length - 1) {
            urlText += '/';
          }
        }
      });
    }

    let extras = {
      'queryParams': {'isdetail' : 'true'}
    };

    this.router.navigate([urlText], extras)
    .catch(err => {
      console.error(err.message);
    });
  }

  _reloadAction(useFilter: boolean = false) {
    let filter = {};
    if (useFilter) {
      filter = this.getCurrentKeysValues();
    }
    this.queryData(filter);
  }

  _reloadTabContent() {
    if (this.mode === Mode.INITIAL) {
      this.queryByIndex(this.currentIndex);
    } else if (this.mode === Mode.UPDATE) {
      // TODO query only fields not stored in formData nor formDataCache
      this.queryByIndex(this.currentIndex);
    }
  }

  /**
   * Navigates to 'insert' mode
   */
  _goInsertMode() {
    this.router.navigate(['../', 'new'], { relativeTo: this.actRoute })
    .catch(err => {
        console.error(err.message);
      });
  }

  /**
   * Performs insert action.
   */
  _insertAction() {

    Object.keys(this.formGroup.controls).forEach(
      (control) => {
        this.formGroup.controls[control].markAsTouched();
      }
    );

    if (!this.formGroup.valid) {
      this.dialogService.alert('ERROR', 'MESSAGES.FORM_VALIDATION_ERROR');
      return;
    }

    var self = this;
    let values = this.getAttributesValuesToInsert();
    let sqlTypes = this.getAttributesSQLTypes();
    this.insertData(values, sqlTypes)
      .subscribe(resp => {
        self.postCorrectInsert(resp);
        //TODO mostrar un toast indicando que la operación fue correcta...

        if (self.stayInRecordAfterInsert) {
          this._stayInRecordAfterInsert(resp);
        } else {
          self._closeDetailAction();
        }

      }, error => {
        self.postIncorrectInsert(error);
      });
  }

  /**
   * Navigates to 'edit' mode
   */
  _goEditMode() {

    this.beforeGoEditMode.emit();

    let url = '';
    this.keysArray.map(key => {
      if (this.urlParams[key]) {
        url += this.urlParams[key];
      }
    });

    let extras = { relativeTo: this.actRoute };
    if (this.isDetailForm) {
       extras['queryParams'] = {'isdetail' : 'true'};
    }
    this.router.navigate(['../', url, 'edit'], extras)
    .catch(err => {
      console.error(err.message);
    });
  }

  /**
   * Performs 'edit' action
    */
  _editAction() {

    Object.keys(this.formGroup.controls).forEach(
      (control) => {
        this.formGroup.controls[control].markAsTouched();
      }
    );

    if (!this.formGroup.valid) {
      this.dialogService.alert('ERROR', 'MESSAGES.FORM_VALIDATION_ERROR');
      return;
    }

    // retrieving keys...
    var self = this;
    let filter = this.getKeysValues(this.currentIndex);

    // retrieving values to update...
    let values = this.getAttributesValuesToUpdate();
    let sqlTypes = this.getAttributesSQLTypes();

    if (Object.keys(values).length === 0) {
      //Nothing to update
      this.dialogService.alert('INFO', 'MESSAGES.FORM_NOTHING_TO_UPDATE_INFO');
      return;
    }

    // invoke update method...
    this.updateData(filter, values, sqlTypes)
      .subscribe(resp => {
        self.postCorrectUpdate(resp);
        //TODO mostrar un toast indicando que la operación fue correcta...
        self._closeDetailAction();
      }, error => {
        self.postIncorrectUpdate(error);
      });
  }

  /**
   * Performs 'delete' action
    */
  _deleteAction() {
    var self = this;
    let filter = {};
    this.keysArray.map(key => {
      filter[key] = self.urlParams[key];
    });
    return this.deleteData(filter);
  }

  /*
  Utility methods
  */

  queryData(filter) {
    var self = this;
    var loader = self.load();
    this.dataService.query(filter, this.keysArray, this.entity)
      .subscribe(resp => {
        loader.unsubscribe();
        if (resp.code === 0) {
          self._setData(resp.data);
        } else {
          console.log('error ');
        }
      }, err => {
        console.log(err);
        loader.unsubscribe();
      });
  }


  _query(index): Observable<any> {
    var self = this;
    var loader = self.load();
    let filter = this.getKeysValues(index);
    let observable = this.dataService.query(filter, this.getAttributesToQuery(), this.entity);
    observable.subscribe(resp => {
      loader.unsubscribe();
    }, err => {
      console.log(err);
      loader.unsubscribe();
    });
    return observable;
  }

  protected getAttributesToQuery(): Array<any> {
    let attributes: Array<any> = [];
    // add form keys...
    if (this.keysArray && this.keysArray.length > 0) {
      attributes.push(...this.keysArray);
    }
    // add only the fields contained into the form...
    let keys = Object.keys(this._components);
    keys.map(item => {
      if (attributes.indexOf(item) < 0) {
        attributes.push(item);
      }
    });

    // add fields stored into form cache...
    if (this.formDataCache) {
      let keys = Object.keys(this.formDataCache);
      keys.map(item => {
        if (attributes.indexOf(item) < 0) {
          attributes.push(item);
        }
      });
     }

    return attributes;
  }

  insertData(values, sqlTypes?: Object): Observable<any> {
    var self = this;
    var loader = self.load();
    let observable = new Observable(observer => {
      this.dataService.insert(values, this.entity, sqlTypes)
        .subscribe(resp => {
          loader.unsubscribe();
          if (resp.code === 0) {
            observer.next(resp.data);
            observer.complete(resp.data);
          } else {
            observer.error(resp.message);
          }
        }, err => {
          loader.unsubscribe();
          observer.error(err);
        });
    });
    return observable;
  }

  protected getAttributesValuesToInsert(): Object {
    return this.formGroup.value;
  }

  protected getAttributesSQLTypes(): Object {
    let types: Object = {};
    if (this._compSQLTypes && Object.keys(this._compSQLTypes).length > 0) {
      Object.assign(types, this._compSQLTypes);
    }
    return types;
  }

  protected postCorrectInsert(result: any) {
    console.log('[OFormComponent.postCorrectInsert]', result);
  }

  protected postIncorrectInsert(result: any) {
    console.log('[OFormComponent.postIncorrectInsert]', result);
    this.dialogService.alert('ERROR', 'MESSAGES.ERROR_INSERT');
  }

  updateData(filter, values, sqlTypes?: Object): Observable<any> {
    var self = this;
    var loader = self.load();
    let observable = new Observable(observer => {
      this.dataService.update(filter, values, this.entity, sqlTypes)
        .subscribe(resp => {
          loader.unsubscribe();
          if (resp.code === 0) {
            observer.next(resp.data);
            observer.complete();
          } else {
            observer.error(resp.message);
          }
        }, err => {
          loader.unsubscribe();
          observer.error(err);
        });
    });
    return observable;
  }

  protected getAttributesValuesToUpdate(): Object {
    let values = {};
    var self = this;
    Object.keys(this.formGroup.controls).forEach(function (item) {
      if (self.formGroup.controls[item].dirty === true) {
        values[item] = self.formGroup.value[item];
      }
    });
    return values;
  }

  protected postCorrectUpdate(result: any) {
    console.log('[OFormComponent.postCorrectUpdate]', result);
  }

  protected postIncorrectUpdate(result: any) {
    console.log('[OFormComponent.postIncorrectUpdate]', result);
    this.dialogService.alert('ERROR', 'MESSAGES.ERROR_UPDATE');
  }

  deleteData(filter): Observable<any> {
    var self = this;
    var loader = self.load();
    let observable = new Observable(observer => {
      this.dataService.delete(filter, this.entity)
        .subscribe(resp => {
          loader.unsubscribe();
          if (resp.code === 0) {
            self.postCorrectDelete(resp);
            observer.next(resp.data);
            observer.complete(resp.data);
          } else {
            self.postIncorrectDelete(resp);
            observer.error(resp.message);
          }
        }, err => {
          loader.unsubscribe();
          self.postIncorrectDelete(err);
          observer.error(err);
        });
    });
    return observable;
  }

  protected postCorrectDelete(result: any) {
    console.log('[OFormComponent.postCorrectDelete]', result);
  }

  protected postIncorrectDelete(result: any) {
    console.log('[OFormComponent.postIncorrectDelete]', result);
    this.dialogService.alert('ERROR', 'MESSAGES.ERROR_DELETE');
  }


  toJSONData(data) {
    if (!data) {
      data = {};
    }
    let valueData = {};
    Object.keys(data).forEach(function (item) {
      valueData[item] = data[item].value;
    });
    return valueData;
  }

  toFormValueData(data) {
    if (data && Util.isArray(data)) {
      let valueData: Array<Object> = [];
      var self = this;
      data.forEach(item => {
        valueData.push(self.objectToFormValueData(item));
      });
      return valueData;
    } else if (data && Util.isObject(data)) {
      return this.objectToFormValueData(data);
    }
  }

  protected objectToFormValueData(data: Object): Object {
    let valueData = {};

    if (!data) {
      data = {};
    }

     Object.keys(data).forEach(function (item) {
      valueData[item] = new OFormValue(data[item]);
    });
    return valueData;
  }

  protected getCurrentKeysValues() {
    let filter = {};
    if (this.urlParams && this.keysArray) {
      this.keysArray.map(key => {
        if (this.urlParams[key]) {
          filter[key] = this.urlParams[key];
        }
      });
    };
    return filter;
  }

  protected getKeysValues(index: number) {
    let filter = {};
    if (index >= 0) {
      //TODO check it!!! let currentRecord = this.formData[index];
      let currentRecord = this.navigationData[index];
      if (this.keysArray) {
        this.keysArray.map(key => {
          if (currentRecord[key]) {
            let currentData = currentRecord[key];
            if (currentData instanceof OFormValue) {
              currentData = currentData.value;
            }
            filter[key] = currentData;
          }
        });
      }
    }
    return filter;
  }

  protected syncCurrentIndex() {
    if (this.navigationData) {
      var self = this;
      let currKV = this.getCurrentKeysValues();
      if (currKV && Object.keys(currKV).length > 0) {
        let current = this.objectToFormValueData(currKV);
        this.navigationData.forEach((value: any, index: number) => {
          // if (current === value) {
          //   self.currentIndex = index;
          // }

          // check whether current === value
          let equals = false;
          Object.keys(current).forEach(function (key) {
            let pair = value[key];
            if (pair && pair.value) {
              if (current[key].value === pair.value.toString()) {
                equals = true;
              } else {
                equals = false;
              }
            }
          });
          if (equals) {
            self.currentIndex = index;
          }
        });
      }
    }
    // this.currentIndex = 22;
  }

}

@NgModule({
  declarations: [OFormComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OFormToolbarModule, MdProgressBarModule],
  exports: [OFormComponent, OFormToolbarModule],
})
export class OFormModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: OFormModule,
      providers: []
    };
  }
}

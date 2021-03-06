import { ElementRef, Injector } from '@angular/core';
import { Subscription } from 'rxjs';

import { Codes, Util } from '../../utils';
import { ServiceUtils } from '../service.utils';
import { InputConverter } from '../../decorators';
import { IFormValueOptions } from '../form/OFormValue';
import { OFormComponent } from '../form/o-form.component';
import { DialogService, OntimizeService } from '../../services';
import { DEFAULT_INPUTS_O_FORM_DATA_COMPONENT, OFormDataComponent, DEFAULT_OUTPUTS_O_FORM_DATA_COMPONENT } from '../o-form-data-component.class';

export const DEFAULT_INPUTS_O_FORM_SERVICE_COMPONENT = [
  ...DEFAULT_INPUTS_O_FORM_DATA_COMPONENT,
  //static-data [Array<any>] : way to populate with static data. Default: no value.
  'staticData: static-data',

  'entity',
  'service',
  'columns',
  'valueColumn: value-column',
  'valueColumnType: value-column-type',
  'parentKeys: parent-keys',

  // Visible columns into selection dialog from parameter 'columns'. With empty parameter all columns are visible.
  'visibleColumns: visible-columns',

  // Visible columns in text field. By default, it is the parameter value of visible columns.
  'descriptionColumns: description-columns',

  'separator',

  'queryOnInit: query-on-init',
  'queryOnBind: query-on-bind',
  'queryOnEvent: query-on-event',

  // query-method [string]: name of the service method to perform queries. Default: query.
  'queryMethod: query-method',

  'serviceType : service-type',

  // query-with-null-parent-keys [string][yes|no|true|false]: Indicates whether or not to trigger query method when parent-keys filter is null. Default: false
  'queryWithNullParentKeys: query-with-null-parent-keys'
];

export const DEFAULT_OUTPUTS_O_FORM_SERVICE_COMPONENT = [
  ...DEFAULT_OUTPUTS_O_FORM_DATA_COMPONENT
];


export class OFormServiceComponent extends OFormDataComponent {

  public static DEFAULT_INPUTS_O_FORM_SERVICE_COMPONENT = DEFAULT_INPUTS_O_FORM_SERVICE_COMPONENT;
  public static DEFAULT_OUTPUTS_O_FORM_SERVICE_COMPONENT = DEFAULT_OUTPUTS_O_FORM_SERVICE_COMPONENT;

  /* Inputs */
  protected staticData: Array<any>;
  protected entity: string;
  protected service: string;
  protected columns: string;
  protected valueColumn: string;
  protected valueColumnType: string = Codes.TYPE_INT;
  protected parentKeys: string;
  protected visibleColumns: string;
  protected descriptionColumns: string;
  protected separator: string = Codes.SPACE_SEPARATOR;
  @InputConverter()
  protected queryOnInit: boolean = true;
  @InputConverter()
  protected queryOnBind: boolean = false;
  protected queryOnEvent: any;
  protected queryMethod: string = Codes.QUERY_METHOD;
  protected serviceType: string;
  @InputConverter()
  queryWithNullParentKeys: boolean = false;

  /* Internal variables */
  protected dataArray: any[] = [];
  protected colArray: string[] = [];
  protected visibleColArray: string[] = [];
  protected descriptionColArray: string[] = [];
  protected dataService: OntimizeService;
  protected querySuscription: Subscription;
  protected cacheQueried: boolean = false;
  protected _pKeysEquiv = {};
  protected _formDataSubcribe;
  protected _currentIndex;
  protected dialogService: DialogService;

  protected queryOnEventSubscription: Subscription;

  constructor(
    form: OFormComponent,
    elRef: ElementRef,
    injector: Injector
  ) {
    super(form, elRef, injector);
    this.form = form;
    this.elRef = elRef;
    this.dialogService = injector.get(DialogService);
  }

  initialize() {
    super.initialize();

    this.cacheQueried = false;
    this.colArray = Util.parseArray(this.columns, true);

    this.visibleColArray = Util.parseArray(this.visibleColumns, true);
    if (Util.isArrayEmpty(this.visibleColArray)) {
      //It is necessary to assing value to visibleColumns to propagate the parameter.
      this.visibleColumns = this.columns;
      this.visibleColArray = this.colArray;
    }

    this.descriptionColArray = Util.parseArray(this.descriptionColumns);
    if (Util.isArrayEmpty(this.descriptionColArray)) {
      this.descriptionColArray = this.visibleColArray;
    }

    let pkArray = Util.parseArray(this.parentKeys);
    this._pKeysEquiv = Util.parseParentKeysEquivalences(pkArray);

    if (this.form) {
      const self = this;
      if (self.queryOnBind) {
        this._formDataSubcribe = this.form.onDataLoaded.subscribe(data => {
          self.queryData();
        });
      }
    }

    if (this.staticData) {
      this.queryOnBind = false;
      this.queryOnInit = false;
      this.setDataArray(this.staticData);
    } else {
      this.configureService();
    }

    if (this.queryOnEvent !== undefined && this.queryOnEvent.subscribe !== undefined) {
      const self = this;
      this.queryOnEventSubscription = this.queryOnEvent.subscribe((value) => {
        if (Util.isDefined(value) || this.queryWithNullParentKeys) {
          self.queryData();
        }
      });
    }
  }

  destroy() {
    super.destroy();
    if (this._formDataSubcribe) {
      this._formDataSubcribe.unsubscribe();
    }
    if (this.queryOnEventSubscription) {
      this.queryOnEventSubscription.unsubscribe();
    }
  }

  /* Utility methods */
  configureService() {
    let loadingService: any = OntimizeService;
    if (this.serviceType) {
      loadingService = this.serviceType;
    }
    try {
      this.dataService = this.injector.get(loadingService);

      if (Util.isDataService(this.dataService)) {
        let serviceCfg = this.dataService.getDefaultServiceConfiguration(this.service);
        if (this.entity) {
          serviceCfg['entity'] = this.entity;
        }
        this.dataService.configureService(serviceCfg);
      }
    } catch (e) {
      console.error(e);
    }
  }

  getAttributesValuesToQuery(columns?: Array<any>) {
    let result = Util.isDefined(columns) ? columns : this.colArray;
    if (result.indexOf(this.valueColumn) === -1) {
      result.push(this.valueColumn);
    }
    return result;
  }

  queryData(filter: any = undefined) {
    const self = this;
    if (!this.dataService || !(this.queryMethod in this.dataService) || !this.entity) {
      console.warn('Service not properly configured! aborting query');
      return;
    }
    filter = ServiceUtils.getParentKeysFromForm(this._pKeysEquiv, this.form);

    if ((Object.keys(this._pKeysEquiv).length > 0) && filter === undefined) {
      this.setDataArray([]);
    } else {
      if (this.querySuscription) {
        this.querySuscription.unsubscribe();
      }
      const queryCols = this.getAttributesValuesToQuery();
      this.querySuscription = this.dataService[this.queryMethod](filter, queryCols, this.entity).subscribe(resp => {
        if (resp.code === Codes.ONTIMIZE_SUCCESSFUL_CODE) {
          self.cacheQueried = true;
          self.setDataArray(resp.data);
        } else {
          console.log('error');
        }
      }, err => {
        console.log(err);
        if (err && !Util.isObject(err)) {
          this.dialogService.alert('ERROR', err);
        } else {
          this.dialogService.alert('ERROR', 'MESSAGES.ERROR_QUERY');
        }
      });
    }
  }

  getDataArray(): any[] {
    return this.dataArray;
  }

  setDataArray(data: any): void {
    if (Util.isArray(data)) {
      this.dataArray = data;
      this.syncDataIndex();
    } else if (Util.isObject(data) && Object.keys(data).length > 0) {
      this.dataArray = [data];
    } else {
      console.warn('Component has received not supported service data. Supported data are Array or not empty Object');
      this.dataArray = [];
    }
  }

  syncDataIndex() {
    this._currentIndex = undefined;
    if (this.value && this.value.value && this.dataArray) {
      const self = this;
      this.dataArray.forEach((item, index) => {
        if (this.value.value instanceof Array) {
          this._currentIndex = [];

          this.value.value.forEach((itemValue, indexValue) => {
            if (item[self.valueColumn] === itemValue) {
              this._currentIndex[this._currentIndex.length] = indexValue;
            }

          });
        } else if (item[self.valueColumn] === this.value.value) {
          self._currentIndex = index;
        }
        if (item[self.valueColumn] === this.value.value) {
          self._currentIndex = index;
        }
      });

      if (this._currentIndex === undefined) {
        if (this.queryOnBind && this.dataArray && this.dataArray.length === 0
          && !this.cacheQueried && !this.isEmpty()) {
          this.queryData();
        }
        return;
      }
    }
  }

  protected parseByValueColumnType(val: any) {
    let value = val;

    if (this.valueColumnType === Codes.TYPE_INT) {
      const parsed = parseInt(value);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }
    return value;
  }

  setValue(val: any, options?: IFormValueOptions) {
    const value = this.parseByValueColumnType(val);
    super.setValue(value, options);
  }

  setData(val: any) {
    const value = this.parseByValueColumnType(val);
    super.setData(value);
  }

  getSelectedRecord() {
    let result = undefined;
    const selectedValue = this.getValue();
    if (Util.isDefined(selectedValue)) {
      result = this.getDataArray().find(item => item[this.valueColumn] === selectedValue);
    }
    return result;
  }

}

/*
 * Copyright (C) 2009 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable rulesdir/no_underscored_properties */

import type * as Platform from '../platform/platform.js'; // eslint-disable-line no-unused-vars
import * as Root from '../root/root.js';

import type {Color} from './Color.js';
import {Format} from './Color.js';  // eslint-disable-line no-unused-vars
import {Console} from './Console.js';
import type {EventDescriptor, EventTargetEvent} from './EventTarget.js'; // eslint-disable-line no-unused-vars
import {ObjectWrapper} from './Object.js';
import {getLocalizedSettingsCategory, getRegisteredSettings, maybeRemoveSettingExtension, RegExpSettingItem, registerSettingExtension, registerSettingsForTest, resetSettings, SettingCategory, SettingExtensionOption, SettingRegistration, SettingType} from './SettingRegistration.js';  // eslint-disable-line no-unused-vars

let settingsInstance: Settings|undefined;

export class Settings {
  readonly globalStorage: SettingsStorage;
  private readonly localStorage: SettingsStorage;
  private readonly sessionStorage: SettingsStorage;
  settingNameSet: Set<string>;
  orderValuesBySettingCategory: Map<SettingCategory, Set<number>>;
  private eventSupport: ObjectWrapper;
  private registry: Map<string, Setting<unknown>>;
  readonly moduleSettings: Map<string, Setting<unknown>>;

  private constructor(globalStorage: SettingsStorage, localStorage: SettingsStorage) {
    this.globalStorage = globalStorage;
    this.localStorage = localStorage;
    this.sessionStorage = new SettingsStorage({});

    this.settingNameSet = new Set();

    this.orderValuesBySettingCategory = new Map();

    this.eventSupport = new ObjectWrapper();
    this.registry = new Map();
    this.moduleSettings = new Map();

    for (const registration of getRegisteredSettings()) {
      const {settingName, defaultValue, storageType} = registration;
      const isRegex = registration.settingType === SettingType.REGEX;

      const setting = isRegex && typeof defaultValue === 'string' ?
          this.createRegExpSetting(settingName, defaultValue, undefined, storageType) :
          this.createSetting(settingName, defaultValue, storageType);

      if (Root.Runtime.Runtime.platform() === 'mac' && registration.titleMac) {
        setting.setTitleFunction(registration.titleMac);
      } else {
        setting.setTitleFunction(registration.title);
      }
      if (registration.userActionCondition) {
        setting.setRequiresUserAction(Boolean(Root.Runtime.Runtime.queryParam(registration.userActionCondition)));
      }
      setting.setRegistration(registration);

      this._registerModuleSetting(setting);
    }
  }

  static hasInstance(): boolean {
    return typeof settingsInstance !== 'undefined';
  }

  static instance(opts: {
    forceNew: boolean|null,
    globalStorage: SettingsStorage|null,
    localStorage: SettingsStorage|null,
  } = {forceNew: null, globalStorage: null, localStorage: null}): Settings {
    const {forceNew, globalStorage, localStorage} = opts;
    if (!settingsInstance || forceNew) {
      if (!globalStorage || !localStorage) {
        throw new Error(`Unable to create settings: global and local storage must be provided: ${new Error().stack}`);
      }

      settingsInstance = new Settings(globalStorage, localStorage);
    }

    return settingsInstance;
  }

  static removeInstance(): void {
    settingsInstance = undefined;
  }

  _registerModuleSetting(setting: Setting<unknown>): void {
    const settingName = setting.name;
    const category = setting.category();
    const order = setting.order();
    if (this.settingNameSet.has(settingName)) {
      throw new Error(`Duplicate Setting name '${settingName}'`);
    }
    if (category && order) {
      const orderValues = this.orderValuesBySettingCategory.get(category) || new Set();
      if (orderValues.has(order)) {
        throw new Error(`Duplicate order value '${order}' for settings category '${category}'`);
      }
      orderValues.add(order);
      this.orderValuesBySettingCategory.set(category, orderValues);
    }
    this.settingNameSet.add(settingName);
    this.moduleSettings.set(setting.name, setting);
  }

  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  moduleSetting<T = any>(settingName: string): Setting<T> {
    const setting = this.moduleSettings.get(settingName) as Setting<T>;
    if (!setting) {
      throw new Error('No setting registered: ' + settingName);
    }
    return setting;
  }

  settingForTest<T = any>(settingName: string): Setting<T> {
    const setting = this.registry.get(settingName) as Setting<T>;
    if (!setting) {
      throw new Error('No setting registered: ' + settingName);
    }
    return setting;
  }

  createSetting<T>(key: string, defaultValue: T, storageType?: SettingStorageType): Setting<T> {
    const storage = this._storageFromType(storageType);
    let setting = (this.registry.get(key) as Setting<T>);
    if (!setting) {
      setting = new Setting(key, defaultValue, this.eventSupport, storage);
      this.registry.set(key, setting);
    }
    return setting;
  }

  createLocalSetting<T>(key: string, defaultValue: T): Setting<T> {
    return this.createSetting(key, defaultValue, SettingStorageType.Local);
  }

  createRegExpSetting(key: string, defaultValue: string, regexFlags?: string, storageType?: SettingStorageType):
      RegExpSetting {
    if (!this.registry.get(key)) {
      this.registry.set(
          key, new RegExpSetting(key, defaultValue, this.eventSupport, this._storageFromType(storageType), regexFlags));
    }
    return this.registry.get(key) as RegExpSetting;
  }

  clearAll(): void {
    this.globalStorage.removeAll();
    this.localStorage.removeAll();
    const versionSetting = Settings.instance().createSetting(VersionController.currentVersionName, 0);
    versionSetting.set(VersionController.currentVersion);
  }

  _storageFromType(storageType?: SettingStorageType): SettingsStorage {
    switch (storageType) {
      case (SettingStorageType.Local):
        return this.localStorage;
      case (SettingStorageType.Session):
        return this.sessionStorage;
      case (SettingStorageType.Global):
        return this.globalStorage;
    }
    return this.globalStorage;
  }

  getRegistry(): Map<string, Setting<unknown>> {
    return this.registry;
  }
}

export class SettingsStorage {
  private object: {
    [x: string]: string,
  };
  private readonly setCallback: (arg0: string, arg1: string) => void;
  private readonly removeCallback: (arg0: string) => void;
  private readonly removeAllCallback: (arg0?: string|undefined) => void;
  private storagePrefix: string;
  constructor(
      object: {
        [x: string]: string,
      },
      setCallback?: ((arg0: string, arg1: string) => void), removeCallback?: ((arg0: string) => void),
      removeAllCallback?: ((arg0?: string|undefined) => void), storagePrefix?: string) {
    this.object = object;
    this.setCallback = setCallback || function(): void {};
    this.removeCallback = removeCallback || function(): void {};
    this.removeAllCallback = removeAllCallback || function(): void {};
    this.storagePrefix = storagePrefix || '';
  }

  set(name: string, value: string): void {
    name = this.storagePrefix + name;
    this.object[name] = value;
    this.setCallback(name, value);
  }

  has(name: string): boolean {
    name = this.storagePrefix + name;
    return name in this.object;
  }

  get(name: string): string {
    name = this.storagePrefix + name;
    return this.object[name];
  }

  remove(name: string): void {
    name = this.storagePrefix + name;
    delete this.object[name];
    this.removeCallback(name);
  }

  removeAll(): void {
    this.object = {};
    this.removeAllCallback();
  }

  _dumpSizes(): void {
    Console.instance().log('Ten largest settings: ');

    const sizes: {
      [x: string]: number,
      // @ts-expect-error __proto__ optimization
    } = {__proto__: null};
    for (const key in this.object) {
      sizes[key] = this.object[key].length;
    }
    const keys = Object.keys(sizes);

    function comparator(key1: string, key2: string): number {
      return sizes[key2] - sizes[key1];
    }

    keys.sort(comparator);

    for (let i = 0; i < 10 && i < keys.length; ++i) {
      Console.instance().log('Setting: \'' + keys[i] + '\', size: ' + sizes[keys[i]]);
    }
  }
}

function removeSetting(setting: Setting<unknown>): void {
  const name = setting.name;
  const settings = Settings.instance();

  settings.getRegistry().delete(name);
  settings.moduleSettings.delete(name);

  setting.getStorage().remove(name);
}

export class Setting<V> {
  private nameInternal: string;
  private defaultValueInternal: V;
  private readonly eventSupport: ObjectWrapper;
  private storage: SettingsStorage;
  private titleFunction!: () => Platform.UIString.LocalizedString;
  private titleInternal!: string;
  private registration: SettingRegistration|null;
  private requiresUserAction?: boolean;
  private value?: V;
  // TODO(crbug.com/1172300) Type cannot be inferred without changes to consumers. See above.
  private serializer: Serializer<unknown, V> = JSON;
  private hadUserAction?: boolean;

  constructor(name: string, defaultValue: V, eventSupport: ObjectWrapper, storage: SettingsStorage) {
    this.nameInternal = name;
    this.defaultValueInternal = defaultValue;
    this.eventSupport = eventSupport;
    this.storage = storage;
    this.registration = null;
  }

  setSerializer(serializer: Serializer<unknown, V>): void {
    this.serializer = serializer;
  }

  addChangeListener(listener: (arg0: EventTargetEvent) => void, thisObject?: Object): EventDescriptor {
    return this.eventSupport.addEventListener(this.nameInternal, listener, thisObject);
  }

  removeChangeListener(listener: (arg0: EventTargetEvent) => void, thisObject?: Object): void {
    this.eventSupport.removeEventListener(this.nameInternal, listener, thisObject);
  }

  get name(): string {
    return this.nameInternal;
  }

  title(): string {
    if (this.titleInternal) {
      return this.titleInternal;
    }
    if (this.titleFunction) {
      return this.titleFunction();
    }
    return '';
  }

  setTitleFunction(titleFunction: (() => Platform.UIString.LocalizedString)|undefined): void {
    if (titleFunction) {
      this.titleFunction = titleFunction;
    }
  }

  setTitle(title: string): void {
    this.titleInternal = title;
  }

  setRequiresUserAction(requiresUserAction: boolean): void {
    this.requiresUserAction = requiresUserAction;
  }

  get(): V {
    if (this.requiresUserAction && !this.hadUserAction) {
      return this.defaultValueInternal;
    }

    if (typeof this.value !== 'undefined') {
      return this.value;
    }

    this.value = this.defaultValueInternal;
    if (this.storage.has(this.nameInternal)) {
      try {
        this.value = this.serializer.parse(this.storage.get(this.nameInternal));
      } catch (e) {
        this.storage.remove(this.nameInternal);
      }
    }
    return this.value;
  }

  set(value: V): void {
    this.hadUserAction = true;
    this.value = value;
    try {
      const settingString = this.serializer.stringify(value);
      try {
        this.storage.set(this.nameInternal, settingString);
      } catch (e) {
        this._printSettingsSavingError(e.message, this.nameInternal, settingString);
      }
    } catch (e) {
      Console.instance().error('Cannot stringify setting with name: ' + this.nameInternal + ', error: ' + e.message);
    }
    this.eventSupport.dispatchEventToListeners(this.nameInternal, value);
  }

  setRegistration(registration: SettingRegistration): void {
    this.registration = registration;
  }

  type(): SettingType|null {
    if (this.registration) {
      return this.registration.settingType;
    }
    return null;
  }

  options(): SimpleSettingOption[] {
    if (this.registration && this.registration.options) {
      return this.registration.options.map(opt => {
        const {value, title, text, raw} = opt;
        return {
          value: value,
          title: title(),
          text: typeof text === 'function' ? text() : text,
          raw: raw,
        };
      });
    }
    return [];
  }

  reloadRequired(): boolean|null {
    if (this.registration) {
      return this.registration.reloadRequired || null;
    }
    return null;
  }

  category(): SettingCategory|null {
    if (this.registration) {
      return this.registration.category || null;
    }
    return null;
  }

  tags(): string|null {
    if (this.registration && this.registration.tags) {
      // Get localized keys and separate by null character to prevent fuzzy matching from matching across them.
      return this.registration.tags.map(tag => tag()).join('\0');
    }
    return null;
  }

  order(): number|null {
    if (this.registration) {
      return this.registration.order || null;
    }
    return null;
  }

  _printSettingsSavingError(message: string, name: string, value: string): void {
    const errorMessage = 'Error saving setting with name: ' + this.nameInternal + ', value length: ' + value.length +
        '. Error: ' + message;
    console.error(errorMessage);
    Console.instance().error(errorMessage);
    this.storage._dumpSizes();
  }
  defaultValue(): V {
    return this.defaultValueInternal;
  }

  getStorage(): SettingsStorage {
    return this.storage;
  }
}

// TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RegExpSetting extends Setting<any> {
  private regexFlags: string|undefined;
  private regex?: RegExp|null;

  constructor(
      name: string, defaultValue: string, eventSupport: ObjectWrapper, storage: SettingsStorage, regexFlags?: string) {
    super(name, defaultValue ? [{pattern: defaultValue}] : [], eventSupport, storage);
    this.regexFlags = regexFlags;
  }

  get(): string {
    const result = [];
    const items = this.getAsArray();
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      if (item.pattern && !item.disabled) {
        result.push(item.pattern);
      }
    }
    return result.join('|');
  }

  getAsArray(): RegExpSettingItem[] {
    return super.get();
  }

  set(value: string): void {
    this.setAsArray([{pattern: value, disabled: false}]);
  }

  setAsArray(value: RegExpSettingItem[]): void {
    delete this.regex;
    super.set(value);
  }

  asRegExp(): RegExp|null {
    if (typeof this.regex !== 'undefined') {
      return this.regex;
    }
    this.regex = null;
    try {
      const pattern = this.get();
      if (pattern) {
        this.regex = new RegExp(pattern, this.regexFlags || '');
      }
    } catch (e) {
    }
    return this.regex;
  }
}

export class VersionController {
  static get currentVersionName(): string {
    return 'inspectorVersion';
  }

  static get currentVersion(): number {
    return 30;
  }

  updateVersion(): void {
    const localStorageVersion = window.localStorage ? window.localStorage[VersionController.currentVersionName] : 0;
    const versionSetting = Settings.instance().createSetting(VersionController.currentVersionName, 0);
    const currentVersion = VersionController.currentVersion;
    const oldVersion = versionSetting.get() || parseInt(localStorageVersion || '0', 10);
    if (oldVersion === 0) {
      // First run, no need to do anything.
      versionSetting.set(currentVersion);
      return;
    }
    const methodsToRun = this._methodsToRunToUpdateVersion(oldVersion, currentVersion);
    for (const method of methodsToRun) {
      // @ts-ignore Special version method matching
      this[method].call(this);
    }
    versionSetting.set(currentVersion);
  }

  _methodsToRunToUpdateVersion(oldVersion: number, currentVersion: number): string[] {
    const result = [];
    for (let i = oldVersion; i < currentVersion; ++i) {
      result.push('_updateVersionFrom' + i + 'To' + (i + 1));
    }
    return result;
  }

  _updateVersionFrom0To1(): void {
    this._clearBreakpointsWhenTooMany(Settings.instance().createLocalSetting('breakpoints', []), 500000);
  }

  _updateVersionFrom1To2(): void {
    Settings.instance().createSetting('previouslyViewedFiles', []).set([]);
  }

  _updateVersionFrom2To3(): void {
    Settings.instance().createSetting('fileSystemMapping', {}).set({});
    removeSetting(Settings.instance().createSetting('fileMappingEntries', []));
  }

  _updateVersionFrom3To4(): void {
    const advancedMode = Settings.instance().createSetting('showHeaSnapshotObjectsHiddenProperties', false);
    moduleSetting('showAdvancedHeapSnapshotProperties').set(advancedMode.get());
    removeSetting(advancedMode);
  }

  _updateVersionFrom4To5(): void {
    const settingNames: {
      [x: string]: string,
    } = {
      'FileSystemViewSidebarWidth': 'fileSystemViewSplitViewState',
      'elementsSidebarWidth': 'elementsPanelSplitViewState',
      'StylesPaneSplitRatio': 'stylesPaneSplitViewState',
      'heapSnapshotRetainersViewSize': 'heapSnapshotSplitViewState',
      'InspectorView.splitView': 'InspectorView.splitViewState',
      'InspectorView.screencastSplitView': 'InspectorView.screencastSplitViewState',
      'Inspector.drawerSplitView': 'Inspector.drawerSplitViewState',
      'layerDetailsSplitView': 'layerDetailsSplitViewState',
      'networkSidebarWidth': 'networkPanelSplitViewState',
      'sourcesSidebarWidth': 'sourcesPanelSplitViewState',
      'scriptsPanelNavigatorSidebarWidth': 'sourcesPanelNavigatorSplitViewState',
      'sourcesPanelSplitSidebarRatio': 'sourcesPanelDebuggerSidebarSplitViewState',
      'timeline-details': 'timelinePanelDetailsSplitViewState',
      'timeline-split': 'timelinePanelRecorsSplitViewState',
      'timeline-view': 'timelinePanelTimelineStackSplitViewState',
      'auditsSidebarWidth': 'auditsPanelSplitViewState',
      'layersSidebarWidth': 'layersPanelSplitViewState',
      'profilesSidebarWidth': 'profilesPanelSplitViewState',
      'resourcesSidebarWidth': 'resourcesPanelSplitViewState',
    };
    const empty = {};
    for (const oldName in settingNames) {
      const newName = settingNames[oldName];
      const oldNameH = oldName + 'H';

      let newValue: {}|null = null;
      const oldSetting = Settings.instance().createSetting(oldName, empty);
      if (oldSetting.get() !== empty) {
        newValue = newValue || {};
        // @ts-expect-error
        newValue.vertical = {};
        // @ts-expect-error
        newValue.vertical.size = oldSetting.get();
        removeSetting(oldSetting);
      }
      const oldSettingH = Settings.instance().createSetting(oldNameH, empty);
      if (oldSettingH.get() !== empty) {
        newValue = newValue || {};
        // @ts-expect-error
        newValue.horizontal = {};
        // @ts-expect-error
        newValue.horizontal.size = oldSettingH.get();
        removeSetting(oldSettingH);
      }
      if (newValue) {
        Settings.instance().createSetting(newName, {}).set(newValue);
      }
    }
  }

  _updateVersionFrom5To6(): void {
    const settingNames: {
      [x: string]: string,
    } = {
      'debuggerSidebarHidden': 'sourcesPanelSplitViewState',
      'navigatorHidden': 'sourcesPanelNavigatorSplitViewState',
      'WebInspector.Drawer.showOnLoad': 'Inspector.drawerSplitViewState',
    };

    for (const oldName in settingNames) {
      const oldSetting = Settings.instance().createSetting(oldName, null);
      if (oldSetting.get() === null) {
        removeSetting(oldSetting);
        continue;
      }

      const newName = settingNames[oldName];
      const invert = oldName === 'WebInspector.Drawer.showOnLoad';
      const hidden = oldSetting.get() !== invert;
      removeSetting(oldSetting);
      const showMode = hidden ? 'OnlyMain' : 'Both';

      const newSetting = Settings.instance().createSetting(newName, {});
      const newValue = newSetting.get() || {};
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // @ts-expect-error
      newValue.vertical = newValue.vertical || {};
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // @ts-expect-error
      newValue.vertical.showMode = showMode;
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // @ts-expect-error
      newValue.horizontal = newValue.horizontal || {};
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // @ts-expect-error
      newValue.horizontal.showMode = showMode;
      newSetting.set(newValue);
    }
  }

  _updateVersionFrom6To7(): void {
    const settingNames = {
      'sourcesPanelNavigatorSplitViewState': 'sourcesPanelNavigatorSplitViewState',
      'elementsPanelSplitViewState': 'elementsPanelSplitViewState',
      'stylesPaneSplitViewState': 'stylesPaneSplitViewState',
      'sourcesPanelDebuggerSidebarSplitViewState': 'sourcesPanelDebuggerSidebarSplitViewState',
    };

    const empty = {};
    for (const name in settingNames) {
      const setting =
          Settings.instance().createSetting<{vertical?: {size?: number}, horizontal?: {size?: number}}>(name, empty);
      const value = setting.get();
      if (value === empty) {
        continue;
      }
      // Zero out saved percentage sizes, and they will be restored to defaults.
      if (value.vertical && value.vertical.size && value.vertical.size < 1) {
        value.vertical.size = 0;
      }
      if (value.horizontal && value.horizontal.size && value.horizontal.size < 1) {
        value.horizontal.size = 0;
      }
      setting.set(value);
    }
  }

  _updateVersionFrom7To8(): void {
  }

  _updateVersionFrom8To9(): void {
    const settingNames = ['skipStackFramesPattern', 'workspaceFolderExcludePattern'];

    for (let i = 0; i < settingNames.length; ++i) {
      const setting = Settings.instance().createSetting<string|unknown[]>(settingNames[i], '');
      let value = setting.get();
      if (!value) {
        return;
      }
      if (typeof value === 'string') {
        value = [value];
      }
      for (let j = 0; j < value.length; ++j) {
        if (typeof value[j] === 'string') {
          value[j] = {pattern: value[j]};
        }
      }
      setting.set(value);
    }
  }

  _updateVersionFrom9To10(): void {
    // This one is localStorage specific, which is fine.
    if (!window.localStorage) {
      return;
    }
    for (const key in window.localStorage) {
      if (key.startsWith('revision-history')) {
        window.localStorage.removeItem(key);
      }
    }
  }

  _updateVersionFrom10To11(): void {
    const oldSettingName = 'customDevicePresets';
    const newSettingName = 'customEmulatedDeviceList';
    const oldSetting = Settings.instance().createSetting<unknown>(oldSettingName, undefined);
    const list = oldSetting.get();
    if (!Array.isArray(list)) {
      return;
    }
    const newList = [];
    for (let i = 0; i < list.length; ++i) {
      const value = list[i];
      const device: {
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [x: string]: any,
      } = {};
      device['title'] = value['title'];
      device['type'] = 'unknown';
      device['user-agent'] = value['userAgent'];
      device['capabilities'] = [];
      if (value['touch']) {
        device['capabilities'].push('touch');
      }
      if (value['mobile']) {
        device['capabilities'].push('mobile');
      }
      device['screen'] = {};
      device['screen']['vertical'] = {width: value['width'], height: value['height']};
      device['screen']['horizontal'] = {width: value['height'], height: value['width']};
      device['screen']['device-pixel-ratio'] = value['deviceScaleFactor'];
      device['modes'] = [];
      device['show-by-default'] = true;
      device['show'] = 'Default';
      newList.push(device);
    }
    if (newList.length) {
      Settings.instance().createSetting<unknown[]>(newSettingName, []).set(newList);
    }
    removeSetting(oldSetting);
  }

  _updateVersionFrom11To12(): void {
    this._migrateSettingsFromLocalStorage();
  }

  _updateVersionFrom12To13(): void {
    this._migrateSettingsFromLocalStorage();
    removeSetting(Settings.instance().createSetting('timelineOverviewMode', ''));
  }

  _updateVersionFrom13To14(): void {
    const defaultValue = {'throughput': -1, 'latency': 0};
    Settings.instance().createSetting('networkConditions', defaultValue).set(defaultValue);
  }

  _updateVersionFrom14To15(): void {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = Settings.instance().createLocalSetting<any>('workspaceExcludedFolders', {});
    const oldValue = setting.get();
    const newValue: {
      [x: string]: string[],
    } = {};
    for (const fileSystemPath in oldValue) {
      newValue[fileSystemPath] = [];
      for (const entry of oldValue[fileSystemPath]) {
        newValue[fileSystemPath].push(entry.path);
      }
    }
    setting.set(newValue);
  }

  _updateVersionFrom15To16(): void {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = Settings.instance().createSetting<any>('InspectorView.panelOrder', {});
    const tabOrders = setting.get();
    for (const key of Object.keys(tabOrders)) {
      tabOrders[key] = (tabOrders[key] + 1) * 10;
    }
    setting.set(tabOrders);
  }

  _updateVersionFrom16To17(): void {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = Settings.instance().createSetting<any>('networkConditionsCustomProfiles', []);
    const oldValue = setting.get();
    const newValue = [];
    if (Array.isArray(oldValue)) {
      for (const preset of oldValue) {
        if (typeof preset.title === 'string' && typeof preset.value === 'object' &&
            typeof preset.value.throughput === 'number' && typeof preset.value.latency === 'number') {
          newValue.push({
            title: preset.title,
            value: {download: preset.value.throughput, upload: preset.value.throughput, latency: preset.value.latency},
          });
        }
      }
    }
    setting.set(newValue);
  }

  _updateVersionFrom17To18(): void {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = Settings.instance().createLocalSetting<any>('workspaceExcludedFolders', {});
    const oldValue = setting.get();
    const newValue: {
      [x: string]: string,
    } = {};
    for (const oldKey in oldValue) {
      let newKey = oldKey.replace(/\\/g, '/');
      if (!newKey.startsWith('file://')) {
        if (newKey.startsWith('/')) {
          newKey = 'file://' + newKey;
        } else {
          newKey = 'file:///' + newKey;
        }
      }
      newValue[newKey] = oldValue[oldKey];
    }
    setting.set(newValue);
  }

  _updateVersionFrom18To19(): void {
    const defaultColumns = {status: true, type: true, initiator: true, size: true, time: true};
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visibleColumnSettings = Settings.instance().createSetting<any>('networkLogColumnsVisibility', defaultColumns);
    const visibleColumns = visibleColumnSettings.get();
    visibleColumns.name = true;
    visibleColumns.timeline = true;

    const configs: {
      [x: string]: {
        visible: number,
      },
    } = {};
    for (const columnId in visibleColumns) {
      if (!visibleColumns.hasOwnProperty(columnId)) {
        continue;
      }
      configs[columnId.toLowerCase()] = {visible: visibleColumns[columnId]};
    }
    const newSetting = Settings.instance().createSetting('networkLogColumns', {});
    newSetting.set(configs);
    removeSetting(visibleColumnSettings);
  }

  _updateVersionFrom19To20(): void {
    const oldSetting = Settings.instance().createSetting('InspectorView.panelOrder', {});
    const newSetting = Settings.instance().createSetting('panel-tabOrder', {});
    newSetting.set(oldSetting.get());
    removeSetting(oldSetting);
  }

  _updateVersionFrom20To21(): void {
    const networkColumns = Settings.instance().createSetting('networkLogColumns', {});
    const columns = (networkColumns.get() as {
      [x: string]: string,
    });
    delete columns['timeline'];
    delete columns['waterfall'];
    networkColumns.set(columns);
  }

  _updateVersionFrom21To22(): void {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakpointsSetting = Settings.instance().createLocalSetting<any>('breakpoints', []);
    const breakpoints = breakpointsSetting.get();
    for (const breakpoint of breakpoints) {
      breakpoint['url'] = breakpoint['sourceFileId'];
      delete breakpoint['sourceFileId'];
    }
    breakpointsSetting.set(breakpoints);
  }

  _updateVersionFrom22To23(): void {
    // This update is no-op.
  }

  _updateVersionFrom23To24(): void {
    const oldSetting = Settings.instance().createSetting('searchInContentScripts', false);
    const newSetting = Settings.instance().createSetting('searchInAnonymousAndContentScripts', false);
    newSetting.set(oldSetting.get());
    removeSetting(oldSetting);
  }

  _updateVersionFrom24To25(): void {
    const defaultColumns = {status: true, type: true, initiator: true, size: true, time: true};
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const networkLogColumnsSetting = Settings.instance().createSetting<any>('networkLogColumns', defaultColumns);
    const columns = networkLogColumnsSetting.get();
    delete columns.product;
    networkLogColumnsSetting.set(columns);
  }

  _updateVersionFrom25To26(): void {
    const oldSetting = Settings.instance().createSetting('messageURLFilters', {});
    const urls = Object.keys(oldSetting.get());
    const textFilter = urls.map(url => `-url:${url}`).join(' ');
    if (textFilter) {
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textFilterSetting = Settings.instance().createSetting<any>('console.textFilter', '');
      const suffix = textFilterSetting.get() ? ` ${textFilterSetting.get()}` : '';
      textFilterSetting.set(`${textFilter}${suffix}`);
    }
    removeSetting(oldSetting);
  }

  _updateVersionFrom26To27(): void {
    function renameKeyInObjectSetting(settingName: string, from: string, to: string): void {
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setting = Settings.instance().createSetting<any>(settingName, {});
      const value = setting.get();
      if (from in value) {
        value[to] = value[from];
        delete value[from];
        setting.set(value);
      }
    }

    function renameInStringSetting(settingName: string, from: string, to: string): void {
      const setting = Settings.instance().createSetting(settingName, '');
      const value = setting.get();
      if (value === from) {
        setting.set(to);
      }
    }

    renameKeyInObjectSetting('panel-tabOrder', 'audits2', 'audits');
    renameKeyInObjectSetting('panel-closeableTabs', 'audits2', 'audits');
    renameInStringSetting('panel-selectedTab', 'audits2', 'audits');
  }

  _updateVersionFrom27To28(): void {
    const setting = Settings.instance().createSetting('uiTheme', 'systemPreferred');
    if (setting.get() === 'default') {
      setting.set('systemPreferred');
    }
  }

  _updateVersionFrom28To29(): void {
    function renameKeyInObjectSetting(settingName: string, from: string, to: string): void {
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setting = Settings.instance().createSetting<any>(settingName, {});
      const value = setting.get();
      if (from in value) {
        value[to] = value[from];
        delete value[from];
        setting.set(value);
      }
    }

    function renameInStringSetting(settingName: string, from: string, to: string): void {
      const setting = Settings.instance().createSetting(settingName, '');
      const value = setting.get();
      if (value === from) {
        setting.set(to);
      }
    }

    renameKeyInObjectSetting('panel-tabOrder', 'audits', 'lighthouse');
    renameKeyInObjectSetting('panel-closeableTabs', 'audits', 'lighthouse');
    renameInStringSetting('panel-selectedTab', 'audits', 'lighthouse');
  }

  _updateVersionFrom29To30(): void {
    // Create new location agnostic setting
    const closeableTabSetting = Settings.instance().createSetting('closeableTabs', {});

    // Read current settings
    const panelCloseableTabSetting = Settings.instance().createSetting('panel-closeableTabs', {});
    const drawerCloseableTabSetting = Settings.instance().createSetting('drawer-view-closeableTabs', {});
    const openTabsInPanel = panelCloseableTabSetting.get();
    const openTabsInDrawer = panelCloseableTabSetting.get();

    // Set value of new setting
    const newValue = Object.assign(openTabsInDrawer, openTabsInPanel);
    closeableTabSetting.set(newValue);

    // Remove old settings
    removeSetting(panelCloseableTabSetting);
    removeSetting(drawerCloseableTabSetting);
  }

  _migrateSettingsFromLocalStorage(): void {
    // This step migrates all the settings except for the ones below into the browser profile.
    const localSettings = new Set<string>([
      'advancedSearchConfig',
      'breakpoints',
      'consoleHistory',
      'domBreakpoints',
      'eventListenerBreakpoints',
      'fileSystemMapping',
      'lastSelectedSourcesSidebarPaneTab',
      'previouslyViewedFiles',
      'savedURLs',
      'watchExpressions',
      'workspaceExcludedFolders',
      'xhrBreakpoints',
    ]);
    if (!window.localStorage) {
      return;
    }

    for (const key in window.localStorage) {
      if (localSettings.has(key)) {
        continue;
      }
      const value = window.localStorage[key];
      window.localStorage.removeItem(key);
      Settings.instance().globalStorage.set(key, value);
    }
  }

  _clearBreakpointsWhenTooMany(breakpointsSetting: Setting<unknown[]>, maxBreakpointsCount: number): void {
    // If there are too many breakpoints in a storage, it is likely due to a recent bug that caused
    // periodical breakpoints duplication leading to inspector slowness.
    if (breakpointsSetting.get().length > maxBreakpointsCount) {
      breakpointsSetting.set([]);
    }
  }
}

// TODO(crbug.com/1167717): Make this a const enum again
// eslint-disable-next-line rulesdir/const_enum
export enum SettingStorageType {
  Global = 'Global',
  Local = 'Local',
  Session = 'Session',
}

export function moduleSetting(settingName: string): Setting<unknown> {
  return Settings.instance().moduleSetting(settingName);
}

export function settingForTest(settingName: string): Setting<unknown> {
  return Settings.instance().settingForTest(settingName);
}

export function detectColorFormat(color: Color): Format {
  const cf = Format;
  let format;
  const formatSetting = Settings.instance().moduleSetting('colorFormat').get();
  if (formatSetting === cf.Original) {
    format = cf.Original;
  } else if (formatSetting === cf.RGB) {
    format = cf.RGB;
  } else if (formatSetting === cf.HSL) {
    format = cf.HSL;
  } else if (formatSetting === cf.HEX) {
    format = color.detectHEXFormat();
  } else {
    format = cf.RGB;
  }

  return format;
}

export {
  getLocalizedSettingsCategory,
  getRegisteredSettings,
  maybeRemoveSettingExtension,
  registerSettingExtension,
  RegExpSettingItem,
  SettingCategory,
  SettingExtensionOption,
  SettingRegistration,
  SettingType,
  registerSettingsForTest,
  resetSettings,
};

export interface Serializer<I, O> {
  stringify: (value: I) => string;
  parse: (value: string) => O;
}

export interface SimpleSettingOption {
  value: string|boolean;
  title: string;
  text?: string;
  raw?: boolean;
}

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'localStorage',
);

const restoreLocalStorageProperty = () => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      window,
      'localStorage',
      originalLocalStorageDescriptor,
    );
  } else {
    delete (window as { localStorage?: Storage }).localStorage;
  }
};

const blockLocalStorageAccess = (error: Error) => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw error;
    },
  });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  restoreLocalStorageProperty();
  localStorage.clear();
});

test('gets a value that was set', () => {
  setItem(LocalStorageKeys.IsDatapanelOpen, false);

  expect(getItem(LocalStorageKeys.IsDatapanelOpen, true)).toBe(false);
});

test('returns the default value for an unset value', () => {
  expect(getItem(LocalStorageKeys.IsDatapanelOpen, true)).toBe(true);
});

test('returns the default value when stored JSON is malformed', () => {
  localStorage.setItem(LocalStorageKeys.ControlsWidth, '{not json');

  expect(() => getItem(LocalStorageKeys.ControlsWidth, 300)).not.toThrow();
  expect(getItem(LocalStorageKeys.ControlsWidth, 300)).toBe(300);
});

test('returns the default value when localStorage.getItem throws', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });

  expect(getItem(LocalStorageKeys.ControlsWidth, 300)).toBe(300);
  expect(Storage.prototype.getItem).toHaveBeenCalledWith(
    LocalStorageKeys.ControlsWidth,
  );
});

test('returns the default value when accessing localStorage throws', () => {
  blockLocalStorageAccess(
    new DOMException('localStorage is disabled', 'SecurityError'),
  );

  expect(getItem(LocalStorageKeys.ControlsWidth, 300)).toBe(300);
});

test('setItem does not throw when accessing localStorage throws', () => {
  blockLocalStorageAccess(
    new DOMException('localStorage is disabled', 'SecurityError'),
  );

  expect(() => setItem(LocalStorageKeys.ControlsWidth, 500)).not.toThrow();

  restoreLocalStorageProperty();
  expect(localStorage.getItem(LocalStorageKeys.ControlsWidth)).toBeNull();
});

test('setItem does not throw when localStorage.setItem exceeds quota', () => {
  const setItemSpy = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

  expect(() => setItem(LocalStorageKeys.ControlsWidth, 500)).not.toThrow();
  expect(setItemSpy).toHaveBeenCalledWith(
    LocalStorageKeys.ControlsWidth,
    '500',
  );

  setItemSpy.mockRestore();
  expect(localStorage.getItem(LocalStorageKeys.ControlsWidth)).toBeNull();
});

test('setItem does not write anything when the value cannot be serialized', () => {
  const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
  const circular: { self?: object } = {};
  circular.self = circular;

  expect(() => setItem(LocalStorageKeys.Database, circular)).not.toThrow();
  expect(setItemSpy).not.toHaveBeenCalled();
  expect(localStorage.getItem(LocalStorageKeys.Database)).toBeNull();
  expect(getItem(LocalStorageKeys.Database, null)).toBeNull();
});

test('returns stored false instead of the default', () => {
  setItem(LocalStorageKeys.SqllabIsAutocompleteEnabled, false);

  expect(getItem(LocalStorageKeys.SqllabIsAutocompleteEnabled, true)).toBe(
    false,
  );
});

test('returns stored 0 instead of the default', () => {
  setItem(LocalStorageKeys.DatasourceWidth, 0);

  expect(getItem(LocalStorageKeys.DatasourceWidth, 300)).toBe(0);
});

test('returns a stored empty array instead of the default', () => {
  setItem(LocalStorageKeys.HomepageCollapseState, []);

  expect(getItem(LocalStorageKeys.HomepageCollapseState, ['1'])).toEqual([]);
});

test('returns an explicitly stored null instead of the default', () => {
  setItem(LocalStorageKeys.HomepageActivityFilter, null);

  expect(localStorage.getItem(LocalStorageKeys.HomepageActivityFilter)).toBe(
    'null',
  );
  expect(getItem(LocalStorageKeys.HomepageActivityFilter, 'Edited')).toBeNull();
});

test('failing operations leave unrelated stored preferences intact', () => {
  setItem(LocalStorageKeys.IsDatapanelOpen, false);
  setItem(LocalStorageKeys.HomepageCollapseState, ['a', 'b']);
  localStorage.setItem(LocalStorageKeys.ControlsWidth, '{not json');

  const circular: { self?: object } = {};
  circular.self = circular;
  setItem(LocalStorageKeys.Database, circular);

  const setItemSpy = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
  setItem(LocalStorageKeys.DatasourceWidth, 100);
  setItemSpy.mockRestore();

  blockLocalStorageAccess(
    new DOMException('localStorage is disabled', 'SecurityError'),
  );
  setItem(LocalStorageKeys.ChartSplitSizes, [1, 2]);
  expect(getItem(LocalStorageKeys.IsDatapanelOpen, true)).toBe(true);
  restoreLocalStorageProperty();

  expect(getItem(LocalStorageKeys.ControlsWidth, 300)).toBe(300);
  expect(getItem(LocalStorageKeys.IsDatapanelOpen, true)).toBe(false);
  expect(getItem(LocalStorageKeys.HomepageCollapseState, [])).toEqual([
    'a',
    'b',
  ]);
  expect(localStorage.length).toBe(3);
});

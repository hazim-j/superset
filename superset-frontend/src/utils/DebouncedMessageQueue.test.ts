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

import DebouncedMessageQueue from './DebouncedMessageQueue';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DebouncedMessageQueue', () => {
  test('should create a queue with default options', () => {
    const queue = new DebouncedMessageQueue();
    expect(queue).toBeDefined();
    expect(queue.trigger).toBeInstanceOf(Function);
  });

  test('should accept custom configuration options', () => {
    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue({
      callback: mockCallback,
      sizeThreshold: 500,
      delayThreshold: 2000,
    });
    expect(queue).toBeDefined();
  });

  test('should append items to the queue', () => {
    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue({ callback: mockCallback });

    const testEvent = { id: 1, message: 'test' };
    queue.append(testEvent);

    // Verify the append method doesn't throw
    expect(() => queue.append(testEvent)).not.toThrow();
  });

  test('should handle generic types properly', () => {
    interface TestEvent {
      id: number;
      data: string;
    }

    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue<TestEvent>({
      callback: mockCallback,
    });

    const testEvent: TestEvent = { id: 1, data: 'test' };
    queue.append(testEvent);

    expect(() => queue.append(testEvent)).not.toThrow();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('debounced delivery', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should not invoke the callback before delayThreshold', () => {
      const mockCallback = jest.fn();
      const queue = new DebouncedMessageQueue<number>({
        callback: mockCallback,
        delayThreshold: 1000,
      });

      queue.append(1);
      jest.advanceTimersByTime(999);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should deliver queued events in insertion order after the delay', () => {
      const mockCallback = jest.fn();
      const queue = new DebouncedMessageQueue<number>({
        callback: mockCallback,
        delayThreshold: 1000,
      });

      queue.append(1);
      queue.append(2);
      queue.append(3);
      jest.advanceTimersByTime(1000);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith([1, 2, 3]);
    });

    test('should restart the debounce timer when an event is appended during the delay', () => {
      const mockCallback = jest.fn();
      const queue = new DebouncedMessageQueue<number>({
        callback: mockCallback,
        delayThreshold: 1000,
      });

      queue.append(1);
      jest.advanceTimersByTime(600);
      queue.append(2);
      jest.advanceTimersByTime(600);

      expect(mockCallback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(400);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith([1, 2]);
    });

    test('should split events into successive batches of sizeThreshold', () => {
      const mockCallback = jest.fn();
      const queue = new DebouncedMessageQueue<number>({
        callback: mockCallback,
        sizeThreshold: 2,
        delayThreshold: 1000,
      });

      [1, 2, 3, 4, 5].forEach(event => queue.append(event));
      jest.runAllTimers();

      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback.mock.calls).toEqual([[[1, 2]], [[3, 4]], [[5]]]);
      expect(mockCallback.mock.calls.flat(2)).toEqual([1, 2, 3, 4, 5]);
    });

    test('should not invoke the callback when triggered with an empty queue', () => {
      const mockCallback = jest.fn();
      const queue = new DebouncedMessageQueue<number>({
        callback: mockCallback,
        delayThreshold: 1000,
      });

      queue.trigger();
      jest.runAllTimers();

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});

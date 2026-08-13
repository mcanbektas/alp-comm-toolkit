import { describe, expect, it } from 'vitest';

import { createRingBuffer } from './ringBuffer';

describe('createRingBuffer', () => {
  it('geçersiz kapasiteyi reddeder', () => {
    expect(() => createRingBuffer<number>(0)).toThrow(RangeError);
    expect(() => createRingBuffer<number>(-3)).toThrow(RangeError);
    expect(() => createRingBuffer<number>(2.5)).toThrow(RangeError);
  });

  it('boş arabellekte size 0, at() undefined', () => {
    const buffer = createRingBuffer<number>(4);

    expect(buffer.size).toBe(0);
    expect(buffer.droppedCount).toBe(0);
    expect(buffer.totalPushed).toBe(0);
    expect(buffer.at(0)).toBeUndefined();
    expect(buffer.toArray()).toEqual([]);
  });

  it('kapasite dolana kadar sırayla biriktirir', () => {
    const buffer = createRingBuffer<number>(4);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([1, 2, 3]);
    expect(buffer.at(0)).toBe(1);
    expect(buffer.at(2)).toBe(3);
    expect(buffer.at(3)).toBeUndefined();
  });

  it('taşınca en eskiyi düşürür ve düşeni sayar', () => {
    const buffer = createRingBuffer<number>(3);
    for (const value of [1, 2, 3, 4, 5]) {
      buffer.push(value);
    }

    expect(buffer.size).toBe(3);
    expect(buffer.droppedCount).toBe(2);
    expect(buffer.totalPushed).toBe(5);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
    // index 0 artık 3'tür: at() DAİMA en eskiden sayar, mutlak sıra numarasından değil.
    expect(buffer.at(0)).toBe(3);
    expect(buffer.at(2)).toBe(5);
  });

  it('sarma sonrası indeksli okuma doğru kalır', () => {
    const buffer = createRingBuffer<number>(5);
    for (let value = 0; value < 23; value += 1) {
      buffer.push(value);
    }

    expect(buffer.toArray()).toEqual([18, 19, 20, 21, 22]);
    for (let index = 0; index < 5; index += 1) {
      expect(buffer.at(index)).toBe(18 + index);
    }
  });

  it('at() aralık dışı ve geçersiz indeks için undefined verir', () => {
    const buffer = createRingBuffer<number>(3);
    buffer.push(7);

    expect(buffer.at(-1)).toBeUndefined();
    expect(buffer.at(1)).toBeUndefined();
    expect(buffer.at(0.5)).toBeUndefined();
  });

  it('latest() son kayıtları eskiden yeniye verir', () => {
    const buffer = createRingBuffer<number>(10);
    for (let value = 1; value <= 6; value += 1) {
      buffer.push(value);
    }

    expect(buffer.latest(3)).toEqual([4, 5, 6]);
    expect(buffer.latest(0)).toEqual([]);
    expect(buffer.latest(-2)).toEqual([]);
    // Elde olandan fazlası istenirse hepsi verilir, hata verilmez.
    expect(buffer.latest(99)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('slice() aralığı kırpar', () => {
    const buffer = createRingBuffer<number>(10);
    for (let value = 0; value < 5; value += 1) {
      buffer.push(value);
    }

    expect(buffer.slice(1, 3)).toEqual([1, 2]);
    expect(buffer.slice(-5, 2)).toEqual([0, 1]);
    expect(buffer.slice(3, 99)).toEqual([3, 4]);
    expect(buffer.slice(4, 2)).toEqual([]);
  });

  it('clear() sayaçları da sıfırlar', () => {
    const buffer = createRingBuffer<number>(2);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    expect(buffer.droppedCount).toBe(1);

    buffer.clear();

    expect(buffer.size).toBe(0);
    expect(buffer.droppedCount).toBe(0);
    expect(buffer.totalPushed).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('kapasite 1 ile daima son kaydı tutar', () => {
    const buffer = createRingBuffer<string>(1);
    buffer.push('a');
    buffer.push('b');

    expect(buffer.size).toBe(1);
    expect(buffer.at(0)).toBe('b');
    expect(buffer.droppedCount).toBe(1);
  });

  it('100 bin kayıt için at() maddileştirme yapmadan çalışır', () => {
    const buffer = createRingBuffer<number>(100_000);
    for (let value = 0; value < 250_000; value += 1) {
      buffer.push(value);
    }

    expect(buffer.size).toBe(100_000);
    expect(buffer.droppedCount).toBe(150_000);
    expect(buffer.at(0)).toBe(150_000);
    expect(buffer.at(99_999)).toBe(249_999);
    // Sanallaştırılmış tablonun tipik penceresi: bütün diziyi değil, 40 satırı okur.
    expect(buffer.slice(50_000, 50_040)).toHaveLength(40);
  });
});

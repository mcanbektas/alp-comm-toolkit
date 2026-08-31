import { beforeEach, describe, expect, it } from 'vitest';

import { useConverterHandoffStore } from './converterHandoffStore';

/** Store bir singleton'dır; testler arası sızıntıyı önlemek için her seferinde sıfırlanır. */
beforeEach(() => {
  useConverterHandoffStore.getState().clearPendingPacket();
});

describe('useConverterHandoffStore', () => {
  it('başlangıçta bekleyen bir paket yoktur', () => {
    const state = useConverterHandoffStore.getState();
    expect(state.pendingHex).toBeNull();
    expect(state.pendingLabel).toBeNull();
  });

  it('setPendingPacket hex ve etiketi birlikte yazar', () => {
    useConverterHandoffStore.getState().setPendingPacket('AA05', 'sensors/temperature');

    const state = useConverterHandoffStore.getState();
    expect(state.pendingHex).toBe('AA05');
    expect(state.pendingLabel).toBe('sensors/temperature');
  });

  it('clearPendingPacket ikisini de sıfırlar', () => {
    useConverterHandoffStore.getState().setPendingPacket('AA05', 'sensors/temperature');
    useConverterHandoffStore.getState().clearPendingPacket();

    const state = useConverterHandoffStore.getState();
    expect(state.pendingHex).toBeNull();
    expect(state.pendingLabel).toBeNull();
  });

  it('ikinci setPendingPacket öncekini değil, kendi değerlerini yansıtır', () => {
    useConverterHandoffStore.getState().setPendingPacket('AA05', 'sensors/temperature');
    useConverterHandoffStore.getState().setPendingPacket('BB10', 'sensors/humidity');

    const state = useConverterHandoffStore.getState();
    expect(state.pendingHex).toBe('BB10');
    expect(state.pendingLabel).toBe('sensors/humidity');
  });
});

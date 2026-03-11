import assert from 'node:assert/strict';
import {
  buildInheritedSimulatorSnapshot,
  buildInheritedSimulatorState
} from '../src/features/simulator/simulatorInheritance.js';
import {
  buildSimulatorResourceLedger,
  DEFAULT_SIMULATOR_RESOURCE_SETTINGS,
  getSimulatorPullCost,
  normalizeResourceSettings
} from '../src/utils/resourceEconomy.js';
import {
  buildSimulatorStorageScope,
  clearInfoBookState,
  clearSharedPityState,
  clearSimulatorResourceSettings,
  clearSimulatorState,
  getSimulatorCurrentPoolStorageKey,
  loadInfoBookState,
  loadSharedPityState,
  loadSimulatorResourceSettings,
  loadSimulatorState,
  migrateLegacySimulatorStorageToScope,
  saveInfoBookState,
  saveSharedPityState,
  saveSimulatorResourceSettings,
  saveSimulatorState
} from '../src/utils/simulatorStorage.js';
import useHistoryStore from '../src/stores/useHistoryStore.js';

const localStorageMap = new Map();
global.localStorage = {
  getItem(key) {
    return localStorageMap.has(key) ? localStorageMap.get(key) : null;
  },
  setItem(key, value) {
    localStorageMap.set(key, String(value));
  },
  removeItem(key) {
    localStorageMap.delete(key);
  },
  clear() {
    localStorageMap.clear();
  }
};

function makePull(poolId, index, overrides = {}) {
  return {
    id: `${poolId}_${index}`,
    poolId,
    rarity: 4,
    timestamp: 1700000000000 + index,
    game_uid: 'uid-1',
    user_id: 'user-1',
    ...overrides
  };
}

const pools = [
  { id: 'limited_a', type: 'limited', up_character: 'A' },
  { id: 'limited_b', type: 'limited', up_character: 'B' },
  { id: 'weapon_a', type: 'weapon', up_character: 'WA', isLimitedWeapon: true },
  { id: 'weapon_b', type: 'weapon', up_character: 'WB', isLimitedWeapon: true },
  { id: 'standard', type: 'standard' }
];

const limitedHistory = [
  ...Array.from({ length: 60 }, (_, index) => makePull('limited_a', index + 1)),
  ...Array.from({ length: 35 }, (_, index) => makePull('limited_b', 100 + index + 1)),
  makePull('limited_b', 200, { is_free: true, rarity: 6, isLimited: true, character_name: 'B' }),
  makePull('limited_b', 201, { special_type: 'gift', rarity: 6, character_name: 'B' })
];

const inheritedLimited = buildInheritedSimulatorState({
  history: limitedHistory,
  realPools: pools,
  currentSimPool: { id: 'sim_limited_b', type: 'limited', up_character: 'B' },
  currentGameUid: 'uid-1',
  currentUserId: 'user-1'
});

assert.ok(inheritedLimited, 'limited pool should be inheritable');
assert.equal(inheritedLimited.totalPulls, 35, 'limited pool total pulls should only include current pool paid pulls');
assert.equal(inheritedLimited.freeTenPullsReceived, 1, 'limited pool should mark already earned free ten-pull for current pool');
assert.equal(inheritedLimited.hasReceivedInfoBook, false, 'current limited pool should not fake info-book ownership from previous pool');
assert.equal(inheritedLimited.sixStarPity, 95, 'limited pool should inherit cross-pool six-star pity');
assert.equal(inheritedLimited.guaranteedLimitedPity, 95, 'limited pool should inherit cross-pool hard pity counter');
assert.equal(inheritedLimited.hasReceivedGuaranteedLimited, false, 'limited pool should preserve whether hard pity has been consumed');
assert.equal(inheritedLimited.pullHistory.length, 35, 'limited pool history should exclude free pulls and gifts');
assert.equal(inheritedLimited.infoBookTenPullAvailable, true, 'current target limited pool should activate inherited info book');

const weaponHistory = [
  ...Array.from({ length: 20 }, (_, index) => makePull('weapon_b', 300 + index + 1)),
  ...Array.from({ length: 12 }, (_, index) => makePull('weapon_a', 400 + index + 1)),
  makePull('weapon_a', 500, { is_free: true, rarity: 5 })
];

const inheritedWeapon = buildInheritedSimulatorState({
  history: weaponHistory,
  realPools: pools,
  currentSimPool: { id: 'sim_weapon_a', type: 'weapon', up_character: 'WA', isLimitedWeapon: true },
  currentGameUid: 'uid-1',
  currentUserId: 'user-1'
});

assert.ok(inheritedWeapon, 'weapon pool should be inheritable');
assert.equal(inheritedWeapon.totalPulls, 12, 'weapon pool total pulls should only include current pool paid pulls');
assert.equal(inheritedWeapon.sixStarPity, 12, 'weapon pool should not inherit cross-pool six-star pity');
assert.equal(inheritedWeapon.guaranteedLimitedPity, 12, 'weapon pool hard pity counter should stay on current pool');
assert.equal(inheritedWeapon.hasReceivedGuaranteedLimited, false, 'weapon pool should preserve whether hard pity has been consumed');
assert.equal(inheritedWeapon.pullHistory.length, 12, 'weapon pool history should exclude free pulls');

const inheritedSnapshot = buildInheritedSimulatorSnapshot({
  history: [...limitedHistory, ...weaponHistory],
  realPools: pools,
  currentGameUid: 'uid-1',
  currentUserId: 'user-1',
  currentSimPoolId: 'sim_limited_b'
});

assert.equal(inheritedSnapshot.hasAnyData, true, 'snapshot should mark inheritable data');
assert.ok(inheritedSnapshot.statesByPoolId.sim_limited_a, 'snapshot should include source limited pool');
assert.ok(inheritedSnapshot.statesByPoolId.sim_limited_b, 'snapshot should include current limited pool');
assert.ok(inheritedSnapshot.statesByPoolId.sim_weapon_a, 'snapshot should include current weapon pool');
assert.deepEqual(inheritedSnapshot.sharedPityState, {
  sixStarPity: 95,
  fiveStarPity: 95,
  guaranteedLimitedPity: 95,
  hasReceivedGuaranteedLimited: false
}, 'snapshot should expose shared limited pity state');
assert.deepEqual(inheritedSnapshot.infoBooks.sim_limited_a, {
  activated: true,
  used: false,
  targetPoolId: 'sim_limited_b',
  obtainedAt: 0
}, 'snapshot should rebuild the inherited info book mapping');

const resourceLedger = buildSimulatorResourceLedger(
  Object.values(inheritedSnapshot.statesByPoolId),
  {
    baseJade: 100000,
    baseOriginite: 100,
    baseArsenalQuota: 200000,
    characterPullJadeCost: 500,
    weaponPullQuotaCost: 1980,
    originiteToJadeRate: 75,
    arsenalReward4: 20,
    arsenalReward5: 200,
    arsenalReward6: 2000
  }
);

assert.equal(resourceLedger.jadeSpent, (60 + 35) * 500, 'resource ledger should charge paid character pulls in jade');
assert.equal(resourceLedger.arsenalSpent, (20 + 12) * 198, 'resource ledger should charge paid weapon pulls in single-pull quota equivalents');
assert.equal(resourceLedger.arsenalGained, 127 * 20, 'resource ledger should reward arsenal quota from recorded pulls');

assert.deepEqual(getSimulatorPullCost({
  poolType: 'weapon',
  pullType: 'single'
}), {
  resource: 'arsenalQuota',
  amount: 198
}, 'weapon single pull should cost one tenth of a ten-pull quota pack');

assert.deepEqual(getSimulatorPullCost({
  poolType: 'weapon',
  pullType: 'ten'
}), {
  resource: 'arsenalQuota',
  amount: 1980
}, 'weapon ten-pull should cost 1980 arsenal quota');

const signedResourceSettings = normalizeResourceSettings({
  baseJade: -75,
  baseArsenalQuota: -20
});
assert.equal(signedResourceSettings.baseJade, -75, 'jade base should preserve signed values for direct balance setting');
assert.equal(signedResourceSettings.baseArsenalQuota, -20, 'arsenal base should preserve signed values for direct balance setting');

const zeroedArsenalLedger = buildSimulatorResourceLedger([
  {
    poolType: 'limited',
    pullHistory: [
      {
        rarity: 4,
        isFreePull: false,
        isInfoBookPull: false
      }
    ]
  }
], {
  ...DEFAULT_SIMULATOR_RESOURCE_SETTINGS,
  baseArsenalQuota: -20
});
assert.equal(zeroedArsenalLedger.arsenalGained, 20, 'ledger should still count arsenal gains after a manual reset');
assert.equal(zeroedArsenalLedger.arsenalBalance, 0, 'signed arsenal base should allow setting displayed arsenal balance to zero after gains');

const noHistory = buildInheritedSimulatorState({
  history: [],
  realPools: pools,
  currentSimPool: { id: 'sim_standard', type: 'standard' },
  currentGameUid: 'uid-1',
  currentUserId: 'user-1'
});

assert.equal(noHistory, null, 'empty history should not produce inherited state');

const guaranteedLimitedHistory = [
  ...Array.from({ length: 119 }, (_, index) => makePull('limited_b', 600 + index + 1)),
  makePull('limited_b', 800, { rarity: 6, isLimited: true, character_name: 'B' })
];

const guaranteedLimitedState = buildInheritedSimulatorState({
  history: guaranteedLimitedHistory,
  realPools: pools,
  currentSimPool: { id: 'sim_limited_b', type: 'limited', up_character: 'B' },
  currentGameUid: 'uid-1',
  currentUserId: 'user-1'
});

assert.equal(guaranteedLimitedState.guaranteedLimitedPity, 0, 'hard pity counter should reset after hitting the guaranteed limited threshold');
assert.equal(guaranteedLimitedState.hasReceivedGuaranteedLimited, true, 'inherited limited state should remember that the one-time hard pity has been consumed');

const scopeA = buildSimulatorStorageScope({ currentUserId: 'user-1', currentGameUid: 'uid-1' });
const scopeB = buildSimulatorStorageScope({ currentUserId: 'user-1', currentGameUid: 'uid-2' });

saveSimulatorState('sim_limited_a', { totalPulls: 10 }, scopeA);
saveSimulatorState('sim_limited_a', { totalPulls: 25 }, scopeB);
assert.equal(loadSimulatorState('sim_limited_a', scopeA).totalPulls, 10, 'scoped simulator state should remain isolated for uid-1');
assert.equal(loadSimulatorState('sim_limited_a', scopeB).totalPulls, 25, 'scoped simulator state should remain isolated for uid-2');
clearSimulatorState('sim_limited_a', scopeA);
assert.equal(loadSimulatorState('sim_limited_a', scopeA), null, 'clearing scoped simulator state should not affect other scopes');
assert.equal(loadSimulatorState('sim_limited_a', scopeB).totalPulls, 25, 'clearing one scope must not remove other scoped state');

saveSharedPityState({ sixStarPity: 12, fiveStarPity: 3 }, scopeA);
saveSharedPityState({ sixStarPity: 55, fiveStarPity: 8 }, scopeB);
assert.deepEqual(loadSharedPityState(scopeA), { sixStarPity: 12, fiveStarPity: 3 }, 'shared pity should be isolated by scoped account');
assert.deepEqual(loadSharedPityState(scopeB), { sixStarPity: 55, fiveStarPity: 8 }, 'shared pity should be isolated by scoped account');
clearSharedPityState(scopeA);
assert.equal(loadSharedPityState(scopeA), null, 'clearing scoped shared pity should only affect that scope');

saveInfoBookState({ sim_limited_a: { activated: true, used: false, targetPoolId: 'sim_limited_b', obtainedAt: 1 } }, scopeA);
saveInfoBookState({ sim_limited_b: { activated: false, used: false, targetPoolId: 'sim_limited_c', obtainedAt: 2 } }, scopeB);
assert.ok(loadInfoBookState(scopeA).sim_limited_a, 'info-book state should be isolated by scope');
assert.ok(loadInfoBookState(scopeB).sim_limited_b, 'info-book state should be isolated by scope');
clearInfoBookState(scopeB);
assert.deepEqual(loadInfoBookState(scopeB), {}, 'clearing scoped info-book state should only affect that scope');

saveSimulatorResourceSettings({ baseJade: 12345, baseOriginite: 6, baseArsenalQuota: 7 }, scopeA);
saveSimulatorResourceSettings({ baseJade: 54321, baseOriginite: 8, baseArsenalQuota: 9 }, scopeB);
assert.equal(loadSimulatorResourceSettings(scopeA).baseJade, 12345, 'scoped resource settings should be isolated by account');
assert.equal(loadSimulatorResourceSettings(scopeB).baseJade, 54321, 'scoped resource settings should be isolated by account');
clearSimulatorResourceSettings(scopeA);
assert.equal(
  loadSimulatorResourceSettings(scopeA).baseJade,
  DEFAULT_SIMULATOR_RESOURCE_SETTINGS.baseJade,
  'clearing scoped resource settings should reset only the cleared scope to defaults'
);

localStorage.setItem('gacha_simulator_state_sim_limited_b', JSON.stringify({
  version: '1.0',
  timestamp: Date.now(),
  poolType: 'sim_limited_b',
  state: { totalPulls: 77 }
}));
localStorage.setItem('simulator_currentPoolId', 'sim_limited_b');
migrateLegacySimulatorStorageToScope({
  scope: scopeA,
  poolIds: ['sim_limited_b']
});
assert.equal(loadSimulatorState('sim_limited_b', scopeA).totalPulls, 77, 'legacy simulator state should migrate into the first scoped account');
assert.equal(localStorage.getItem(getSimulatorCurrentPoolStorageKey(scopeA)), 'sim_limited_b', 'legacy current simulator pool should migrate into scoped key');

useHistoryStore.getState().setHistory([
  { id: 'snake-1', poolId: 'limited_a', game_uid: 'uid-snake', nick_name: 'SnakeName', rarity: 4, timestamp: 1 },
  { id: 'camel-1', poolId: 'limited_a', gameUid: 'uid-camel', nickName: 'CamelName', rarity: 5, timestamp: 2 }
]);
const accounts = useHistoryStore.getState().getGameAccountsFromHistory();
assert.deepEqual(
  accounts.map(({ gameUid, nickName }) => ({ gameUid, nickName })),
  [
    { gameUid: 'uid-snake', nickName: 'SnakeName' },
    { gameUid: 'uid-camel', nickName: 'CamelName' }
  ],
  'account extraction should support both snake_case and camelCase history fields'
);
assert.equal(
  useHistoryStore.getState().getHistoryByGameAccount('uid-camel').length,
  1,
  'history filtering should support camelCase account fields'
);

console.log('SIM-001 inheritance, resource, and scoped storage verification passed');

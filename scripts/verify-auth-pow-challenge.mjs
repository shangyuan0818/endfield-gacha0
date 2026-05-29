import assert from 'node:assert/strict';
import {
  createPowChallenge,
  verifyPowPayload,
} from '../api/_lib/powChallenge.js';
import {
  solvePowChallenge,
} from '../src/utils/powChallengeCore.js';

const env = {
  AUTH_POW_SECRET: 'verify-auth-pow-secret',
  AUTH_POW_DIFFICULTY: '1',
  AUTH_POW_TOTAL_STEPS: '1200',
  AUTH_POW_EXPIRES_MS: '600000',
  AUTH_POW_MAX_VERIFY_STEPS: '5000',
};

const challenge = createPowChallenge({
  action: 'register',
  env,
});

assert.equal(challenge.action, 'register');
assert.equal(challenge.difficulty, 1);
assert.equal(challenge.totalSteps, 1200);
assert.ok(challenge.signature);

const solution = await solvePowChallenge(challenge);
const verified = await verifyPowPayload({
  action: 'register',
  payload: solution,
  env,
});
assert.equal(verified.ok, true);
assert.equal(verified.code, 'pow_verified');

const tampered = await verifyPowPayload({
  action: 'register',
  payload: {
    ...solution,
    hash: `${solution.hash.slice(0, -1)}0`,
  },
  env,
});
assert.equal(tampered.ok, false);
assert.equal(tampered.code, 'pow_failed');

const wrongAction = await verifyPowPayload({
  action: 'password_reset',
  payload: solution,
  env,
});
assert.equal(wrongAction.ok, false);
assert.equal(wrongAction.code, 'pow_action_mismatch');

const expiredChallenge = createPowChallenge({
  action: 'register',
  env: {
    ...env,
    AUTH_POW_EXPIRES_MS: '30000',
  },
});
const expiredSolution = await solvePowChallenge({
  ...expiredChallenge,
  expiresAt: Date.now() - 1,
});
const expired = await verifyPowPayload({
  action: 'register',
  payload: expiredSolution,
  env,
});
assert.equal(expired.ok, false);
assert.equal(expired.code, 'pow_expired');

console.log('auth pow challenge verification passed');

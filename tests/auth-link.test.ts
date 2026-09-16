import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseAccessLink } from '../src/auth-link';
const project = 'https://flow-test.supabase.co';
const valid = `${project}/auth/v1/verify?token=received-token&type=magiclink&redirect_to=http%3A%2F%2Flocalhost%3A3000`;
test('redeems the email token directly, regardless of its browser redirect', () => {
  assert.deepEqual(parseAccessLink(`  ${valid}  `, project), { token_hash: 'received-token', type: 'email' });
});
test('never accepts another project, a deceptive hostname, or credentials in the URL', () => {
  for (const origin of ['https://other.supabase.co', 'https://flow-test.supabase.co.attacker.test', 'https://flow-test.supabase.co@attacker.test', 'http://flow-test.supabase.co', 'https://user:password@flow-test.supabase.co']) {
    assert.throws(() => parseAccessLink(`${origin}/auth/v1/verify?token=received-token&type=magiclink`, project));
  }
});
test('rejects empty tokens, different auth actions, and other paths', () => {
  for (const value of [valid.replace('received-token', ''), valid.replace('magiclink', 'recovery'), valid.replace('/auth/v1/verify', '/auth/v1/user'), 'not a link']) {
    assert.throws(() => parseAccessLink(value, project));
  }
});

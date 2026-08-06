import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, isNewerVersion, checkForUpdate, RELEASES_API_URL } from './update-check.js';

test('parseVersion parses "v1.2.3" and "1.2.3" identically', () => {
  assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 });
});

test('parseVersion returns null for an unparseable tag', () => {
  assert.equal(parseVersion('not-a-version'), null);
  assert.equal(parseVersion(''), null);
  assert.equal(parseVersion(undefined), null);
});

test('isNewerVersion compares major/minor/patch in order', () => {
  assert.equal(isNewerVersion('v2.0.0', '1.9.9'), true);
  assert.equal(isNewerVersion('v1.10.0', '1.9.9'), true);
  assert.equal(isNewerVersion('v1.0.1', '1.0.0'), true);
  assert.equal(isNewerVersion('v1.0.0', '1.0.0'), false);
  assert.equal(isNewerVersion('v0.9.0', '1.0.0'), false);
});

test('isNewerVersion returns false when either tag fails to parse', () => {
  assert.equal(isNewerVersion('garbage', '1.0.0'), false);
  assert.equal(isNewerVersion('v1.0.0', 'garbage'), false);
});

test('checkForUpdate requires deps.fetch', async () => {
  await assert.rejects(() => checkForUpdate('1.0.0', {}), /deps\.fetch/);
});

test('checkForUpdate calls the exact GitHub releases/latest URL', async () => {
  let calledUrl = null;
  const fetch = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ tag_name: 'v1.0.0' }) };
  };
  await checkForUpdate('1.0.0', { fetch });
  assert.equal(calledUrl, RELEASES_API_URL);
});

test('checkForUpdate returns up-to-date when remote tag is not newer', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ tag_name: 'v1.0.0' }) });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.deepEqual(result, { status: 'up-to-date' });
});

test('checkForUpdate returns update-available with release metadata when remote is newer', async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v1.2.0', body: 'release notes here', html_url: 'https://github.com/cworkfox-source/pdfprint-layout/releases/tag/v1.2.0' }),
  });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.deepEqual(result, {
    status: 'update-available',
    latestVersion: 'v1.2.0',
    releaseNotes: 'release notes here',
    releaseUrl: 'https://github.com/cworkfox-source/pdfprint-layout/releases/tag/v1.2.0',
  });
});

test('checkForUpdate falls back to a constructed release URL when html_url is missing', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ tag_name: 'v1.2.0' }) });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.equal(result.releaseUrl, 'https://github.com/cworkfox-source/pdfprint-layout/releases/tag/v1.2.0');
  assert.equal(result.releaseNotes, '');
});

test('checkForUpdate degrades to a message when fetch rejects (offline)', async () => {
  const fetch = async () => { throw new Error('network down'); };
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.equal(result.status, 'error');
  assert.match(result.message, /離線/);
});

test('checkForUpdate degrades to a message on a non-ok HTTP response (e.g. rate limited)', async () => {
  const fetch = async () => ({ ok: false, status: 403 });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.equal(result.status, 'error');
  assert.match(result.message, /403/);
});

test('checkForUpdate degrades to a message when the response body is not valid JSON', async () => {
  const fetch = async () => ({ ok: true, json: async () => { throw new Error('bad json'); } });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.equal(result.status, 'error');
});

test('checkForUpdate degrades to a message when the response has no tag_name', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({}) });
  const result = await checkForUpdate('1.0.0', { fetch });
  assert.equal(result.status, 'error');
});

test('checkForUpdate never throws for any of the failure paths', async () => {
  const failingFetches = [
    async () => { throw new Error('x'); },
    async () => ({ ok: false, status: 500 }),
    async () => ({ ok: true, json: async () => { throw new Error('x'); } }),
    async () => ({ ok: true, json: async () => ({}) }),
  ];
  for (const fetch of failingFetches) {
    // eslint-disable-next-line no-await-in-loop
    await assert.doesNotReject(() => checkForUpdate('1.0.0', { fetch }));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_SECTIONS,
  filterSettingsSections,
  getSettingsSectionById,
} from '../src/lib/settingsNav';

test('SETTINGS_SECTIONS defines 6 unique, grouped sections', () => {
  assert.equal(SETTINGS_SECTIONS.length, 6);
  const ids = new Set(SETTINGS_SECTIONS.map((s) => s.id));
  assert.equal(ids.size, 6);
  assert.equal(getSettingsSectionById('security').label, 'Security & Privacy');
});

test('filterSettingsSections returns all sections for empty query', () => {
  const all = filterSettingsSections('   ');
  assert.equal(all.length, SETTINGS_SECTIONS.length);
});

test('filterSettingsSections ranks direct topic matches accurately', () => {
  const driveMatches = filterSettingsSections('google drive');
  assert.ok(driveMatches.length >= 1);
  assert.equal(driveMatches[0].section.id, 'data_mobile');

  const paydayMatches = filterSettingsSections('payday sweep');
  assert.ok(paydayMatches.length >= 1);
  assert.equal(paydayMatches[0].section.id, 'automation');

  const quietMatches = filterSettingsSections('quiet hours');
  assert.ok(quietMatches.length >= 1);
  assert.equal(quietMatches[0].section.id, 'notifications');

  const pwMatches = filterSettingsSections('password');
  assert.ok(pwMatches.length >= 1);
  assert.equal(pwMatches[0].section.id, 'security');

  const none = filterSettingsSections('zzzz_nonexistent_setting');
  assert.equal(none.length, 0);
});

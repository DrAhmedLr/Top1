import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMeasurementInput } from './measurementInput';

test('blank measurements remain missing rather than zero', () => {
  assert.equal(parseMeasurementInput(''), '');
  assert.equal(parseMeasurementInput('  ', 60), '');
  assert.equal(parseMeasurementInput('0'), '0');
});
test('decimal drafts and decimal commas preserve sleep units', () => {
  assert.equal(parseMeasurementInput('7.', 60), '420');
  assert.equal(parseMeasurementInput('7.5', 60), '450');
  assert.equal(parseMeasurementInput('7,5', 60), '450');
  assert.equal(parseMeasurementInput('.5'), '0.5');
});
test('incomplete and malformed measurements stay invalid', () => {
  for (const raw of ['-', '.', '7,5,2', '12 hours', '0x20', 'Infinity', '1e3']) {
    assert.equal(parseMeasurementInput(raw), 'NaN', raw);
  }
});

test('French decimal commas and Arabic numerals preserve the intended measurement',()=>{
 assert.equal(parseMeasurementInput('٢٫٥'),'2.5');
 assert.equal(parseMeasurementInput('۲,۵'),'2.5');
 assert.equal(parseMeasurementInput('٣،٥'),'NaN');
 assert.equal(parseMeasurementInput('٧٫٥',60),'450');
 assert.equal(parseMeasurementInput('١٬٠٠٠'),'NaN');
});

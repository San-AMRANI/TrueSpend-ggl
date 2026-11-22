import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackParse, parseNumber } from '../server/services/BankNotificationParser.js';

test('parseNumber parses US, EU, and spaced numeric amounts accurately', () => {
  assert.equal(parseNumber('1,250.50'), 1250.5);
  assert.equal(parseNumber('1.250,50'), 1250.5);
  assert.equal(parseNumber('8 500,00'), 8500);
  assert.equal(parseNumber('1,250'), 1250);
  assert.equal(parseNumber('48,90'), 48.9);
  assert.equal(parseNumber('1250.50'), 1250.5);
  assert.equal(parseNumber(''), null);
});

test('fallbackParse extracts MAD, EUR, USD, and GBP amounts without partial truncation', () => {
  const mad = fallbackParse('CIH Bank\nPaiement par carte de 345,00 MAD chez Marjane');
  assert.equal(mad.amount, 345);
  assert.equal(mad.currency, 'MAD');
  assert.equal(mad.type, 'Expense');
  assert.equal(mad.merchant, 'Marjane');

  const usd = fallbackParse('Credit card purchase of $1,250.50 at Apple Store');
  assert.equal(usd.amount, 1250.5);
  assert.equal(usd.currency, 'USD');
  assert.equal(usd.type, 'Expense');

  const usdPlain = fallbackParse('Purchase $1250.50 at Best Buy');
  assert.equal(usdPlain.amount, 1250.5);
  assert.equal(usdPlain.currency, 'USD');

  const eur = fallbackParse('Carte de crédit: achat €48,90 chez Carrefour');
  assert.equal(eur.amount, 48.9);
  assert.equal(eur.currency, 'EUR');
  assert.equal(eur.type, 'Expense');

  const gbp = fallbackParse('Card payment of £79.99 at Sainsburys');
  assert.equal(gbp.amount, 79.99);
  assert.equal(gbp.currency, 'GBP');
  assert.equal(gbp.type, 'Expense');
});

test('fallbackParse distinguishes salary/incoming transfer from credit card spend', () => {
  const income = fallbackParse('Virement reçu de 8 500,00 MAD - Salaire');
  assert.equal(income.amount, 8500);
  assert.equal(income.type, 'Income');
  assert.equal(income.category, '📥 Income');

  const cardSpend = fallbackParse('Your credit card was charged 150.00 MAD at Glovo');
  assert.equal(cardSpend.amount, 150);
  assert.equal(cardSpend.type, 'Expense');
});

import { describe, expect, it } from 'vitest';
import {
  filterCharacterCatalogRows,
  getCatalogRowPotentialState,
  selectCharacterCatalogRows,
  sortCharacterCatalogRows
} from '../characterCatalogViewModel.js';

const rows = [
  {
    id: 'char_alpha',
    name: 'Alpha',
    rarity: 6,
    isLimited: true,
    ownerUsers: 10,
    unownedUsers: 0,
    ownershipRate: 1,
    fullPotentialUsers: 2,
    fullPotentialRateOfOwners: 0.2,
    totalCopies: 18,
    quota: { aicQuotaTotalPotential: 300, bondQuotaDirect: 800, endpointQuotaConvertible: 20 },
  },
  {
    id: 'char_beta',
    name: 'Beta',
    rarity: 5,
    isLimited: false,
    ownerUsers: 3,
    unownedUsers: 7,
    ownershipRate: 0.3,
    fullPotentialUsers: 0,
    fullPotentialRateOfOwners: 0,
    totalCopies: 4,
    quota: { aicQuotaTotalPotential: 90, bondQuotaDirect: 10, endpointQuotaConvertible: 0 },
  },
  {
    id: 'char_gamma',
    name: 'Gamma',
    rarity: 4,
    isLimited: false,
    ownerUsers: 0,
    unownedUsers: 10,
    ownershipRate: 0,
    fullPotentialUsers: 0,
    fullPotentialRateOfOwners: 0,
    totalCopies: 0,
    quota: {},
  },
];

describe('characterCatalogViewModel', () => {
  it('filters global catalog rows by rarity, limited status, ownership, potential, and search', () => {
    expect(filterCharacterCatalogRows(rows, { rarity: '6' }, 'global').map((row) => row.id)).toEqual(['char_alpha']);
    expect(filterCharacterCatalogRows(rows, { limitedStatus: 'standard' }, 'global').map((row) => row.id)).toEqual(['char_beta', 'char_gamma']);
    expect(filterCharacterCatalogRows(rows, { ownershipStatus: 'unowned' }, 'global').map((row) => row.id)).toEqual(['char_gamma']);
    expect(filterCharacterCatalogRows(rows, { potentialStatus: 'full' }, 'global').map((row) => row.id)).toEqual(['char_alpha']);
    expect(filterCharacterCatalogRows(rows, { search: 'bet' }, 'global').map((row) => row.id)).toEqual(['char_beta']);
  });

  it('sorts global catalog rows by configured metrics', () => {
    expect(sortCharacterCatalogRows(rows, 'ownerUsers', 'global').map((row) => row.id)).toEqual(['char_alpha', 'char_beta', 'char_gamma']);
    expect(sortCharacterCatalogRows(rows, 'quota', 'global').map((row) => row.id)).toEqual(['char_alpha', 'char_beta', 'char_gamma']);
    expect(sortCharacterCatalogRows(rows, 'name', 'global', 'asc').map((row) => row.id)).toEqual(['char_alpha', 'char_beta', 'char_gamma']);
    expect(sortCharacterCatalogRows(rows, 'ownerUsers', 'global', 'asc').map((row) => row.id)).toEqual(['char_gamma', 'char_beta', 'char_alpha']);
  });

  it('selects local rows by owned, full, and excess states', () => {
    const localRows = [
      { id: 'owned', name: 'Owned', rarity: 6, owned: true, acquisitionCount: 2, potentialLevel: 1, excessTrustTokens: 0 },
      { id: 'full', name: 'Full', rarity: 6, owned: true, acquisitionCount: 6, potentialLevel: 5, excessTrustTokens: 0 },
      { id: 'excess', name: 'Excess', rarity: 6, owned: true, acquisitionCount: 7, potentialLevel: 5, excessTrustTokens: 1 },
      { id: 'missing', name: 'Missing', rarity: 6, owned: false, acquisitionCount: 0, potentialLevel: 0, excessTrustTokens: 0 },
    ];

    expect(getCatalogRowPotentialState(localRows[0], 'local')).toBe('owned_unfull');
    expect(getCatalogRowPotentialState(localRows[1], 'local')).toBe('full');
    expect(getCatalogRowPotentialState(localRows[2], 'local')).toBe('excess');
    expect(getCatalogRowPotentialState(localRows[3], 'local')).toBe('unowned');
    expect(new Set(selectCharacterCatalogRows(localRows, { potentialStatus: 'full' }, 'local').map((row) => row.id))).toEqual(new Set(['full', 'excess']));
    expect(selectCharacterCatalogRows(localRows, { potentialStatus: 'excess' }, 'local').map((row) => row.id)).toEqual(['excess']);
  });
});

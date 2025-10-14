import { normalizeCompanyName } from '../workerDataProcessor'

describe('normalizeCompanyName', () => {
  it('uppercases and trims input', () => {
    expect(normalizeCompanyName('  Acme Pty Ltd  ')).toBe('ACME')
  })

  it('preserves ampersands and numeric tokens', () => {
    expect(normalizeCompanyName('A & B Electrical 24/7 Pty Ltd')).toBe('A & B ELECTRICAL 24 7')
  })

  it('removes trading as suffixes', () => {
    expect(normalizeCompanyName('Acme Constructions t/a Fast Build Pty Ltd')).toBe('ACME CONSTRUCTIONS')
  })

  it('removes diacritics and corporate suffixes', () => {
    expect(normalizeCompanyName('Société Générale SARL')).toBe('SOCIETE GENERALE')
  })
})



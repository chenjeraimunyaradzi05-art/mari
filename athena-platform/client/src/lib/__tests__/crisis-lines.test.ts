import { crisisLinesFor, crisisRegionFor, telHref } from '../crisis-lines';

/**
 * The Emergency help button reads this list and asks nobody, so what is in it
 * is what a woman is given at the worst moment. These are the numbers the rest
 * of the product already publishes; a change to one is a change someone must
 * have checked against the service.
 */

describe('crisisLinesFor', () => {
  it('gives an Australian member the three lines that are answered at any hour', () => {
    const set = crisisLinesFor('ANZ');

    expect(set.region).toBe('AU');
    expect(set.lines.map((line) => [line.name, line.phone])).toEqual([
      ['Emergency', '000'],
      ['1800RESPECT', '1800 737 732'],
      ['Lifeline', '13 11 14'],
    ]);
  });

  it('reads an unset region as Australian, which is the product default, and says where else the emergency numbers differ', () => {
    for (const unset of [undefined, null, '', '  ']) {
      const set = crisisLinesFor(unset);
      expect(set.region).toBe('AU');
      expect(set.elsewhere).toMatch(/New Zealand 111.*United Kingdom 999.*United States 911.*European Union 112/);
    }
  });

  it('gives a member elsewhere the lines of her own country, not Australian numbers that will not connect', () => {
    expect(crisisLinesFor('UK').lines.map((line) => line.phone)).toEqual(['999', '0808 2000 247']);
    expect(crisisLinesFor('US').lines.map((line) => line.phone)).toEqual(['911', '1-800-799-7233']);
    expect(crisisLinesFor('NZ').lines.map((line) => line.phone)).toEqual(['111', '0800 733 843']);
    expect(crisisLinesFor('EU').lines.map((line) => line.phone)).toEqual(['112']);
    expect(crisisLinesFor('UK').lines.some((line) => line.phone === '000')).toBe(false);
  });

  it('says so, with no number it cannot stand behind, for a region it has no list for', () => {
    for (const region of ['SEA', 'MEA']) {
      const set = crisisLinesFor(region);
      expect(set.region).toBeNull();
      expect(set.lines).toEqual([]);
      expect(set.elsewhere).toMatch(/do not have a list of support lines for your region/i);
    }
  });
});

describe('crisisRegionFor', () => {
  it('maps the spellings a profile and a locale produce', () => {
    expect(crisisRegionFor('gb')).toBe('UK');
    expect(crisisRegionFor('AUS')).toBe('AU');
    expect(crisisRegionFor('usa')).toBe('US');
  });
});

describe('telHref', () => {
  it('hands the dialler the digits and nothing a link could mangle', () => {
    expect(telHref('1800 737 732')).toBe('tel:1800737732');
    expect(telHref('1-800-799-7233')).toBe('tel:18007997233');
    expect(telHref('13 11 14')).toBe('tel:131114');
    expect(telHref('000')).toBe('tel:000');
  });
});

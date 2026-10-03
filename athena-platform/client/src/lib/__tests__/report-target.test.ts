import { asReportContentType, resolveReportTarget } from '../report-target';

/**
 * The report form asks for "the link or the ID". The server looks the thing up
 * by its ID alone, so a pasted address has to be turned into a type and an ID
 * here, in the link shapes the site itself produces, or the report is refused.
 */

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9a0b1c2d3e4f';

describe('resolveReportTarget', () => {
  it.each([
    [`https://athena.example/posts/${ID}`, 'post'],
    [`https://athena.example/posts/${ID}/`, 'post'],
    [`https://athena.example/posts/${ID}?utm_source=share#comments`, 'post'],
    [`/posts/${ID}`, 'post'],
    [`https://athena.example/dashboard/community/post/${ID}`, 'post'],
    [`https://athena.example/explore?video=${ID}`, 'video'],
    [`https://athena.example/explore/?tab=trending&video=${ID}`, 'video'],
    [`https://athena.example/explore/video/${ID}`, 'video'],
    // What the phone app puts on a shared reel.
    [`https://athena.example/videos/${ID}`, 'video'],
    // What an event's share button copies: the list, with the event in the query.
    [`https://athena.example/events?event=${ID}`, 'event'],
    [`https://athena.example/dashboard/events/?event=${ID}`, 'event'],
    [`https://athena.example/profile/${ID}`, 'profile'],
    [`https://athena.example/dashboard/profile/${ID}`, 'profile'],
    [`https://athena.example/jobs/${ID}`, 'job'],
    [`https://athena.example/dashboard/jobs/${ID}`, 'job'],
    [`athena.example/posts/${ID}`, 'post'],
  ])('reads %s as a %s with the right ID', (pasted, type) => {
    // The list is left on a different type on purpose: the link wins.
    const chosen = type === 'comment' ? 'post' : type === 'post' ? 'profile' : 'comment';

    expect(resolveReportTarget(pasted, chosen)).toEqual({ ok: true, contentType: type, contentId: ID, fromLink: true });
  });

  it('takes a bare ID as the type she chose', () => {
    expect(resolveReportTarget(`  ${ID}  `, 'event')).toEqual({ ok: true, contentType: 'event', contentId: ID, fromLink: false });
    expect(resolveReportTarget('abc_123-XYZ', 'housing_listing')).toMatchObject({
      ok: true,
      contentType: 'housing_listing',
      contentId: 'abc_123-XYZ',
    });
  });

  it('says what to do when the link is not one it can read, rather than sending it to be looked up', () => {
    for (const pasted of [
      'https://athena.example/pricing',
      `https://athena.example/explore?tab=trending`,
      // The events list with no event named is a list, not an event.
      `https://athena.example/events`,
      `https://athena.example/events?event=a%20b`,
      'https://athena.example/posts/',
      `https://athena.example/posts/${ID}/edit`,
    ]) {
      const result = resolveReportTarget(pasted, 'post');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/could not tell what that link is/i);
    }
  });

  it('says a conversation is not a message, and where to report one', () => {
    const result = resolveReportTarget(`https://athena.example/dashboard/messages/${ID}`, 'post');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/conversation[\s\S]*Report on the message itself/);
  });

  it('refuses something that is neither a link nor an ID, and an empty box', () => {
    expect(resolveReportTarget('that post from yesterday', 'post').ok).toBe(false);
    expect(resolveReportTarget('   ', 'post').ok).toBe(false);
    // Longer than the server will take.
    expect(resolveReportTarget('a'.repeat(101), 'post').ok).toBe(false);
  });

  it('does not take an ID out of an encoded path that is not an ID', () => {
    expect(resolveReportTarget('https://athena.example/posts/%E0%A4%A', 'post').ok).toBe(false);
    expect(resolveReportTarget('https://athena.example/posts/a%20b', 'post').ok).toBe(false);
  });
});

describe('asReportContentType', () => {
  it('accepts the types the form files, in any case, and nothing else', () => {
    expect(asReportContentType('VIDEO')).toBe('video');
    expect(asReportContentType(' housing_listing ')).toBe('housing_listing');
    // Not filed by this form: a message is reported from its thread, and there is
    // no report of "something else" without something to point at.
    expect(asReportContentType('message')).toBeNull();
    expect(asReportContentType('other')).toBeNull();
    expect(asReportContentType(null)).toBeNull();
    expect(asReportContentType('')).toBeNull();
  });
});

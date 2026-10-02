/**
 * Hostile input for the HTML sanitiser tests, in one place so the browser
 * branch (sanitize.test.ts) and the server branch (sanitize.server.test.ts)
 * are tried with the same strings. Test data only; nothing imports this in the
 * app.
 */

export const HOSTILE_PAYLOADS: ReadonlyArray<{ name: string; html: string }> = [
  { name: 'a script element', html: '<p>hi</p><script>alert(1)</script>' },
  { name: 'a script element split to dodge a pattern', html: '<scr<script>ipt>alert(1)</scr</script>ipt>' },
  { name: 'an image with an error handler', html: '<img src=x onerror=alert(1)>' },
  { name: 'an image with a quoted handler', html: '<img src="x" onerror="alert(1)">' },
  { name: 'an svg with onload', html: '<svg onload=alert(1)><circle r="5"/></svg>' },
  { name: 'an svg script', html: '<svg><script>alert(1)</script></svg>' },
  { name: 'a javascript: link', html: '<a href="javascript:alert(1)">click</a>' },
  { name: 'a javascript: link with the scheme entity-encoded', html: '<a href="jav&#x61;script:alert(1)">click</a>' },
  { name: 'a javascript: link with a tab inside the scheme', html: '<a href="java&#x09;script:alert(1)">click</a>' },
  { name: 'a javascript: link in capitals with a leading space', html: '<a href=" JaVaScRiPt:alert(1)">click</a>' },
  { name: 'a data: link', html: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>' },
  { name: 'a vbscript: link', html: '<a href="vbscript:msgbox(1)">click</a>' },
  { name: 'an iframe', html: '<iframe src="https://evil.example"></iframe>' },
  { name: 'an iframe with srcdoc', html: '<iframe srcdoc="<script>alert(1)</script>"></iframe>' },
  { name: 'an object and an embed', html: '<object data="x.swf"></object><embed src="x.swf">' },
  { name: 'a style element', html: '<style>body{display:none}</style>' },
  { name: 'an inline style', html: '<p style="position:fixed;top:0;left:0;width:100%;height:100%">overlay</p>' },
  { name: 'a form posting somewhere else', html: '<form action="https://evil.example"><input name="password"><button>Sign in</button></form>' },
  { name: 'a button with formaction', html: '<button formaction="javascript:alert(1)">go</button>' },
  { name: 'an event handler on an allowed tag', html: '<p onmouseover="alert(1)">hover</p>' },
  { name: 'an autofocus handler', html: '<div onfocus="alert(1)" tabindex="0" autofocus>x</div>' },
  { name: 'a meta refresh', html: '<meta http-equiv="refresh" content="0;url=https://evil.example">' },
  { name: 'a base tag that rewrites every relative link', html: '<base href="https://evil.example/">' },
  { name: 'a math element', html: '<math><mi xlink:href="javascript:alert(1)">x</mi></math>' },
  { name: 'a class that draws over the page', html: '<div class="fixed inset-0 z-50 bg-white">Please sign in again</div>' },
];

/** What a job description is, which has to come through untouched. */
export const BENIGN_DESCRIPTION =
  '<h2>About the role</h2><p>You will be <strong>mentoring</strong> two apprentices.</p><ul><li>Paid</li><li>Part time</li></ul><p><a href="https://example.org/apply">Apply here</a></p>';

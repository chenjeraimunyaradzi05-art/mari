/**
 * scripts/check-raw-body.js: what it refuses, and what it leaves alone.
 *
 * The guard is the only thing standing between the next `update: req.body` and
 * the one that let any member write their own role, so it has to refuse the
 * shapes that did the damage (the exact handler is reproduced below) and has to
 * leave a handler that reads a single named field, or a parsed body, alone —
 * otherwise someone will silence it rather than live with it.
 */

type Hit = { line: number; kind: string };

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const guard = require('../scripts/check-raw-body') as {
  findRawBodyUses: (fileName: string, text: string) => Hit[];
  isTestFile: (relativePath: string) => boolean;
};

const kinds = (source: string) => guard.findRawBodyUses('src/routes/example.routes.ts', source).map((hit) => hit.kind);

describe('check-raw-body', () => {
  it('refuses the handler that let a member write their own role', () => {
    const source = `
      router.patch('/me/profile', authenticate, async (req, res, next) => {
        const profile = await prisma.profile.upsert({
          where: { userId: req.user!.id },
          update: req.body,
          create: {
            userId: req.user!.id,
            ...req.body,
          },
        });
      });
    `;
    expect(kinds(source)).toEqual(['update: req.body', 'spread of req.body into an object']);
  });

  it('refuses a body spread after the owner, which let a body userId win', () => {
    const source = `
      await prisma.workExperience.create({
        data: { userId: req.user!.id, ...req.body, startDate: new Date(req.body.startDate) },
      });
    `;
    expect(kinds(source)).toEqual(['spread of req.body into an object']);
  });

  it('refuses data, create and update handed the body whole', () => {
    expect(kinds('prisma.post.update({ where: { id }, data: req.body });')).toEqual(['data: req.body']);
    expect(kinds('prisma.post.create({ data: req.body });')).toEqual(['data: req.body']);
    expect(kinds('prisma.post.upsert({ where, update: req.body, create: req.body });')).toEqual([
      'update: req.body',
      'create: req.body',
    ]);
  });

  it('refuses the same body under the other names a handler gives its request', () => {
    expect(kinds('prisma.post.create({ data: request.body });')).toEqual(['data: req.body']);
    expect(kinds('const copy = { ...request.body };')).toEqual(['spread of req.body into an object']);
  });

  it('refuses Object.assign and rest destructuring of the body', () => {
    expect(kinds('Object.assign(existing, req.body);')).toEqual(['Object.assign with req.body']);
    expect(kinds('const { id, ...rest } = req.body;')).toEqual(['rest destructuring of req.body']);
  });

  it('leaves a single named field, a picked set and a parsed body alone', () => {
    const source = `
      const title = req.body.title;
      const { skillName, level } = req.body;
      const parsed = schema.safeParse(req.body);
      const data = parseStrict(profileSchema, req.body);
      await prisma.profile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
      await prisma.post.create({ data: { title: req.body.title, authorId: req.user!.id } });
      res.json(req.body);
    `;
    expect(kinds(source)).toEqual([]);
  });

  it('does not count a comment or a string that mentions it', () => {
    const source = `
      // update: req.body was how a member became an administrator.
      const note = 'data: req.body';
    `;
    expect(kinds(source)).toEqual([]);
  });

  it('reports the line of each use', () => {
    const source = ['const a = 1;', '', 'prisma.x.create({ data: req.body });'].join('\n');
    expect(guard.findRawBodyUses('src/routes/example.routes.ts', source)).toEqual([
      { line: 3, kind: 'data: req.body' },
    ]);
  });

  it('does not scan test files', () => {
    expect(guard.isTestFile('src/routes/__tests__/user.test.ts')).toBe(true);
    expect(guard.isTestFile('src/routes/user.routes.ts')).toBe(false);
  });
});

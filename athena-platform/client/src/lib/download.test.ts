import { downloadText, shareOrCopy } from './download';

describe('downloadText', () => {
  it('offers the text as a named file through a temporary link', () => {
    const createObjectURL = jest.fn((_blob: Blob) => 'blob:athena/1');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    jest.useFakeTimers();

    downloadText('profit-and-loss.csv', 'Revenue,3000', 'text/csv;charset=utf-8');

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('profit-and-loss.csv');
    expect(anchor.href).toBe('blob:athena/1');
    expect(document.body.contains(anchor)).toBe(false);

    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:athena/1');
    jest.useRealTimers();
    click.mockRestore();
  });
});

describe('shareOrCopy', () => {
  const originalShare = (navigator as { share?: unknown }).share;
  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
  });

  it('uses the native share sheet when the browser has one', async () => {
    const share = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await expect(shareOrCopy({ title: 'A course', url: 'https://app.example/c/1' })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'A course', url: 'https://app.example/c/1' });
  });

  it('copies the link when there is no share sheet, and reports failure honestly', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeText = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(shareOrCopy({ title: 'A course', url: 'https://app.example/c/1' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://app.example/c/1');

    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    await expect(shareOrCopy({ title: 'A course', url: 'https://app.example/c/1' })).resolves.toBe('failed');
  });
});

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  mediaApi: { downloadUrl: jest.fn() },
}));

jest.mock('@/lib/download', () => ({
  downloadBlob: jest.fn(),
}));

import { api, mediaApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { downloadPrivateUpload, uploadKeyFromUrl } from '@/lib/private-files';

const mockedGet = api.get as unknown as jest.Mock;
const mockedMint = mediaApi.downloadUrl as unknown as jest.Mock;
const mockedDownload = downloadBlob as unknown as jest.Mock;

describe('uploadKeyFromUrl', () => {
  it('finds the storage key inside a local or CDN résumé URL', () => {
    expect(uploadKeyFromUrl('http://localhost:5000/api/media/local/resumes/u1/7f3a.pdf')).toBe('resumes/u1/7f3a.pdf');
    expect(uploadKeyFromUrl('https://athena-media.s3.amazonaws.com/resumes/u1/7f3a.pdf?X-Amz-Signature=abc')).toBe('resumes/u1/7f3a.pdf');
    expect(uploadKeyFromUrl('documents/u1/deed.docx')).toBe('documents/u1/deed.docx');
  });

  it('has no key for a link someone typed by hand, or for nothing', () => {
    expect(uploadKeyFromUrl('https://example.com/my-cv.pdf')).toBeNull();
    expect(uploadKeyFromUrl('https://example.com/resumes/only-two-parts')).toBeNull();
    expect(uploadKeyFromUrl(null)).toBeNull();
    expect(uploadKeyFromUrl('')).toBeNull();
  });
});

describe('downloadPrivateUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches a local file through the API, with the session, and hands it over as a download', async () => {
    mockedMint.mockResolvedValue({ data: { data: { downloadUrl: 'http://localhost:5000/api/media/local/resumes/u1/7f3a.pdf', fileName: '7f3a.pdf' } } });
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockedGet.mockResolvedValue({ data: blob });

    await downloadPrivateUpload('http://localhost:5000/api/media/local/resumes/u1/7f3a.pdf');

    expect(mockedMint).toHaveBeenCalledWith('resumes/u1/7f3a.pdf');
    expect(mockedGet).toHaveBeenCalledWith('/media/local/resumes/u1/7f3a.pdf', { responseType: 'blob' });
    expect(mockedDownload).toHaveBeenCalledWith('7f3a.pdf', blob);
  });

  it('opens a signed S3 URL instead of proxying it', async () => {
    mockedMint.mockResolvedValue({ data: { data: { downloadUrl: 'https://s3.example/signed', fileName: '7f3a.pdf' } } });
    const open = jest.spyOn(window, 'open').mockReturnValue({} as Window);

    await downloadPrivateUpload('https://cdn.example/resumes/u1/7f3a.pdf');

    expect(open).toHaveBeenCalledWith('https://s3.example/signed', '_blank', 'noopener,noreferrer');
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedDownload).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('surfaces the refusal when the server says the file is not hers to read', async () => {
    mockedMint.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 404, data: { message: 'File not found' } } }));

    await expect(downloadPrivateUpload('http://localhost:5000/api/media/local/resumes/u2/x.pdf')).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(mockedDownload).not.toHaveBeenCalled();
  });
});

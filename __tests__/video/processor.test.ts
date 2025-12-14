import { VideoProcessor } from '@/lib/video/processor';
import ffmpeg from 'fluent-ffmpeg';

// Define the mock factory
jest.mock('fluent-ffmpeg', () => {
  const mockOutput = jest.fn();
  const mockVideoCodec = jest.fn();
  const mockSize = jest.fn();
  const mockOn = jest.fn();
  const mockRun = jest.fn();
  const mockScreenshots = jest.fn();
  
  const mockCommand = {
    output: mockOutput,
    videoCodec: mockVideoCodec,
    size: mockSize,
    on: mockOn,
    run: mockRun,
    screenshots: mockScreenshots,
  };
  
  // Fix chaining
  mockOutput.mockReturnValue(mockCommand);
  mockVideoCodec.mockReturnValue(mockCommand);
  mockSize.mockReturnValue(mockCommand);
  mockOn.mockReturnValue(mockCommand);
  mockScreenshots.mockReturnValue(mockCommand);

  const ffmpegMock = jest.fn(() => mockCommand);
  
  const mockFfprobe = jest.fn();
  
  Object.assign(ffmpegMock, {
    setFfmpegPath: jest.fn(),
    setFfprobePath: jest.fn(),
    ffprobe: mockFfprobe,
    // Expose mocks for testing
    _mocks: {
      mockCommand,
      mockFfprobe
    }
  });
  
  return ffmpegMock;
});

jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/mock/ffmpeg' }));
jest.mock('@ffprobe-installer/ffprobe', () => ({ path: '/mock/ffprobe' }));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
  }
}));

describe('VideoProcessor', () => {
  let processor: VideoProcessor;
  let mocks: { mockCommand: any; mockFfprobe: any };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new VideoProcessor();
    // Get the mocks from the module
    mocks = (ffmpeg as any)._mocks;
  });

  it('should process a video successfully', async () => {
    const { mockCommand, mockFfprobe } = mocks;

    // Setup 'on' to simulate success
    mockCommand.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'end') {
        setTimeout(() => callback(), 10);
      }
      return mockCommand;
    });

    // Mock ffprobe success
    mockFfprobe.mockImplementation((path: string, cb: (err: Error | null, data: { format: { duration: number } }) => void) => {
      cb(null, { format: { duration: 120 } });
    });

    const result = await processor.process('input.mov', 'test-video.mov');

    expect(result).toEqual({
      videoPath: expect.stringContaining('test-video.mp4'),
      thumbnailPath: expect.stringContaining('test-video.png'),
      duration: 120,
      format: 'mp4'
    });

    expect(mockCommand.output).toHaveBeenCalled();
    expect(mockCommand.videoCodec).toHaveBeenCalledWith('libx264');
    expect(mockCommand.size).toHaveBeenCalledWith('1280x720');
    expect(mockCommand.screenshots).toHaveBeenCalled();
  });
});

import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StoryViewer, type StoryBucket } from './StoryViewer';

function story(id: string, type: 'image' | 'video' = 'image') {
  return {
    id,
    userId: `u-${id}`,
    type,
    mediaUrl: `https://cdn.test/${id}.${type === 'video' ? 'mp4' : 'jpg'}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}

const buckets: StoryBucket[] = [
  {
    user: { id: 'ada', displayName: 'Ada Lovelace', avatar: null },
    stories: [story('a1'), story('a2')],
  },
  {
    user: { id: 'grace', displayName: 'Grace Hopper', avatar: null },
    stories: [story('g1')],
  },
];

function currentImageId() {
  const img = screen.getByRole('img', { name: /Story from/i }) as HTMLImageElement;
  return img.src.split('/').pop();
}

describe('StoryViewer', () => {
  it('opens on the bucket that was clicked', () => {
    render(<StoryViewer buckets={buckets} initialBucket={1} onClose={jest.fn()} />);
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('renders one progress bar per story in the current bucket', () => {
    const { container } = render(
      <StoryViewer buckets={buckets} initialBucket={0} onClose={jest.fn()} />
    );
    // Ada has two stories, Grace has one.
    expect(container.querySelectorAll('.h-0\\.5').length).toBe(2);
  });

  it('advances within a bucket, then rolls into the next one', () => {
    render(<StoryViewer buckets={buckets} initialBucket={0} onClose={jest.fn()} />);
    expect(currentImageId()).toBe('a1.jpg');

    fireEvent.click(screen.getByLabelText('Next story'));
    expect(currentImageId()).toBe('a2.jpg');

    fireEvent.click(screen.getByLabelText('Next story'));
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(currentImageId()).toBe('g1.jpg');
  });

  it('closes after the final story rather than getting stuck', () => {
    const onClose = jest.fn();
    render(<StoryViewer buckets={buckets} initialBucket={1} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Next story'));
    expect(onClose).toHaveBeenCalled();
  });

  it('steps back into the previous bucket at its last story', () => {
    render(<StoryViewer buckets={buckets} initialBucket={1} onClose={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('Previous story'));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(currentImageId()).toBe('a2.jpg');
  });

  it('does nothing when stepping back from the very first story', () => {
    const onClose = jest.fn();
    render(<StoryViewer buckets={buckets} initialBucket={0} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Previous story'));
    expect(currentImageId()).toBe('a1.jpg');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supports arrow keys and Escape', () => {
    const onClose = jest.fn();
    render(<StoryViewer buckets={buckets} initialBucket={0} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(currentImageId()).toBe('a2.jpg');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(currentImageId()).toBe('a1.jpg');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-advances an image story on its timer', () => {
    jest.useFakeTimers();
    try {
      render(<StoryViewer buckets={buckets} initialBucket={0} onClose={jest.fn()} />);
      expect(currentImageId()).toBe('a1.jpg');

      act(() => {
        jest.advanceTimersByTime(5200);
      });

      expect(currentImageId()).toBe('a2.jpg');
    } finally {
      jest.useRealTimers();
    }
  });

  it('locks background scroll while open and restores it on unmount', () => {
    const { unmount } = render(
      <StoryViewer buckets={buckets} initialBucket={0} onClose={jest.fn()} />
    );
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders nothing when handed an empty bucket list', () => {
    const { container } = render(
      <StoryViewer buckets={[]} initialBucket={0} onClose={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

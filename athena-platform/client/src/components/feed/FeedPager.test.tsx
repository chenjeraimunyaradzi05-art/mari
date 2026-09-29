import { fireEvent, render, screen } from '@testing-library/react';
import { FeedPager } from './FeedPager';

describe('FeedPager', () => {
  it('offers the next page while there is one', () => {
    const onLoadMore = jest.fn();
    render(<FeedPager hasNextPage isFetchingNextPage={false} failed={false} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load more posts' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('says it is loading while the next page is on its way', () => {
    render(<FeedPager hasNextPage isFetchingNextPage failed={false} onLoadMore={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Loading more posts/ })).toBeDisabled();
  });

  it('a page that failed is reported as a failure with a retry, not as the end', () => {
    const onLoadMore = jest.fn();
    render(<FeedPager hasNextPage isFetchingNextPage={false} failed onLoadMore={onLoadMore} />);

    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('You are all caught up.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('says so when there is nothing more', () => {
    render(<FeedPager hasNextPage={false} isFetchingNextPage={false} failed={false} onLoadMore={jest.fn()} />);

    expect(screen.getByText('You are all caught up.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

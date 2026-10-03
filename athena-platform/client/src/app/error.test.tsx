import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * The page says the team was sent the error. That is only true if the error
 * reaches the error tracker, which this boundary used to skip (it wrote to the
 * browser console and nothing else), and only if the build has a tracker to
 * reach, so the page makes the claim only then.
 */

const captureException = jest.fn();
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

import ErrorBoundary from './error';

describe('the error boundary', () => {
  beforeEach(() => {
    captureException.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hands the error to the error tracker, once, as the same object', () => {
    const failure = Object.assign(new Error('render blew up'), { digest: 'abc123' });

    render(<ErrorBoundary error={failure} reset={() => undefined} />);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(failure);
  });

  describe('what the page says about who was told', () => {
    const env = process.env as Record<string, string | undefined>;
    const before = { NODE_ENV: env.NODE_ENV, dsn: env.NEXT_PUBLIC_SENTRY_DSN };

    afterEach(() => {
      env.NODE_ENV = before.NODE_ENV;
      if (before.dsn === undefined) delete env.NEXT_PUBLIC_SENTRY_DSN;
      else env.NEXT_PUBLIC_SENTRY_DSN = before.dsn;
    });

    it('does not claim the team was told when the build has no error tracker to tell', () => {
      env.NODE_ENV = 'production';
      delete env.NEXT_PUBLIC_SENTRY_DSN;

      render(<ErrorBoundary error={new Error('x')} reset={() => undefined} />);

      expect(screen.queryByText(/sent to our team|has been notified/i)).toBeNull();
      expect(screen.getByText(/let us know below/i)).toBeInTheDocument();
    });

    it('does not claim it outside production either, where Sentry is switched off', () => {
      env.NODE_ENV = 'test';
      env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/0';

      render(<ErrorBoundary error={new Error('x')} reset={() => undefined} />);

      expect(screen.queryByText(/sent to our team|has been notified/i)).toBeNull();
    });

    it('says the details were sent when a production build has a DSN', () => {
      env.NODE_ENV = 'production';
      env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/0';

      render(<ErrorBoundary error={new Error('x')} reset={() => undefined} />);

      expect(screen.getByText(/have been sent to our team/i)).toBeInTheDocument();
    });
  });

  describe('what the page shows of the error itself', () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;

    afterEach(() => {
      env.NODE_ENV = before;
    });

    it('shows her no part of it in production: not the message, not the digest', () => {
      env.NODE_ENV = 'production';
      const failure = Object.assign(new Error("SECRET: connect ECONNREFUSED db.internal:5432"), { digest: 'digest-4471' });

      const { container } = render(<ErrorBoundary error={failure} reset={() => undefined} />);

      expect(container.textContent).not.toMatch(/SECRET|ECONNREFUSED|db\.internal|digest-4471/);
    });

    it('shows the message in development, where whoever is building the page needs it', () => {
      env.NODE_ENV = 'development';

      render(<ErrorBoundary error={new Error('render blew up here')} reset={() => undefined} />);

      expect(screen.getByText('render blew up here')).toBeInTheDocument();
    });
  });

  it('lets her try again, which is the button she is offered', () => {
    const reset = jest.fn();
    render(<ErrorBoundary error={new Error('x')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The interview coach used to open every session with one of four fixed
 * sentences keyed by interview type, whatever role she typed, and graded her
 * answer against whatever message happened to be last on screen — which, when
 * a reply had no follow-up question, was the coach's own feedback. These guard
 * the opening question coming from the role, and each answer being marked
 * against the question she was actually asked.
 */

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));

jest.mock('../PremiumGate', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import InterviewCoachPage from './page';
import { api } from '@/lib/api';

const post = api.post as unknown as jest.Mock;

const QUESTIONS = [
  'How have you kept a ward safe when two nurses called in sick?',
  'Tell me about a medication error you caught before it reached a patient.',
];

function startWith(role: string) {
  render(<InterviewCoachPage />);
  fireEvent.change(screen.getByPlaceholderText(/Product Manager/), { target: { value: role } });
  fireEvent.click(screen.getByRole('button', { name: /Start Practice Session/ }));
}

function answer(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: text } });
  fireEvent.keyDown(screen.getByPlaceholderText(/Type your answer/), { key: 'Enter' });
}

describe('Interview coach', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens with a question written for the role she typed', async () => {
    post.mockResolvedValueOnce({ data: { success: true, data: { questions: QUESTIONS, tips: null, simulated: false } } });

    startWith('Registered Nurse');

    expect(await screen.findByText(QUESTIONS[0])).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/ai/interview-coach', { jobRole: 'Registered Nurse', interviewType: 'behavioral' });
    expect(screen.queryByText(/Tell me about a time when you faced a significant challenge/)).not.toBeInTheDocument();
  });

  it('does not start a session on a canned question when no model is connected', async () => {
    post.mockResolvedValueOnce({
      data: { success: true, data: { questions: ['Tell me about a time you faced a challenge.'], tips: null, simulated: true } },
    });

    startWith('Registered Nurse');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not connected to its AI model/);
    expect(screen.queryByText('Tell me about a time you faced a challenge.')).not.toBeInTheDocument();
  });

  it('marks each answer against the question asked, and moves to the next when there is no follow-up', async () => {
    post
      .mockResolvedValueOnce({ data: { success: true, data: { questions: QUESTIONS, tips: null, simulated: false } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            feedback: 'Clear escalation, but say what you did first.',
            analysis: { rating: null, strengths: ['Escalated early'], improvements: [] },
            nextQuestion: null,
            simulated: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            feedback: 'Good use of the double-check.',
            analysis: { rating: 4, strengths: [], improvements: [] },
            nextQuestion: null,
            simulated: false,
          },
        },
      });

    startWith('Registered Nurse');
    await screen.findByText(QUESTIONS[0]);

    answer('I rang the after-hours manager and split the rooms.');
    expect(await screen.findByText(QUESTIONS[1])).toBeInTheDocument();
    expect(post.mock.calls[1][1]).toEqual(expect.objectContaining({ question: QUESTIONS[0] }));
    // A missing rating is said in words, not drawn as five empty stars.
    expect(screen.getByText(/did not rate this answer/)).toBeInTheDocument();

    answer('I checked the chart against the order and held the dose.');
    await screen.findByText('Good use of the double-check.');
    // The second answer is marked against the second question, never against
    // the feedback text that preceded it.
    expect(post.mock.calls[2][1]).toEqual(expect.objectContaining({ question: QUESTIONS[1] }));

    await waitFor(() => expect(screen.getByPlaceholderText('No question to answer')).toBeDisabled());
  });
});

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Sparkles,
  User,
  Bot,
  Lightbulb,
  Target,
  Clock,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Mic,
  MicOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  feedback?: {
    rating: number;
    strengths: string[];
    improvements: string[];
  };
}

const interviewTypes = [
  { id: 'behavioral', name: 'Behavioral', icon: '🗣️' },
  { id: 'technical', name: 'Technical', icon: '💻' },
  { id: 'case', name: 'Case Study', icon: '📊' },
  { id: 'situational', name: 'Situational', icon: '🎯' },
];

const difficultyLevels = [
  { id: 'entry', name: 'Entry Level', description: 'For those new to interviewing' },
  { id: 'mid', name: 'Mid Level', description: '3-5 years of experience' },
  { id: 'senior', name: 'Senior Level', description: 'Leadership and strategic roles' },
];

export default function InterviewCoachPage() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [interviewType, setInterviewType] = useState('behavioral');
  const [difficulty, setDifficulty] = useState('mid');
  const [jobRole, setJobRole] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [recordedAnswerUrl, setRecordedAnswerUrl] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordedAnswerUrlRef = useRef<string | null>(null);

  useEffect(() => {
    recordedAnswerUrlRef.current = recordedAnswerUrl;
  }, [recordedAnswerUrl]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        try {
          recognition.stop();
        } catch {
          // Browser speech recognition may already be stopped.
        }
      }

      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stream.getTracks().forEach((track) => track.stop());
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }

      if (recordedAnswerUrlRef.current) {
        URL.revokeObjectURL(recordedAnswerUrlRef.current);
      }
    };
  }, []);

  const startSession = () => {
    if (!jobRole) return;

    const systemMessage: Message = {
      id: '1',
      role: 'system',
      content: `Interview session started for ${jobRole} position. Interview type: ${interviewType}, Difficulty: ${difficulty}`,
    };

    const firstQuestion: Message = {
      id: '2',
      role: 'assistant',
      content: getFirstQuestion(interviewType),
    };

    setMessages([systemMessage, firstQuestion]);
    setSessionStarted(true);
  };

  const getFirstQuestion = (type: string) => {
    const questions: Record<string, string> = {
      behavioral: "Let's start with a classic. Tell me about a time when you faced a significant challenge at work. How did you handle it, and what was the outcome?",
      technical: "Great, let's begin. Can you walk me through your technical background and describe a complex project you've worked on recently?",
      case: "Here's your first case study: A retail company is seeing declining in-store sales while their online presence grows. How would you approach analyzing and solving this problem?",
      situational: "Imagine you're leading a project and a key team member suddenly leaves mid-project. How would you handle this situation?",
    };
    return questions[type] || questions.behavioral;
  };

  const handleSend = () => {
    if (!input.trim() || isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    setIsPending(true);
    setCoachError(null);

    api
      .post('/ai/interview-coach/feedback', {
        question: messages[messages.length - 1]?.content || '',
        answer: input,
        jobRole,
        interviewType,
        difficulty,
      })
      .then((response) => {
        const data = response.data?.data || {};
        if (!data.feedback) {
          setCoachError('The coach completed but did not return feedback.');
          return;
        }

        const feedbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.feedback,
          feedback: data.analysis,
        };

        const nextMessages: Message[] = [feedbackMessage];
        if (data.nextQuestion) {
          nextMessages.push({
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: data.nextQuestion,
          });
        }

        setMessages((prev) => [...prev, ...nextMessages]);
      })
      .catch((error) => {
        setCoachError(
          error?.response?.data?.message ||
            'Interview feedback is unavailable right now. Please try again later.'
        );
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  const formatRecordingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopSpeechRecognition = () => {
    if (!recognitionRef.current) return;

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.stop();
    } catch {
      // Browser speech recognition may already be stopped.
    }
  };

  const startRecording = async () => {
    if (isRecording || isPending) return;

    setRecordingError(null);
    setRecordingStatus(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      if (recordedAnswerUrl) {
        URL.revokeObjectURL(recordedAnswerUrl);
        setRecordedAnswerUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          setRecordedAnswerUrl(URL.createObjectURL(blob));
        }
        stream.getTracks().forEach((track) => track.stop());
        recordingChunksRef.current = [];
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingStatus('Recording...');

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((previous) => previous + 1);
      }, 1000);

      const SpeechRecognitionConstructor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        setRecordingStatus('Recording audio. Speech transcription is not available in this browser.');
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index]?.[0]?.transcript || '';
          if (event.results[index].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          setInput((current) =>
            [current.trimEnd(), finalTranscript.trim()].filter(Boolean).join(' ')
          );
        }

        setRecordingStatus(
          interimTranscript.trim()
            ? `Listening: ${interimTranscript.trim()}`
            : 'Recording...'
        );
      };
      recognition.onerror = () => {
        setRecordingError('Speech transcription stopped. Your audio recording is still being captured.');
      };
      recognition.onend = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          setRecordingStatus('Recording audio. Speech transcription has stopped.');
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setRecordingError('Microphone access was blocked or unavailable.');
      clearRecordingTimer();
      setIsRecording(false);
    }
  };

  const stopRecording = ({ discard = false }: { discard?: boolean } = {}) => {
    clearRecordingTimer();
    stopSpeechRecognition();

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    if (recorder) {
      recorder.stream.getTracks().forEach((track) => track.stop());
      if (recorder.state !== 'inactive') {
        if (discard) {
          recorder.ondataavailable = null;
          recorder.onstop = null;
          recordingChunksRef.current = [];
        }
        recorder.stop();
      }
    }

    setIsRecording(false);
    setRecordingTime(0);
    if (!discard) {
      setRecordingStatus('Recording saved. Review the clip or send the transcribed answer.');
    }
  };

  const clearRecordedAnswer = () => {
    if (recordedAnswerUrl) {
      URL.revokeObjectURL(recordedAnswerUrl);
      setRecordedAnswerUrl(null);
    }
    setRecordingStatus(null);
    setRecordingError(null);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  if (!sessionStarted) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/ai"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span className="text-3xl">🎯</span>
              <span>Interview Coach</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Practice interviews with AI feedback
            </p>
          </div>
        </div>

        {/* Setup */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Set Up Your Practice Session
          </h2>

          {/* Job Role */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Job Role
            </label>
            <input
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g., Product Manager, Software Engineer, Marketing Director"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Interview Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Interview Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {interviewTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setInterviewType(type.id)}
                  className={cn(
                    'p-4 rounded-lg border-2 text-center transition',
                    interviewType === type.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <span className="text-2xl block mb-2">{type.icon}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {type.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Difficulty Level
            </label>
            <div className="grid md:grid-cols-3 gap-3">
              {difficultyLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setDifficulty(level.id)}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition',
                    difficulty === level.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <span className="font-medium text-slate-900 dark:text-white block">
                    {level.name}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={!jobRole}
            className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Start Practice Session</span>
          </button>
        </div>

        {/* Tips */}
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>Interview Tips</span>
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>• Use the STAR method (Situation, Task, Action, Result) for behavioral questions</li>
            <li>• Be specific with examples and quantify your achievements when possible</li>
            <li>• Practice speaking your answers out loud, not just typing</li>
            <li>• Take your time to think before answering - it's okay to pause</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSessionStarted(false)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Interview Practice: {jobRole}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {interviewTypes.find((t) => t.id === interviewType)?.name} Interview • {difficultyLevels.find((d) => d.id === difficulty)?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-sm text-slate-500 dark:text-slate-400">
            <Clock className="w-4 h-4 mr-1" />
            {Math.floor(messages.filter((m) => m.role === 'user').length)} answers
          </span>
          <button
            onClick={() => {
              setSessionStarted(false);
              setMessages([]);
            }}
            className="btn-outline text-sm py-1.5"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 card bg-slate-50 dark:bg-slate-900">
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'system' ? (
              <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                {message.content}
              </div>
            ) : (
              <div
                className={cn(
                  'flex items-start space-x-3',
                  message.role === 'user' && 'flex-row-reverse space-x-reverse'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    message.role === 'user'
                      ? 'bg-primary-500'
                      : 'bg-purple-500'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg p-4',
                    message.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  )}
                >
                  <p className={message.role === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}>
                    {message.content}
                  </p>

                  {/* Feedback Section */}
                  {message.feedback && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          Performance Rating:
                        </span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={cn(
                                'text-lg',
                                star <= message.feedback!.rating
                                  ? 'text-yellow-500'
                                  : 'text-slate-300'
                              )}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1 flex items-center">
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Strengths
                          </p>
                          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                            {message.feedback.strengths.map((s, i) => (
                              <li key={i}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1 flex items-center">
                            <ThumbsDown className="w-4 h-4 mr-1" />
                            Improvements
                          </p>
                          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                            {message.feedback.improvements.map((s, i) => (
                              <li key={i}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isPending && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing your response...</span>
              </div>
            </div>
          </div>
        )}

        {coachError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {coachError}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="card">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your answer... (Press Enter to send)"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <button
              onClick={toggleRecording}
              disabled={isPending}
              className={cn(
                'p-3 rounded-lg transition',
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
                isPending && 'cursor-not-allowed opacity-50'
              )}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isPending}
              className="p-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        {(isRecording || recordingStatus) && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>{recordingStatus}</span>
              {isRecording && (
                <span className="font-mono text-red-500">
                  {formatRecordingTime(recordingTime)}
                </span>
              )}
            </div>
          </div>
        )}
        {recordingError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {recordingError}
          </p>
        )}
        {recordedAnswerUrl && !isRecording && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Volume2 className="h-4 w-4" />
              Recorded answer
            </div>
            <audio controls src={recordedAnswerUrl} className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={clearRecordedAnswer}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          💡 Tip: Use specific examples and structure your answers with the STAR method
        </p>
      </div>
    </div>
  );
}

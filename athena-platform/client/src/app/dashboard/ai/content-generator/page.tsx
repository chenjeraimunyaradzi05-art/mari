'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  Linkedin,
  Twitter,
  FileText,
  Mail,
  MessageSquare,
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import { useContentGenerator } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const contentTypes = [
  {
    id: 'linkedin',
    name: 'LinkedIn Post',
    icon: Linkedin,
    description: 'Professional posts for your network',
    maxLength: 3000,
  },
  {
    id: 'twitter',
    name: 'Twitter/X Thread',
    icon: Twitter,
    description: 'Engaging threads that spark conversation',
    maxLength: 280,
  },
  {
    id: 'bio',
    name: 'Professional Bio',
    icon: FileText,
    description: 'Compelling bios for any platform',
    maxLength: 500,
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Professional emails that get responses',
    maxLength: 2000,
  },
  {
    id: 'pitch',
    name: 'Elevator Pitch',
    icon: MessageSquare,
    description: 'Concise pitches for networking',
    maxLength: 300,
  },
];

const tones = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'confident', name: 'Confident' },
  { id: 'inspiring', name: 'Inspiring' },
  { id: 'casual', name: 'Casual' },
  { id: 'formal', name: 'Formal' },
];

export default function ContentGeneratorPage() {
  const [contentType, setContentType] = useState('linkedin');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);

  const { mutate: generateContent, isPending } = useContentGenerator();

  const handleGenerate = () => {
    if (!topic.trim()) return;

    generateContent(
      { type: contentType, topic, tone, context: additionalContext },
      {
        onSuccess: (data) => {
          setGeneratedContent(data.content || generateMockContent());
          setVariations(data.variations || []);
          setSelectedVariation(0);
        },
        onError: () => {
          setGeneratedContent(generateMockContent());
          setVariations([]);
        },
      }
    );
  };

  const generateMockContent = () => {
    const mockContents: Record<string, string> = {
      linkedin: `🚀 Exciting news to share!

I recently had a transformative experience that reminded me why I love what I do.

${topic}

Here's what I learned:

1️⃣ The power of persistence - Every setback is a setup for a comeback
2️⃣ Community matters - Surround yourself with people who lift you up
3️⃣ Growth is continuous - There's always room to learn and improve

What's one lesson that shaped your career journey? I'd love to hear your stories! 👇

#CareerGrowth #Leadership #ProfessionalDevelopment`,

      twitter: `Thread 🧵

${topic}

Here's what I learned:

1/ First, understand that success rarely happens overnight. It's the small, consistent actions that compound over time.

2/ Second, your network is your net worth. Invest in genuine relationships, not just connections.

3/ Third, embrace failure as feedback. Every setback teaches you something valuable.

4/ Finally, bet on yourself. You're capable of more than you think.

What would you add to this list?`,

      bio: `${topic.split(' ').slice(0, 3).join(' ')} professional with a passion for driving meaningful impact. I specialize in transforming challenges into opportunities and building high-performing teams.

With experience spanning multiple industries, I bring a unique perspective to every project. I believe in the power of collaboration, continuous learning, and leading with empathy.

When I'm not working, you'll find me mentoring aspiring professionals, exploring new ideas, or advocating for diversity in the workplace.`,

      email: `Subject: ${topic}

Hi [Name],

I hope this message finds you well. I wanted to reach out regarding ${topic}.

I've been following your work and believe there's a great opportunity for us to collaborate. Your expertise in this area aligns perfectly with what we're trying to achieve.

Would you be open to a brief 15-minute call next week to explore this further? I'm flexible on timing and happy to work around your schedule.

Looking forward to hearing from you.

Best regards,
[Your Name]`,

      pitch: `I help ${topic} by combining strategic thinking with hands-on execution. In my career, I've consistently delivered results that exceed expectations - from leading cross-functional teams to launching products that delight users.

What sets me apart is my ability to see the big picture while never losing sight of the details. I'm passionate about creating impact and always eager to take on new challenges.

Let's connect and explore how I can bring value to your team.`,
    };

    return mockContents[contentType] || mockContents.linkedin;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedType = contentTypes.find((t) => t.id === contentType);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/ai"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <span className="text-3xl">✍️</span>
            <span>Content Generator</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered content creation for professional communication
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Content Type */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Content Type
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contentTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setContentType(type.id)}
                  className={cn(
                    'flex items-start space-x-3 p-4 rounded-lg border-2 text-left transition',
                    contentType === type.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <type.icon
                    className={cn(
                      'w-5 h-5 mt-0.5',
                      contentType === type.id
                        ? 'text-primary-500'
                        : 'text-gray-400'
                    )}
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white block">
                      {type.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {type.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Topic or Key Message
            </h2>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., I just got promoted to Senior Product Manager and want to share my journey..."
              className="w-full h-24 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Tone */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Tone
            </h2>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm transition',
                    tone === t.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Context */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Additional Context (Optional)
            </h2>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any specific points you want to include, your industry, target audience, etc."
              className="w-full h-20 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || isPending}
            className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Generate Content</span>
              </>
            )}
          </button>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          {!generatedContent && !isPending ? (
            <div className="card h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Ready to Create
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Select a content type, enter your topic, and let AI craft the
                perfect message for you
              </p>
            </div>
          ) : isPending ? (
            <div className="card h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Wand2 className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Creating Your Content
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Crafting the perfect {selectedType?.name.toLowerCase()}...
              </p>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    {selectedType && <selectedType.icon className="w-5 h-5 text-primary-500" />}
                    <span>{selectedType?.name}</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleGenerate}
                      className="btn-outline text-sm py-1.5 flex items-center space-x-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Regenerate</span>
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="btn-primary text-sm py-1.5 flex items-center space-x-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {generatedContent}
                  </pre>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{generatedContent.length} characters</span>
                  {selectedType && generatedContent.length > selectedType.maxLength && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Exceeds recommended length of {selectedType.maxLength}
                    </span>
                  )}
                </div>
              </div>

              {/* Variations */}
              {variations.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Alternative Variations
                  </h3>
                  <div className="space-y-2">
                    {variations.map((variation, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setGeneratedContent(variation);
                          setSelectedVariation(index);
                        }}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border transition',
                          selectedVariation === index
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <span className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {variation}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <span>Content Tips</span>
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <p className="font-medium mb-1">LinkedIn Best Practices</p>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400">
              <li>• Use emojis sparingly for visual breaks</li>
              <li>• End with a question to encourage engagement</li>
              <li>• Include relevant hashtags (3-5 max)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Email Best Practices</p>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400">
              <li>• Keep subject lines under 50 characters</li>
              <li>• Get to the point in the first paragraph</li>
              <li>• Include a clear call-to-action</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

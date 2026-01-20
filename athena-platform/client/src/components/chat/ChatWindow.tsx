import React, { useState, useRef, useEffect } from 'react';
import { useMessages, useSendMessage } from '@/lib/hooks';
import { useAuthStore } from '@/lib/store';
import { useChatStore, ChatMessage as StoreMessage } from '@/lib/stores/chat.store';
import { format } from 'date-fns';
import { Paperclip, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatWindowProps {
  conversationId: string;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { data: apiMessages, isLoading } = useMessages(conversationId);
  const sendMessageMutation = useSendMessage();
  const { user } = useAuthStore();
  const { messages: storeMessages, setMessages, addMessage, setActiveConversation, markConversationAsRead } = useChatStore();
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMessages = storeMessages[conversationId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  useEffect(() => {
    setActiveConversation(conversationId);
    markConversationAsRead(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, markConversationAsRead, setActiveConversation]);

  // Sync API messages to Store
  useEffect(() => {
    if (apiMessages) {
       const mappedMessages: StoreMessage[] = apiMessages.map((m: { id: string; senderId: string; content: string; createdAt: string }) => ({
           id: m.id,
           senderId: m.senderId,
           content: m.content,
           createdAt: m.createdAt,
           type: 'text' as const,
           status: 'read' as const, // History is assumed read/delivered
       }));
       setMessages(conversationId, mappedMessages);
    }
  }, [apiMessages, conversationId, setMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;

    try {
      // Optimistic update could go here, but let's wait for success or socket
      const sentMessage = await sendMessageMutation.mutateAsync({ 
        receiverId: conversationId, 
        content: newMessage 
      });
      setNewMessage('');
      setAttachments([]);
      
      // Manually add to store if socket doesn't arrive first (deduplication in store handles race)
      if (sentMessage) {
          addMessage(conversationId, {
              id: sentMessage.data?.id || crypto.randomUUID(),
              senderId: user?.id || '',
              content: newMessage,
              createdAt: new Date().toISOString(),
              type: 'text',
              status: 'sent'
          });
      }
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading && currentMessages.length === 0) {
    return <div className="flex-1 flex items-center justify-center h-full">Loading messages...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentMessages.map((message) => {
          const isMe = message.senderId === user?.id;
          return (
            <div
              key={message.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                <div className={`text-xs mt-1 flex items-center gap-2 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                  <span>{format(new Date(message.createdAt), 'h:mm a')}</span>
                  {isMe && message.status && (
                    <span className="uppercase tracking-wide">
                      {message.status === 'sending' ? 'Sending' : message.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4">
        {attachments.length > 0 && (
          <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {attachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  aria-label="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Attach files"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              aria-label="Message"
            />
          </div>
          <Button
            type="submit"
            disabled={(!newMessage.trim() && attachments.length === 0) || sendMessageMutation.isPending}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useHelpContext } from '@/context/HelpContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, ThumbsUp, ThumbsDown, ExternalLink, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  actions?: SuggestedAction[]
  confidence?: number
  interactionId?: string
}

interface Source {
  docId: string
  title: string
  excerpt: string
  similarity: number
}

interface SuggestedAction {
  label: string
  path: string
}

interface AiHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiHelpDialog({ open, onOpenChange }: AiHelpDialogProps) {
  const { scope } = useHelpContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/help/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: input,
          context: scope,
          conversationHistory: messages.slice(-6), // Last 3 turns
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        actions: data.suggestedActions,
        confidence: data.confidence,
        interactionId: data.interactionId,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Help chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again or visit the user guide at /guide.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = async (message: Message, feedback: 'positive' | 'negative') => {
    if (!message.interactionId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await fetch('/api/help/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          interactionId: message.interactionId,
          feedback,
        }),
      })

      // Update local state to show feedback was recorded
      setMessages((prev) =>
        prev.map((m) =>
          m.interactionId === message.interactionId
            ? { ...m, feedbackGiven: feedback }
            : m
        )
      )
    } catch (error) {
      console.error('Feedback error:', error)
    }
  }

  const quickQuestions = [
    'How do I register a delegate?',
    'How do I create a new project?',
    'How do I import BCI data?',
    'What are the user roles?',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="w-5 h-5 text-primary" />
            Platform Help Assistant
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Powered by Claude AI • Ask me anything about using the platform
          </p>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Ask me about any feature or workflow in the platform
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {quickQuestions.map((question, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-left justify-start h-auto py-3 px-4"
                    onClick={() => setInput(question)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
                    <span className="text-sm">{question}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg p-4',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                )}
              >
                {/* Message Content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Confidence Indicator (low confidence warning) */}
                {msg.role === 'assistant' && msg.confidence !== undefined && msg.confidence < 0.7 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      ⚠️ Low confidence answer - please verify in the documentation
                    </p>
                  </div>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs font-medium mb-2 opacity-80">Sources:</p>
                    <div className="space-y-1">
                      {msg.sources.map((source, i) => (
                        <div key={i} className="text-xs opacity-75">
                          • {source.title} ({Math.round(source.similarity * 100)}% match)
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium mb-2">Quick Actions:</p>
                    {msg.actions.map((action, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => {
                          window.location.href = action.path
                          onOpenChange(false)
                        }}
                      >
                        {action.label}
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    ))}
                  </div>
                )}

                {/* Feedback Buttons */}
                {msg.role === 'assistant' && msg.interactionId && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs opacity-75 mr-2">Was this helpful?</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 px-2',
                        (msg as any).feedbackGiven === 'positive' && 'bg-green-100 dark:bg-green-900'
                      )}
                      onClick={() => handleFeedback(msg, 'positive')}
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 px-2',
                        (msg as any).feedbackGiven === 'negative' && 'bg-red-100 dark:bg-red-900'
                      )}
                      onClick={() => handleFeedback(msg, 'negative')}
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question... (Press Enter to send, Shift+Enter for new line)"
              className="resize-none min-h-[60px]"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="shrink-0 h-[60px] w-[60px]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI responses are based on platform documentation. Always verify critical information.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

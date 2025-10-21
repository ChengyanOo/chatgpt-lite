const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3000'

export interface ChatMessage {
  role: string
  content: string
}

export interface CreateChatHistoryPayload {
  sessionId: string
  userId?: number
  countryCode?: string
  systemPrompt: string
  messages: ChatMessage[]
  userIp?: string
  userAgent?: string
  metadata?: Record<string, any>
}

export interface ChatHistoryResponse {
  id: number
  sessionId: string
  userId?: number
  countryCode?: string
  systemPrompt: string
  messages: ChatMessage[]
  userIp?: string
  userAgent?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export class ChatHistoryService {
  private static baseUrl = `${BACKEND_API_URL}/chat-history`

  /**
   * Save chat history to backend
   */
  static async saveChatHistory(
    payload: CreateChatHistoryPayload
  ): Promise<ChatHistoryResponse> {
    try {
      console.log('💾 Saving chat history to:', this.baseUrl)
      console.log('📦 Payload:', {
        sessionId: payload.sessionId,
        messageCount: payload.messages.length,
        countryCode: payload.countryCode
      })

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Failed to save chat history:', error)
        throw new Error(error.message || 'Failed to save chat history')
      }

      const result = await response.json()
      console.log('✅ Chat history saved successfully! ID:', result.id)
      return result
    } catch (error) {
      console.error('❌ Error saving chat history:', error)
      // Don't throw - we don't want to break the chat if history saving fails
      return null as any
    }
  }

  /**
   * Get chat history by session ID
   */
  static async getChatHistoryBySession(
    sessionId: string
  ): Promise<ChatHistoryResponse[]> {
    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch chat history')
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching chat history:', error)
      return []
    }
  }
}

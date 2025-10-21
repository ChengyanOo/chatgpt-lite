export interface ChatMessage {
  content: string
  role: ChatRole
}

export interface Chat {
  id: string
  messages?: ChatMessage[]
}

export type ChatRole = 'assistant' | 'user' | 'system'

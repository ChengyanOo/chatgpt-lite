'use client'

import { createContext, MutableRefObject } from 'react'
import { Chat, ChatMessage } from './interface'

const ChatContext = createContext<{
  currentChatRef?: MutableRefObject<Chat | undefined>
  chatList: Chat[]
  toggleSidebar?: boolean
  setCurrentChat?: (chat: Chat) => void
  onDeleteChat?: (chat: Chat) => void
  onCreateChat?: () => void
  onChangeChat?: (chat: Chat) => void
  saveMessages?: (messages: ChatMessage[]) => void
  onToggleSidebar?: () => void
  forceUpdate?: () => void
}>({
  chatList: []
})

export default ChatContext

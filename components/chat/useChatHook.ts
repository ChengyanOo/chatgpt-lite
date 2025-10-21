'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ChatGPInstance } from './chat'
import { Chat, ChatMessage } from './interface'

enum StorageKeys {
  Chat_List = 'chatList',
  Chat_Current_ID = 'chatCurrentID',
  Sidebar_Toggle = 'sidebarToggle'
}

let isInit = false

const useChatHook = () => {
  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const messagesMap = useRef<Map<string, ChatMessage[]>>(new Map<string, ChatMessage[]>())
  const chatRef = useRef<ChatGPInstance>(null)
  const currentChatRef = useRef<Chat | undefined>(undefined)
  const [chatList, setChatList] = useState<Chat[]>([])
  const [toggleSidebar, setToggleSidebar] = useState<boolean>(() => {
    // Initialize from localStorage, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(StorageKeys.Sidebar_Toggle)
      return saved !== null ? JSON.parse(saved) : true
    }
    return true
  })

  const onChangeChat = useCallback((chat: Chat) => {
    const oldMessages = chatRef.current?.getConversation() || []
    const newMessages = messagesMap.current.get(chat.id) || []
    chatRef.current?.setConversation(newMessages)
    chatRef.current?.focus()
    if (currentChatRef.current?.id) {
      messagesMap.current.set(currentChatRef.current?.id, oldMessages)
    }
    currentChatRef.current = chat
    forceUpdate()
  }, [])

  const onCreateChat = useCallback(() => {
    const id = uuid()
    const newChat: Chat = {
      id
    }
    setChatList((state) => [...state, newChat])
    onChangeChat(newChat)
  }, [setChatList, onChangeChat])

  const onToggleSidebar = useCallback(() => {
    setToggleSidebar((state) => {
      const newState = !state
      localStorage.setItem(StorageKeys.Sidebar_Toggle, JSON.stringify(newState))
      return newState
    })
  }, [])

  const onDeleteChat = useCallback((chat: Chat) => {
    setChatList((prevList) => {
      const newList = prevList.filter((item) => item.id !== chat.id)
      localStorage.removeItem(`ms_${chat.id}`)
      messagesMap.current.delete(chat.id)
      if (currentChatRef.current?.id === chat.id) {
        if (newList.length > 0) {
          currentChatRef.current = newList[0]
          const newMessages = messagesMap.current.get(newList[0].id) || []
          chatRef.current?.setConversation(newMessages)
          chatRef.current?.focus()
        } else {
          currentChatRef.current = undefined
        }
      }
      return newList
    })
  }, [])

  const saveMessages = (messages: ChatMessage[]) => {
    if (messages.length > 0) {
      localStorage.setItem(`ms_${currentChatRef.current?.id}`, JSON.stringify(messages))
    } else {
      localStorage.removeItem(`ms_${currentChatRef.current?.id}`)
    }
  }

  useEffect(() => {
    const chatList = (JSON.parse(localStorage.getItem(StorageKeys.Chat_List) || '[]') ||
      []) as Chat[]
    const currentChatId = localStorage.getItem(StorageKeys.Chat_Current_ID)
    if (chatList.length > 0) {
      const currentChat = chatList.find((chat) => chat.id === currentChatId)
      setChatList(chatList)

      chatList.forEach((chat) => {
        const messages = JSON.parse(localStorage.getItem(`ms_${chat?.id}`) || '[]') as ChatMessage[]
        messagesMap.current.set(chat.id!, messages)
      })

      onChangeChat(currentChat || chatList[0])
    } else {
      onCreateChat()
    }

    return () => {
      document.body.removeAttribute('style')
      localStorage.setItem(StorageKeys.Chat_List, JSON.stringify(chatList))
    }
  }, [])

  useEffect(() => {
    if (currentChatRef.current?.id) {
      localStorage.setItem(StorageKeys.Chat_Current_ID, currentChatRef.current.id)
    }
  }, [chatList, currentChatRef.current?.id])

  useEffect(() => {
    localStorage.setItem(StorageKeys.Chat_List, JSON.stringify(chatList))
  }, [chatList])

  return {
    chatRef,
    currentChatRef,
    chatList,
    toggleSidebar,
    onCreateChat,
    onDeleteChat,
    onChangeChat,
    saveMessages,
    onToggleSidebar,
    forceUpdate
  }
}

export default useChatHook

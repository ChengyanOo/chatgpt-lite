'use client'
import { Suspense } from 'react'
import { Chat, ChatContext, SideBar, useChatHook } from '@/components/chat'
import { Header } from '@/components/header'

const ChatProvider = () => {
  const provider = useChatHook()

  return (
    <ChatContext.Provider value={provider}>
      <div className="h-full flex flex-col bg-background">
        <Header />
        <div className="relative flex-1 flex overflow-hidden">
          <SideBar />
          <div className="flex-1 relative transition-all duration-300">
            <Chat ref={provider.chatRef} />
          </div>
        </div>
      </div>
    </ChatContext.Provider>
  )
}

const ChatPage = () => {
  return (
    <Suspense>
      <ChatProvider />
    </Suspense>
  )
}

export default ChatPage

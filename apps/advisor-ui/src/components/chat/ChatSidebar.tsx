import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, Loader2, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/chat.store';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export function ChatSidebar() {
  const router = useRouter();
  const { clearMessages, setSessionId, setMessages, sessionId } = useChatStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch recent conversations list
  const fetchConversations = async () => {
    try {
      const data = await apiClient.get<any[]>('/chat/conversations');
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to fetch recent chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [sessionId]); // Re-fetch list if active session ID changes

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/chat/conversations/${convId}`);
      if (sessionId === convId) {
        clearMessages();
        router.push('/chat');
      }
      fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Format dynamic relative times
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      if (diffMs < 0) return 'Just now';
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 60) {
        return diffMins <= 0 ? 'Just now' : `${diffMins}m ago`;
      }
      
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) {
        return `${diffHrs}h ago`;
      }
      
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  // Load selected past conversation
  const handleSelectConversation = async (convId: string) => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/chat/conversations/${convId}`);
      if (data) {
        setSessionId(data.sessionId);
        setMessages(data.messages || []);
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter conversations based on search text
  const filteredChats = conversations.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 border-r border-border bg-slate-50 dark:bg-slate-900 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border space-y-4">
        <button
          onClick={() => {
            clearMessages();
            router.push('/chat');
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-md active:scale-98"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          New chat
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">
          Recents
        </h3>
        
        {loading && conversations.length === 0 ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 italic">
            {searchQuery ? 'No matching chats' : 'No recent chats'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredChats.map((chat) => {
              const isActive = sessionId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={`relative w-full text-left rounded-xl transition-all group border ${
                    isActive 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400' 
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800/60 border-transparent text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <button
                    onClick={() => handleSelectConversation(chat.id)}
                    className="w-full text-left px-3 py-2 rounded-xl"
                  >
                    <div className={`text-sm font-semibold truncate pr-6 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                      {chat.title}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatTime(chat.time)}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(chat.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                    title="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

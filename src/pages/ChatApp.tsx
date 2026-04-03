import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { LogOut, Phone, Send, User as UserIcon, Settings, Menu, MessageSquare } from 'lucide-react';
import VoiceCall from '../components/VoiceCall';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface Chat {
  id: string;
  participants: string[];
  updatedAt: any;
  lastMessage?: string;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export default function ChatApp() {
  const { user, logout, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch all users
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: UserData[] = [];
      snapshot.forEach((doc) => {
        if (doc.data().uid !== user.uid) {
          usersData.push(doc.data() as UserData);
        }
      });
      setUsers(usersData);
    });

    // Fetch user's chats
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const chatsUnsub = onSnapshot(q, (snapshot) => {
      const chatsData: Chat[] = [];
      snapshot.forEach((doc) => {
        chatsData.push({ id: doc.id, ...doc.data() } as Chat);
      });
      // Sort by updatedAt descending
      chatsData.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChats(chatsData);
    });

    return () => {
      usersUnsub();
      chatsUnsub();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', selectedChat.id),
      orderBy('createdAt', 'asc')
    );

    const msgsUnsub = onSnapshot(q, (snapshot) => {
      const msgsData: Message[] = [];
      snapshot.forEach((doc) => {
        msgsData.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgsData);
      scrollToBottom();
    });

    return () => msgsUnsub();
  }, [selectedChat]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const startChat = async (otherUser: UserData) => {
    if (!user) return;
    
    // Check if chat already exists
    const existingChat = chats.find(c => c.participants.includes(otherUser.uid));
    if (existingChat) {
      setSelectedChat(existingChat);
      setSelectedUser(otherUser);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      return;
    }

    // Create new chat
    try {
      const newChatRef = doc(collection(db, 'chats'));
      const newChat = {
        participants: [user.uid, otherUser.uid],
        updatedAt: serverTimestamp(),
      };
      await setDoc(newChatRef, newChat);
      setSelectedChat({ id: newChatRef.id, ...newChat } as Chat);
      setSelectedUser(otherUser);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (err) {
      console.error("Error creating chat", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        chatId: selectedChat.id,
        senderId: user.uid,
        text,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, 'chats', selectedChat.id), {
        updatedAt: serverTimestamp(),
        lastMessage: text
      }, { merge: true });
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  const getOtherUser = (chat: Chat) => {
    if (!user) return null;
    const otherUid = chat.participants.find(uid => uid !== user.uid);
    return users.find(u => u.uid === otherUid);
  };

  const updateProfilePic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        photoURL: profilePicUrl
      }, { merge: true });
      setIsProfileModalOpen(false);
      setProfilePicUrl('');
    } catch (err) {
      console.error("Error updating profile pic", err);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-30 w-80 h-full bg-neutral-900/50 backdrop-blur-2xl border-r border-white/10 transition-transform duration-300 flex flex-col`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg border border-white/20 hover:opacity-80 transition-opacity overflow-hidden"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold">{user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}</span>
              )}
            </button>
            <div>
              <div className="font-medium text-sm">{user?.displayName || 'User'}</div>
              <div className="text-xs text-neutral-400">Online</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => window.location.href = '/admin'} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Conversations
          </div>
          {users.map(u => {
            const chat = chats.find(c => c.participants.includes(u.uid));
            const isSelected = selectedUser?.uid === u.uid;
            
            return (
              <button
                key={u.uid}
                onClick={() => startChat(u)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                  isSelected ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center border border-white/5">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.displayName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="font-medium text-neutral-300">{u.displayName?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="font-medium truncate">{u.displayName || u.email}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {chat?.lastMessage || 'Start a conversation'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10 h-full">
        {selectedChat && selectedUser ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  className="lg:hidden p-2 -ml-2 hover:bg-white/10 rounded-full"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center border border-white/10">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="font-medium">{selectedUser.displayName?.charAt(0).toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h2 className="font-semibold">{selectedUser.displayName || selectedUser.email}</h2>
                  <p className="text-xs text-green-400">Online</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsCallActive(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all text-sm font-medium"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">AI Call</span>
              </button>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, index) => {
                const isMine = msg.senderId === user?.uid;
                const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-3`}
                  >
                    {!isMine && showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 mt-auto">
                        <span className="text-xs font-medium">{selectedUser.displayName?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    {!isMine && !showAvatar && <div className="w-8 shrink-0" />}
                    
                    <div className={`max-w-[70%] ${isMine ? 'order-1' : 'order-2'}`}>
                      <div 
                        className={`px-5 py-3 rounded-2xl ${
                          isMine 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-sm shadow-lg shadow-blue-500/20' 
                            : 'bg-white/10 backdrop-blur-md border border-white/5 text-white rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                      <div className={`text-[10px] text-neutral-500 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
                        {msg.createdAt ? format(msg.createdAt.toDate(), 'h:mm a') : 'Sending...'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 backdrop-blur-xl border-t border-white/10 shrink-0">
              <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message..."
                  className="w-full bg-black/40 border border-white/10 rounded-full pl-6 pr-14 py-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="absolute right-2 w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white flex items-center justify-center transition-all"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <MessageSquare className="w-10 h-10 text-neutral-600" />
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Liquid Chat</h2>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      {/* Voice Call Modal */}
      {isCallActive && <VoiceCall onClose={() => setIsCallActive(false)} />}

      {/* Profile Pic Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-neutral-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-semibold mb-4">Update Profile Picture</h2>
              <form onSubmit={updateProfilePic} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1 ml-1">Image URL</label>
                  <input
                    type="url"
                    value={profilePicUrl}
                    onChange={(e) => setProfilePicUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    required
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-medium"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

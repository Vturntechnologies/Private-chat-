import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, secondaryAuth } from '../firebase';
import { Users, UserPlus, LogOut, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

export default function AdminPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: UserData[] = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data() as UserData);
      });
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    return () => unsub();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create user using secondary auth to prevent logging out admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      // Add to Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        displayName: displayName,
        photoURL: '',
        role: 'user',
        createdAt: serverTimestamp()
      });

      // Sign out secondary auth
      await secondaryAuth.signOut();

      setSuccess('User created successfully!');
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: any) {
      console.error("Create user error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please use a different email.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Failed to create user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Go to Chat
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-xl transition-all text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create User Form */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-medium">Create New User</h2>
              </div>

              {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">{success}</div>}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1 ml-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1 ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1 ml-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-4 py-3 font-medium transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Users List */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 h-full min-h-[500px]">
              <h2 className="text-lg font-medium mb-6">Registered Users</h2>
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={u.uid} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-sm font-medium border border-white/10">
                        {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.displayName || 'No Name'}</div>
                        <div className="text-xs text-neutral-400">{u.email}</div>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium border border-white/5">
                      {u.role}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-12 text-neutral-500">
                    No users found.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

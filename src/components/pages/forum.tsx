'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ForumPost, ForumReply, ForumCategory, hydrateForumPost } from '@/lib/types';
import { FORUM_CATEGORIES } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { canPostAnnouncement } from '@/lib/roles';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { TitleBadges } from '@/components/ui/title-badges';
import { v4 as uuidv4 } from 'uuid';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const categoryColors: Record<ForumCategory, 'default' | 'success' | 'warning' | 'info' | 'gold'> = {
  Announcement: 'gold',
  Proposal: 'warning',
  Opportunity: 'info',
  Observation: 'info',
  Question: 'default',
  Report: 'success',
  General: 'default',
};

export function ForumContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');

  const canAnnounce = canPostAnnouncement(user);
  const postableCategories = FORUM_CATEGORIES.filter(c => c !== 'Announcement' || canAnnounce);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<ForumCategory>('General');
  const [reply, setReply] = useState('');

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc')),
      (snap) => {
        setPosts(snap.docs.map(d => hydrateForumPost(d.id, d.data())));
        setLoading(false);
      }
    );
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (category === 'Announcement' && !canAnnounce) {
      showToast('Only office bearers can post announcements', 'error');
      return;
    }
    if (!title.trim() || !body.trim()) {
      showToast('Title and body required', 'error');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'forumPosts'), {
        title: title.trim(),
        body: body.trim(),
        category,
        pinned: category === 'Announcement',
        authorId: user.id,
        authorName: user.name,
        authorTitles: user.titles ?? [],
        replies: [],
        createdAt: Date.now(),
      });
      showToast(category === 'Announcement' ? 'Announcement posted' : 'Post created');
      setShowNewPost(false);
      setTitle('');
      setBody('');
      setCategory('General');
    } catch {
      showToast('Failed to create post', 'error');
    }
    setSaving(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !reply.trim()) return;
    setSaving(true);
    try {
      const newReply: ForumReply = {
        id: uuidv4(),
        body: reply.trim(),
        authorId: user.id,
        authorName: user.name,
        authorTitles: user.titles ?? [],
        createdAt: Date.now(),
      };
      await updateDoc(doc(db, 'forumPosts', selectedPost.id), { replies: arrayUnion(newReply) });
      setReply('');
      setSelectedPost(prev => prev ? { ...prev, replies: [...(prev.replies || []), newReply] } : null);
      showToast('Reply posted');
    } catch {
      showToast('Failed to reply', 'error');
    }
    setSaving(false);
  };

  if (loading) return <Loading />;

  const filteredPosts = (filter === 'All' ? posts : posts.filter(p => p.category === filter))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-stone-800">Forum</h2>
        <Button onClick={() => setShowNewPost(true)} size="sm">+ New Post</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {['All', ...FORUM_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors
              ${filter === cat ? 'bg-amber-700 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <EmptyState title="No posts" description={filter === 'All' ? 'Start a discussion' : `No ${filter} posts yet`} />
      ) : (
        <div className="space-y-2">
          {filteredPosts.map(post => (
            <Card key={post.id}>
              <div className="cursor-pointer" onClick={() => { setSelectedPost(post); setShowThread(true); }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {post.pinned && <Badge variant="gold">📌 Pinned</Badge>}
                      <Badge variant={categoryColors[post.category]}>{post.category}</Badge>
                      <TitleBadges titles={post.authorTitles} />
                    </div>
                    <p className="font-medium text-stone-800 mt-1">{post.title}</p>
                    <p className="text-sm text-stone-500 line-clamp-2">{post.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
                      <span>{post.authorName}</span>
                      <span>·</span>
                      <span>{timeAgo(post.createdAt)}</span>
                      <span>·</span>
                      <span>{(post.replies || []).length} replies</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showThread} onClose={() => { setShowThread(false); setSelectedPost(null); }} title="Discussion" size="lg">
        {selectedPost && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={categoryColors[selectedPost.category]}>{selectedPost.category}</Badge>
                <TitleBadges titles={selectedPost.authorTitles} />
              </div>
              <h3 className="text-lg font-bold text-stone-800 mt-1">{selectedPost.title}</h3>
              <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{selectedPost.body}</p>
              <p className="text-xs text-stone-400 mt-2">{selectedPost.authorName} · {timeAgo(selectedPost.createdAt)}</p>
            </div>

            {(selectedPost.replies || []).length > 0 && (
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <p className="text-sm font-medium text-stone-600">{selectedPost.replies.length} Replies</p>
                {selectedPost.replies.map(r => (
                  <div key={r.id} className="bg-stone-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-medium text-stone-600">{r.authorName}</span>
                      <TitleBadges titles={r.authorTitles} />
                    </div>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{r.body}</p>
                    <p className="text-xs text-stone-400 mt-1">{timeAgo(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleReply} className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder={selectedPost.category === 'Announcement' ? 'Reply to leadership...' : 'Write a reply...'}
                value={reply}
                onChange={e => setReply(e.target.value)}
              />
              <Button type="submit" loading={saving} size="sm">Reply</Button>
            </form>
          </div>
        )}
      </Modal>

      <Modal open={showNewPost} onClose={() => setShowNewPost(false)} title="New Post">
        <form onSubmit={handleCreatePost} className="space-y-4">
          <Select
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value as ForumCategory)}
            options={postableCategories.map(c => ({ value: c, label: c === 'Announcement' ? 'Announcement (leadership)' : c }))}
          />
          <Input label="Title" placeholder="Post title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea label="Body" placeholder="Write your post..." value={body} onChange={e => setBody(e.target.value)} rows={4} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowNewPost(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Post</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Fetch initial count
    fetchUnreadCount();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_auth_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Show toast for new notification
            const notification = payload.new as any;
            toast.success(notification.title, {
              description: notification.message,
              duration: 5000,
            });
            
            // Increment count optimistically
            setUnreadCount(prev => prev + 1);
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            // Debounce recalc to avoid rapid duplicate requests
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
              fetchUnreadCount();
            }, 250);
          }
        }
      )
      .subscribe();

    return () => {
      // Cleanup: cancel pending count request and timers, and unsubscribe channel
      if (timerRef.current) window.clearTimeout(timerRef.current);
      controllerRef.current?.abort();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    // Abort any in-flight request before starting a new one
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' }) // minimal payload, count from Content-Range
        .eq('user_auth_id', user.id)
        .eq('read', false)
        .limit(1)
        .abortSignal(controller.signal);

      if (error) throw error;
      if (!controller.signal.aborted) {
        setUnreadCount(count || 0);
      }
    } catch (error: any) {
      const msg = String(error?.message || '');
      // Ignore aborted/cancelled fetch noise during navigation
      if (
        error?.name === 'AbortError' ||
        msg.includes('aborted') ||
        msg.includes('AbortError') ||
        msg.includes('Failed to fetch')
      ) {
        return;
      }
      console.error('Error fetching unread count:', error);
    } finally {
      // Clear the controller if it is the same instance
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  return { unreadCount };
}

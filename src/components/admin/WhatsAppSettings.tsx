import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Unplug,
  Send,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// The whatsapp_league_config table is added by migration 20260216000000 but
// auto-generated Supabase types won't include it until `supabase gen types`
// is re-run after the migration. Use an untyped client reference for now.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type SessionStatus = 'disconnected' | 'qr_pending' | 'connected';

interface WhatsAppConfig {
  id: string;
  league_id: string;
  waha_session_name: string;
  whatsapp_group_id: string | null;
  whatsapp_group_name: string | null;
  is_active: boolean;
  session_status: SessionStatus;
  notify_player_add: boolean;
  notify_player_drop: boolean;
  notify_trade: boolean;
  notify_score_finalized: boolean;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participants?: Array<{ id: string }>;
}

async function callSessionApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke('whatsapp-session', {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (res.error) throw new Error(res.error.message || 'Request failed');
  return res.data;
}

export const WhatsAppSettings = () => {
  const currentLeagueId = useGameStore(state => state.currentLeagueId);
  const leagueName = useGameStore(state => state.leagueName);

  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing config
  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchConfig = async () => {
      setLoading(true);
      const { data, error } = await db
        .from('whatsapp_league_config')
        .select('*')
        .eq('league_id', currentLeagueId)
        .maybeSingle();

      if (!error && data) {
        setConfig(data as unknown as WhatsAppConfig);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [currentLeagueId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    if (!currentLeagueId) return;
    try {
      const data = await callSessionApi('status', { leagueId: currentLeagueId });
      if (data.status === 'connected') {
        stopPolling();
        setQrImage(null);
        setConfig(prev => prev ? { ...prev, session_status: 'connected' } : prev);
        // Fetch groups immediately
        try {
          const groupsData = await callSessionApi('groups', { leagueId: currentLeagueId });
          setGroups(groupsData.groups || []);
        } catch {
          // Groups will load on demand
        }
      }
    } catch {
      // Polling errors are expected during QR scanning
    }
  }, [currentLeagueId, stopPolling]);

  const handleStartSession = async () => {
    if (!currentLeagueId) return;
    setActionLoading(true);
    try {
      await callSessionApi('start', { leagueId: currentLeagueId });

      // Get QR code
      const qrData = await callSessionApi('qr', { leagueId: currentLeagueId });
      if (qrData.qr) {
        setQrImage(typeof qrData.qr === 'string' ? qrData.qr : null);
      }

      setConfig(prev => {
        if (prev) return { ...prev, session_status: 'qr_pending' };
        return {
          id: '',
          league_id: currentLeagueId,
          waha_session_name: `league-${currentLeagueId}`,
          whatsapp_group_id: null,
          whatsapp_group_name: null,
          is_active: false,
          session_status: 'qr_pending',
          notify_player_add: true,
          notify_player_drop: true,
          notify_trade: true,
          notify_score_finalized: true,
        };
      });

      // Start polling for connection status
      stopPolling();
      pollRef.current = setInterval(pollStatus, 3000);

      toast.success('WhatsApp session started — scan the QR code');
    } catch (err) {
      toast.error(`Failed to start session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshQr = async () => {
    if (!currentLeagueId) return;
    try {
      const qrData = await callSessionApi('qr', { leagueId: currentLeagueId });
      if (qrData.qr && typeof qrData.qr === 'string') {
        setQrImage(qrData.qr);
      }
    } catch {
      toast.error('Failed to refresh QR code');
    }
  };

  const handleSelectGroup = async (group: WhatsAppGroup) => {
    if (!currentLeagueId) return;
    setActionLoading(true);
    try {
      await callSessionApi('select-group', {
        leagueId: currentLeagueId,
        groupId: group.id,
        groupName: group.name,
      });

      setConfig(prev => prev ? {
        ...prev,
        whatsapp_group_id: group.id,
        whatsapp_group_name: group.name,
        is_active: true,
        session_status: 'connected',
      } : prev);

      toast.success(`Connected to "${group.name}"`);
    } catch (err) {
      toast.error(`Failed to select group: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!currentLeagueId) return;
    setActionLoading(true);
    try {
      const data = await callSessionApi('create-group', {
        leagueId: currentLeagueId,
        groupName: `${leagueName} Fantasy League`,
      });

      setConfig(prev => prev ? {
        ...prev,
        whatsapp_group_id: data.groupId,
        whatsapp_group_name: data.groupName,
        is_active: true,
        session_status: 'connected',
      } : prev);

      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      }

      toast.success('WhatsApp group created');
    } catch (err) {
      toast.error(`Failed to create group: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentLeagueId) return;
    setActionLoading(true);
    try {
      await callSessionApi('disconnect', { leagueId: currentLeagueId });

      stopPolling();
      setQrImage(null);
      setGroups([]);
      setInviteLink(null);
      setConfig(prev => prev ? {
        ...prev,
        is_active: false,
        session_status: 'disconnected',
        whatsapp_group_id: null,
        whatsapp_group_name: null,
      } : prev);

      toast.success('WhatsApp disconnected');
    } catch (err) {
      toast.error(`Failed to disconnect: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestMessage = async () => {
    if (!currentLeagueId) return;
    setActionLoading(true);
    try {
      await callSessionApi('test', { leagueId: currentLeagueId });
      toast.success('Test message sent to WhatsApp group');
    } catch (err) {
      toast.error(`Failed to send test message: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleChange = (key: keyof Pick<WhatsAppConfig, 'notify_player_add' | 'notify_player_drop' | 'notify_trade' | 'notify_score_finalized'>, value: boolean) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSaveToggles = async () => {
    if (!currentLeagueId || !config) return;
    setSaving(true);
    try {
      const { error } = await db
        .from('whatsapp_league_config')
        .update({
          notify_player_add: config.notify_player_add,
          notify_player_drop: config.notify_player_drop,
          notify_trade: config.notify_trade,
          notify_score_finalized: config.notify_score_finalized,
        })
        .eq('league_id', currentLeagueId);

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const status = config?.session_status || 'disconnected';
  const isConnectedWithGroup = status === 'connected' && config?.whatsapp_group_id && config?.is_active;

  if (loading) {
    return (
      <section className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">WhatsApp Notifications</h2>
        </div>
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">WhatsApp Notifications</h2>
        </div>
        {isConnectedWithGroup && (
          <Badge variant="default" className="bg-green-600 text-xs">
            Connected
          </Badge>
        )}
      </div>

      {/* State 1: Not Connected */}
      {status === 'disconnected' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a WhatsApp group to receive league transaction notifications
            (player adds, drops, trades, and score finalizations).
          </p>
          <Button
            onClick={handleStartSession}
            disabled={actionLoading}
            className="w-full"
          >
            {actionLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Connect WhatsApp
          </Button>
        </div>
      )}

      {/* State 2: QR Code Scanning */}
      {status === 'qr_pending' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with WhatsApp on your phone to connect.
          </p>
          {qrImage ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={qrImage}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleRefreshQr}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh QR Code
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8">
              <QrCode className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading QR code...</p>
              <Button variant="outline" size="sm" onClick={handleRefreshQr}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">
            Checking for connection every 3 seconds...
          </p>
        </div>
      )}

      {/* State 3: Connected, selecting group */}
      {status === 'connected' && !isConnectedWithGroup && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            WhatsApp connected. Choose a group to receive notifications.
          </p>

          {groups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select an existing group:</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {group.name}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <span className="text-sm text-muted-foreground">or</span>
            )}
            <Button
              variant="outline"
              onClick={handleCreateGroup}
              disabled={actionLoading}
              className="flex-1"
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create New Group
            </Button>
          </div>
        </div>
      )}

      {/* State 4: Fully connected */}
      {isConnectedWithGroup && (
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-foreground">
              <span className="font-medium">Group:</span>{' '}
              {config?.whatsapp_group_name || 'Unknown group'}
            </p>
          </div>

          {inviteLink && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-foreground font-medium mb-1">Invite Link</p>
              <a
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {inviteLink}
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                Share this link with league members to join the WhatsApp group.
              </p>
            </div>
          )}

          {/* Notification toggles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Notification Types</Label>
            {[
              { key: 'notify_player_add' as const, label: 'Player Adds', icon: '➕' },
              { key: 'notify_player_drop' as const, label: 'Player Drops', icon: '❌' },
              { key: 'notify_trade' as const, label: 'Trades', icon: '🔄' },
              { key: 'notify_score_finalized' as const, label: 'Score Finalizations', icon: '📊' },
            ].map(toggle => (
              <div
                key={toggle.key}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2">
                  <span>{toggle.icon}</span>
                  <span className="text-sm text-foreground">{toggle.label}</span>
                </div>
                <Switch
                  checked={config?.[toggle.key] ?? true}
                  onCheckedChange={(checked) => handleToggleChange(toggle.key, checked)}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveToggles}
              disabled={saving}
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestMessage}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={actionLoading}
            >
              <Unplug className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

import React, { useState } from 'react';
import { usePopupStore } from '../store';
import { validateConnectToken, disconnectExtension } from '../../shared/api-client';
import { saveConnectionInfo, clearConnectionInfo } from '../../shared/storage';
import { EXTENSION_ID } from '../../shared/constants';

export function ConnectionStatus() {
  const { connected, connection, init } = usePopupStore();
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  const handleConnect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    try {
      // validate-connect-token also creates the connection on the server
      const result = await validateConnectToken({
        connectToken: token.trim(),
        extensionId: EXTENSION_ID,
        channelId: 'pending',        // will be updated when YouTube Studio is visited
        channelName: 'Pending setup',
      });

      if (!result.success) {
        usePopupStore.getState().setError('Invalid or expired token');
        setConnecting(false);
        return;
      }

      await saveConnectionInfo({
        connectionId: result.connectionId,
        userId: result.userId,
        syncToken: result.syncToken,
        channelId: result.channelName || 'pending',
        channelName: result.channelName || 'Pending setup',
        status: 'active',
      });

      setToken('');
      setShowConnect(false);
      await init();
    } catch (err: any) {
      usePopupStore.getState().setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectExtension();
    } catch { /* ignore */ }
    await clearConnectionInfo();
    await init();
  };

  if (connected && connection) {
    return (
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-green-400">Connected</span>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
        <p className="text-xs text-[#888] mt-1">
          Syncing as user {connection.userId.slice(0, 8)}…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-[#2a2a2a]">
      {!showConnect ? (
        <button
          onClick={() => setShowConnect(true)}
          className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold text-sm hover:from-orange-600 hover:to-orange-700 transition-all"
        >
          Connect to Boostify
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#888]">
            Paste the connect token from your Boostify dashboard:
          </p>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token…"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !token.trim()}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button
              onClick={() => { setShowConnect(false); setToken(''); }}
              className="px-4 py-2 bg-[#2a2a2a] text-[#999] rounded-lg text-sm hover:bg-[#333] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

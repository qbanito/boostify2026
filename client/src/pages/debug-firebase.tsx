import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../hooks/use-auth";

export default function DebugFirebase() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Obtener todas las canciones
      const songsSnapshot = await getDocs(query(collection(db, "songs"), limit(50)));
      const songs = songsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Obtener todos los videos
      const videosSnapshot = await getDocs(query(collection(db, "videos"), limit(50)));
      const videos = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Obtener usuarios
      const usersSnapshot = await getDocs(query(collection(db, "users"), limit(20)));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Obtener merchandise
      const merchSnapshot = await getDocs(query(collection(db, "merchandise"), limit(50)));
      const merchandise = merchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setData({
        songs,
        videos,
        users,
        merchandise,
        currentUserId: user?.uid
      });
    } catch (error) {
      logger.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">🔍 Debug Firebase Data</h1>
      
      <div className="mb-4">
        <p className="text-gray-400">Current User ID: <span className="text-orange-500">{user?.uid || 'Not logged in'}</span></p>
        <Button onClick={fetchAllData} disabled={loading} className="mt-2">
          {loading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Songs */}
        <Card className="bg-gray-900 border-gray-700 p-6">
          <h2 className="text-2xl font-bold mb-4 text-orange-500">
            🎵 Songs ({data.songs?.length || 0})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.songs?.map((song: any) => (
              <div key={song.id} className="bg-black/50 p-3 rounded border border-gray-700">
                <p className="font-semibold">{song.name}</p>
                <p className="text-xs text-gray-400">ID: {song.id}</p>
                <p className="text-xs text-gray-400">User ID: {song.userId}</p>
                <p className="text-xs text-gray-400">Audio URL: {song.audioUrl?.substring(0, 50)}...</p>
              </div>
            ))}
            {(!data.songs || data.songs.length === 0) && (
              <p className="text-gray-500">No songs found in Firebase</p>
            )}
          </div>
        </Card>

        {/* Videos */}
        <Card className="bg-gray-900 border-gray-700 p-6">
          <h2 className="text-2xl font-bold mb-4 text-orange-500">
            📹 Videos ({data.videos?.length || 0})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.videos?.map((video: any) => (
              <div key={video.id} className="bg-black/50 p-3 rounded border border-gray-700">
                <p className="font-semibold">{video.title}</p>
                <p className="text-xs text-gray-400">ID: {video.id}</p>
                <p className="text-xs text-gray-400">User ID: {video.userId}</p>
                <p className="text-xs text-gray-400">URL: {video.url}</p>
              </div>
            ))}
            {(!data.videos || data.videos.length === 0) && (
              <p className="text-gray-500">No videos found in Firebase</p>
            )}
          </div>
        </Card>

        {/* Merchandise */}
        <Card className="bg-gray-900 border-gray-700 p-6">
          <h2 className="text-2xl font-bold mb-4 text-orange-500">
            🛍️ Merchandise ({data.merchandise?.length || 0})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.merchandise?.map((product: any) => (
              <div key={product.id} className="bg-black/50 p-3 rounded border border-gray-700">
                <p className="font-semibold">{product.name} - ${product.price}</p>
                <p className="text-xs text-gray-400">ID: {product.id}</p>
                <p className="text-xs text-gray-400">User ID: {product.userId}</p>
              </div>
            ))}
            {(!data.merchandise || data.merchandise.length === 0) && (
              <p className="text-gray-500">No merchandise found in Firebase</p>
            )}
          </div>
        </Card>

        {/* Users */}
        <Card className="bg-gray-900 border-gray-700 p-6">
          <h2 className="text-2xl font-bold mb-4 text-orange-500">
            👥 Users ({data.users?.length || 0})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.users?.map((userData: any) => (
              <div key={userData.id} className="bg-black/50 p-3 rounded border border-gray-700">
                <p className="font-semibold">{userData.displayName || userData.name || 'No name'}</p>
                <p className="text-xs text-gray-400">ID: {userData.id}</p>
                <p className="text-xs text-gray-400">UID: {userData.uid}</p>
                <p className="text-xs text-gray-400">Email: {userData.email}</p>
              </div>
            ))}
            {(!data.users || data.users.length === 0) && (
              <p className="text-gray-500">No users found in Firebase</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-gray-900 border border-gray-700 rounded">
        <h3 className="font-bold mb-2">📊 Summary</h3>
        <pre className="text-xs text-gray-400 overflow-x-auto">
          {JSON.stringify({
            totalSongs: data.songs?.length || 0,
            totalVideos: data.videos?.length || 0,
            totalMerchandise: data.merchandise?.length || 0,
            totalUsers: data.users?.length || 0,
            currentUser: data.currentUserId,
            songsForCurrentUser: data.songs?.filter((s: any) => s.userId === data.currentUserId).length || 0,
            videosForCurrentUser: data.videos?.filter((v: any) => v.userId === data.currentUserId).length || 0
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

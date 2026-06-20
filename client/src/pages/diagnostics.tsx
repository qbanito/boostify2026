import { useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>({
    loading: true,
    firebaseConfigured: false,
    environment: {},
    users: [],
    merchandise: [],
    errors: []
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      const errors: string[] = [];
      const results: any = {
        loading: false,
        firebaseConfigured: !!db,
        environment: {
          url: window.location.href,
          origin: window.location.origin,
          hostname: window.location.hostname,
        },
        users: [],
        merchandise: [],
        errors: []
      };

      try {
        // Test 1: Get all users
        logger.info('🧪 TEST 1: Fetching all users...');
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        results.users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          uid: doc.data().uid,
          slug: doc.data().slug,
          name: doc.data().displayName || doc.data().name
        }));
        logger.info(`✅ Found ${results.users.length} users`);

        // Test 2: Get all merchandise
        logger.info('🧪 TEST 2: Fetching all merchandise...');
        const merchRef = collection(db, "merchandise");
        const merchSnapshot = await getDocs(merchRef);
        results.merchandise = merchSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          userId: doc.data().userId,
          imageUrl: doc.data().imageUrl?.substring(0, 50) + '...'
        }));
        logger.info(`✅ Found ${results.merchandise.length} products`);

        // Test 3: Test query for specific user
        if (results.users.length > 0) {
          const testUserId = results.users[0].uid;
          logger.info(`🧪 TEST 3: Fetching merchandise for user: ${testUserId}`);
          const q = query(merchRef, where("userId", "==", testUserId));
          const testSnapshot = await getDocs(q);
          logger.info(`✅ Query test: Found ${testSnapshot.size} products for user ${testUserId}`);
        }

      } catch (error: any) {
        logger.error('❌ Diagnostics error:', error);
        errors.push(error.message || String(error));
      }

      results.errors = errors;
      setDiagnostics(results);
    };

    runDiagnostics();
  }, []);

  if (diagnostics.loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold mb-4">🔍 Running Diagnostics...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">🔍 Production Diagnostics</h1>
      
      <div className="space-y-6">
        {/* Firebase Status */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            {diagnostics.firebaseConfigured ? '✅' : '❌'} Firebase Configuration
          </h2>
          <p className={diagnostics.firebaseConfigured ? 'text-green-400' : 'text-red-400'}>
            {diagnostics.firebaseConfigured ? 'Firebase is configured' : 'Firebase is NOT configured'}
          </p>
        </div>

        {/* Environment */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-3">🌍 Environment</h2>
          <pre className="bg-black p-4 rounded text-xs overflow-x-auto">
            {JSON.stringify(diagnostics.environment, null, 2)}
          </pre>
        </div>

        {/* Users */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-3">👥 Users ({diagnostics.users.length})</h2>
          {diagnostics.users.length > 0 ? (
            <div className="space-y-2">
              {diagnostics.users.map((user: any) => (
                <div key={user.id} className="bg-black p-3 rounded text-sm">
                  <div><strong>Name:</strong> {user.name}</div>
                  <div><strong>Slug:</strong> {user.slug}</div>
                  <div><strong>UID:</strong> <code className="text-xs text-blue-400">{user.uid}</code></div>
                  <div className="mt-2">
                    <a 
                      href={`/artist/${user.slug}`}
                      className="text-orange-400 hover:text-orange-300 underline"
                    >
                      View Profile: /artist/{user.slug}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No users found</p>
          )}
        </div>

        {/* Merchandise */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-3">🛍️ Merchandise ({diagnostics.merchandise.length})</h2>
          {diagnostics.merchandise.length > 0 ? (
            <div className="space-y-2">
              {diagnostics.merchandise.map((product: any) => (
                <div key={product.id} className="bg-black p-3 rounded text-sm">
                  <div><strong>Name:</strong> {product.name}</div>
                  <div><strong>User ID:</strong> <code className="text-xs text-blue-400">{product.userId}</code></div>
                  <div><strong>Image:</strong> <code className="text-xs text-green-400">{product.imageUrl}</code></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No merchandise found</p>
          )}
        </div>

        {/* Errors */}
        {diagnostics.errors.length > 0 && (
          <div className="bg-red-900/20 p-6 rounded-lg border border-red-700">
            <h2 className="text-xl font-semibold mb-3 text-red-400">❌ Errors</h2>
            <div className="space-y-2">
              {diagnostics.errors.map((error: string, i: number) => (
                <div key={i} className="bg-black p-3 rounded text-sm text-red-300">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-900/20 p-6 rounded-lg border border-blue-700">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">📋 Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Check if Firebase is configured (should show ✅)</li>
            <li>Verify that users exist with correct slugs</li>
            <li>Check if merchandise items exist and have correct userId</li>
            <li>Open browser console (F12) to see detailed logs</li>
            <li>Compare userId in merchandise with uid in users - they MUST match</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const API_LINKS = [
  {
    category: 'Video Generation',
    apis: [
      { name: 'Kling API', url: 'http://localhost:5000/api/kling', endpoint: '/api/kling', status: 'active' },
      { name: 'Kling LipSync', url: 'http://localhost:5000/api/kling/lipsync', endpoint: '/api/kling/lipsync', status: 'active' },
      { name: 'MiniMax Video', url: 'http://localhost:5000/api/minimax', endpoint: '/api/minimax', status: 'active' },
      { name: 'Flux API', url: 'http://localhost:5000/api/flux', endpoint: '/api/flux', status: 'active' },
      { name: 'Gemini Image', url: 'http://localhost:5000/api/gemini-image', endpoint: '/api/gemini-image', status: 'active' }
    ]
  },
  {
    category: 'Music & Audio',
    apis: [
      { name: 'Music Generation', url: 'http://localhost:5000/api/music', endpoint: '/api/music', status: 'active' },
      { name: 'Audio Transcription', url: 'http://localhost:5000/api/transcription', endpoint: '/api/transcription', status: 'active' },
      { name: 'Spotify Tools', url: 'http://localhost:5000/api/spotify', endpoint: '/api/spotify', status: 'active' }
    ]
  },
  {
    category: 'Content Creation',
    apis: [
      { name: 'AI Assistant', url: 'http://localhost:5000/api/ai', endpoint: '/api/ai', status: 'active' },
      { name: 'Gemini Agents', url: 'http://localhost:5000/api/gemini-agents', endpoint: '/api/gemini-agents', status: 'active' },
      { name: 'PR Agent', url: 'http://localhost:5000/api/pr-agent', endpoint: '/api/pr-agent', status: 'active' },
      { name: 'Fashion Studio', url: 'http://localhost:5000/api/fashion', endpoint: '/api/fashion', status: 'active' }
    ]
  },
  {
    category: 'Social & Marketing',
    apis: [
      { name: 'Instagram Tools', url: 'http://localhost:5000/api/instagram', endpoint: '/api/instagram', status: 'active' },
      { name: 'YouTube Tools', url: 'http://localhost:5000/api/youtube', endpoint: '/api/youtube', status: 'active' },
      { name: 'Apify Instagram', url: 'http://localhost:5000/api/apify/instagram', endpoint: '/api/apify/instagram', status: 'active' }
    ]
  },
  {
    category: 'Payments & Subscriptions',
    apis: [
      { name: 'Stripe API', url: 'http://localhost:5000/api/stripe', endpoint: '/api/stripe', status: 'active' },
      { name: 'Credits & Payments', url: 'http://localhost:5000/api/credits', endpoint: '/api/credits', status: 'active' },
      { name: 'Subscriptions', url: 'http://localhost:5000/api/subscriptions', endpoint: '/api/subscriptions', status: 'active' }
    ]
  },
  {
    category: 'Project Management',
    apis: [
      { name: 'Music Video Projects', url: 'http://localhost:5000/api/music-video-projects', endpoint: '/api/music-video-projects', status: 'active' },
      { name: 'Musician Clips', url: 'http://localhost:5000/api/musician-clips', endpoint: '/api/musician-clips', status: 'active' },
      { name: 'Camera Angles', url: 'http://localhost:5000/api/camera-angles', endpoint: '/api/camera-angles', status: 'active' }
    ]
  },
  {
    category: 'Admin & Analytics',
    apis: [
      { name: 'API Usage', url: 'http://localhost:5000/api/admin/api-usage', endpoint: '/api/admin/api-usage', status: 'active' },
      { name: 'Accounting', url: 'http://localhost:5000/api/admin/accounting', endpoint: '/api/admin/accounting', status: 'active' },
      { name: 'Artist Manager', url: 'http://localhost:5000/api/admin/artists', endpoint: '/api/admin/artists', status: 'active' }
    ]
  }
];

interface ApiLink {
  name: string;
  url: string;
  endpoint: string;
  status: string;
}

function ApiLinkCard({ api }: { api: ApiLink }) {
  const [copied, setCopied] = useState(false);

  const copyEndpoint = () => {
    navigator.clipboard.writeText(api.endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-white text-sm">{api.name}</h4>
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
          {api.status}
        </Badge>
      </div>
      <p className="text-xs text-slate-400 mb-3 font-mono break-all">{api.endpoint}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={copyEndpoint}
          className="flex-1 text-xs"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
        <a href={api.url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="text-xs">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </div>
    </div>
  );
}

export function ApiLinks() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">API Directory</h2>
        <p className="text-slate-400 text-sm md:text-base">All APIs and endpoints for direct access and integration</p>
      </div>

      <div className="space-y-4">
        {API_LINKS.map((category) => (
          <Card key={category.category} className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">{category.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.apis.map((api) => (
                  <ApiLinkCard key={api.endpoint} api={api} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-300">Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>• Click "Copy" to quickly copy API endpoints for integration</p>
          <p>• Click the link icon to view API documentation</p>
          <p>• All endpoints are available at the base URL: http://localhost:5000</p>
          <p>• Use the Accounting tab to track API costs and usage</p>
        </CardContent>
      </Card>
    </div>
  );
}

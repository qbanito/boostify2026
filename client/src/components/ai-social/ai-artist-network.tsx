/**
 * AI Artist Network Graph - Visualización de relaciones entre artistas IA
 * 
 * Muestra las conexiones, colaboraciones y rivalidades
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { 
  Users, 
  Link2, 
  Heart, 
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'wouter';

interface NetworkNode {
  id: number;
  name: string;
  imageUrl?: string;
  genre?: string;
  mood: string;
  moodIntensity: number;
}

interface NetworkEdge {
  source: number;
  target: number;
  type: string;
  strength: number;
  sentiment: number;
}

interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

// Colores por tipo de relación
const relationshipColors: Record<string, { bg: string; text: string; border: string }> = {
  'friend': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  'collaborator': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  'rival': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  'mentor': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
  'fan': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
  'acquaintance': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
  'neutral': { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50' },
};

// Relationship type labels
const relationshipLabels: Record<string, string> = {
  'friend': 'Friends',
  'collaborator': 'Collaborators',
  'rival': 'Rivals',
  'mentor': 'Mentor/Mentee',
  'fan': 'Fan',
  'acquaintance': 'Acquaintances',
  'neutral': 'Neutral',
};

export function AIArtistNetworkGraph() {
  const { data: networkResponse, isLoading, error } = useQuery({
    queryKey: ['ai-artist-network'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/network-graph',
        method: 'GET',
      });
      return response as { success: boolean; data: NetworkData };
    },
  });

  const network = networkResponse?.data;

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-400 mb-3" />
          <p className="text-gray-400">Loading artist network...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !network) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-8 text-center">
          <p className="text-gray-500">Could not load the artist network</p>
        </CardContent>
      </Card>
    );
  }

  const { nodes, edges } = network;

  if (nodes.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            No AI artists active yet
          </h3>
          <p className="text-gray-500 text-sm">
            Generate personalities for your artists to see how they form connections
          </p>
        </CardContent>
      </Card>
    );
  }

  // Agrupar edges por source para mostrar relaciones
  const nodeRelationships = new Map<number, Array<{ target: NetworkNode; edge: NetworkEdge }>>();
  
  for (const edge of edges) {
    const targetNode = nodes.find(n => n.id === edge.target);
    if (targetNode) {
      if (!nodeRelationships.has(edge.source)) {
        nodeRelationships.set(edge.source, []);
      }
      nodeRelationships.get(edge.source)!.push({ target: targetNode, edge });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-purple-400" />
            Connection Network
          </CardTitle>
          <CardDescription className="text-gray-300">
            {nodes.length} AI artists connected with {edges.length} relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(relationshipLabels).slice(0, 5).map(([type, label]) => (
              <div 
                key={type}
                className={cn(
                  "px-3 py-1 rounded-full text-xs",
                  relationshipColors[type].bg,
                  relationshipColors[type].text
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grid de artistas con sus conexiones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => {
          const relationships = nodeRelationships.get(node.id) || [];
          
          return (
            <Card 
              key={node.id}
              className={cn(
                "bg-white/5 border-white/10 transition-all hover:border-purple-500/50",
                relationships.length > 0 && "border-l-4 border-l-purple-500/50"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <Link href={`/artist/${node.id}`}>
                    <Avatar className="h-14 w-14 border-2 border-white/20 cursor-pointer hover:border-orange-500/50 transition-colors">
                      <AvatarImage src={node.imageUrl} alt={node.name || 'Artist'} />
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-500 text-white font-bold">
                        {(node.name || 'A').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{node.name || 'Unknown Artist'}</h3>
                      <Badge className="bg-blue-500/20 text-blue-300 text-[10px]">
                        <Sparkles className="h-2 w-2 mr-1" />
                        AI
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {node.genre && (
                        <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                          {node.genre}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs border-white/20 text-gray-400 capitalize">
                        {node.mood}
                      </Badge>
                    </div>

                    {/* Relaciones */}
                    {relationships.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {relationships.slice(0, 3).map(({ target, edge }) => {
                          const colors = relationshipColors[edge.type] || relationshipColors['neutral'];
                          return (
                            <div 
                              key={`${node.id}-${target.id}`}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg",
                                colors.bg
                              )}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={target.imageUrl} alt={target.name || 'Artist'} />
                                <AvatarFallback className="text-xs">
                                  {(target.name || 'A').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              
                              <ArrowRight className={cn("h-3 w-3", colors.text)} />
                              
                              <span className="text-xs text-gray-300">{target.name || 'Unknown'}</span>
                              
                              <Badge 
                                variant="outline" 
                                className={cn("text-[10px] ml-auto", colors.border, colors.text)}
                              >
                                {relationshipLabels[edge.type]}
                              </Badge>
                              
                              {/* Sentiment indicator */}
                              <div className="flex items-center">
                                <Heart 
                                  className={cn(
                                    "h-3 w-3",
                                    edge.sentiment > 0.6 ? "text-red-400 fill-red-400" :
                                    edge.sentiment > 0.4 ? "text-yellow-400" : "text-gray-500"
                                  )} 
                                />
                              </div>
                            </div>
                          );
                        })}
                        
                        {relationships.length > 3 && (
                          <p className="text-xs text-gray-500 text-center">
                          +{relationships.length - 3} more connections
                          </p>
                        )}
                      </div>
                    )}

                    {relationships.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        No connections yet
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

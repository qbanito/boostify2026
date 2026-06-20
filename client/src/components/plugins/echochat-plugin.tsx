import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { 
  User, 
  MessageSquare, 
  Users, 
  Settings, 
  BarChart2, 
  Trash2, 
  Send, 
  Filter 
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "../../hooks/use-toast";

// Interfaz para los comentarios
interface Comment {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
  avatar?: string;
  platform?: string;
}

// Simulación del servicio EchoChat
class EchoChatService {
  private comments: Comment[] = [];
  
  constructor() {
    // Inicializamos con algunos comentarios de ejemplo
    this.addComment({
      id: '1',
      user: 'MusicFan22',
      message: '¡Este nuevo álbum es increíble! ¡No puedo dejar de escucharlo!',
      timestamp: new Date(Date.now() - 3600000 * 24),
      platform: 'website'
    });
    this.addComment({
      id: '2',
      user: 'BeatMaster',
      message: 'La producción en esta canción es de otro nivel. ¿Alguien sabe quién fue el productor?',
      timestamp: new Date(Date.now() - 3600000 * 12),
      platform: 'instagram'
    });
    this.addComment({
      id: '3',
      user: 'RhythmQueen',
      message: 'Estoy esperando con ansias el próximo concierto. ¿Alguien tiene información sobre fechas?',
      timestamp: new Date(Date.now() - 3600000 * 5),
      platform: 'twitter'
    });
    this.addComment({
      id: '4',
      user: 'MelodyMaster',
      message: 'Las armonías vocales en esta pista son perfectas. Tremendo talento.',
      timestamp: new Date(Date.now() - 3600000 * 2),
      platform: 'facebook'
    });
    this.addComment({
      id: '5',
      user: 'BassGroove',
      message: 'He estado practicando la línea de bajo de esta canción. ¡Es tan pegadiza!',
      timestamp: new Date(Date.now() - 3600000),
      platform: 'website'
    });
  }
  
  getComments(): Comment[] {
    return [...this.comments].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  addComment(comment: Comment): void {
    this.comments.push({
      ...comment,
      id: comment.id || crypto.randomUUID()
    });
  }
  
  deleteComment(id: string): void {
    const index = this.comments.findIndex(c => c.id === id);
    if (index !== -1) {
      this.comments.splice(index, 1);
    }
  }
  
  getFilteredComments(platform?: string): Comment[] {
    if (!platform || platform === 'all') {
      return this.getComments();
    }
    
    return this.getComments().filter(c => c.platform === platform);
  }
  
  getCommentStatistics() {
    const total = this.comments.length;
    
    // Agrupar por plataforma
    const platformStats = this.comments.reduce((acc, comment) => {
      const platform = comment.platform || 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Comentarios por día (últimos 7 días)
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();
    
    const dailyComments = last7Days.map(date => {
      const count = this.comments.filter(comment => {
        const commentDate = new Date(comment.timestamp);
        commentDate.setHours(0, 0, 0, 0);
        return commentDate.getTime() === date.getTime();
      }).length;
      
      return {
        date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
        count
      };
    });
    
    return {
      total,
      platformStats,
      dailyComments
    };
  }
}

// Instancia del servicio (simulada)
const echoChatService = new EchoChatService();

export function EchoChatPlugin() {
  const [activeTab, setActiveTab] = useState("feed");
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newUsername, setNewUsername] = useState("AdminUser");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [autoModeration, setAutoModeration] = useState(true);
  const { toast } = useToast();
  
  // Cargar comentarios
  useEffect(() => {
    // Simulamos una carga asíncrona
    setTimeout(() => {
      setComments(echoChatService.getFilteredComments(platformFilter));
      setIsLoading(false);
    }, 800);
  }, [platformFilter]);
  
  // Función para formatear la fecha
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Menos de un día
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 1) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes <= 1 ? 'hace un momento' : `hace ${minutes} minutos`;
      }
      return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
    }
    
    // Menos de una semana
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return days === 1 ? 'hace 1 día' : `hace ${days} días`;
    }
    
    // Fecha completa
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Función para enviar un comentario
  const handleSubmitComment = () => {
    if (!newComment.trim()) {
      toast({
        title: "Comentario vacío",
        description: "Por favor, escribe un mensaje para publicar.",
        variant: "destructive"
      });
      return;
    }
    
    // Comprobar moderación
    if (autoModeration && containsInappropriateContent(newComment)) {
      toast({
        title: "Moderación automática",
        description: "Tu comentario podría contener lenguaje inapropiado y ha sido bloqueado.",
        variant: "destructive"
      });
      return;
    }
    
    const newCommentObj: Comment = {
      id: crypto.randomUUID(),
      user: newUsername,
      message: newComment,
      timestamp: new Date(),
      platform: 'website'
    };
    
    echoChatService.addComment(newCommentObj);
    setComments(prevComments => [newCommentObj, ...prevComments]);
    setNewComment("");
    
    toast({
      title: "Comentario publicado",
      description: "Tu comentario ha sido publicado exitosamente.",
    });
  };
  
  // Función para eliminar un comentario
  const handleDeleteComment = (id: string) => {
    echoChatService.deleteComment(id);
    setComments(prevComments => prevComments.filter(comment => comment.id !== id));
    
    toast({
      title: "Comentario eliminado",
      description: "El comentario ha sido eliminado exitosamente.",
    });
  };
  
  // Función simple para simular moderación de contenido
  const containsInappropriateContent = (text: string): boolean => {
    const inappropriateWords = ['odio', 'insulto', 'maldición', 'estúpido', 'idiota', '@#$%'];
    return inappropriateWords.some(word => text.toLowerCase().includes(word));
  };
  
  // Renderizado del avatar según la plataforma
  const renderAvatar = (comment: Comment) => {
    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
    
    // Colores para diferentes plataformas
    const bgColor = {
      website: 'bg-orange-500',
      twitter: 'bg-blue-400',
      instagram: 'bg-pink-500',
      facebook: 'bg-blue-600',
      default: 'bg-gray-500'
    }[comment.platform || 'default'];
    
    return (
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white ${bgColor}`}>
        {getInitials(comment.user)}
      </div>
    );
  };
  
  // Estadísticas
  const stats = echoChatService.getCommentStatistics();
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="feed" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Feed de Comentarios</span>
          </TabsTrigger>
          <TabsTrigger value="moderate" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Moderación</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span>Estadísticas</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Configuración</span>
          </TabsTrigger>
        </TabsList>
      
        <TabsContent value="feed" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Feed de Comentarios</h3>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                className="text-sm border rounded p-1"
                value={platformFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlatformFilter(e.target.value)}
              >
                <option value="all">Todas las plataformas</option>
                <option value="website">Sitio web</option>
                <option value="twitter">Twitter</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
          </div>
          
          <div className="border rounded-md p-4 mb-4">
            <div className="flex gap-4 items-start">
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                {newUsername.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 space-y-2">
                <Textarea 
                  placeholder="Escribe un comentario..." 
                  value={newComment}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
                  className="w-full"
                  rows={3}
                />
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Publicando como <span className="font-medium">{newUsername}</span>
                  </div>
                  <Button 
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Publicar
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {isLoading ? (
              // Esqueletos de carga
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-4 items-start">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </Card>
              ))
            ) : comments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No hay comentarios para mostrar. ¡Sé el primero en comentar!
              </div>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                  <div className="flex gap-4 items-start">
                    {renderAvatar(comment)}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-semibold">{comment.user}</h4>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(new Date(comment.timestamp))}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm mb-2">{comment.message}</p>
                      {comment.platform && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          Origen: 
                          <span className="font-medium">
                            {comment.platform.charAt(0).toUpperCase() + comment.platform.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="moderate" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Moderación de Comentarios</h3>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <h4 className="font-medium text-yellow-800 mb-2">Centro de Moderación</h4>
            <p className="text-sm text-yellow-700 mb-3">
              Aquí puedes moderar todos los comentarios en tiempo real. Los comentarios que requieren atención aparecerán primero.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Aprobar Seleccionados
              </Button>
              <Button variant="outline" size="sm" className="text-red-500">
                Rechazar Seleccionados
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {isLoading ? (
              // Esqueletos de carga
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-4 items-start">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </Card>
              ))
            ) : comments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No hay comentarios para moderar. ¡Todo al día!
              </div>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                  <div className="flex gap-4 items-start">
                    {renderAvatar(comment)}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-semibold">{comment.user}</h4>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(new Date(comment.timestamp))}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{comment.message}</p>
                      {comment.platform && (
                        <div className="text-xs text-muted-foreground">
                          Origen: {comment.platform.charAt(0).toUpperCase() + comment.platform.slice(1)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" className="text-green-500">
                        Aprobar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-500"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="stats" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Estadísticas de Comentarios</h3>
            <Button variant="outline" size="sm">
              <span className="text-xs">Exportar Datos</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 text-center">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Total de Comentarios</h4>
              <p className="text-3xl font-bold text-orange-500">{stats.total}</p>
            </Card>
            <Card className="p-4 text-center">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Media Diaria</h4>
              <p className="text-3xl font-bold text-orange-500">
                {stats.dailyComments.reduce((acc, day) => acc + day.count, 0) / stats.dailyComments.length || 0}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Plataformas</h4>
              <p className="text-3xl font-bold text-orange-500">{Object.keys(stats.platformStats).length}</p>
            </Card>
          </div>
          
          <Card className="p-4">
            <h4 className="font-medium mb-4">Comentarios por Plataforma</h4>
            <div className="space-y-2">
              {Object.entries(stats.platformStats).map(([platform, count]) => (
                <div key={platform} className="flex items-center gap-2">
                  <div className="w-32 text-sm capitalize">{platform}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-orange-500 h-full rounded-full"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm">{count}</div>
                </div>
              ))}
            </div>
          </Card>
          
          <Card className="p-4">
            <h4 className="font-medium mb-4">Comentarios por Día</h4>
            <div className="h-40 flex items-end justify-between gap-2">
              {stats.dailyComments.map((day, i) => {
                const maxCount = Math.max(...stats.dailyComments.map(d => d.count), 1);
                const height = (day.count / maxCount) * 100;
                
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div 
                      className="w-12 bg-orange-500 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs mt-2">{day.date}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <h3 className="text-lg font-medium mb-4">Configuración de EchoChat</h3>
          
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Configuración de la Cuenta</h4>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de Usuario</Label>
                  <Input 
                    id="username"
                    value={newUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
                    placeholder="Tu nombre de usuario"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Notificaciones</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifs">Notificaciones por Email</Label>
                  <Switch id="email-notifs" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="push-notifs">Notificaciones Push</Label>
                  <Switch id="push-notifs" defaultChecked />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Moderación</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-moderation">Moderación Automática</Label>
                    <p className="text-xs text-muted-foreground">
                      Filtra automáticamente contenido inapropiado
                    </p>
                  </div>
                  <Switch 
                    id="auto-moderation" 
                    checked={autoModeration}
                    onCheckedChange={setAutoModeration}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="require-approval">Requerir Aprobación</Label>
                  <Switch id="require-approval" />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Integración de Plataformas</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="w-full justify-start">
                    <div className="mr-2 h-4 w-4 text-blue-500">🐦</div>
                    Conectar Twitter
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <div className="mr-2 h-4 w-4 text-pink-500">📸</div>
                    Conectar Instagram
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <div className="mr-2 h-4 w-4 text-blue-600">👍</div>
                    Conectar Facebook
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <div className="mr-2 h-4 w-4 text-red-500">🎬</div>
                    Conectar YouTube
                  </Button>
                </div>
              </div>
            </div>
            
            <Button className="w-full">Guardar Configuración</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EchoChatPlugin;
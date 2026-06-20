import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Share2, Eye, Calendar, Edit2, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SiX, SiFacebook, SiWhatsapp, SiTelegram } from "react-icons/si";

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  summary: string;
  imageUrl: string;
  category: 'release' | 'performance' | 'collaboration' | 'achievement' | 'lifestyle';
  views: number;
  createdAt: string;
}

interface NewsArticleModalProps {
  article: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
  isOwner?: boolean;
  onEdit?: (article: NewsArticle) => void;
  onDelete?: (articleId: number) => void;
  onRegenerate?: (articleId: number) => void;
}

export function NewsArticleModal({
  article,
  isOpen,
  onClose,
  isOwner = false,
  onEdit,
  onDelete,
  onRegenerate,
}: NewsArticleModalProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  if (!article) return null;

  const categoryColors = {
    release: { bg: '#10B981', text: 'Release' },
    performance: { bg: '#8B5CF6', text: 'Performance' },
    collaboration: { bg: '#F59E0B', text: 'Collaboration' },
    achievement: { bg: '#EF4444', text: 'Achievement' },
    lifestyle: { bg: '#3B82F6', text: 'Lifestyle' }
  };

  const categoryInfo = categoryColors[article.category] || { bg: '#FF6B35', text: article.category };

  // Usar URL de la página individual de la noticia
  const shareUrl = `${window.location.origin}/article/${article.id}`;
  const shareText = `${article.title} - ${article.summary}`;

  const handleShare = (platform: string) => {
    setIsSharing(true);
    
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    
    let shareLink = '';
    
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'telegram':
        shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied",
          description: "The link has been copied to clipboard",
        });
        setIsSharing(false);
        return;
    }
    
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
    
    setTimeout(() => setIsSharing(false), 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        <DialogHeader className="space-y-4">
          {/* Hero Image */}
          <div className="relative -mx-6 -mt-6 h-72 overflow-hidden rounded-t-lg">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            
            {/* Category Badge */}
            <div 
              className="absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-semibold text-white shadow-lg"
              style={{ backgroundColor: categoryInfo.bg }}
            >
              {categoryInfo.text}
            </div>

            {/* Owner Controls */}
            {isOwner && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit?.(article)}
                  className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm"
                  data-testid="button-edit-news"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRegenerate?.(article.id)}
                  className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm"
                  data-testid="button-regenerate-news"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete?.(article.id)}
                  className="bg-red-900/80 hover:bg-red-800 backdrop-blur-sm"
                  data-testid="button-delete-news"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Title and Meta */}
          <div className="space-y-3">
            <DialogTitle className="text-3xl font-bold text-white leading-tight">
              {article.title}
            </DialogTitle>
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {article.views || 0} views
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(article.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </p>
        </div>

        {/* Share Section */}
        <div className="border-t border-zinc-800 pt-6 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Share this article</p>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSharing}
                  className="border-zinc-700 hover:bg-zinc-800"
                  data-testid="button-share-news"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem 
                  onClick={() => handleShare('twitter')}
                  className="cursor-pointer hover:bg-zinc-800"
                  data-testid="share-twitter"
                >
                  <SiX className="h-4 w-4 mr-2" />
                  Twitter / X
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleShare('facebook')}
                  className="cursor-pointer hover:bg-zinc-800"
                  data-testid="share-facebook"
                >
                  <SiFacebook className="h-4 w-4 mr-2" />
                  Facebook
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleShare('whatsapp')}
                  className="cursor-pointer hover:bg-zinc-800"
                  data-testid="share-whatsapp"
                >
                  <SiWhatsapp className="h-4 w-4 mr-2" />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleShare('telegram')}
                  className="cursor-pointer hover:bg-zinc-800"
                  data-testid="share-telegram"
                >
                  <SiTelegram className="h-4 w-4 mr-2" />
                  Telegram
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleShare('copy')}
                  className="cursor-pointer hover:bg-zinc-800"
                  data-testid="share-copy"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

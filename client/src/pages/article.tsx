import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Head } from "../components/ui/head";
import { Button } from "../components/ui/button";
import { ArrowLeft, Calendar, Eye, Share2 } from "lucide-react";
import { SiX, SiFacebook, SiWhatsapp, SiTelegram } from "react-icons/si";
import { useToast } from "../hooks/use-toast";

interface NewsArticle {
  id: number;
  userId: number;
  title: string;
  content: string;
  summary: string;
  imageUrl: string;
  category: 'release' | 'performance' | 'collaboration' | 'achievement' | 'lifestyle';
  views: number;
  createdAt: string;
  user?: {
    artistName: string;
    profileImage: string;
  };
}

export default function ArticlePage() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data: article, isLoading } = useQuery<NewsArticle>({
    queryKey: ['/api/artist-generator/news-item', id],
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Cargando artículo...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
        <p className="text-white text-xl">Artículo no encontrado</p>
        <Link href="/">
          <Button>Volver al inicio</Button>
        </Link>
      </div>
    );
  }

  const categoryColors = {
    release: { bg: '#10B981', text: 'Release' },
    performance: { bg: '#8B5CF6', text: 'Performance' },
    collaboration: { bg: '#F59E0B', text: 'Collaboration' },
    achievement: { bg: '#EF4444', text: 'Achievement' },
    lifestyle: { bg: '#3B82F6', text: 'Lifestyle' }
  };

  const categoryInfo = categoryColors[article.category] || { bg: '#FF6B35', text: article.category };

  const shareUrl = window.location.href;
  const shareText = `${article.title} - ${article.summary}`;

  const handleShare = (platform: string) => {
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
        return;
    }
    
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
  };

  const formattedDate = new Date(article.createdAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Función helper para obtener URL absoluta de imagen
  const getAbsoluteImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return `${window.location.origin}/assets/freepik__boostify_music_organe_abstract_icon.png`;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${window.location.origin}${imageUrl}`;
  };

  // Usar la imagen de la noticia directamente como OG image
  const ogImageUrl = getAbsoluteImageUrl(article.imageUrl);

  return (
    <>
      <Head
        title={`${article.title} | Boostify Music`}
        description={article.summary}
        image={ogImageUrl}
        url={shareUrl}
        type="article"
        siteName="Boostify Music"
      />
      
      <div className="min-h-screen bg-black">
        {/* Hero Section with Background Image */}
        <div className="relative h-[60vh] md:h-[70vh] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${article.imageUrl})`,
              filter: 'brightness(0.4) blur(8px)',
              transform: 'scale(1.1)'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
          
          <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-12 md:pb-16">
            {/* Back Button */}
            <Link href={`/profile/${article.userId}`}>
              <Button 
                variant="ghost" 
                className="absolute top-6 left-4 text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al perfil
              </Button>
            </Link>

            {/* Category Badge */}
            <div 
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow-lg mb-4 w-fit"
              style={{ backgroundColor: categoryInfo.bg }}
            >
              {categoryInfo.text}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 max-w-4xl">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm">{article.views} views</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Share Buttons */}
          <div className="flex gap-2 mb-8 flex-wrap">
            <Button
              onClick={() => handleShare('twitter')}
              className="bg-black hover:bg-gray-900 border border-gray-800"
              size="sm"
              data-testid="button-share-twitter"
            >
              <SiX className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              onClick={() => handleShare('facebook')}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
              data-testid="button-share-facebook"
            >
              <SiFacebook className="h-4 w-4 mr-2" />
              Facebook
            </Button>
            <Button
              onClick={() => handleShare('whatsapp')}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
              data-testid="button-share-whatsapp"
            >
              <SiWhatsapp className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              onClick={() => handleShare('telegram')}
              className="bg-blue-500 hover:bg-blue-600"
              size="sm"
              data-testid="button-share-telegram"
            >
              <SiTelegram className="h-4 w-4 mr-2" />
              Telegram
            </Button>
            <Button
              onClick={() => handleShare('copy')}
              variant="outline"
              className="border-gray-700 hover:bg-gray-900"
              size="sm"
              data-testid="button-copy-link"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </div>

          {/* Article Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              {article.content}
            </div>
          </div>

          {/* Back to Profile */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <Link href={`/profile/${article.userId}`}>
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="button-back-to-profile"
              >
                Ver más artículos del artista
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

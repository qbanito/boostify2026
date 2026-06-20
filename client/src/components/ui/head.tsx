import { Helmet } from "react-helmet-async";
import { logger } from "../../lib/logger";

interface HeadProps {
  title: string;
  description: string;
  image?: string;
  url: string;
  type?: string;
  siteName?: string;
  twitterUsername?: string;
}

export function Head({ 
  title, 
  description, 
  image, 
  url,
  type = "website",
  siteName = "Boostify Music",
  twitterUsername = "@boostifymusic"
}: HeadProps) {
  const defaultImage = `${window.location.origin}/assets/freepik__boostify_music_organe_abstract_icon.png`;
  const finalImage = image || defaultImage;
  
  // Asegurar que la imagen sea una URL absoluta
  let absoluteImageUrl = finalImage;
  if (!finalImage.startsWith('http')) {
    absoluteImageUrl = finalImage.startsWith('/') 
      ? `${window.location.origin}${finalImage}` 
      : `${window.location.origin}/${finalImage}`;
  }

  // Forzar HTTPS si la imagen lo soporta (requerido por algunas redes sociales)
  if (absoluteImageUrl.startsWith('http://') && !absoluteImageUrl.includes('localhost')) {
    absoluteImageUrl = absoluteImageUrl.replace('http://', 'https://');
  }

  // Asegurar que la descripción no sea demasiado larga (ideal 155-160 caracteres para SEO)
  const truncatedDescription = description.length > 155 
    ? `${description.slice(0, 152)}...` 
    : description;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={truncatedDescription} />
      <link rel="canonical" href={url} />
      <link rel="icon" type="image/png" href={defaultImage} />
      <link rel="apple-touch-icon" href={defaultImage} />

      {/* OpenGraph / Facebook / WhatsApp / LinkedIn */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:image" content={absoluteImageUrl} />
      <meta property="og:image:secure_url" content={absoluteImageUrl} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:locale:alternate" content="en_US" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={twitterUsername} />
      <meta name="twitter:creator" content={twitterUsername} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={truncatedDescription} />
      <meta name="twitter:image" content={absoluteImageUrl} />
      <meta name="twitter:image:alt" content={title} />
      <meta name="twitter:image:width" content="1200" />
      <meta name="twitter:image:height" content="630" />

      {/* Discord / Telegram optimizations */}
      <meta name="theme-color" content="#ea580c" />
      <meta property="telegram:channel" content={siteName} />
      
      {/* LinkedIn optimizations */}
      {type === "profile" && <meta property="article:author" content={siteName} />}
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Theme color for mobile browsers */}
      <meta name="theme-color" content="#ea580c" />
      <meta name="msapplication-TileColor" content="#ea580c" />
      <meta name="msapplication-TileImage" content={absoluteImageUrl} />
    </Helmet>
  );
}
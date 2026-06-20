import { useState } from "react";
import { logger } from "../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Package } from "lucide-react";

const affiliateProducts = [
  {
    id: 'boostify-premium-monthly',
    name: 'Boostify Premium - Monthly',
    description: 'Access to all Boostify features including AI music video creation, unlimited exports, and premium templates',
    url: 'https://boostify.com/premium/monthly',
    category: 'subscription',
    price: 29.99,
    commissionRate: 0.30,
    imageUrl: '/assets/products/premium-monthly.png',
    features: ['Unlimited video exports', 'AI video generation', 'Premium templates', 'Priority support'],
    active: true
  },
  {
    id: 'boostify-premium-yearly',
    name: 'Boostify Premium - Yearly',
    description: 'Annual subscription with 2 months free. Full access to Boostify platform',
    url: 'https://boostify.com/premium/yearly',
    category: 'subscription',
    price: 299.99,
    commissionRate: 0.35,
    imageUrl: '/assets/products/premium-yearly.png',
    features: ['All Premium features', '2 months free', 'Extended cloud storage', 'Premium support'],
    active: true
  },
  {
    id: 'music-production-course',
    name: 'Complete Music Production Masterclass',
    description: 'Learn professional music production from industry experts',
    url: 'https://boostify.com/courses/music-production',
    category: 'course',
    price: 199.99,
    commissionRate: 0.25,
    imageUrl: '/assets/products/music-course.png',
    features: ['10+ hours of content', 'Certificate of completion', 'Lifetime access', 'Project files included'],
    active: true
  },
  {
    id: 'mastering-plugin-bundle',
    name: 'Professional Mastering Plugin Bundle',
    description: 'Complete set of mastering plugins for professional sound',
    url: 'https://boostify.com/products/mastering-bundle',
    category: 'product',
    price: 149.99,
    commissionRate: 0.20,
    imageUrl: '/assets/products/plugin-bundle.png',
    features: ['10 premium plugins', 'VST/AU compatible', 'Lifetime updates', 'Tutorial videos'],
    active: true
  },
  {
    id: 'music-distribution-package',
    name: 'Music Distribution Package',
    description: 'Distribute your music to all major streaming platforms',
    url: 'https://boostify.com/distribution',
    category: 'service',
    price: 79.99,
    commissionRate: 0.30,
    imageUrl: '/assets/products/distribution.png',
    features: ['All major platforms', 'Unlimited releases', 'Keep 100% royalties', 'Analytics dashboard'],
    active: true
  },
  {
    id: 'marketing-consultation',
    name: '1-on-1 Music Marketing Consultation',
    description: 'Personal consultation session with music marketing experts',
    url: 'https://boostify.com/services/consultation',
    category: 'service',
    price: 99.99,
    commissionRate: 0.40,
    imageUrl: '/assets/products/consultation.png',
    features: ['1 hour session', 'Personalized strategy', 'Action plan included', 'Email follow-up'],
    active: true
  },
  {
    id: 'sample-pack-collection',
    name: 'Ultimate Sample Pack Collection',
    description: 'Over 10,000 royalty-free samples for music production',
    url: 'https://boostify.com/products/sample-pack',
    category: 'product',
    price: 59.99,
    commissionRate: 0.25,
    imageUrl: '/assets/products/sample-pack.png',
    features: ['10,000+ samples', 'Royalty-free', 'Multiple genres', 'Instant download'],
    active: true
  },
  {
    id: 'mixing-masterclass',
    name: 'Advanced Mixing Techniques Course',
    description: 'Master the art of mixing with professional techniques',
    url: 'https://boostify.com/courses/mixing',
    category: 'course',
    price: 149.99,
    commissionRate: 0.25,
    imageUrl: '/assets/products/mixing-course.png',
    features: ['8+ hours content', 'Project files', 'Certificate', 'Private community access'],
    active: true
  }
];

export default function InitProductsPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const { toast } = useToast();

  const initializeProducts = async () => {
    setLoading(true);
    setSuccess(false);
    
    try {
      const productsRef = collection(db, 'affiliateProducts');
      
      // Check existing products
      const existingDocs = await getDocs(productsRef);
      const existingIds = existingDocs.docs.map(d => d.id);
      
      let created = 0;
      let updated = 0;

      for (const product of affiliateProducts) {
        const { id, ...productData } = product;
        const productRef = doc(db, 'affiliateProducts', id);
        
        if (existingIds.includes(id)) {
          await setDoc(productRef, {
            ...productData,
            updatedAt: serverTimestamp()
          }, { merge: true });
          updated++;
        } else {
          await setDoc(productRef, {
            ...productData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          created++;
        }
      }

      setProductCount(affiliateProducts.length);
      setSuccess(true);
      
      toast({
        title: "Productos inicializados",
        description: `${created} productos creados, ${updated} actualizados`,
      });
      
    } catch (error) {
      logger.error('Error initializing products:', error);
      toast({
        title: "Error",
        description: "No se pudieron inicializar los productos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Inicializar Productos de Afiliado
            </CardTitle>
            <CardDescription>
              Crea los productos de ejemplo en Firestore para el sistema de afiliados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Productos a crear:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {affiliateProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs">{index + 1}.</span>
                    <span>{product.name}</span>
                    <span className="text-xs">- ${product.price} ({product.commissionRate * 100}%)</span>
                  </li>
                ))}
              </ul>
            </div>

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    ¡Productos inicializados correctamente!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {productCount} productos disponibles para afiliados
                  </p>
                </div>
              </div>
            )}

            <Button 
              onClick={initializeProducts} 
              disabled={loading}
              className="w-full"
              data-testid="button-init-products"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inicializando...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Inicializar Productos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { logger } from "../lib/logger";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import QRCode from "react-qr-code";
import {
  CreditCard,
  Package,
  Truck,
  QrCode as LucideQrCode,
  BadgeCheck,
  Share2,
  User
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const cardPackages = [
  {
    id: "50-cards",
    quantity: 50,
    price: 49.99,
    description: "Perfect for local networking",
    features: [
      "50 Premium Business Cards",
      "Custom QR Code",
      "Professional Design",
      "High Quality Print",
      "Free Shipping"
    ]
  },
  {
    id: "100-cards",
    quantity: 100,
    price: 89.99,
    popular: true,
    description: "Most popular choice",
    features: [
      "100 Premium Business Cards",
      "Custom QR Code",
      "Professional Design",
      "High Quality Print",
      "Free Shipping",
      "Premium Card Stock"
    ]
  },
  {
    id: "500-cards",
    quantity: 500,
    price: 399.99,
    description: "Best value for large events",
    features: [
      "500 Premium Business Cards",
      "Custom QR Code",
      "Professional Design",
      "High Quality Print",
      "Free Priority Shipping",
      "Premium Card Stock",
      "Custom Finish Options"
    ]
  }
];

export default function SmartCardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [, setLocation] = useLocation();


  const { data: artistData, isLoading } = useQuery({
    queryKey: ["/api/artist-profile", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data();
        }
        return {
          name: user.displayName || "Artist Name",
          displayName: user.displayName || "Artist Name",
        };
      } catch (error) {
        logger.error("Error fetching artist data:", error);
        return {
          name: user.displayName || "Artist Name",
          displayName: user.displayName || "Artist Name",
        };
      }
    },
    enabled: !!user?.uid
  });

  const handlePackageSelect = (packageId: string) => {
    setSelectedPackage(packageId);
    toast({
      title: "Coming Soon",
      description: "Payment processing will be available soon!",
    });
  };

  const artistUrl = `boostify.com/${artistData?.name?.toLowerCase() || "yourname"}`;

  return (
    <div className="min-h-screen bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
            Smart Business Cards
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Professional QR-enabled business cards that connect directly to your Boostify artist profile
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
        >
          <Card className="p-6 bg-black/50 backdrop-blur-sm border-orange-500/20">
            <LucideQrCode className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart QR Technology</h3>
            <p className="text-white/70">
              Direct access to your full artist profile with a simple scan
            </p>
          </Card>
          <Card className="p-6 bg-black/50 backdrop-blur-sm border-orange-500/20">
            <BadgeCheck className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Premium Quality</h3>
            <p className="text-white/70">
              High-quality card stock with professional finish options
            </p>
          </Card>
          <Card className="p-6 bg-black/50 backdrop-blur-sm border-orange-500/20">
            <Share2 className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Instant Connection</h3>
            <p className="text-white/70">
              Share your music, videos, and booking info instantly
            </p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <Card className="p-8 bg-black/50 backdrop-blur-sm border-orange-500/20">
            <h2 className="text-2xl font-bold mb-6 text-center">Your Card Preview</h2>
            <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
              <div className="relative aspect-[1.586] w-96 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-6">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl" />
                <div className="relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {artistData?.name || "Your Name"}
                      </h3>
                      <p className="text-white/70">{artistData?.genre || "Music Genre"}</p>
                    </div>
                    <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center p-2">
                      <QRCode
                        value={artistUrl}
                        size={80}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                        fgColor="#000000"
                        bgColor="#FFFFFF"
                      />
                    </div>
                  </div>
                  <div className="mt-auto pt-4">
                    <p className="text-sm text-white/60">Scan to view full profile</p>
                    <p className="text-sm text-orange-500">{artistUrl}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 max-w-md">
                <h3 className="text-xl font-semibold">Card Features:</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-white/70">
                    <BadgeCheck className="h-5 w-5 text-orange-500" />
                    Premium matte or glossy finish
                  </li>
                  <li className="flex items-center gap-2 text-white/70">
                    <LucideQrCode className="h-5 w-5 text-orange-500" />
                    Dynamic QR code linked to your profile
                  </li>
                  <li className="flex items-center gap-2 text-white/70">
                    <CreditCard className="h-5 w-5 text-orange-500" />
                    Standard business card size (3.5" x 2")
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cardPackages.map((pkg) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative"
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm">
                    Most Popular
                  </span>
                </div>
              )}
              <Card
                className={`p-6 bg-black/50 backdrop-blur-sm ${
                  pkg.popular
                    ? "border-orange-500"
                    : "border-orange-500/20"
                } hover:border-orange-500 transition-all duration-300`}
              >
                <div className="text-center mb-6">
                  <Package className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">{pkg.quantity} Cards</h3>
                  <p className="text-3xl font-bold text-orange-500">
                    ${pkg.price}
                  </p>
                  <p className="text-white/70 text-sm mt-2">{pkg.description}</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-white/70">
                      <BadgeCheck className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="space-y-4">
                  <Button
                    className={`w-full ${
                      pkg.popular
                        ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        : "bg-black/50 hover:bg-black/70"
                    } transition-all duration-300`}
                    onClick={() => handlePackageSelect(pkg.id)}
                  >
                    Order Now
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-orange-500/20 hover:bg-orange-500/10 text-orange-500"
                    onClick={() => setLocation("/profile")}
                  >
                    <User className="mr-2 h-5 w-5" />
                    View Your Profile
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-white/70">
            <Truck className="h-5 w-5 text-orange-500" />
            Free shipping on all orders • 7-10 business days delivery
          </div>
        </motion.div>
      </div>
    </div>
  );
}
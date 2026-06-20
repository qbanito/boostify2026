import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { logger } from "../lib/logger";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Bell,
  User,
  Shield,
  Palette,
  Globe,
  Music,
  Upload,
  Loader2,
  Sparkles,
  Wand2,
  CreditCard,
  Crown,
  Check,
  ArrowRight,
  Coins,
  History,
  Zap,
  Link2,
  Unlink2,
  AlertTriangle,
  LogOut,
  Download,
  Trash2,
  ExternalLink,
  Activity,
  RefreshCw,
  Lock,
  Smartphone,
  Clock,
  TrendingUp,
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { useSettingsStore, themeOptions, densityOptions, languageOptions } from "../store/settings-store";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useSubscription } from "../lib/context/subscription-context";
import { z } from "zod";
import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StylePresetSelector } from "../components/settings/style-preset-selector";

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSignedIn, isLoaded, user: clerkUser } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { subscription, currentPlan, isLoading: subscriptionLoading } = useSubscription();

  // Password visibility
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Credits state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  // Notification preferences (granular)
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newsletter: false,
    royaltyAlerts: true,
    syncOpportunities: true,
    platformUpdates: true,
    weeklyDigest: false,
    collaborationRequests: true,
    marketingEmails: false,
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  
  // Redirect to auth if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/auth");
    }
  }, [isLoaded, isSignedIn, setLocation]);
  
  // Global settings state
  const settings = useSettingsStore();
  
  // Estados para el perfil de artista
  const [artistProfileData, setArtistProfileData] = useState<any>(null);
  const [isLoadingArtistProfile, setIsLoadingArtistProfile] = useState(true);
  const [isSavingArtistProfile, setIsSavingArtistProfile] = useState(false);
  
  // Estados para generación con Gemini
  const [isGeneratingBiography, setIsGeneratingBiography] = useState(false);
  const [isGeneratingProfileImage, setIsGeneratingProfileImage] = useState(false);
  const [isGeneratingBannerImage, setIsGeneratingBannerImage] = useState(false);
  
  // Validation Schemas
  const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email").optional(),
    language: z.enum(languageOptions)
  });

  const artistProfileSchema = z.object({
    displayName: z.string().min(2, "Artist name must be at least 2 characters"),
    biography: z.string().min(10, "Biography must be at least 10 characters").optional(),
    genre: z.string().optional(),
    location: z.string().optional(),
    profileImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    bannerImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
    spotify: z.string().optional(),
  });
  
  const notificationsSchema = z.object({
    emailNotifications: z.boolean(),
    pushNotifications: z.boolean(),
    newsletter: z.boolean()
  });
  
  const appearanceSchema = z.object({
    theme: z.enum(themeOptions),
    density: z.enum(densityOptions)
  });
  
  const securitySchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
    confirmPassword: z.string()
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
  
  // Form initializers
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: settings.profile.name || "",
      email: settings.profile.email || "",
      language: settings.profile.language
    }
  });
  
  const notificationsForm = useForm({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      emailNotifications: settings.notifications.emailNotifications,
      pushNotifications: settings.notifications.pushNotifications,
      newsletter: settings.notifications.newsletter
    }
  });
  
  const appearanceForm = useForm({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      theme: settings.appearance.theme,
      density: settings.appearance.density
    }
  });
  
  const securityForm = useForm({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  const artistProfileForm = useForm({
    resolver: zodResolver(artistProfileSchema),
    defaultValues: {
      displayName: "",
      biography: "",
      genre: "",
      location: "",
      profileImage: "",
      bannerImage: "",
      contactEmail: "",
      contactPhone: "",
      instagram: "",
      twitter: "",
      youtube: "",
      spotify: "",
    }
  });

  // Load artist profile from Firestore
  useEffect(() => {
    const loadArtistProfile = async () => {
      if (!user?.uid) {
        setIsLoadingArtistProfile(false);
        return;
      }

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setArtistProfileData(userData);
          
          artistProfileForm.reset({
            displayName: userData.displayName || userData.name || "",
            biography: userData.biography || "",
            genre: userData.genre || "",
            location: userData.location || "",
            profileImage: userData.profileImage || userData.photoURL || "",
            bannerImage: userData.bannerImage || "",
            contactEmail: userData.contactEmail || userData.email || "",
            contactPhone: userData.contactPhone || "",
            instagram: userData.instagram || "",
            twitter: userData.twitter || "",
            youtube: userData.youtube || "",
            spotify: userData.spotify || "",
          });
        }
      } catch (error) {
        logger.error("Error loading artist profile:", error);
      } finally {
        setIsLoadingArtistProfile(false);
      }
    };

    loadArtistProfile();
  }, [user?.uid]);
  
  // Funciones de generación con Gemini
  const handleGenerateBiography = async () => {
    const currentName = artistProfileForm.getValues("displayName");
    const currentGenre = artistProfileForm.getValues("genre");
    const currentLocation = artistProfileForm.getValues("location");

    if (!currentName) {
      toast({
        title: "Name required",
        description: "Please enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBiography(true);

    try {
      const response = await fetch('/api/artist-profile/generate-biography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentName,
          genre: currentGenre,
          location: currentLocation,
        }),
      });

      const data = await response.json();

      if (data.success && data.biography) {
        artistProfileForm.setValue("biography", data.biography, { shouldDirty: true });
        toast({
          title: "Biography generated",
          description: "Your biography has been generated automatically. You can edit it if you wish.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate biography');
      }
    } catch (error: any) {
      logger.error("Error generating biography:", error);
      toast({
        title: "Error",
        description: "Could not generate biography. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBiography(false);
    }
  };

  const handleGenerateProfileImage = async () => {
    const currentName = artistProfileForm.getValues("displayName");
    const currentGenre = artistProfileForm.getValues("genre");

    if (!currentName) {
      toast({
        title: "Name required",
        description: "Please enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingProfileImage(true);

    try {
      const response = await fetch('/api/artist-profile/generate-profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: currentName,
          genre: currentGenre,
          style: "Professional portrait, studio lighting, artistic aesthetic",
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        artistProfileForm.setValue("profileImage", data.imageUrl, { shouldDirty: true });
        toast({
          title: "Profile image generated",
          description: "Your profile image has been generated. Copy the URL if you want to use it.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate profile image');
      }
    } catch (error: any) {
      logger.error("Error generating profile image:", error);
      toast({
        title: "Error",
        description: "Could not generate profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingProfileImage(false);
    }
  };

  const handleGenerateBannerImage = async () => {
    const currentName = artistProfileForm.getValues("displayName");
    const currentGenre = artistProfileForm.getValues("genre");

    if (!currentName) {
      toast({
        title: "Name required",
        description: "Please enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBannerImage(true);

    try {
      const response = await fetch('/api/artist-profile/generate-banner-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: currentName,
          genre: currentGenre,
          style: "Wide cinematic banner, professional music artist aesthetic",
          mood: "Creative and energetic atmosphere",
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        artistProfileForm.setValue("bannerImage", data.imageUrl, { shouldDirty: true });
        toast({
          title: "Banner image generated",
          description: "Your banner image has been generated. Copy the URL if you want to use it.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate banner image');
      }
    } catch (error: any) {
      logger.error("Error generating banner image:", error);
      toast({
        title: "Error",
        description: "Could not generate banner image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBannerImage(false);
    }
  };
  
  // Load credits
  const loadCredits = useCallback(async () => {
    if (!user?.email) return;
    setIsLoadingCredits(true);
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`/api/credits/balance?email=${encodeURIComponent(user.email)}`),
        fetch(`/api/credits/transactions?email=${encodeURIComponent(user.email)}`),
      ]);
      if (balRes.ok) {
        const balData = await balRes.json();
        setCreditBalance(balData.credits ?? 0);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setCreditTransactions(Array.isArray(txData) ? txData.slice(0, 10) : []);
      }
    } catch (e) {
      logger.error("Error loading credits:", e);
    } finally {
      setIsLoadingCredits(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) loadCredits();
  }, [user?.email, loadCredits]);

  // Save granular notifications
  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true);
    try {
      // Persist to settings store (base fields)
      settings.updateNotifications({
        emailNotifications: notifPrefs.emailNotifications,
        pushNotifications: notifPrefs.pushNotifications,
        newsletter: notifPrefs.newsletter,
      });
      // Persist extended prefs to Firestore if user is logged in
      if (user?.uid) {
        const q = query(collection(db, "users"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const notifData = { notificationPreferences: notifPrefs, updatedAt: new Date() };
        if (!snap.empty) {
          await setDoc(snap.docs[0].ref, notifData, { merge: true });
        }
      }
      toast({ title: "Notifications saved", description: "Your notification preferences have been updated." });
    } catch (e) {
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    } finally {
      setIsSavingNotifs(false);
    }
  };

  // Load notification prefs from Firestore
  useEffect(() => {
    const loadNotifPrefs = async () => {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, "users"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.notificationPreferences) {
            setNotifPrefs(prev => ({ ...prev, ...data.notificationPreferences }));
          }
        }
      } catch (e) { /* ignore */ }
    };
    loadNotifPrefs();
  }, [user?.uid]);

  // Form submit handlers
  const handleProfileSubmit = (values: z.infer<typeof profileSchema>) => {
    settings.updateProfile(values);
    toast({
      title: "Profile updated",
      description: "Your profile information has been updated."
    });
  };

  const handleArtistProfileSubmit = async (values: z.infer<typeof artistProfileSchema>) => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingArtistProfile(true);

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      const profileData = {
        uid: user.uid,
        displayName: values.displayName,
        name: values.displayName,
        biography: values.biography || "",
        genre: values.genre || "",
        location: values.location || "",
        profileImage: values.profileImage || "",
        photoURL: values.profileImage || "",
        bannerImage: values.bannerImage || "",
        contactEmail: values.contactEmail || "",
        contactPhone: values.contactPhone || "",
        instagram: values.instagram || "",
        twitter: values.twitter || "",
        youtube: values.youtube || "",
        spotify: values.spotify || "",
        updatedAt: new Date(),
      };

      if (!querySnapshot.empty) {
        // Update existing document
        const userDocRef = querySnapshot.docs[0].ref;
        await setDoc(userDocRef, profileData, { merge: true });
      } else {
        // Create new document
        const newDocRef = doc(collection(db, "users"));
        await setDoc(newDocRef, {
          ...profileData,
          createdAt: new Date(),
        });
      }

      toast({
        title: "Artist profile updated",
        description: "Your profile information has been saved successfully."
      });

      setArtistProfileData(profileData);
    } catch (error) {
      logger.error("Error saving artist profile:", error);
      toast({
        title: "Error",
        description: "Could not save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingArtistProfile(false);
    }
  };
  
  const handleNotificationsSubmit = (values: z.infer<typeof notificationsSchema>) => {
    settings.updateNotifications(values);
    toast({
      title: "Notification preferences updated",
      description: "Your notification preferences have been saved."
    });
  };
  
  const handleAppearanceSubmit = (values: z.infer<typeof appearanceSchema>) => {
    settings.updateAppearance(values);
    // Apply selected theme
    document.documentElement.setAttribute('data-theme', values.theme === 'system' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : values.theme);
    
    toast({
      title: "Appearance updated",
      description: "Your appearance preferences have been saved."
    });
  };
  
  const handleSecuritySubmit = (values: z.infer<typeof securitySchema>) => {
    // Password change logic would be implemented here
    // For now we just simulate success
    toast({
      title: "Password updated",
      description: "Your password has been updated successfully."
    });
    securityForm.reset();
  };
  
  // Apply theme on page load
  useEffect(() => {
    const theme = settings.appearance.theme;
    document.documentElement.setAttribute('data-theme', theme === 'system' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme);
  }, [settings.appearance.theme]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Don't render if not signed in (redirect in progress)
  if (!isSignedIn) {
    return null;
  }

  // Helper to get plan display name
  const getPlanDisplayName = (plan: string) => {
    const planNames: Record<string, string> = {
      'free': 'Free',
      'creator': 'Creator',
      'basic': 'Creator',
      'professional': 'Professional',
      'pro': 'Professional',
      'enterprise': 'Enterprise',
      'premium': 'Enterprise'
    };
    return planNames[plan] || 'Free';
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 md:pt-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your account, billing, and platform preferences
          </p>
        </div>
        {clerkUser && (
          <div className="flex items-center gap-3 shrink-0">
            <Avatar className="h-10 w-10 ring-2 ring-orange-500/30">
              <AvatarImage src={clerkUser.imageUrl} alt={clerkUser.fullName || "User"} />
              <AvatarFallback className="bg-orange-500/10 text-orange-500 font-semibold">
                {(clerkUser.firstName?.[0] || "") + (clerkUser.lastName?.[0] || "") || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-none">{clerkUser.fullName || clerkUser.username || "User"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{clerkUser.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="subscription" className="space-y-4 md:space-y-6">
        <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto h-auto flex-nowrap gap-0.5 p-1 min-w-max">
            <TabsTrigger value="subscription" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Crown className="h-3.5 w-3.5" /> Subscription
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Coins className="h-3.5 w-3.5" /> Credits
            </TabsTrigger>
            <TabsTrigger value="artist" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Music className="h-3.5 w-3.5" /> Artist Profile
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <User className="h-3.5 w-3.5" /> Account
            </TabsTrigger>
            <TabsTrigger value="connected" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Link2 className="h-3.5 w-3.5" /> Connected
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Bell className="h-3.5 w-3.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Palette className="h-3.5 w-3.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap">
              <Shield className="h-3.5 w-3.5" /> Security
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-4">
          <Card className="p-3 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-orange-500" />
              <h3 className="text-base md:text-lg font-semibold">Your Subscription</h3>
            </div>
            
            {subscriptionLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Plan */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Plan</p>
                      <p className="text-2xl font-bold text-orange-500">{getPlanDisplayName(currentPlan)}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      subscription?.status === 'active' 
                        ? 'bg-green-500/20 text-green-500' 
                        : subscription?.status === 'trialing'
                        ? 'bg-blue-500/20 text-blue-500'
                        : 'bg-gray-500/20 text-gray-500'
                    }`}>
                      {subscription?.status === 'active' ? 'Active' : 
                       subscription?.status === 'trialing' ? 'Trial' : 
                       subscription?.status || 'Free'}
                    </div>
                  </div>
                  
                  {subscription?.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {subscription.cancelAtPeriodEnd 
                        ? `Expires on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      }
                    </p>
                  )}
                </div>

                {/* Plan Features */}
                <div>
                  <h4 className="font-medium mb-3">Plan Features</h4>
                  <div className="grid gap-2">
                    {currentPlan === 'free' ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Basic analytics</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>1 artist profile</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Limited AI features</span>
                        </div>
                      </>
                    ) : currentPlan === 'creator' || currentPlan === 'basic' ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Advanced analytics</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>3 artist profiles</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>AI content generation</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Priority support</span>
                        </div>
                      </>
                    ) : currentPlan === 'professional' || currentPlan === 'pro' ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Full analytics suite</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>10 artist profiles</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>All AI features</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Video creation tools</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>24/7 support</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Enterprise analytics</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Unlimited artist profiles</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>All premium AI features</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>White-label options</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Dedicated account manager</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Upgrade Button */}
                {(currentPlan === 'free' || currentPlan === 'creator' || currentPlan === 'basic') && (
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    onClick={() => setLocation('/pricing')}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade Your Plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}

                {/* Manage Subscription */}
                {subscription && subscription.status === 'active' && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Manage Subscription</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" onClick={() => setLocation('/pricing')}>
                        Change Plan
                      </Button>
                      {subscription.stripeSubscriptionId && (
                        <Button 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/subscription/create-portal-session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                              });
                              const data = await response.json();
                              if (data.url) {
                                window.location.href = data.url;
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Could not open billing portal",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          Manage Billing
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Credits Tab ── */}
        <TabsContent value="credits" className="space-y-4">
          {/* Balance card */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 sm:col-span-1 flex flex-col items-center justify-center text-center bg-gradient-to-br from-orange-500/10 to-purple-500/10 border-orange-500/30">
              <Coins className="h-8 w-8 text-orange-500 mb-2" />
              {isLoadingCredits ? (
                <Loader2 className="h-6 w-6 animate-spin text-orange-500 my-2" />
              ) : (
                <p className="text-4xl font-bold text-orange-500">{creditBalance?.toLocaleString() ?? "—"}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Available Credits</p>
              <p className="text-xs text-muted-foreground mt-0.5">≈ ${((creditBalance ?? 0) * 0.01).toFixed(2)} USD value</p>
              <Button size="sm" variant="outline" className="mt-3 gap-2 border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-500" onClick={loadCredits} disabled={isLoadingCredits}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCredits ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </Card>

            <Card className="p-5 sm:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-orange-500" /> Credit Packages</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { credits: 500, price: "$4.99" },
                  { credits: 1200, price: "$9.99", badge: "Popular" },
                  { credits: 3000, price: "$24.99" },
                  { credits: 7500, price: "$49.99", badge: "Best Value" },
                  { credits: 20000, price: "$99.99" },
                  { credits: 60000, price: "$249.99" },
                ].map(pkg => (
                  <div key={pkg.credits} className="relative p-3 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all cursor-pointer text-center">
                    {pkg.badge && <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-1.5 py-0">{pkg.badge}</Badge>}
                    <p className="font-bold text-sm mt-1">{pkg.credits.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">credits</p>
                    <p className="font-semibold text-orange-500 text-sm mt-1">{pkg.price}</p>
                    <Button size="sm" className="w-full mt-2 h-7 text-xs bg-orange-500 hover:bg-orange-600" onClick={() => setLocation('/pricing')}>
                      <ShoppingCart className="h-3 w-3 mr-1" /> Buy
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Monthly allocation */}
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <h3 className="font-semibold">Monthly Plan Allocation</h3>
                <p className="text-xs text-muted-foreground">Credits included with your {getPlanDisplayName(currentPlan)} plan</p>
              </div>
            </div>
            {(() => {
              const allocations: Record<string, number> = { free: 50, artist: 200, creator: 500, basic: 500, professional: 2000, pro: 2000, enterprise: 10000, premium: 10000 };
              const alloc = allocations[currentPlan] ?? 50;
              const used = Math.max(0, alloc - (creditBalance ?? alloc));
              const pct = Math.min(100, Math.round((used / alloc) * 100));
              return (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{used.toLocaleString()} used</span>
                    <span className="font-medium">{alloc.toLocaleString()} / month</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground">{100 - pct}% remaining this cycle</p>
                </div>
              );
            })()}
          </Card>

          {/* Transaction history */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-orange-500" /> Recent Transactions</h3>
              <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-500">{creditTransactions.length} records</Badge>
            </div>
            {isLoadingCredits ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : creditTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {creditTransactions.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? "bg-green-500/10" : "bg-orange-500/10"}`}>
                        {tx.amount > 0 ? <Zap className="h-3.5 w-3.5 text-green-500" /> : <Activity className="h-3.5 w-3.5 text-orange-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{tx.description || tx.operationType || "Credit transaction"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-green-500" : "text-orange-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="artist" className="space-y-4">
          <Card className="p-3 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Artist Profile Information</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This information will be displayed on your public artist profile
            </p>
            
            {isLoadingArtistProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <Form {...artistProfileForm}>
                <form onSubmit={artistProfileForm.handleSubmit(handleArtistProfileSubmit)} className="space-y-4">
                  <FormField
                    control={artistProfileForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Artist Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your artist name" {...field} data-testid="input-artist-name" />
                        </FormControl>
                        <FormDescription>
                          This will be your public name as an artist
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={artistProfileForm.control}
                    name="biography"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Biography</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateBiography}
                            disabled={isGeneratingBiography}
                            data-testid="button-generate-biography"
                          >
                            {isGeneratingBiography ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate with AI
                              </>
                            )}
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us your story as an artist..." 
                            className="min-h-[100px]"
                            {...field}
                            data-testid="input-biography"
                          />
                        </FormControl>
                        <FormDescription>
                          A brief description about you and your music
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={artistProfileForm.control}
                      name="genre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Music Genre</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g: Pop, Rock, Hip-Hop" {...field} data-testid="input-genre" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={artistProfileForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="City, Country" {...field} data-testid="input-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={artistProfileForm.control}
                    name="profileImage"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Profile Image URL</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateProfileImage}
                            disabled={isGeneratingProfileImage}
                            data-testid="button-generate-profile-image"
                          >
                            {isGeneratingProfileImage ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generate with AI
                              </>
                            )}
                          </Button>
                        </div>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/image.jpg" 
                            {...field} 
                            data-testid="input-profile-image"
                          />
                        </FormControl>
                        <FormDescription>
                          URL of your profile photo (JPG, PNG, etc.)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={artistProfileForm.control}
                    name="bannerImage"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Banner Image URL</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateBannerImage}
                            disabled={isGeneratingBannerImage}
                            data-testid="button-generate-banner-image"
                          >
                            {isGeneratingBannerImage ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generate with AI
                              </>
                            )}
                          </Button>
                        </div>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/banner.jpg" 
                            {...field} 
                            data-testid="input-banner-image"
                          />
                        </FormControl>
                        <FormDescription>
                          URL of your cover image (banner)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-semibold mb-3">Contact Information</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={artistProfileForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="contact@example.com" {...field} data-testid="input-contact-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={artistProfileForm.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 234 567 8900" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-semibold mb-3">Social Networks</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={artistProfileForm.control}
                        name="instagram"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Instagram</FormLabel>
                            <FormControl>
                              <Input placeholder="@yourusername" {...field} data-testid="input-instagram" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={artistProfileForm.control}
                        name="twitter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Twitter / X</FormLabel>
                            <FormControl>
                              <Input placeholder="@yourusername" {...field} data-testid="input-twitter" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={artistProfileForm.control}
                        name="youtube"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>YouTube</FormLabel>
                            <FormControl>
                              <Input placeholder="https://youtube.com/@yourchannel" {...field} data-testid="input-youtube" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={artistProfileForm.control}
                        name="spotify"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Spotify</FormLabel>
                            <FormControl>
                              <Input placeholder="https://open.spotify.com/artist/..." {...field} data-testid="input-spotify" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full md:w-auto"
                    disabled={!artistProfileForm.formState.isDirty || isSavingArtistProfile}
                    data-testid="button-save-artist-profile"
                  >
                    {isSavingArtistProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </Card>
        </TabsContent>

        {/* ── Account / Profile Tab ── */}
        <TabsContent value="profile" className="space-y-4">
          {/* Clerk account overview */}
          {clerkUser && (
            <Card className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <Avatar className="h-16 w-16 ring-2 ring-orange-500/30">
                  <AvatarImage src={clerkUser.imageUrl} alt={clerkUser.fullName || "User"} />
                  <AvatarFallback className="bg-orange-500/10 text-orange-500 text-xl font-bold">
                    {(clerkUser.firstName?.[0] || "") + (clerkUser.lastName?.[0] || "") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{clerkUser.fullName || clerkUser.username || "User"}</h3>
                  <p className="text-sm text-muted-foreground">{clerkUser.primaryEmailAddress?.emailAddress}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-500 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                    <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-500">
                      {getPlanDisplayName(currentPlan)}
                    </Badge>
                  </div>
                </div>
              </div>
              <Separator className="mb-5" />
              <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Full Name</p>
                  <p className="font-medium">{clerkUser.fullName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Username</p>
                  <p className="font-medium">{clerkUser.username || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Email</p>
                  <p className="font-medium">{clerkUser.primaryEmailAddress?.emailAddress || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Member Since</p>
                  <p className="font-medium">{clerkUser.createdAt ? new Date(clerkUser.createdAt).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Last Active</p>
                  <p className="font-medium">{clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">User ID</p>
                  <p className="font-mono text-xs text-muted-foreground truncate">{clerkUser.id}</p>
                </div>
              </div>
              <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600" onClick={() => openUserProfile()}>
                <User className="mr-2 h-4 w-4" /> Edit Profile in Clerk
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Card>
          )}

          {/* Platform language preference */}
          <Card className="p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-500" /> Language Preference
            </h3>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interface Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="max-w-xs">
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="es">🇪🇸 Español</SelectItem>
                          <SelectItem value="en">🇺🇸 English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full sm:w-auto" disabled={!profileForm.formState.isDirty}>
                  Save Language
                </Button>
              </form>
            </Form>
          </Card>
        </TabsContent>

        {/* ── Connected Accounts Tab ── */}
        <TabsContent value="connected" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2"><Link2 className="h-4 w-4 text-orange-500" /> OAuth Connections</h3>
            <p className="text-sm text-muted-foreground mb-5">Social accounts connected to your Clerk identity</p>
            <div className="space-y-3">
              {(clerkUser?.externalAccounts ?? []).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Unlink2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No external accounts connected</p>
                  <Button variant="outline" size="sm" className="mt-3 border-orange-500/30 hover:bg-orange-500/10" onClick={() => openUserProfile()}>
                    Connect Account <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                clerkUser?.externalAccounts.map((acct) => (
                  <div key={acct.id} className="flex items-center justify-between p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium capitalize">{acct.provider}</p>
                        <p className="text-xs text-muted-foreground">{acct.emailAddress || acct.username || acct.id}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">Connected</Badge>
                  </div>
                ))
              )}
            </div>
            <Button variant="outline" className="mt-4 w-full sm:w-auto border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-500" onClick={() => openUserProfile()}>
              Manage Connected Accounts <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Card>

          {/* Platform integrations */}
          <Card className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2"><Music className="h-4 w-4 text-orange-500" /> Platform Integrations</h3>
            <p className="text-sm text-muted-foreground mb-5">Connect your music distribution accounts for deeper analytics</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { name: "Spotify for Artists", icon: "🎵", desc: "Sync streams and listener analytics", connected: false },
                { name: "Apple Music Connect", icon: "🍎", desc: "Access Apple Music metrics", connected: false },
                { name: "YouTube Studio", icon: "▶️", desc: "Video views and subscriber sync", connected: false },
                { name: "DistroKid", icon: "📦", desc: "Distribution status and royalties", connected: false },
                { name: "TuneCore", icon: "🎸", desc: "Revenue and release tracking", connected: false },
                { name: "SoundCloud", icon: "☁️", desc: "Play counts and fan engagement", connected: false },
              ].map(plat => (
                <div key={plat.name} className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-orange-500/30 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{plat.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{plat.name}</p>
                      <p className="text-xs text-muted-foreground">{plat.desc}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={plat.connected ? "outline" : "default"} className={plat.connected ? "border-green-500/30 text-green-500 hover:text-red-500 hover:border-red-500/30" : "bg-orange-500 hover:bg-orange-600 h-7 text-xs"}>
                    {plat.connected ? "Connected" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ── */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2"><Bell className="h-4 w-4 text-orange-500" /> Notification Preferences</h3>
            <p className="text-sm text-muted-foreground mb-5">Choose exactly what you want to be notified about</p>
            <div className="space-y-1">
              {([
                { key: "emailNotifications", icon: "📧", label: "Email Notifications", desc: "Receive all updates via email" },
                { key: "pushNotifications", icon: "🔔", label: "Push Notifications", desc: "Real-time browser/app notifications" },
                { key: "royaltyAlerts", icon: "💰", label: "Royalty & Revenue Alerts", desc: "Payment received, royalty statements" },
                { key: "syncOpportunities", icon: "🎬", label: "Sync Licensing Opportunities", desc: "New TV, film, and ad placement leads" },
                { key: "platformUpdates", icon: "⚡", label: "Platform Updates", desc: "New features and improvements" },
                { key: "weeklyDigest", icon: "📊", label: "Weekly Performance Digest", desc: "Streams, plays, and catalog stats" },
                { key: "collaborationRequests", icon: "🤝", label: "Collaboration Requests", desc: "Artist and producer collab invites" },
                { key: "newsletter", icon: "📰", label: "Monthly Newsletter", desc: "Industry news and platform highlights" },
                { key: "marketingEmails", icon: "📢", label: "Marketing & Promotions", desc: "Special offers and promo campaigns" },
              ] as { key: keyof typeof notifPrefs; icon: string; label: string; desc: string }[]).map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifPrefs[item.key]}
                    onCheckedChange={val => setNotifPrefs(prev => ({ ...prev, [item.key]: val }))}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-5 w-full sm:w-auto bg-orange-500 hover:bg-orange-600" onClick={handleSaveNotifications} disabled={isSavingNotifs}>
              {isSavingNotifs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Preferences
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card className="p-3 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Customization</h3>
            
            <Form {...appearanceForm}>
              <form onSubmit={appearanceForm.handleSubmit(handleAppearanceSubmit)} className="space-y-3 md:space-y-4">
                <FormField
                  control={appearanceForm.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a theme" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appearanceForm.control}
                  name="density"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Density</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select density" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="comfortable">Comfortable</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={!appearanceForm.formState.isDirty}
                >
                  Save Changes
                </Button>
              </form>
            </Form>
            
          </Card>

          {/* Visual Style Preset Selector */}
          <Card className="p-3 md:p-6">
            <StylePresetSelector />
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="space-y-4">
          {/* Password change */}
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-5 w-5 text-orange-500" />
              <div>
                <h3 className="font-semibold">Change Password</h3>
                <p className="text-xs text-muted-foreground">Managed through your Clerk account</p>
              </div>
            </div>
            <Form {...securityForm}>
              <form onSubmit={securityForm.handleSubmit(handleSecuritySubmit)} className="space-y-4">
                <FormField
                  control={securityForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showCurrentPwd ? "text" : "password"} className="pr-10" {...field} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCurrentPwd(v => !v)}>
                            {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={securityForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showNewPwd ? "text" : "password"} className="pr-10" {...field} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPwd(v => !v)}>
                            {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">Min. 8 chars, one uppercase, one number</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={securityForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showConfirmPwd ? "text" : "password"} className="pr-10" {...field} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPwd(v => !v)}>
                            {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={!securityForm.formState.isDirty}>
                    Update Password
                  </Button>
                  <Button type="button" variant="outline" className="border-orange-500/30 hover:bg-orange-500/10" onClick={() => openUserProfile()}>
                    Manage via Clerk <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
            </Form>
          </Card>

          {/* 2FA + Sessions */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="h-5 w-5 text-orange-500" />
                <div>
                  <h3 className="font-semibold">Two-Factor Authentication</h3>
                  <p className="text-xs text-muted-foreground">Extra layer of security for your account</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground">Authenticator app or SMS</p>
                </div>
                <Switch
                  checked={settings.security.twoFactorEnabled}
                  onCheckedChange={(value) => {
                    settings.updateSecurity({ twoFactorEnabled: value });
                    openUserProfile();
                  }}
                />
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full border-orange-500/30 hover:bg-orange-500/10" onClick={() => openUserProfile()}>
                Configure 2FA <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <h3 className="font-semibold">Active Sessions</h3>
                  <p className="text-xs text-muted-foreground">Devices where you're signed in</p>
                </div>
              </div>
              {clerkUser?.lastSignInAt && (
                <div className="p-3 rounded-lg bg-muted/50 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-sm font-medium">Current Session</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last active: {new Date(clerkUser.lastSignInAt).toLocaleString()}</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full border-orange-500/30 hover:bg-orange-500/10" onClick={() => openUserProfile()}>
                View All Sessions <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Card>
          </div>

          {/* Data & Privacy */}
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Download className="h-5 w-5 text-orange-500" />
              <div>
                <h3 className="font-semibold">Data & Privacy</h3>
                <p className="text-xs text-muted-foreground">Control and export your personal data</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-orange-500/30 hover:bg-orange-500/10" onClick={() => {
                toast({ title: "Data export requested", description: "We'll send you an email with your data within 24 hours." });
              }}>
                <Download className="mr-2 h-4 w-4" /> Export My Data
              </Button>
              <Button variant="outline" className="border-orange-500/30 hover:bg-orange-500/10" onClick={() => setLocation('/privacy')}>
                <Globe className="mr-2 h-4 w-4" /> Privacy Policy
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="p-5 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Danger Zone</h3>
                <p className="text-xs text-muted-foreground">Irreversible actions — proceed with caution</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
                onClick={async () => {
                  try {
                    await signOut();
                    setLocation("/auth");
                  } catch (e) {
                    toast({ title: "Error", description: "Could not sign out.", variant: "destructive" });
                  }
                }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your data, artist profiles, songs, and settings will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => openUserProfile()}
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

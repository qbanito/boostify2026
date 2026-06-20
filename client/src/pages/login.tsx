import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield, CheckCircle2, Mail, Github } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Beta Notice Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm md:text-base font-medium">
            🚀 Platform in Beta Testing & Development Phase - Official Launch: January 2026
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-52px)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
        <Card className="border-2 shadow-2xl">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mb-2">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Welcome to Boostify Music
            </CardTitle>
            <CardDescription className="text-base">
              Sign in to access your artist dashboard and tools
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Main Sign In Button */}
            <Button
              onClick={handleLogin}
              size="lg"
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
              data-testid="button-sign-in"
            >
              <Lock className="w-5 h-5 mr-2" />
              Sign In Securely
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Authentication options
                </span>
              </div>
            </div>

            {/* Auth Options Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
                  <SiGoogle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <span>Continue with Google</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950 dark:to-slate-950">
                  <Github className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                </div>
                <span>Continue with GitHub</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Continue with Email & Password</span>
              </div>
            </div>

            {/* Security Features */}
            <div className="pt-4 space-y-3 border-t">
              <p className="text-sm font-semibold text-center text-muted-foreground">
                Secured with enterprise-grade authentication
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>OpenID Connect & OAuth 2.0 protocols</span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>End-to-end encrypted connections</span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>Secure session management with PostgreSQL</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>No passwords stored on our servers</span>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <p className="text-xs text-center text-muted-foreground pt-2">
              By signing in, you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground" data-testid="link-terms">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-foreground" data-testid="link-privacy">
                Privacy Policy
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Additional Trust Indicators */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            Powered by Replit Auth
          </p>
          <p className="text-xs text-muted-foreground">
            Trusted by thousands of artists worldwide
          </p>
        </div>
        </motion.div>
      </div>
    </div>
  );
}

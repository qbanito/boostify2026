import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { CheckCircle2, Mail, Clock, ShoppingBag, ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

/**
 * Product Purchase Success Page
 * Displayed after a successful product purchase from the Boostify Store.
 * Stripe redirects here with session_id and product_id query params.
 * Informs the user they will receive plugin/product access via email within 24-48 hours.
 */
export default function ProductSuccessPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('session_id'));
    setProductId(params.get('product_id'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-orange-500/5">
      <div className="container max-w-3xl mx-auto px-4 py-16">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-2xl shadow-green-500/30">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Payment{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
              Successful!
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Thank you for your purchase. Your order is being processed.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-orange-500/30 bg-gradient-to-br from-background to-orange-500/5 shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
            <CardContent className="p-8 md:p-10">
              {/* Email Notification Section */}
              <div className="flex items-start gap-5 mb-8 p-6 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <div className="p-3 bg-orange-500/10 rounded-xl flex-shrink-0">
                  <Mail className="h-8 w-8 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You will receive access to your purchased plugin/product via email within{' '}
                    <span className="font-semibold text-orange-500">24 to 48 hours</span>. 
                    Our team is preparing your access credentials and download links.
                  </p>
                </div>
              </div>

              {/* Timeline Steps */}
              <div className="space-y-6 mb-8">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  What happens next?
                </h3>
                
                <div className="relative pl-8 space-y-6">
                  {/* Vertical Line */}
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-500 via-orange-500 to-orange-500/30" />
                  
                  {[
                    {
                      icon: CheckCircle2,
                      title: 'Payment Confirmed',
                      description: 'Your payment has been successfully processed through Stripe.',
                      color: 'text-green-500',
                      bgColor: 'bg-green-500',
                      done: true,
                    },
                    {
                      icon: Clock,
                      title: 'Processing Your Order',
                      description: 'Our team is setting up your access credentials and preparing your product.',
                      color: 'text-orange-500',
                      bgColor: 'bg-orange-500',
                      done: false,
                    },
                    {
                      icon: Mail,
                      title: 'Email Delivery (24-48 hrs)',
                      description: 'You will receive an email with your access link, license key and setup instructions.',
                      color: 'text-orange-500/60',
                      bgColor: 'bg-orange-500/60',
                      done: false,
                    },
                  ].map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.2 }}
                      className="relative flex items-start gap-4"
                    >
                      <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500' : 'bg-orange-500/20 border-2 border-orange-500/40'}`}>
                        {step.done && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${step.color}`}>{step.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 mb-8">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-blue-400">Tip:</strong> Make sure to check your spam/junk folder 
                  if you don't see the email within 48 hours. If you still haven't received it, contact our 
                  support team at <span className="text-orange-500 font-medium">support@boostifymusic.com</span>
                </p>
              </div>

              {/* Order Reference */}
              {sessionId && (
                <div className="text-center text-xs text-muted-foreground/60 mb-6">
                  Order Reference: {sessionId.substring(0, 20)}...
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/store">
                  <Button variant="outline" className="w-full sm:w-auto border-orange-500/30 hover:bg-orange-500/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Store
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Decorative Elements */}
        <div className="fixed top-20 left-10 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-20 right-10 w-96 h-96 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { XCircle, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Link } from 'wouter';

/**
 * Product Purchase Cancelled Page
 * Displayed when a user cancels the Stripe checkout for a store product.
 */
export default function ProductCancelledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-orange-500/5">
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl" />
            <div className="relative p-6 bg-gradient-to-br from-red-500 to-rose-600 rounded-full shadow-2xl shadow-red-500/30">
              <XCircle className="h-16 w-16 text-white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold mb-3">Payment Cancelled</h1>
          <p className="text-lg text-muted-foreground">
            Your purchase was not completed. No charges were made.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-orange-500/20 bg-gradient-to-br from-background to-orange-500/5">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-8">
                If you changed your mind or encountered an issue, you can try again anytime. 
                Your cart items are still available in the store.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/store">
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Return to Store
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full sm:w-auto border-orange-500/30 hover:bg-orange-500/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

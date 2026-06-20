/**
 * Cart canceled page
 */
import { Link } from 'wouter';
import { XCircle, ShoppingBag, ArrowLeft } from 'lucide-react';

export default function CartCanceledPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
          <XCircle className="w-8 h-8 text-white/40" />
        </div>
        <h1 className="text-3xl font-black mb-3">Checkout canceled</h1>
        <p className="text-white/50 mb-8">Your cart is still saved. You can complete your purchase whenever you're ready.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/store">
            <a className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <ShoppingBag className="w-4 h-4" />
              Continue shopping
            </a>
          </Link>
          <Link href="/">
            <a className="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm py-3 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back home
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}

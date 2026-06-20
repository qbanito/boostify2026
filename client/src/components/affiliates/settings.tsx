import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { CreditCard, DollarSign, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface PaymentSettings {
  paymentMethod: 'paypal' | 'bank_transfer' | 'crypto';
  paymentEmail?: string;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    swiftCode?: string;
  };
  cryptoAddress?: string;
  minPayoutAmount?: number;
  autoPayoutEnabled?: boolean;
}

export function AffiliateSettings() {
  const { user } = useAuth() || {};
  const { toast } = useToast();
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    paymentMethod: 'paypal',
    paymentEmail: '',
    minPayoutAmount: 50,
    autoPayoutEnabled: true
  });

  // Query para obtener datos del afiliado
  const { data: affiliateData, isLoading } = useQuery({
    queryKey: ["/api/affiliate/me"],
    enabled: !!user?.uid
  });

  // Mutación para actualizar configuración de pago
  const updatePaymentMutation = useMutation({
    mutationFn: async (settings: PaymentSettings) => {
      return apiRequest({
        url: "/api/affiliate/settings/payment",
        method: "PATCH",
        data: settings
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment settings updated",
        description: "Your payment settings have been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating settings",
        description: error.message || "Failed to update payment settings",
        variant: "destructive",
      });
    }
  });

  const handleSavePaymentSettings = () => {
    // Validar según el método de pago seleccionado
    if (paymentSettings.paymentMethod === 'paypal' && !paymentSettings.paymentEmail) {
      toast({
        title: "PayPal email required",
        description: "Please enter your PayPal email address",
        variant: "destructive",
      });
      return;
    }

    if (paymentSettings.paymentMethod === 'bank_transfer' && 
        (!paymentSettings.bankDetails?.accountName || !paymentSettings.bankDetails?.accountNumber)) {
      toast({
        title: "Bank details required",
        description: "Please enter your bank account details",
        variant: "destructive",
      });
      return;
    }

    if (paymentSettings.paymentMethod === 'crypto' && !paymentSettings.cryptoAddress) {
      toast({
        title: "Crypto address required",
        description: "Please enter your cryptocurrency wallet address",
        variant: "destructive",
      });
      return;
    }

    updatePaymentMutation.mutate(paymentSettings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Settings
              </CardTitle>
              <CardDescription>
                Configure how you want to receive your affiliate commissions
              </CardDescription>
            </div>
            {affiliateData?.data?.paymentSettings?.paymentEmail && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={paymentSettings.paymentMethod}
                onValueChange={(value: 'paypal' | 'bank_transfer' | 'crypto') => 
                  setPaymentSettings({ ...paymentSettings, paymentMethod: value })
                }
              >
                <SelectTrigger id="payment-method" data-testid="select-payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="crypto">Cryptocurrency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentSettings.paymentMethod === 'paypal' && (
              <div className="space-y-2">
                <Label htmlFor="paypal-email">PayPal Email</Label>
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="your-email@paypal.com"
                  value={paymentSettings.paymentEmail || ''}
                  onChange={(e) => setPaymentSettings({ 
                    ...paymentSettings, 
                    paymentEmail: e.target.value 
                  })}
                  data-testid="input-paypal-email"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the email address associated with your PayPal account
                </p>
              </div>
            )}

            {paymentSettings.paymentMethod === 'bank_transfer' && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium">Bank Account Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">Account Holder Name</Label>
                    <Input
                      id="account-name"
                      placeholder="John Doe"
                      value={paymentSettings.bankDetails?.accountName || ''}
                      onChange={(e) => setPaymentSettings({
                        ...paymentSettings,
                        bankDetails: { ...paymentSettings.bankDetails, accountName: e.target.value }
                      })}
                      data-testid="input-account-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input
                      id="account-number"
                      placeholder="1234567890"
                      value={paymentSettings.bankDetails?.accountNumber || ''}
                      onChange={(e) => setPaymentSettings({
                        ...paymentSettings,
                        bankDetails: { ...paymentSettings.bankDetails, accountNumber: e.target.value }
                      })}
                      data-testid="input-account-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      placeholder="Bank of America"
                      value={paymentSettings.bankDetails?.bankName || ''}
                      onChange={(e) => setPaymentSettings({
                        ...paymentSettings,
                        bankDetails: { ...paymentSettings.bankDetails, bankName: e.target.value }
                      })}
                      data-testid="input-bank-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swift-code">SWIFT/BIC Code (Optional)</Label>
                    <Input
                      id="swift-code"
                      placeholder="BOFAUS3N"
                      value={paymentSettings.bankDetails?.swiftCode || ''}
                      onChange={(e) => setPaymentSettings({
                        ...paymentSettings,
                        bankDetails: { ...paymentSettings.bankDetails, swiftCode: e.target.value }
                      })}
                      data-testid="input-swift-code"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentSettings.paymentMethod === 'crypto' && (
              <div className="space-y-2">
                <Label htmlFor="crypto-address">Cryptocurrency Wallet Address</Label>
                <Input
                  id="crypto-address"
                  placeholder="0x..."
                  value={paymentSettings.cryptoAddress || ''}
                  onChange={(e) => setPaymentSettings({ 
                    ...paymentSettings, 
                    cryptoAddress: e.target.value 
                  })}
                  data-testid="input-crypto-address"
                />
                <p className="text-sm text-muted-foreground">
                  We support BTC, ETH, and USDT. Make sure the address is correct.
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Payout Preferences</h4>
            
            <div className="space-y-2">
              <Label htmlFor="min-payout">Minimum Payout Amount (USD)</Label>
              <Select
                value={String(paymentSettings.minPayoutAmount || 50)}
                onValueChange={(value) => 
                  setPaymentSettings({ ...paymentSettings, minPayoutAmount: Number(value) })
                }
              >
                <SelectTrigger id="min-payout" data-testid="select-min-payout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">$25</SelectItem>
                  <SelectItem value="50">$50</SelectItem>
                  <SelectItem value="100">$100</SelectItem>
                  <SelectItem value="250">$250</SelectItem>
                  <SelectItem value="500">$500</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Minimum balance required before payout is processed
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <div className="font-medium">Automatic Payouts</div>
                <div className="text-sm text-muted-foreground">
                  Receive payments automatically when minimum amount is reached
                </div>
              </div>
              <Button
                variant={paymentSettings.autoPayoutEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentSettings({
                  ...paymentSettings,
                  autoPayoutEnabled: !paymentSettings.autoPayoutEnabled
                })}
                data-testid="button-toggle-auto-payout"
              >
                {paymentSettings.autoPayoutEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSavePaymentSettings}
              disabled={updatePaymentMutation.isPending}
              className="flex-1"
              data-testid="button-save-payment-settings"
            >
              {updatePaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Payment Settings
                </>
              )}
            </Button>
          </div>

          {paymentSettings.paymentMethod === 'paypal' && (
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">PayPal Integration</p>
                <p className="text-sm text-muted-foreground">
                  Payments are processed within 3-5 business days. Make sure your PayPal account can receive payments.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your affiliate account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Affiliate ID</Label>
              <div className="font-mono text-sm p-2 bg-muted rounded">
                {user?.uid?.substring(0, 16) || 'Loading...'}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Account Status</Label>
              <div>
                <Badge variant={affiliateData?.data?.status === 'approved' ? 'default' : 'secondary'}>
                  {affiliateData?.data?.status || 'Pending'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Member Since</Label>
              <div className="text-sm">
                {affiliateData?.data?.createdAt 
                  ? new Date(affiliateData.data.createdAt.seconds * 1000).toLocaleDateString()
                  : 'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Current Level</Label>
              <div className="font-medium">
                {affiliateData?.data?.level || 'Básico'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

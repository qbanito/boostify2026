"""
Fix Official Store module:
  1. artist-profile-card.tsx:
     a) Fix checkout endpoint URL (/.netlify/functions → /api/artist-profile/create-checkout-session)
     b) Fix productType extraction (use product.type || name-based lookup)
     c) Loosen hasValidMerchImage validation (FAL/FHDR URLs were being rejected+deleted)
     d) Add type + generatedByAI to saved product objects
  2. official-store-section.tsx:
     a) Add selectedSize state to QuickViewModal
     b) Make size chips clickable (user can pick size before buying)
     c) Pass selected size as sizes[0] when calling onBuy
"""

# ══════════════════════════════════════════════════════
# File 1: artist-profile-card.tsx
# ══════════════════════════════════════════════════════
with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    card = f.read()

# ── Fix 1a + 1b: Checkout URL + productType extraction ──
old_buy = (
    "                    onBuyClick={(product) => {\n"
    "                      // Delegate to ProductBuyButton-like logic via checkout endpoint\n"
    "                      const checkoutUrl = (import.meta as any).env?.VITE_NETLIFY_FUNCTIONS_URL\n"
    "                        ? `${(import.meta as any).env.VITE_NETLIFY_FUNCTIONS_URL}/create-checkout`\n"
    "                        : '/.netlify/functions/create-checkout';\n"
    "                      const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : '';\n"
    "                      fetch(checkoutUrl, {\n"
    "                        method: 'POST',\n"
    "                        headers: { 'Content-Type': 'application/json' },\n"
    "                        body: JSON.stringify({\n"
    "                          productName: product.name,\n"
    "                          productPrice: product.price,\n"
    "                          productImage: product.imageUrl,\n"
    "                          artistName: artist.name,\n"
    "                          productId: product.id,\n"
    "                          productType: (product as any).type,\n"
    "                          size,\n"
    "                        }),\n"
    "                      })\n"
    "                        .then(r => r.json())\n"
    "                        .then((result: any) => {\n"
    "                          if (result.success && result.url) {\n"
    "                            window.location.href = result.url;\n"
    "                          } else {\n"
    "                            throw new Error(result.error || 'Checkout failed');\n"
    "                          }\n"
    "                        })\n"
    "                        .catch((err: any) => {\n"
    "                          console.error('Checkout error:', err);\n"
    "                        });\n"
    "                    }}"
)

new_buy = (
    "                    onBuyClick={(product) => {\n"
    "                      // Express server endpoint (works on Render)\n"
    "                      const checkoutUrl = '/api/artist-profile/create-checkout-session';\n"
    "                      // sizes[0] = selected size (QuickViewModal puts chosen size first)\n"
    "                      const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : '';\n"
    "                      // Extract type from stored field or product name for Printful variant lookup\n"
    "                      const productType = (product as any).type ||\n"
    "                        ['T-Shirt', 'Hoodie', 'Cap', 'Poster', 'Sticker Pack', 'Mug']\n"
    "                          .find(t => product.name?.includes(t)) || '';\n"
    "                      fetch(checkoutUrl, {\n"
    "                        method: 'POST',\n"
    "                        headers: { 'Content-Type': 'application/json' },\n"
    "                        body: JSON.stringify({\n"
    "                          productName: product.name,\n"
    "                          productPrice: product.price,\n"
    "                          productImage: product.imageUrl,\n"
    "                          artistName: artist.name,\n"
    "                          productId: product.id,\n"
    "                          productType,\n"
    "                          size,\n"
    "                        }),\n"
    "                      })\n"
    "                        .then(r => r.json())\n"
    "                        .then((result: any) => {\n"
    "                          if (result.success && result.url) {\n"
    "                            window.location.href = result.url;\n"
    "                          } else {\n"
    "                            throw new Error(result.error || 'Checkout failed');\n"
    "                          }\n"
    "                        })\n"
    "                        .catch((err: any) => {\n"
    "                          console.error('Checkout error:', err);\n"
    "                        });\n"
    "                    }}"
)

if old_buy in card:
    card = card.replace(old_buy, new_buy, 1)
    print("FIX 1a+1b SUCCESS: checkout URL + productType fixed")
else:
    print("FIX 1a+1b FAIL: onBuyClick block not found")

# ── Fix 1c: Loosen hasValidMerchImage — accept any non-artist-profile URL ──
old_filter = (
    "          for (const product of allProducts) {\n"
    "            const productType = product.name?.split(' ').pop() || product.category || 'Unknown';\n"
    "            const hasValidMerchImage = product.imageUrl?.includes('merchandise-imag') || \n"
    "                                        product.imageUrl?.includes('merchandise_') ||\n"
    "                                        (product.generatedByAI === true && !product.imageUrl?.includes('artist-images'));\n"
    "            const isArtistImage = product.imageUrl?.includes('artist-images/');\n"
    "            const isUnsplashFallback = product.imageUrl?.includes('unsplash.com');\n"
    "            \n"
    "            // Mantener solo productos con imágenes válidas de merchandise (1 por tipo)\n"
    "            if (!seenTypes.has(productType) && hasValidMerchImage && !isArtistImage && !isUnsplashFallback) {\n"
    "              seenTypes.add(productType);\n"
    "              validProducts.push(product);\n"
    "            } else {\n"
    "              // Marcar para eliminación si es duplicado o tiene imagen incorrecta\n"
    "              productsToDelete.push(product.id);\n"
    "            }\n"
    "          }"
)

new_filter = (
    "          for (const product of allProducts) {\n"
    "            const productType = product.name?.split(' ').pop() || product.category || 'Unknown';\n"
    "            // Accept any image URL that isn't an artist profile photo\n"
    "            // (FAL, FHDR, Firebase Storage non-profile paths, etc. are all valid)\n"
    "            const isArtistProfileImage = product.imageUrl?.includes('artist-images/');\n"
    "            const hasValidMerchImage = !!(product.imageUrl) && !isArtistProfileImage;\n"
    "            \n"
    "            // Keep products with valid images (1 per type to avoid duplicates)\n"
    "            if (!seenTypes.has(productType) && hasValidMerchImage) {\n"
    "              seenTypes.add(productType);\n"
    "              validProducts.push(product);\n"
    "            } else {\n"
    "              // Mark duplicates for cleanup only\n"
    "              productsToDelete.push(product.id);\n"
    "            }\n"
    "          }"
)

if old_filter in card:
    card = card.replace(old_filter, new_filter, 1)
    print("FIX 1c SUCCESS: hasValidMerchImage validation loosened")
else:
    print("FIX 1c FAIL: image filter block not found")

# ── Fix 1d: Add type + generatedByAI to saved products ──
old_product_save = (
    "          const product = {\n"
    "            name: productDef.name,\n"
    "            description: productDef.description,\n"
    "            price: productDef.price,\n"
    "            imageUrl: productImage,\n"
    "            category: productDef.category,\n"
    "            sizes: productDef.sizes,\n"
    "            userId: userIdForProducts, // Usar pgId para consistencia\n"
    "            createdAt: new Date(),\n"
    "          };"
)

new_product_save = (
    "          const product = {\n"
    "            name: productDef.name,\n"
    "            description: productDef.description,\n"
    "            price: productDef.price,\n"
    "            imageUrl: productImage,\n"
    "            category: productDef.category,\n"
    "            sizes: productDef.sizes,\n"
    "            type: productDef.type,         // for Printful variant lookup\n"
    "            generatedByAI: true,           // marks this as a valid merchandise image\n"
    "            userId: userIdForProducts, // Usar pgId para consistencia\n"
    "            createdAt: new Date(),\n"
    "          };"
)

if old_product_save in card:
    card = card.replace(old_product_save, new_product_save, 1)
    print("FIX 1d SUCCESS: type + generatedByAI added to saved products")
else:
    print("FIX 1d FAIL: product save block not found")

with open('client/src/components/artist/artist-profile-card.tsx', 'w', encoding='utf-8') as f:
    f.write(card)

print()

# ══════════════════════════════════════════════════════
# File 2: official-store-section.tsx — size selector in QuickViewModal
# ══════════════════════════════════════════════════════
with open('client/src/components/artist/official-store-section.tsx', 'r', encoding='utf-8') as f:
    store = f.read()

# ── Fix 2a: Add selectedSize state ──
old_qv_state = (
    "  const { toast } = useToast();\n"
    "  const queryClient = useQueryClient();\n"
    "  const [liveDescription, setLiveDescription] = useState<string | null>(null);"
)

new_qv_state = (
    "  const { toast } = useToast();\n"
    "  const queryClient = useQueryClient();\n"
    "  const [liveDescription, setLiveDescription] = useState<string | null>(null);\n"
    "  const [selectedSize, setSelectedSize] = useState<string>(product?.sizes?.[0] || '');\n"
    "\n"
    "  // Reset selected size whenever the product changes\n"
    "  useEffect(() => {\n"
    "    setSelectedSize(product?.sizes?.[0] || '');\n"
    "  }, [product?.id]);"
)

if old_qv_state in store:
    store = store.replace(old_qv_state, new_qv_state, 1)
    print("FIX 2a SUCCESS: selectedSize state added to QuickViewModal")
else:
    print("FIX 2a FAIL: QuickViewModal state block not found")

# ── Fix 2b: Make size chips clickable ──
old_sizes = (
    "            {/* Sizes */}\n"
    "            {product.sizes && product.sizes.length > 0 && (\n"
    "              <div className=\"mb-3\">\n"
    "                <p className=\"text-xs text-gray-400 mb-1.5\">Available sizes:</p>\n"
    "                <div className=\"flex flex-wrap gap-1.5\">\n"
    "                  {product.sizes.map(size => (\n"
    "                    <span\n"
    "                      key={size}\n"
    "                      className=\"px-2.5 py-1 rounded-md text-xs font-bold border\"\n"
    "                      style={{ borderColor: colors.hexAccent, color: colors.hexAccent }}\n"
    "                    >\n"
    "                      {size}\n"
    "                    </span>\n"
    "                  ))}\n"
    "                </div>\n"
    "              </div>\n"
    "            )}"
)

new_sizes = (
    "            {/* Sizes — clickable selector */}\n"
    "            {product.sizes && product.sizes.length > 0 && (\n"
    "              <div className=\"mb-3\">\n"
    "                <p className=\"text-xs text-gray-400 mb-1.5\">\n"
    "                  Size: <span className=\"font-bold\" style={{ color: colors.hexAccent }}>{selectedSize || product.sizes[0]}</span>\n"
    "                </p>\n"
    "                <div className=\"flex flex-wrap gap-1.5\">\n"
    "                  {product.sizes.map(size => {\n"
    "                    const isSelected = (selectedSize || product.sizes![0]) === size;\n"
    "                    return (\n"
    "                      <button\n"
    "                        key={size}\n"
    "                        onClick={() => setSelectedSize(size)}\n"
    "                        className=\"px-2.5 py-1 rounded-md text-xs font-bold border transition-all hover:scale-105\"\n"
    "                        style={{\n"
    "                          borderColor: isSelected ? colors.hexPrimary : `${colors.hexAccent}60`,\n"
    "                          background: isSelected ? colors.hexPrimary : 'transparent',\n"
    "                          color: isSelected ? 'white' : colors.hexAccent,\n"
    "                          boxShadow: isSelected ? `0 0 8px ${colors.hexPrimary}60` : 'none',\n"
    "                        }}\n"
    "                      >\n"
    "                        {size}\n"
    "                      </button>\n"
    "                    );\n"
    "                  })}\n"
    "                </div>\n"
    "              </div>\n"
    "            )}"
)

if old_sizes in store:
    store = store.replace(old_sizes, new_sizes, 1)
    print("FIX 2b SUCCESS: size chips made clickable")
else:
    print("FIX 2b FAIL: sizes block not found")

# ── Fix 2c: Buy button passes selected size as sizes[0] ──
old_buy_btn = (
    "              <Button\n"
    "                onClick={() => onBuy(product)}\n"
    "                className=\"flex-1 font-bold\"\n"
    "                style={{\n"
    "                  background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,\n"
    "                  color: 'white',\n"
    "                }}\n"
    "              >\n"
    "                <ShoppingCart className=\"w-4 h-4 mr-2\" />\n"
    "                Buy Now — ${product.price}\n"
    "              </Button>"
)

new_buy_btn = (
    "              <Button\n"
    "                onClick={() => {\n"
    "                  const chosenSize = selectedSize || product.sizes?.[0] || '';\n"
    "                  // Put the chosen size first so parent's sizes[0] = selected size\n"
    "                  const productWithSize = chosenSize\n"
    "                    ? { ...product, sizes: [chosenSize, ...(product.sizes || []).filter(s => s !== chosenSize)] }\n"
    "                    : product;\n"
    "                  onBuy(productWithSize);\n"
    "                }}\n"
    "                className=\"flex-1 font-bold\"\n"
    "                style={{\n"
    "                  background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,\n"
    "                  color: 'white',\n"
    "                }}\n"
    "              >\n"
    "                <ShoppingCart className=\"w-4 h-4 mr-2\" />\n"
    "                Buy Now — ${product.price}\n"
    "              </Button>"
)

if old_buy_btn in store:
    store = store.replace(old_buy_btn, new_buy_btn, 1)
    print("FIX 2c SUCCESS: Buy button passes selected size")
else:
    print("FIX 2c FAIL: QuickViewModal Buy button not found")

with open('client/src/components/artist/official-store-section.tsx', 'w', encoding='utf-8') as f:
    f.write(store)

print()
print("DONE")

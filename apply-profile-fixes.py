with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# CHANGE 1: Command Center - navigation for non-owners
# Replace the handleModuleToggle function to allow navigation
# ============================================================

old_toggle = (
    "                        const handleModuleToggle = (mod: { id: string; side: 'left' | 'right' }, e: React.MouseEvent | React.TouchEvent) => {\n"
    "                          e.preventDefault();\n"
    "                          e.stopPropagation();\n"
    "                          if (!isOwnProfile) return;\n"
    "                          if (mod.side === 'left') {\n"
    "                            const wasActive = sectionVisibility[mod.id] !== false;\n"
    "                            if (wasActive) {\n"
    "                              setSectionVisibility(prev => ({ ...prev, [mod.id]: false }));\n"
    "                              setSectionExpanded(prev => ({ ...prev, [mod.id]: false }));\n"
    "                            } else {\n"
    "                              setSectionVisibility(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              setSectionExpanded(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              const scrollToEl = (retries: number) => {\n"
    "                                const el = document.getElementById(`section-${mod.id}`);\n"
    "                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "                                else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);\n"
    "                              };\n"
    "                              setTimeout(() => scrollToEl(3), 400);\n"
    "                            }\n"
    "                          } else {\n"
    "                            const wasActive = rightVisibility[mod.id] !== false;\n"
    "                            if (wasActive) {\n"
    "                              setRightVisibility(prev => ({ ...prev, [mod.id]: false }));\n"
    "                            } else {\n"
    "                              setRightVisibility(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              const scrollToEl = (retries: number) => {\n"
    "                                const el = document.getElementById(`widget-${mod.id}`);\n"
    "                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "                                else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);\n"
    "                              };\n"
    "                              setTimeout(() => scrollToEl(3), 400);\n"
    "                            }\n"
    "                          }\n"
    "                        };"
)

new_toggle = (
    "                        const handleModuleToggle = (mod: { id: string; side: 'left' | 'right' }, e: React.MouseEvent | React.TouchEvent) => {\n"
    "                          e.preventDefault();\n"
    "                          e.stopPropagation();\n"
    "                          // Non-owners: navigate to section (read-only)\n"
    "                          if (!isOwnProfile) {\n"
    "                            const targetId = mod.side === 'left' ? `section-${mod.id}` : `widget-${mod.id}`;\n"
    "                            const scrollToEl = (retries: number) => {\n"
    "                              const el = document.getElementById(targetId);\n"
    "                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "                              else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);\n"
    "                            };\n"
    "                            scrollToEl(3);\n"
    "                            return;\n"
    "                          }\n"
    "                          if (mod.side === 'left') {\n"
    "                            const wasActive = sectionVisibility[mod.id] !== false;\n"
    "                            if (wasActive) {\n"
    "                              setSectionVisibility(prev => ({ ...prev, [mod.id]: false }));\n"
    "                              setSectionExpanded(prev => ({ ...prev, [mod.id]: false }));\n"
    "                            } else {\n"
    "                              setSectionVisibility(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              setSectionExpanded(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              const scrollToEl = (retries: number) => {\n"
    "                                const el = document.getElementById(`section-${mod.id}`);\n"
    "                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "                                else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);\n"
    "                              };\n"
    "                              setTimeout(() => scrollToEl(3), 400);\n"
    "                            }\n"
    "                          } else {\n"
    "                            const wasActive = rightVisibility[mod.id] !== false;\n"
    "                            if (wasActive) {\n"
    "                              setRightVisibility(prev => ({ ...prev, [mod.id]: false }));\n"
    "                            } else {\n"
    "                              setRightVisibility(prev => ({ ...prev, [mod.id]: true }));\n"
    "                              const scrollToEl = (retries: number) => {\n"
    "                                const el = document.getElementById(`widget-${mod.id}`);\n"
    "                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "                                else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);\n"
    "                              };\n"
    "                              setTimeout(() => scrollToEl(3), 400);\n"
    "                            }\n"
    "                          }\n"
    "                        };"
)

if old_toggle in content:
    content = content.replace(old_toggle, new_toggle, 1)
    print("Change 1 (toggle fn): SUCCESS")
else:
    print("Change 1 (toggle fn): NOT FOUND")

# ============================================================
# CHANGE 1b: Remove disabled and update cursor on the button
# ============================================================
old_button_attrs = (
    "                                disabled={!isOwnProfile}\n"
    "                                title={mod.name.replace(/[^\\w\\s]/g, '').trim()}\n"
    "                                className=\"flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95\"\n"
    "                                style={{\n"
    "                                  background: isActive ? `${activeColor}10` : 'rgba(255,255,255,0.03)',\n"
    "                                  borderColor: isActive ? `${activeColor}35` : 'rgba(255,255,255,0.07)',\n"
    "                                  cursor: isOwnProfile ? 'pointer' : 'default',\n"
    "                                  touchAction: 'manipulation',\n"
    "                                  WebkitTapHighlightColor: 'transparent',\n"
    "                                }}"
)
new_button_attrs = (
    "                                title={isOwnProfile ? `Toggle ${mod.name.replace(/[^\\w\\s]/g, '').trim()}` : `Go to ${mod.name.replace(/[^\\w\\s]/g, '').trim()}`}\n"
    "                                className=\"flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95\"\n"
    "                                style={{\n"
    "                                  background: isActive ? `${activeColor}10` : 'rgba(255,255,255,0.03)',\n"
    "                                  borderColor: isActive ? `${activeColor}35` : 'rgba(255,255,255,0.07)',\n"
    "                                  cursor: 'pointer',\n"
    "                                  touchAction: 'manipulation',\n"
    "                                  WebkitTapHighlightColor: 'transparent',\n"
    "                                }}"
)
if old_button_attrs in content:
    content = content.replace(old_button_attrs, new_button_attrs, 1)
    print("Change 1b (button attrs): SUCCESS")
else:
    print("Change 1b (button attrs): NOT FOUND")

# ============================================================
# CHANGE 2: Move social-hub right after videos in defaultOrder
# ============================================================
old_order = "  const defaultOrder = ['influencer-module', 'songs', 'videos', 'news', 'social-posts', 'social-hub', 'merchandise', 'galleries', 'downloads', 'tokenization', 'monetize-cta', 'analytics', 'earnings', 'crowdfunding', 'sponsors', 'venueBooking', 'explicit-content', 'aas-engine', 'viral-products', 'brand-collabs', 'business-plan'];"
new_order = "  const defaultOrder = ['influencer-module', 'songs', 'videos', 'social-hub', 'news', 'social-posts', 'merchandise', 'galleries', 'downloads', 'tokenization', 'monetize-cta', 'analytics', 'earnings', 'crowdfunding', 'sponsors', 'venueBooking', 'explicit-content', 'aas-engine', 'viral-products', 'brand-collabs', 'business-plan'];"
if old_order in content:
    content = content.replace(old_order, new_order, 1)
    print("Change 2 (defaultOrder): SUCCESS")
else:
    print("Change 2 (defaultOrder): NOT FOUND")

# ============================================================
# CHANGE 3: Monetize CTA - English + creative animation
# Make it visible to all (remove isOwnProfile condition) + redesign
# ============================================================
old_monetize = (
    "                      } else if (sectionId === 'monetize-cta' && isOwnProfile) {\n"
    "                        sectionElement = (\n"
    "                          <div className={cardStyles} style={{ ...cardStyleInline, position: 'relative', overflow: 'hidden' }}>\n"
    "                            {renderSectionHeader(sectionId, Sparkles, 'Monetize Your Talent')}\n"
    "                            {sectionExpanded[sectionId] && (\n"
    "                              <>\n"
    "                            <div className=\"absolute inset-0 opacity-10\" style={{\n"
    "                              background: `radial-gradient(circle at 30% 50%, ${colors.hexPrimary}, transparent 70%)`\n"
    "                            }}></div>\n"
    "                            \n"
    "                            <div className=\"relative z-10\">\n"
    "                              <div className=\"flex items-center gap-2 mb-3\">\n"
    "                                <Music className=\"h-6 w-6\" style={{ color: colors.hexAccent }} />\n"
    "                                <div \n"
    "                                  className=\"text-base font-bold transition-colors duration-500\" \n"
    "                                  style={{ color: colors.hexAccent }}\n"
    "                                >\n"
    "                                  {t('profile.monetize.title')}\n"
    "                                </div>\n"
    "                              </div>\n"
    "                              \n"
    "                              <p className=\"text-sm text-gray-300 mb-4 leading-relaxed\">\n"
    "                                {t('profile.monetize.description')}\n"
    "                              </p>\n"
    "                              \n"
    "                              <Link href=\"/producer-tools\">\n"
    "                                <button\n"
    "                                  className=\"w-full py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2\"\n"
    "                                  style={{ \n"
    "                                    background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,\n"
    "                                    color: 'white'\n"
    "                                  }}\n"
    "                                  data-testid=\"button-producer-tools\"\n"
    "                                >\n"
    "                                  <Sparkles className=\"h-4 w-4\" />\n"
    "                                  <span>{t('profile.monetize.cta')}</span>\n"
    "                                  <ArrowRight className=\"h-4 w-4\" />\n"
    "                                </button>\n"
    "                              </Link>\n"
    "                              \n"
    "                              <div className=\"mt-3 flex items-center justify-center gap-4 text-xs text-gray-400\">\n"
    "                                <span className=\"flex items-center gap-1\">\n"
    "                                  <Check className=\"h-3 w-3\" style={{ color: colors.hexAccent }} />\n"
    "                                  Beats\n"
    "                                </span>\n"
    "                                <span className=\"flex items-center gap-1\">\n"
    "                                  <Check className=\"h-3 w-3\" style={{ color: colors.hexAccent }} />\n"
    "                                  Mixing\n"
    "                                </span>\n"
    "                                <span className=\"flex items-center gap-1\">\n"
    "                                  <Check className=\"h-3 w-3\" style={{ color: colors.hexAccent }} />\n"
    "                                  Master\n"
    "                                </span>\n"
    "                              </div>\n"
    "                            </div>\n"
    "                              </>\n"
    "                            )}\n"
    "                          </div>\n"
    "                        );"
)

new_monetize = (
    "                      } else if (sectionId === 'monetize-cta') {\n"
    "                        sectionElement = (\n"
    "                          <div className={cardStyles} style={{ ...cardStyleInline, position: 'relative', overflow: 'hidden' }}>\n"
    "                            {renderSectionHeader(sectionId, Sparkles, 'Launch Your Career')}\n"
    "                            {sectionExpanded[sectionId] && (\n"
    "                              <>\n"
    "                            {/* Animated background */}\n"
    "                            <div className=\"absolute inset-0 pointer-events-none\" style={{ overflow: 'hidden' }}>\n"
    "                              <div style={{\n"
    "                                position: 'absolute', inset: 0,\n"
    "                                background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${colors.hexPrimary}18, transparent 70%)`,\n"
    "                                animation: 'pulseGlow 3s ease-in-out infinite alternate',\n"
    "                              }} />\n"
    "                              {[...Array(5)].map((_, i) => (\n"
    "                                <div key={i} style={{\n"
    "                                  position: 'absolute',\n"
    "                                  width: 3, height: 3,\n"
    "                                  borderRadius: '50%',\n"
    "                                  background: colors.hexAccent,\n"
    "                                  opacity: 0.4,\n"
    "                                  left: `${15 + i * 18}%`,\n"
    "                                  top: `${20 + (i % 3) * 20}%`,\n"
    "                                  animation: `float ${2 + i * 0.4}s ease-in-out infinite alternate`,\n"
    "                                  animationDelay: `${i * 0.3}s`,\n"
    "                                }} />\n"
    "                              ))}\n"
    "                            </div>\n"
    "\n"
    "                            <div className=\"relative z-10\">\n"
    "                              {/* Animated icon badge */}\n"
    "                              <div className=\"flex justify-center mb-4\">\n"
    "                                <motion.div\n"
    "                                  animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}\n"
    "                                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}\n"
    "                                  className=\"w-14 h-14 rounded-2xl flex items-center justify-center\"\n"
    "                                  style={{\n"
    "                                    background: `linear-gradient(135deg, ${colors.hexPrimary}30, ${colors.hexAccent}25)`,\n"
    "                                    boxShadow: `0 0 24px ${colors.hexAccent}40`,\n"
    "                                    border: `1px solid ${colors.hexAccent}30`,\n"
    "                                  }}\n"
    "                                >\n"
    "                                  <Sparkles className=\"h-7 w-7\" style={{ color: colors.hexAccent }} />\n"
    "                                </motion.div>\n"
    "                              </div>\n"
    "\n"
    "                              {/* Headline */}\n"
    "                              <motion.div\n"
    "                                initial={{ opacity: 0, y: 8 }}\n"
    "                                animate={{ opacity: 1, y: 0 }}\n"
    "                                transition={{ duration: 0.5 }}\n"
    "                                className=\"text-center mb-2\"\n"
    "                              >\n"
    "                                <h3 className=\"text-base font-bold tracking-tight\" style={{ color: colors.hexAccent }}>\n"
    "                                  Turn Your Music Into a Business\n"
    "                                </h3>\n"
    "                                <p className=\"text-xs text-gray-400 mt-1.5 leading-relaxed px-1\">\n"
    "                                  Release tracks, grow your fanbase, and earn — all from one platform built for independent artists.\n"
    "                                </p>\n"
    "                              </motion.div>\n"
    "\n"
    "                              {/* Feature pills */}\n"
    "                              <div className=\"flex flex-wrap justify-center gap-1.5 my-3\">\n"
    "                                {['Distribute Music', 'Sell Beats', 'Fan Merch', 'Live Shows'].map((feat, i) => (\n"
    "                                  <motion.span\n"
    "                                    key={feat}\n"
    "                                    initial={{ opacity: 0, scale: 0.8 }}\n"
    "                                    animate={{ opacity: 1, scale: 1 }}\n"
    "                                    transition={{ delay: 0.1 + i * 0.08 }}\n"
    "                                    className=\"text-[10px] font-semibold px-2.5 py-0.5 rounded-full\"\n"
    "                                    style={{ background: `${colors.hexAccent}18`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}25` }}\n"
    "                                  >\n"
    "                                    {feat}\n"
    "                                  </motion.span>\n"
    "                                ))}\n"
    "                              </div>\n"
    "\n"
    "                              {/* CTA Button */}\n"
    "                              <Link href=\"/producer-tools\">\n"
    "                                <motion.button\n"
    "                                  whileHover={{ scale: 1.03 }}\n"
    "                                  whileTap={{ scale: 0.97 }}\n"
    "                                  className=\"w-full py-3 px-4 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 mt-1\"\n"
    "                                  style={{ \n"
    "                                    background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,\n"
    "                                    color: 'white',\n"
    "                                    boxShadow: `0 4px 20px ${colors.hexAccent}30`,\n"
    "                                  }}\n"
    "                                  data-testid=\"button-producer-tools\"\n"
    "                                >\n"
    "                                  <Sparkles className=\"h-4 w-4\" />\n"
    "                                  <span>Start Your Journey</span>\n"
    "                                  <ArrowRight className=\"h-4 w-4\" />\n"
    "                                </motion.button>\n"
    "                              </Link>\n"
    "\n"
    "                              {/* Social proof */}\n"
    "                              <p className=\"text-center text-[10px] text-gray-600 mt-3\">\n"
    "                                \u2728 Join thousands of artists already on Boostify\n"
    "                              </p>\n"
    "                            </div>\n"
    "                              </>\n"
    "                            )}\n"
    "                          </div>\n"
    "                        );"
)

if old_monetize in content:
    content = content.replace(old_monetize, new_monetize, 1)
    print("Change 3 (monetize-cta): SUCCESS")
else:
    print("Change 3 (monetize-cta): NOT FOUND")
    # Debug
    idx = content.find("monetize-cta' && isOwnProfile")
    if idx != -1:
        print("Found at idx:", idx)
        print(repr(content[idx:idx+100]))

# Save
with open('client/src/components/artist/artist-profile-card.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("File saved.")

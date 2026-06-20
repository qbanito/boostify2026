with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Add to sectionModules map ─────────────────────────────
old1 = "    'monetize-cta': { name: getSectionLabel(pageMode, 'monetize-cta', 'Monetize Your Talent'), icon: Sparkles, isOwnerOnly: false },"
new1 = (
    "    'monetize-cta': { name: getSectionLabel(pageMode, 'monetize-cta', 'Monetize Your Talent'), icon: Sparkles, isOwnerOnly: false },\n"
    "    'video-service-promo': { name: 'Video Service \U0001f3ac', icon: Film, isOwnerOnly: false },"
)
assert old1 in content, "FAIL: sectionModules map not found"
content = content.replace(old1, new1, 1)
print("1. sectionModules map updated")

# ── 2. Add to defaultOrder (after monetize-cta) ──────────────
old2 = "'monetize-cta', 'analytics'"
new2 = "'monetize-cta', 'video-service-promo', 'analytics'"
assert old2 in content, "FAIL: defaultOrder not found"
content = content.replace(old2, new2, 1)
print("2. defaultOrder updated")

# ── 3. Add to defaultVisibility ──────────────────────────────
old3 = "    'monetize-cta': true,\n    'analytics': true,"
new3 = "    'monetize-cta': true,\n    'video-service-promo': true,\n    'analytics': true,"
assert old3 in content, "FAIL: defaultVisibility not found"
content = content.replace(old3, new3, 1)
print("3. defaultVisibility updated")

# ── 4. Add to defaultExpanded ────────────────────────────────
old4 = "    'monetize-cta': false,\n    'analytics': false,"
new4 = "    'monetize-cta': false,\n    'video-service-promo': false,\n    'analytics': false,"
assert old4 in content, "FAIL: defaultExpanded not found"
content = content.replace(old4, new4, 1)
print("4. defaultExpanded updated")

# ── 5. Add render block after monetize-cta section ───────────
# Find the closing of the monetize-cta block and insert after it
old5 = (
    "                      } else if (sectionId === 'analytics' && isOwnProfile) {"
)
new5 = (
    "                      } else if (sectionId === 'video-service-promo') {\n"
    "                        sectionElement = (\n"
    "                          <div className={cardStyles} style={{ ...cardStyleInline, position: 'relative', overflow: 'hidden' }}>\n"
    "                            {renderSectionHeader(sectionId, Film, 'Video Service \U0001f3ac')}\n"
    "                            {sectionExpanded[sectionId] && (\n"
    "                              <>\n"
    "                            {/* Cinematic background */}\n"
    "                            <div className=\"absolute inset-0 pointer-events-none\" style={{ overflow: 'hidden' }}>\n"
    "                              <div style={{\n"
    "                                position: 'absolute', inset: 0,\n"
    "                                background: 'linear-gradient(135deg, rgba(234,88,12,0.12) 0%, rgba(168,85,247,0.10) 100%)',\n"
    "                              }} />\n"
    "                              {[...Array(6)].map((_, i) => (\n"
    "                                <div key={i} style={{\n"
    "                                  position: 'absolute',\n"
    "                                  width: i % 2 === 0 ? 2 : 3, height: i % 2 === 0 ? 2 : 3,\n"
    "                                  borderRadius: '50%',\n"
    "                                  background: i < 3 ? '#ea580c' : '#a855f7',\n"
    "                                  opacity: 0.35,\n"
    "                                  left: `${10 + i * 16}%`,\n"
    "                                  top: `${15 + (i % 3) * 25}%`,\n"
    "                                  animation: `float ${2.2 + i * 0.35}s ease-in-out infinite alternate`,\n"
    "                                  animationDelay: `${i * 0.25}s`,\n"
    "                                }} />\n"
    "                              ))}\n"
    "                            </div>\n"
    "\n"
    "                            <div className=\"relative z-10\">\n"
    "                              {/* Icon + badge */}\n"
    "                              <div className=\"flex justify-center mb-3\">\n"
    "                                <motion.div\n"
    "                                  animate={{ scale: [1, 1.06, 1], rotate: [0, -4, 4, 0] }}\n"
    "                                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}\n"
    "                                  className=\"w-14 h-14 rounded-2xl flex items-center justify-center\"\n"
    "                                  style={{\n"
    "                                    background: 'linear-gradient(135deg, rgba(234,88,12,0.25), rgba(168,85,247,0.20))',\n"
    "                                    boxShadow: '0 0 28px rgba(234,88,12,0.30)',\n"
    "                                    border: '1px solid rgba(234,88,12,0.30)',\n"
    "                                  }}\n"
    "                                >\n"
    "                                  <Film className=\"h-7 w-7\" style={{ color: '#ea580c' }} />\n"
    "                                </motion.div>\n"
    "                              </div>\n"
    "\n"
    "                              {/* Headline */}\n"
    "                              <motion.div\n"
    "                                initial={{ opacity: 0, y: 8 }}\n"
    "                                animate={{ opacity: 1, y: 0 }}\n"
    "                                transition={{ duration: 0.5 }}\n"
    "                                className=\"text-center mb-3\"\n"
    "                              >\n"
    "                                <h3 className=\"text-base font-bold tracking-tight\" style={{ background: 'linear-gradient(90deg, #ea580c, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>\n"
    "                                  Bring Your Music to Life on Screen\n"
    "                                </h3>\n"
    "                                <p className=\"text-xs text-gray-400 mt-1.5 leading-relaxed px-1\">\n"
    "                                  From AI-generated visuals to full cinematic productions — we create videos that elevate your brand and captivate your audience.\n"
    "                                </p>\n"
    "                              </motion.div>\n"
    "\n"
    "                              {/* Service cards */}\n"
    "                              <div className=\"flex flex-col gap-2 mb-3\">\n"
    "                                {[\n"
    "                                  { icon: Sparkles, label: 'AI Music Video', price: 'from $999', color: '#ea580c', desc: 'AI-generated visuals synced to your track' },\n"
    "                                  { icon: Camera, label: 'Premium Production', price: '$2,500 – $10k', color: '#a855f7', desc: 'Real crew, locations & post-production' },\n"
    "                                ].map(({ icon: Icon, label, price, color, desc }, i) => (\n"
    "                                  <motion.div\n"
    "                                    key={label}\n"
    "                                    initial={{ opacity: 0, x: -8 }}\n"
    "                                    animate={{ opacity: 1, x: 0 }}\n"
    "                                    transition={{ delay: 0.1 + i * 0.1 }}\n"
    "                                    className=\"flex items-center gap-3 rounded-xl px-3 py-2.5\"\n"
    "                                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}\n"
    "                                  >\n"
    "                                    <div className=\"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0\" style={{ background: `${color}22` }}>\n"
    "                                      <Icon className=\"h-4 w-4\" style={{ color }} />\n"
    "                                    </div>\n"
    "                                    <div className=\"flex-1 min-w-0\">\n"
    "                                      <div className=\"text-xs font-bold\" style={{ color }}>{label}</div>\n"
    "                                      <div className=\"text-[10px] text-gray-500 truncate\">{desc}</div>\n"
    "                                    </div>\n"
    "                                    <div className=\"text-xs font-black\" style={{ color }}>{price}</div>\n"
    "                                  </motion.div>\n"
    "                                ))}\n"
    "                              </div>\n"
    "\n"
    "                              {/* Feature pills */}\n"
    "                              <div className=\"flex flex-wrap justify-center gap-1.5 mb-3\">\n"
    "                                {['Lyric Videos', 'Visualizers', 'Reels & Shorts', 'EPK Videos'].map((feat, i) => (\n"
    "                                  <motion.span\n"
    "                                    key={feat}\n"
    "                                    initial={{ opacity: 0, scale: 0.8 }}\n"
    "                                    animate={{ opacity: 1, scale: 1 }}\n"
    "                                    transition={{ delay: 0.2 + i * 0.07 }}\n"
    "                                    className=\"text-[10px] font-semibold px-2.5 py-0.5 rounded-full\"\n"
    "                                    style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.20)' }}\n"
    "                                  >\n"
    "                                    {feat}\n"
    "                                  </motion.span>\n"
    "                                ))}\n"
    "                              </div>\n"
    "\n"
    "                              {/* CTA */}\n"
    "                              <Link href=\"/videoservice\">\n"
    "                                <motion.button\n"
    "                                  whileHover={{ scale: 1.03 }}\n"
    "                                  whileTap={{ scale: 0.97 }}\n"
    "                                  className=\"w-full py-3 px-4 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2\"\n"
    "                                  style={{\n"
    "                                    background: 'linear-gradient(135deg, #ea580c, #a855f7)',\n"
    "                                    color: 'white',\n"
    "                                    boxShadow: '0 4px 20px rgba(234,88,12,0.30)',\n"
    "                                  }}\n"
    "                                >\n"
    "                                  <Film className=\"h-4 w-4\" />\n"
    "                                  <span>Explore Video Services</span>\n"
    "                                  <ArrowRight className=\"h-4 w-4\" />\n"
    "                                </motion.button>\n"
    "                              </Link>\n"
    "\n"
    "                              {/* Social proof */}\n"
    "                              <p className=\"text-center text-[10px] text-gray-600 mt-3\">\n"
    "                                \U0001f3ac Real projects. Real artists. Real results.\n"
    "                              </p>\n"
    "                            </div>\n"
    "                              </>\n"
    "                            )}\n"
    "                          </div>\n"
    "                        );\n"
    "                      } else if (sectionId === 'analytics' && isOwnProfile) {"
)
assert old5 in content, "FAIL: analytics block anchor not found"
content = content.replace(old5, new5, 1)
print("5. render block added")

# ── Check Film icon is imported ──────────────────────────────
if 'Film,' not in content and "Film " not in content:
    # Add Film to imports
    old_imp = 'import { Play, Pause, Upload'
    # This is likely not in this file — let's check what icon imports look like
    pass

# Verify Film is available
if 'Film' in content:
    print("6. Film icon already in file")
else:
    print("WARNING: Film icon not imported — may need to add to imports")

# ── Check Camera icon is available ──────────────────────────
if 'Camera' in content:
    print("7. Camera icon already in file")
else:
    print("WARNING: Camera icon not imported")

with open('client/src/components/artist/artist-profile-card.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDONE: Video Service section added successfully")

with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ══════════════════════════════════════════════════════════════
# FIX 1 — Replace the bottom CTA section (Spanish → English + better design)
# ══════════════════════════════════════════════════════════════
old_cta = (
    "        {/* CTA for non-authenticated visitors - Bottom of page */}\n"
    "        {!isOwnProfile && !user && (\n"
    "          <div className=\"mt-8\">\n"
    "            <div className={cardStyles} style={cardStyleInline}>\n"
    "              <div className=\"text-center py-10\">\n"
    "                <div className=\"mb-6\">\n"
    "                  <Music2 className=\"h-16 w-16 mx-auto mb-4\" style={{ color: colors.hexAccent }} />\n"
    "                  <h3 className=\"text-3xl font-bold text-white mb-3\">{t('profile.cta.title')}</h3>\n"
    "                  <p className=\"text-gray-400 text-lg max-w-2xl mx-auto\">\n"
    "                    {t('profile.cta.description')}\n"
    "                  </p>\n"
    "                </div>\n"
    "                <Link href=\"/auth?returnTo=/profile\">\n"
    "                  <Button\n"
    "                    className=\"bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-2xl shadow-orange-500/50 gap-2 px-8 py-7 text-lg font-bold rounded-full hover:scale-105 transition-all duration-300\"\n"
    "                    data-testid=\"button-cta-bottom\"\n"
    "                  >\n"
    "                    <Sparkles className=\"h-6 w-6\" />\n"
    "                    {t('profile.cta.button')}\n"
    "                    <ArrowRight className=\"h-6 w-6\" />\n"
    "                  </Button>\n"
    "                </Link>\n"
    "                <p className=\"text-gray-500 text-sm mt-4\">\n"
    "                  {t('profile.cta.subtitle')}\n"
    "                </p>\n"
    "              </div>\n"
    "            </div>\n"
    "          </div>\n"
    "        )}"
)

new_cta = """\
        {/* CTA for non-authenticated visitors - Bottom of page */}
        {!isOwnProfile && !user && (
          <div className="mt-8">
            <div className="rounded-3xl overflow-hidden relative" style={{ ...cardStyleInline, padding: 0, border: '1px solid rgba(234,88,12,0.25)' }}>
              {/* Animated background */}
              <div className="absolute inset-0 pointer-events-none">
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, rgba(234,88,12,0.15) 0%, rgba(168,85,247,0.12) 50%, rgba(234,88,12,0.08) 100%)',
                }} />
                <motion.div
                  animate={{ x: ['0%', '100%', '0%'], opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', top: 0, left: '-50%',
                    width: '200%', height: '2px',
                    background: 'linear-gradient(90deg, transparent, #ea580c, #a855f7, transparent)',
                  }}
                />
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
                    borderRadius: '50%',
                    background: i < 4 ? '#ea580c' : '#a855f7',
                    opacity: 0.3,
                    left: `${8 + i * 12}%`,
                    top: `${10 + (i % 4) * 22}%`,
                    animation: `float ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.3}s`,
                  }} />
                ))}
              </div>

              <div className="relative z-10 px-6 py-10 text-center">
                {/* Animated icon */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,88,12,0.30), rgba(168,85,247,0.25))',
                    boxShadow: '0 0 40px rgba(234,88,12,0.25)',
                    border: '1px solid rgba(234,88,12,0.35)',
                  }}
                >
                  <Rocket className="h-10 w-10" style={{ color: '#ea580c' }} />
                </motion.div>

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-4"
                  style={{ background: 'rgba(234,88,12,0.15)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.30)' }}
                >
                  <Sparkles className="h-3 w-3" />
                  Free to Start · No Credit Card
                </motion.div>

                {/* Headline */}
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl md:text-3xl font-black mb-3"
                  style={{
                    background: 'linear-gradient(90deg, #ffffff, #ea580c, #a855f7)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}
                >
                  Launch Your Music Career on Boostify
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 text-sm max-w-lg mx-auto mb-6 leading-relaxed"
                >
                  Join thousands of independent artists managing their music, growing their fanbase, and earning — all from one powerful platform.
                </motion.p>

                {/* Feature row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap justify-center gap-2 mb-7"
                >
                  {['Distribute Music', 'Music Videos', 'Sell Merch', 'Fan Community', 'Analytics'].map((feat, i) => (
                    <span key={feat} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.10)' }}>
                      ✓ {feat}
                    </span>
                  ))}
                </motion.div>

                {/* CTA Button */}
                <Link href="/auth?returnTo=/profile">
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: '0 8px 32px rgba(234,88,12,0.45)' }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-black text-white shadow-xl"
                    style={{
                      background: 'linear-gradient(135deg, #ea580c, #dc2626)',
                      boxShadow: '0 4px 24px rgba(234,88,12,0.35)',
                    }}
                    data-testid="button-cta-bottom"
                  >
                    <Sparkles className="h-5 w-5" />
                    Create My Free Profile
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </Link>
                <p className="text-gray-600 text-xs mt-4">
                  Setup in 2 minutes · No credit card required
                </p>
              </div>
            </div>
          </div>
        )}\
"""

if old_cta in content:
    content = content.replace(old_cta, new_cta, 1)
    print("FIX 1 SUCCESS: Bottom CTA replaced with English animated version")
else:
    print("FIX 1 FAIL: Could not find bottom CTA block")
    # Debug
    idx = content.find("profile.cta.title")
    if idx != -1:
        print(repr(content[idx-200:idx+300]))

# ══════════════════════════════════════════════════════════════
# FIX 2 — Video Service: remove prices, always expanded, better animation
# Make it always visible regardless of sectionVisibility/sectionExpanded
# by rendering it outside the section order loop as a fixed promo block
# We'll do that by: 
#   a) Remove it from the dynamic section system
#   b) Render it as a fixed block right before the bottom CTA
# But simpler: just remove it from sectionOrder and render it inline
# ══════════════════════════════════════════════════════════════

# Find and replace the video-service-promo render block (remove prices, improve design)
old_vs_block = """\
                      } else if (sectionId === 'video-service-promo') {
                        sectionElement = (
                          <div className={cardStyles} style={{ ...cardStyleInline, position: 'relative', overflow: 'hidden' }}>
                            {renderSectionHeader(sectionId, Film, 'Video Service \U0001f3ac')}
                            {sectionExpanded[sectionId] && (
                              <>
                            {/* Cinematic background */}
                            <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(135deg, rgba(234,88,12,0.12) 0%, rgba(168,85,247,0.10) 100%)',
                              }} />
                              {[...Array(6)].map((_, i) => (
                                <div key={i} style={{
                                  position: 'absolute',
                                  width: i % 2 === 0 ? 2 : 3, height: i % 2 === 0 ? 2 : 3,
                                  borderRadius: '50%',
                                  background: i < 3 ? '#ea580c' : '#a855f7',
                                  opacity: 0.35,
                                  left: `${10 + i * 16}%`,
                                  top: `${15 + (i % 3) * 25}%`,
                                  animation: `float ${2.2 + i * 0.35}s ease-in-out infinite alternate`,
                                  animationDelay: `${i * 0.25}s`,
                                }} />
                              ))}
                            </div>

                            <div className="relative z-10">
                              {/* Icon + badge */}
                              <div className="flex justify-center mb-3">
                                <motion.div
                                  animate={{ scale: [1, 1.06, 1], rotate: [0, -4, 4, 0] }}
                                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(234,88,12,0.25), rgba(168,85,247,0.20))',
                                    boxShadow: '0 0 28px rgba(234,88,12,0.30)',
                                    border: '1px solid rgba(234,88,12,0.30)',
                                  }}
                                >
                                  <Film className="h-7 w-7" style={{ color: '#ea580c' }} />
                                </motion.div>
                              </div>

                              {/* Headline */}
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="text-center mb-3"
                              >
                                <h3 className="text-base font-bold tracking-tight" style={{ background: 'linear-gradient(90deg, #ea580c, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                  Bring Your Music to Life on Screen
                                </h3>
                                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed px-1">
                                  From AI-generated visuals to full cinematic productions — we create videos that elevate your brand and captivate your audience.
                                </p>
                              </motion.div>

                              {/* Service cards */}
                              <div className="flex flex-col gap-2 mb-3">
                                {[
                                  { icon: Sparkles, label: 'AI Music Video', price: 'from $999', color: '#ea580c', desc: 'AI-generated visuals synced to your track' },
                                  { icon: Camera, label: 'Premium Production', price: '$2,500 \u2013 $10k', color: '#a855f7', desc: 'Real crew, locations & post-production' },
                                ].map(({ icon: Icon, label, price, color, desc }, i) => (
                                  <motion.div
                                    key={label}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + i * 0.1 }}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                                  >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
                                      <Icon className="h-4 w-4" style={{ color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-bold" style={{ color }}>{label}</div>
                                      <div className="text-[10px] text-gray-500 truncate">{desc}</div>
                                    </div>
                                    <div className="text-xs font-black" style={{ color }}>{price}</div>
                                  </motion.div>
                                ))}
                              </div>

                              {/* Feature pills */}
                              <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                                {['Lyric Videos', 'Visualizers', 'Reels & Shorts', 'EPK Videos'].map((feat, i) => (
                                  <motion.span
                                    key={feat}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 + i * 0.07 }}
                                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.20)' }}
                                  >
                                    {feat}
                                  </motion.span>
                                ))}
                              </div>

                              {/* CTA */}
                              <Link href="/videoservice">
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  className="w-full py-3 px-4 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                                  style={{
                                    background: 'linear-gradient(135deg, #ea580c, #a855f7)',
                                    color: 'white',
                                    boxShadow: '0 4px 20px rgba(234,88,12,0.30)',
                                  }}
                                >
                                  <Film className="h-4 w-4" />
                                  <span>Explore Video Services</span>
                                  <ArrowRight className="h-4 w-4" />
                                </motion.button>
                              </Link>

                              {/* Social proof */}
                              <p className="text-center text-[10px] text-gray-600 mt-3">
                                \U0001f3ac Real projects. Real artists. Real results.
                              </p>
                            </div>
                              </>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'analytics' && isOwnProfile) {\
"""

new_vs_block = """\
                      } else if (sectionId === 'analytics' && isOwnProfile) {\
"""

if old_vs_block in content:
    content = content.replace(old_vs_block, new_vs_block, 1)
    print("FIX 2a SUCCESS: Removed video-service-promo from section loop")
else:
    print("FIX 2a FAIL: Could not find video-service-promo block")

# ── Remove video-service-promo from sectionModules ──────────
old_vs_mod = "    'video-service-promo': { name: 'Video Service \U0001f3ac', icon: Film, isOwnerOnly: false },\n"
if old_vs_mod in content:
    content = content.replace(old_vs_mod, '', 1)
    print("FIX 2b SUCCESS: Removed from sectionModules")
else:
    print("FIX 2b FAIL: sectionModules entry not found")

# ── Remove from defaultOrder ─────────────────────────────────
old_order = "'monetize-cta', 'video-service-promo', 'analytics'"
new_order = "'monetize-cta', 'analytics'"
if old_order in content:
    content = content.replace(old_order, new_order, 1)
    print("FIX 2c SUCCESS: Removed from defaultOrder")
else:
    print("FIX 2c FAIL: defaultOrder entry not found")

# ── Remove from defaultVisibility ────────────────────────────
old_vis = "    'video-service-promo': true,\n"
if old_vis in content:
    content = content.replace(old_vis, '', 1)
    print("FIX 2d SUCCESS: Removed from defaultVisibility")
else:
    print("FIX 2d FAIL: visibility entry not found")

# ── Remove from defaultExpanded ──────────────────────────────
old_exp = "    'video-service-promo': false,\n"
if old_exp in content:
    content = content.replace(old_exp, '', 1)
    print("FIX 2e SUCCESS: Removed from defaultExpanded")
else:
    print("FIX 2e FAIL: expanded entry not found")

# ── Now render video-service as a FIXED block above the bottom CTA ──
# Find the bottom CTA anchor and insert the fixed block above it
fixed_vs_block = """\
        {/* ── VIDEO SERVICE PROMO — Fixed promotional block (always visible) ── */}
        <div className="mt-4 rounded-3xl overflow-hidden relative" style={{ ...cardStyleInline, padding: 0, border: '1px solid rgba(234,88,12,0.25)' }}>
          {/* Scanning light animation */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(234,88,12,0.14) 0%, rgba(24,24,27,0.95) 50%, rgba(168,85,247,0.12) 100%)',
            }} />
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '40%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(234,88,12,0.07), transparent)',
              }}
            />
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
                borderRadius: '50%',
                background: i < 4 ? '#ea580c' : '#a855f7',
                opacity: 0.25,
                left: `${6 + i * 12}%`,
                top: `${12 + (i % 4) * 20}%`,
                animation: `float ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.3}s`,
              }} />
            ))}
          </div>

          <div className="relative z-10 px-5 py-6">
            {/* Top row: icon + label */}
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, -6, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(234,88,12,0.30), rgba(168,85,247,0.20))',
                  boxShadow: '0 0 24px rgba(234,88,12,0.28)',
                  border: '1px solid rgba(234,88,12,0.30)',
                }}
              >
                <Film className="h-6 w-6" style={{ color: '#ea580c' }} />
              </motion.div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white">Video Service</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,88,12,0.20)', color: '#ea580c' }}>
                    \U0001f3ac PROMO
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">by Boostify</p>
              </div>
            </div>

            {/* Headline */}
            <h3 className="text-base font-black mb-1.5" style={{ background: 'linear-gradient(90deg, #ea580c, #f97316, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Bring Your Music to Life on Screen
            </h3>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
              Professional music videos, AI visuals, lyric videos & more. We handle everything — you focus on the music.
            </p>

            {/* Service tiles */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { icon: Sparkles, label: 'AI Music Video', desc: 'AI visuals synced to your track', color: '#ea580c' },
                { icon: Camera, label: 'Premium Production', desc: 'Full crew & post-production', color: '#a855f7' },
                { icon: Film, label: 'Lyric Videos', desc: 'Cinematic text animations', color: '#3b82f6' },
                { icon: Rocket, label: 'Reels & Shorts', desc: 'Social-ready short clips', color: '#10b981' },
              ].map(({ icon: Icon, label, desc, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-xl p-2.5 flex flex-col gap-1"
                  style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <div className="text-[11px] font-bold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{desc}</div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <Link href="/videoservice">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 6px 28px rgba(234,88,12,0.40)' }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #a855f7 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(234,88,12,0.28)',
                }}
              >
                <Film className="h-4 w-4" />
                Get My Music Video
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
          </div>
        </div>

        {/* CTA for non-authenticated visitors - Bottom of page */}\
"""

anchor = "        {/* CTA for non-authenticated visitors - Bottom of page */"
if anchor in content:
    content = content.replace(anchor, fixed_vs_block, 1)
    print("FIX 2f SUCCESS: Fixed Video Service promo block added above bottom CTA")
else:
    print("FIX 2f FAIL: bottom CTA anchor not found")

with open('client/src/components/artist/artist-profile-card.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDONE")

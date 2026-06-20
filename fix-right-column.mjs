import { readFileSync, writeFileSync } from 'fs';

const file = 'client/src/components/artist/artist-profile-card.tsx';
let code = readFileSync(file, 'utf-8');

// Find the right column section
const rightColStart = code.indexOf('{/* Columna Derecha */}');
if (rightColStart === -1) { console.error('Cannot find right column marker'); process.exit(1); }

// Find the <section> after the marker
const sectionStart = code.indexOf('<section', rightColStart);
// Find the closing </section> for this section (it's the one with </main> right after)
// We need to find the exact section closing. Let's find "</section>\n        </main>"
const sectionEndPattern = '</section>\n        </main>';
const sectionEndIdx = code.indexOf(sectionEndPattern, rightColStart);
if (sectionEndIdx === -1) { console.error('Cannot find section end'); process.exit(1); }

// Extract everything between <section ...> opening tag end and </section>
const sectionOpenEnd = code.indexOf('>', sectionStart) + 1;
const oldContent = code.substring(sectionOpenEnd, sectionEndIdx);

// Now build the new content
const newContent = `
        <Droppable droppableId="inline-sections-right" isDropDisabled={!isOwnProfile}>
          {(rightDropProvided) => (
            <div
              ref={rightDropProvided.innerRef}
              {...rightDropProvided.droppableProps}
              className="flex flex-col gap-4 sm:gap-5 md:gap-6"
            >
            {rightOrder.map((widgetId: string, widgetIndex: number) => {
              let widgetElement: React.ReactNode = null;

              if (widgetId === 'qr-card') {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <ArtistCard 
                      artist={artist}
                      colors={colors}
                      profileUrl={\`\${window.location.origin}/artist/\${userProfile?.slug || artistId}\`}
                    />
                  </div>
                );
              }

              if (widgetId === 'physical-cards' && isOwnProfile) {
                widgetElement = (
                  <div 
                    className={\`\${cardStyles} overflow-hidden\`}
                    style={{ 
                      borderColor: colors.hexBorder, 
                      borderWidth: '2px',
                      background: \`linear-gradient(135deg, \${colors.hexPrimary}15 0%, \${colors.hexAccent}10 100%)\`
                    }}
                  >
                    <div className="relative">
                      <div className="absolute -top-2 -right-2 z-10">
                        <div 
                          className="px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                          style={{ 
                            background: \`linear-gradient(135deg, \${colors.hexPrimary}, \${colors.hexAccent})\`,
                            color: 'white'
                          }}
                        >
                          ✨ NUEVO
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                          style={{ 
                            background: \`linear-gradient(135deg, \${colors.hexPrimary}, \${colors.hexAccent})\`,
                            boxShadow: \`0 8px 20px \${colors.hexPrimary}40\`
                          }}
                        >
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Premium Physical Cards</h3>
                          <p className="text-sm text-gray-400">Print your Artist Card on high-quality plastic</p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        {['Premium PVC plastic (same as bank cards)', 'Full-color printing with glossy or matte finish', 'Integrated QR code to easily share your profile', 'Standard credit card size (85.6 × 53.98 mm)', 'Resistente al agua y duradera'].map(text => (
                          <div key={text} className="flex items-start gap-2 text-sm text-gray-300">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.hexAccent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{text}</span>
                          </div>
                        ))}
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            className="w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
                            style={{
                              background: \`linear-gradient(135deg, \${colors.hexPrimary} 0%, \${colors.hexAccent} 100%)\`,
                              color: 'white',
                              boxShadow: \`0 10px 30px \${colors.hexPrimary}40\`
                            }}
                          >
                            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            <span className="relative flex items-center justify-center gap-3">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                              Order Your Physical Cards
                            </span>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-2xl">Coming Soon!</DialogTitle>
                            <DialogDescription className="text-base">
                              We are working on the ordering system to bring you the highest quality physical cards.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="p-4 rounded-lg border-2" style={{ borderColor: colors.hexBorder, background: \`\${colors.hexPrimary}10\` }}>
                              <h4 className="font-bold text-white mb-2">What's Included?</h4>
                              <ul className="space-y-2 text-sm text-gray-300">
                                <li>• Packages from 50 to 1000+ cards</li>
                                <li>• International shipping available</li>
                                <li>• Special pricing for large orders</li>
                                <li>• Custom design included</li>
                              </ul>
                            </div>
                            <div className="p-4 rounded-lg border" style={{ borderColor: colors.hexBorder }}>
                              <p className="text-sm text-gray-400">
                                <strong className="text-white">Note:</strong> Physical cards are perfect for events, shows, networking and promoting your music brand.
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm" style={{ color: colors.hexAccent }}>📧 Interested? Contact us at <strong>cards@boostify.com</strong></p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'statistics' && isOwnProfile) {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <div className="text-base font-semibold mb-4 transition-colors duration-500" style={{ color: colors.hexAccent }}>Profile Statistics</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: \`\${colors.hexPrimary}15\`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <Music2 className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{songs.length}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Canciones</div>
                      </motion.div>
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: \`\${colors.hexPrimary}15\`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <VideoIcon className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{videos.length}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Videos</div>
                      </motion.div>
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: \`\${colors.hexPrimary}15\`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <Users className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{artist.followers > 1000 ? \`\${(artist.followers / 1000).toFixed(1)}K\` : artist.followers}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Followers</div>
                      </motion.div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-300">Completion Level</div>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart innerRadius="50%" outerRadius="100%" data={[{ name: 'Perfil', value: (() => { let s = 0; if (artist.profileImage) s += 20; if (artist.bannerImage) s += 20; if (artist.biography) s += 15; if (songs.length > 0) s += 15; if (videos.length > 0) s += 15; if (artist.instagram || artist.twitter || artist.youtube) s += 15; return s; })(), fill: colors.hexPrimary }]} startAngle={180} endAngle={0}>
                            <RadialBar background={{ fill: '#1a1a1a' }} dataKey="value" cornerRadius={10} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-3xl font-bold" style={{ color: colors.hexAccent }}>
                          {(() => { let s = 0; if (artist.profileImage) s += 20; if (artist.bannerImage) s += 20; if (artist.biography) s += 15; if (songs.length > 0) s += 15; if (videos.length > 0) s += 15; if (artist.instagram || artist.twitter || artist.youtube) s += 15; return s; })()}%
                        </div>
                        <div className="text-sm text-gray-400">{t('profile.analytics.complete')}</div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'tokenized-music') {
                widgetElement = <TokenizedMusicView artistId={artistId} />;
              }

              if (widgetId === 'information') {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <div className="text-base font-semibold mb-3 transition-colors duration-500" style={{ color: colors.hexAccent }}>Information</div>
                    <div className="space-y-3">
                      {artist.genre && (
                        <div className="flex items-center gap-2">
                          <Music2 className="h-4 w-4" style={{ color: colors.hexAccent }} />
                          <span className="text-sm text-gray-300">{artist.genre}</span>
                        </div>
                      )}
                      {artist.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" style={{ color: colors.hexAccent }} />
                          <span className="text-sm text-gray-300">{artist.location}</span>
                        </div>
                      )}
                      {artist.website && (
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" style={{ color: colors.hexAccent }} />
                          <a href={artist.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: colors.hexAccent }}>{artist.website}</a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (widgetId === 'social-media' && (artist.instagram || artist.twitter || artist.youtube)) {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <div className="text-base font-semibold mb-3 transition-colors duration-500" style={{ color: colors.hexAccent }}>Social Media</div>
                    <div className="space-y-2">
                      {artist.instagram && (
                        <a href={\`https://instagram.com/\${artist.instagram}\`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                          <span className="text-sm">📸 Instagram</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>@{artist.instagram}</span>
                        </a>
                      )}
                      {artist.twitter && (
                        <a href={\`https://twitter.com/\${artist.twitter}\`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                          <span className="text-sm">𝕏 Twitter</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>@{artist.twitter}</span>
                        </a>
                      )}
                      {artist.youtube && (
                        <a href={artist.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                          <span className="text-sm">▶️ YouTube</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>View Channel</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              if (widgetId === 'spotify' && artist.spotify && getSpotifyEmbedUrl(artist.spotify)) {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }} data-testid="spotify-widget">
                    <div className="text-base font-semibold mb-3 transition-colors duration-500 flex items-center gap-2" style={{ color: colors.hexAccent }}>
                      <Music className="h-5 w-5" />
                      Spotify
                    </div>
                    <div className="mb-3 md:hidden">
                      <a href={artist.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-bold shadow-xl hover:shadow-2xl transition-all active:scale-95" style={{ backgroundColor: '#1DB954', color: 'white' }} data-testid="button-open-spotify-mobile">
                        <Music className="h-5 w-5" />
                        <span className="font-semibold">Abrir en Spotify</span>
                      </a>
                    </div>
                    <div className="rounded-lg overflow-hidden w-full relative" style={{ minHeight: '152px', background: \`linear-gradient(135deg, \${colors.hexPrimary}15 0%, rgba(0,0,0,0.4) 25%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 75%, \${colors.hexAccent}10 100%)\`, position: 'relative' }}>
                      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: \`radial-gradient(circle at 20% 30%, \${colors.hexPrimary}40 0%, transparent 50%), radial-gradient(circle at 80% 70%, \${colors.hexAccent}30 0%, transparent 50%)\` }} />
                      <iframe style={{ borderRadius: '12px', border: 'none', display: 'block', background: 'transparent', position: 'relative', zIndex: 1, width: '100%' }} src={getSpotifyEmbedUrl(artist.spotify) || ''} width="100%" height="352" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify Artist Profile" className="w-full h-[152px] md:h-[352px]" data-testid="spotify-iframe" />
                      <div className="hidden md:flex md:absolute md:bottom-3 md:right-3 justify-end" style={{ position: 'relative', zIndex: 2 }}>
                        <a href={artist.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105" style={{ backgroundColor: '#1DB954', color: 'white' }} data-testid="button-open-spotify">
                          <Music className="h-5 w-5" />
                          <span className="font-semibold">Open on Spotify</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'premium-tools' && isOwnProfile) {
                const premiumLinks = [
                  { href: '/instagram-boost', icon: Instagram, title: 'My Community Manager', desc: 'Boost your Instagram presence with AI-powered engagement' },
                  { href: '/contracts', icon: Scale, title: 'My Lawyer', desc: 'Generate and manage music contracts with AI legal assistance' },
                  { href: '/producer-tools', icon: Headphones, title: 'My Music Producer', desc: 'Professional production tools and AI music generation' },
                  { href: '/education', icon: GraduationCap, title: 'Education', desc: 'Master your craft with courses and tutorials' },
                  { href: '/manager-tools', icon: Briefcase, title: 'My Manager', desc: 'Manage bookings, schedules, and career opportunities' },
                  { href: '/ai-advisors', icon: Eye, title: 'My Image Supervisor', desc: 'AI-powered brand and visual identity management' },
                  { href: '/pr', icon: Megaphone, title: 'My PR', desc: 'Press releases, media outreach, and publicity campaigns' },
                  { href: '/music-video-creator', icon: Film, title: 'My Video Director', desc: 'Create professional music videos with AI-powered direction' },
                  { href: '/contacts', icon: Globe, title: 'Industry Outreach', desc: 'Connect with labels, publishers & sync opportunities' },
                ];
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-lg font-bold transition-colors duration-500 flex items-center gap-2" style={{ color: colors.hexAccent }}>
                        <Zap className="h-6 w-6" />
                        Premium Tools
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                        <Crown className="h-3.5 w-3.5 text-yellow-500" />
                        <span className="text-xs font-bold text-yellow-500">PRO</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {premiumLinks.map(item => (
                        <Link key={item.href} href={item.href}>
                          <div className="group relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer" style={{ borderColor: colors.hexBorder, background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)' }}>
                            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ background: \`radial-gradient(circle, \${colors.hexPrimary} 0%, transparent 70%)\` }} />
                            <div className="flex items-start gap-3 relative z-10">
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ background: \`linear-gradient(135deg, \${colors.hexPrimary}, \${colors.hexAccent})\`, boxShadow: \`0 4px 12px \${colors.hexPrimary}40\` }}>
                                <item.icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-opacity-90 transition-colors">{item.title}</h3>
                                <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.hexBorder }}>
                      <p className="text-xs text-center text-gray-500">All tools require an active premium subscription</p>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'upcoming-shows') {
                widgetElement = (
                  <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                    <div className="text-base font-semibold mb-3 transition-colors duration-500 flex items-center gap-2" style={{ color: colors.hexAccent }}>
                      <Calendar className="h-5 w-5" />
                      {t('profile.shows.title')}
                    </div>
                    {shows.length > 0 ? (
                      <div className="space-y-3">
                        {shows.map((show) => {
                          const showDate = new Date(show.date);
                          const formattedDate = showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          const formattedTime = showDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                          return (
                            <div key={show.id} className="p-3 rounded-lg border transition-colors duration-200 hover:bg-gray-800/30" style={{ borderColor: colors.hexBorder }}>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-white">{show.venue}</h4>
                                {show.ticketUrl && (
                                  <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded font-medium hover:opacity-80 transition-opacity" style={{ backgroundColor: colors.hexPrimary, color: 'white' }}>{t('profile.shows.tickets')}</a>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formattedDate} • {formattedTime}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <MapPin className="h-4 w-4" />
                                <span>{show.location}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto mb-2" style={{ color: colors.hexAccent, opacity: 0.3 }} />
                        <p className="text-gray-400 text-sm">{t('profile.shows.noShows')}</p>
                      </div>
                    )}
                  </div>
                );
              }

              if (!widgetElement) return null;

              return isOwnProfile ? (
                <Draggable key={widgetId} draggableId={\`right-\${widgetId}\`} index={widgetIndex}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={\`group/drag relative \${dragSnapshot.isDragging ? 'z-50 shadow-2xl' : ''}\`}
                    >
                      <div
                        {...dragProvided.dragHandleProps}
                        className="flex items-center justify-center gap-2 py-1.5 -mb-2 rounded-t-2xl opacity-0 group-hover/drag:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
                        style={{ background: \`linear-gradient(135deg, \${colors.hexPrimary}40, \${colors.hexAccent}30)\` }}
                      >
                        <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                        <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: colors.hexAccent }}>Drag to reorder</span>
                        <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                      </div>
                      {widgetElement}
                    </div>
                  )}
                </Draggable>
              ) : (
                <div key={widgetId}>{widgetElement}</div>
              );
            })}
            {rightDropProvided.placeholder}
            </div>
          )}
        </Droppable>
`;

// Replace the old content
const newCode = code.substring(0, sectionOpenEnd) + newContent + '\n          ' + code.substring(sectionEndIdx);
writeFileSync(file, newCode, 'utf-8');

console.log('✅ Right column replaced with Droppable + Draggable map');
console.log(`   Old content: ${oldContent.length} chars`);
console.log(`   New content: ${newContent.length} chars`);

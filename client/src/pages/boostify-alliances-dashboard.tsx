import { useState } from 'react';
import { Link } from 'wouter';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { AlliancesSidebar } from '../components/boostify-alliances/AlliancesSidebar';
import { AlliancesTopbar } from '../components/boostify-alliances/AlliancesTopbar';
import { AdminCrossNav } from '../components/admin-shared/AdminCrossNav';
import { KpiStrip } from '../components/boostify-alliances/widgets/KpiStrip';
import { ArtistRadarCard } from '../components/boostify-alliances/widgets/ArtistRadarCard';
import { DecisionCircleCard } from '../components/boostify-alliances/widgets/DecisionCircleCard';
import { BoostifyFitScoreCard } from '../components/boostify-alliances/widgets/BoostifyFitScoreCard';
import { OutreachSequenceCard } from '../components/boostify-alliances/widgets/OutreachSequenceCard';
import { AlliancePipelineCard } from '../components/boostify-alliances/widgets/AlliancePipelineCard';
import { ArtistMasterJsonCard } from '../components/boostify-alliances/widgets/ArtistMasterJsonCard';
import { MasterJsonModal } from '../components/boostify-alliances/MasterJsonModal';
import { ImageEnrichmentBanner } from '../components/boostify-alliances/ImageEnrichmentBanner';
import { OffersSection } from '../components/boostify-alliances/sections/OffersSection';
import { AssetsSection } from '../components/boostify-alliances/sections/AssetsSection';
import { AnalyticsSection } from '../components/boostify-alliances/sections/AnalyticsSection';
import { TOKENS } from '../components/artist-acquisition/shared/tokens';

export default function BoostifyAlliancesDashboard() {
  const { isAdmin, isLoading } = useAuth();
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMasterJsonModal, setShowMasterJsonModal] = useState(false);

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: TOKENS.BG_DEEP, color: TOKENS.TEXT }}
      >
        <div className="flex items-center gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading Boostify Alliances…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ background: TOKENS.BG_DEEP, color: TOKENS.TEXT }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
        >
          <div className="flex justify-center mb-3">
            <ShieldAlert size={20} style={{ color: TOKENS.ORANGE_GLOW }} />
          </div>
          <h1 className="text-lg font-semibold mb-1">Admin access required</h1>
          <p className="text-sm mb-5" style={{ color: TOKENS.MUTED }}>
            Boostify Alliances is restricted to Boostify admins.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
            style={{
              background: TOKENS.ORANGE,
              color: '#0a0a0a',
              boxShadow: '0 0 18px rgba(255,138,31,0.4)',
            }}
          >
            Back to Boostify
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: TOKENS.BG_DEEP, color: TOKENS.TEXT }}
      data-testid="page-boostify-alliances"
    >
      <AlliancesSidebar
        active={active}
        onSelect={setActive}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AlliancesTopbar
          onMenu={() => setSidebarOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto custom-scroll">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-4">
            <AdminCrossNav />
            {active === 'overview' && (
              <>
                <ImageEnrichmentBanner />
                <KpiStrip />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-4">
                    <ArtistRadarCard
                      searchQuery={searchQuery}
                      selectedContactId={selectedContactId}
                      onSelect={setSelectedContactId}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <DecisionCircleCard contactId={selectedContactId} />
                  </div>
                  <div className="lg:col-span-3">
                    <BoostifyFitScoreCard
                      contactId={selectedContactId}
                      onViewAnalysis={() => setShowMasterJsonModal(true)}
                    />
                  </div>
                </div>

                <OutreachSequenceCard contactId={selectedContactId} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7">
                    <AlliancePipelineCard
                      onSelect={setSelectedContactId}
                      selectedContactId={selectedContactId}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <ArtistMasterJsonCard
                      contactId={selectedContactId}
                      onViewProfile={() => setShowMasterJsonModal(true)}
                    />
                  </div>
                </div>
              </>
            )}

            {active === 'artist-radar' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5">
                  <ArtistRadarCard
                    searchQuery={searchQuery}
                    selectedContactId={selectedContactId}
                    onSelect={setSelectedContactId}
                  />
                </div>
                <div className="lg:col-span-7">
                  <ArtistMasterJsonCard
                    contactId={selectedContactId}
                    onViewProfile={() => setShowMasterJsonModal(true)}
                  />
                </div>
              </div>
            )}

            {active === 'decision-circle' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                  <ArtistRadarCard
                    searchQuery={searchQuery}
                    selectedContactId={selectedContactId}
                    onSelect={setSelectedContactId}
                  />
                </div>
                <div className="lg:col-span-5">
                  <DecisionCircleCard contactId={selectedContactId} />
                </div>
                <div className="lg:col-span-3">
                  <BoostifyFitScoreCard
                    contactId={selectedContactId}
                    onViewAnalysis={() => setShowMasterJsonModal(true)}
                  />
                </div>
              </div>
            )}

            {active === 'offers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7">
                  <OffersSection
                    onSelect={setSelectedContactId}
                    selectedContactId={selectedContactId}
                  />
                </div>
                <div className="lg:col-span-5 space-y-4">
                  <BoostifyFitScoreCard
                    contactId={selectedContactId}
                    onViewAnalysis={() => setShowMasterJsonModal(true)}
                  />
                  <ArtistMasterJsonCard
                    contactId={selectedContactId}
                    onViewProfile={() => setShowMasterJsonModal(true)}
                  />
                </div>
              </div>
            )}

            {active === 'assets' && (
              <AssetsSection
                onSelect={setSelectedContactId}
                selectedContactId={selectedContactId}
              />
            )}

            {active === 'outreach' && (
              <div className="space-y-4">
                <OutreachSequenceCard contactId={selectedContactId} />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <ArtistRadarCard
                      searchQuery={searchQuery}
                      selectedContactId={selectedContactId}
                      onSelect={setSelectedContactId}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <ArtistMasterJsonCard
                      contactId={selectedContactId}
                      onViewProfile={() => setShowMasterJsonModal(true)}
                    />
                  </div>
                </div>
              </div>
            )}

            {active === 'deals' && (
              <div className="space-y-4">
                <KpiStrip />
                <AlliancePipelineCard
                  onSelect={setSelectedContactId}
                  selectedContactId={selectedContactId}
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <BoostifyFitScoreCard
                      contactId={selectedContactId}
                      onViewAnalysis={() => setShowMasterJsonModal(true)}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <OutreachSequenceCard contactId={selectedContactId} />
                  </div>
                </div>
              </div>
            )}

            {active === 'analytics' && <AnalyticsSection />}

            <div className="h-8" />
          </div>
        </main>
      </div>

      {showMasterJsonModal && (
        <MasterJsonModal
          contactId={selectedContactId}
          onClose={() => setShowMasterJsonModal(false)}
        />
      )}
    </div>
  );
}

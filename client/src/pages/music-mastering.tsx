import { AudioMastering } from "../components/music/audio-mastering";
import { Header } from "../components/layout/header";

export default function MusicMasteringPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AudioMastering />
    </div>
  );
}
import React from "react";
import { logger } from "../../lib/logger";
import { Link } from "wouter";
import {
  Github,
  Twitter,
  Instagram,
  Youtube,
  ExternalLink,
} from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-zinc-800 pt-16 pb-12 text-white/80">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo y descripción */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img
                src="/assets/freepik__boostify_music_organe_abstract_icon.png"
                alt="Boostify Music"
                className="h-8 w-8"
              />
              <h2 className="text-xl font-bold text-white">Boostify Music</h2>
            </div>
            <p className="text-sm md:pr-8">
              The AI platform revolutionizing how artists create, promote, and grow in the music industry.
            </p>
            <div className="flex space-x-4 pt-2">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-orange-500 transition-colors"
              >
                <Twitter size={18} />
                <span className="sr-only">Twitter</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-orange-500 transition-colors"
              >
                <Instagram size={18} />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-orange-500 transition-colors"
              >
                <Youtube size={18} />
                <span className="sr-only">YouTube</span>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-orange-500 transition-colors"
              >
                <Github size={18} />
                <span className="sr-only">GitHub</span>
              </a>
            </div>
          </div>

          {/* Platform Features */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Platform Features</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/ai-agents" className="hover:text-orange-500 transition-colors">
                  AI-Powered Marketing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-orange-500 transition-colors">
                  Content Management
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-orange-500 transition-colors">
                  Admin Dashboard
                </Link>
              </li>
              <li>
                <Link href="/promotion" className="hover:text-orange-500 transition-colors">
                  Audience Growth
                </Link>
              </li>
              <li>
                <Link href="/music-video-creator" className="hover:text-orange-500 transition-colors">
                  AI Video Creator
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Services</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/virtual-record-label" className="hover:text-orange-500 transition-colors">
                  Virtual Record Label
                </Link>
              </li>
              <li>
                <Link href="/record-label-services" className="hover:text-orange-500 transition-colors">
                  Record Label Services
                </Link>
              </li>
              <li>
                <Link href="/youtube-views" className="hover:text-orange-500 transition-colors">
                  YouTube Views
                </Link>
              </li>
              <li>
                <Link href="/instagram-boost" className="hover:text-orange-500 transition-colors">
                  Instagram Growth
                </Link>
              </li>
              <li>
                <Link href="/promotion" className="hover:text-orange-500 transition-colors">
                  Music Promotion
                </Link>
              </li>
            </ul>
          </div>

          {/* Metafeed & Boostify */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Metafeed & Boostify</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/boostify-tv" className="hover:text-orange-500 transition-colors">
                  Metafeed Metaverse
                </Link>
              </li>
              <li>
                <Link href="/tokenization" className="hover:text-orange-500 transition-colors">
                  Metafeed Token
                </Link>
              </li>
              <li>
                <Link href="/tokenization" className="hover:text-orange-500 transition-colors">
                  One Artist One Token
                </Link>
              </li>
              <li>
                <Link href="/ecosystem" className="hover:text-orange-500 transition-colors">
                  View Ecosystem
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Avat Pro & Boostify y Recursos */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Avat Pro & Boostify</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/artist-generator" className="hover:text-orange-500 transition-colors">
                  Hyper Realistic Avatars
                </Link>
              </li>
              <li>
                <Link href="/image-generator" className="hover:text-orange-500 transition-colors">
                  Unreal Engine
                </Link>
              </li>
              <li>
                <Link href="/music-video-creator" className="hover:text-orange-500 transition-colors">
                  Motion Capture
                </Link>
              </li>
              <li>
                <Link href="/affiliates" className="hover:text-orange-500 transition-colors">
                  View Partnership
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog" className="hover:text-orange-500 transition-colors">
                  Blog & Tutorials
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-orange-500 transition-colors">
                  Artist Guides
                </Link>
              </li>
              <li>
                <Link href="/tools" className="hover:text-orange-500 transition-colors">
                  Free Tools
                </Link>
              </li>
              <li>
                <Link href="/education" className="hover:text-orange-500 transition-colors">
                  Music Academy
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Support */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/resources" className="hover:text-orange-500 transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-orange-500 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-orange-500 transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-orange-500 transition-colors">
                  Service Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-zinc-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-white/60">
            &copy; {currentYear} Boostify Music. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-white/60 mt-4 md:mt-0">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-white transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
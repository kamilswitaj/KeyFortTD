import { HeroId, TowerType } from '../types';

export class SvgArtwork {
  public static brandLogo(size = 28): string {
    return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="kf_crest" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="55%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#1e3a8a"/>
        </linearGradient>
      </defs>
      <path d="M18 2L31 7.5V17.5C31 25.4 25.4 31.8 18 34C10.6 31.8 5 25.4 5 17.5V7.5L18 2Z" fill="url(#kf_crest)" stroke="#7dd3fc" stroke-width="1.6"/>
      <path d="M11 13H14V10H16.5V13H19.5V10H22V13H25V17H23V24.5H13V17H11V13Z" fill="#0f172a" stroke="#bae6fd" stroke-width="1.2"/>
      <path d="M18 15.5L15.8 20H18.2L17.4 23.5L20.4 18.8H18L18 15.5Z" fill="#facc15"/>
    </svg>`;
  }

  public static resourceIcon(kind: 'heart' | 'gold' | 'energy' | 'wave' | 'star' | 'accuracy' | 'combo' | 'speed', size = 15): string {
    switch (kind) {
      case 'heart':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 17.5L8.6 16.2C4.1 12.1 1.5 9.7 1.5 6.6C1.5 4.2 3.4 2.4 5.8 2.4C7.2 2.4 8.6 3.1 10 4.3C11.4 3.1 12.8 2.4 14.2 2.4C16.6 2.4 18.5 4.2 18.5 6.6C18.5 9.7 15.9 12.1 11.4 16.2L10 17.5Z" fill="#f43f5e" stroke="#fda4af" stroke-width="1.1"/></svg>`;
      case 'gold':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#eab308" stroke="#fef08a" stroke-width="1.4"/><circle cx="10" cy="10" r="4.8" stroke="#854d0e" stroke-width="1.2" fill="#facc15"/><path d="M10 6.8V13.2" stroke="#854d0e" stroke-width="1.4" stroke-linecap="round"/></svg>`;
      case 'energy':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M11.5 2L4.5 11H10L8.5 18L15.5 9H10L11.5 2Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
      case 'wave':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 3V17M4 4H15L12.5 7.5L15 11H4" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="rgba(56,189,248,0.28)"/></svg>`;
      case 'star':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2L12.4 7L18 7.8L14 11.7L14.9 17.3L10 14.6L5.1 17.3L6 11.7L2 7.8L7.6 7L10 2Z" fill="#facc15" stroke="#fef08a" stroke-width="1"/></svg>`;
      case 'accuracy':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke="#4ade80" stroke-width="1.5"/><circle cx="10" cy="10" r="4" stroke="#4ade80" stroke-width="1.3"/><circle cx="10" cy="10" r="1.5" fill="#4ade80"/></svg>`;
      case 'combo':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10.5 2C11.5 5 14.5 6.8 14.5 10.5C14.5 13.8 12.2 17 9.8 17C7.2 17 5.5 14.8 5.5 12C5.5 9.8 6.8 8.2 8 7.2C7.8 9 8.7 10 9.6 10C10.5 10 11 8.5 10.5 2Z" fill="#fb923c" stroke="#fed7aa" stroke-width="1.1"/></svg>`;
      case 'speed':
        return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 13A7 7 0 1 1 16.5 13" stroke="#a855f7" stroke-width="1.7" stroke-linecap="round"/><path d="M10 10L14 6.5" stroke="#e9d5ff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="10" r="1.6" fill="#a855f7"/></svg>`;
    }
  }

  public static towerPortrait(type: TowerType, size = 26): string {
    const bg = '#0b1220';
    switch (type) {
      case 'gun':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#38bdf8" stroke-width="1.4"/>
          <circle cx="14" cy="16" r="6.5" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
          <rect x="14" y="13" width="13" height="2.4" rx="1" fill="#bae6fd"/>
          <rect x="14" y="16.6" width="13" height="2.4" rx="1" fill="#7dd3fc"/>
          <circle cx="14" cy="16" r="2.6" fill="#38bdf8"/>
        </svg>`;
      case 'cannon':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#f97316" stroke-width="1.4"/>
          <rect x="7" y="10" width="12" height="12" rx="3" fill="#431407" stroke="#f97316" stroke-width="1.5"/>
          <rect x="15" y="12.5" width="12" height="7" rx="2" fill="#fb923c" stroke="#fed7aa" stroke-width="1.1"/>
          <circle cx="13" cy="16" r="2.5" fill="#facc15"/>
        </svg>`;
      case 'frost':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#67e8f9" stroke-width="1.4"/>
          <path d="M16 6V26M6 16H26M9 9L23 23M23 9L9 23" stroke="#67e8f9" stroke-width="1.8" stroke-linecap="round"/>
          <polygon points="16,11 21,16 16,21 11,16" fill="#0891b2" stroke="#cffafe" stroke-width="1.3"/>
        </svg>`;
      case 'tesla':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#c084fc" stroke-width="1.4"/>
          <rect x="12" y="18" width="8" height="7" rx="1.5" fill="#3b0764" stroke="#c084fc" stroke-width="1.3"/>
          <circle cx="16" cy="11" r="4.5" fill="#a855f7" stroke="#f3e8ff" stroke-width="1.4"/>
          <path d="M9 9L12 11M23 9L20 11M16 4V6.5" stroke="#e9d5ff" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
      case 'sniper':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#f43f5e" stroke-width="1.4"/>
          <circle cx="12" cy="16" r="5" fill="#3b0d18" stroke="#f43f5e" stroke-width="1.4"/>
          <rect x="14" y="14.6" width="14" height="2.8" rx="1" fill="#fda4af"/>
          <circle cx="26" cy="16" r="1.8" fill="#fb7185"/>
          <path d="M12 13V19M9 16H15" stroke="#fecdd3" stroke-width="1.1"/>
        </svg>`;
      case 'reactor':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#4ade80" stroke-width="1.4"/>
          <polygon points="16,5 25,10.5 25,21.5 16,27 7,21.5 7,10.5" fill="#052e16" stroke="#4ade80" stroke-width="1.4"/>
          <circle cx="16" cy="16" r="4.5" fill="#22c55e" stroke="#dcfce7" stroke-width="1.3"/>
        </svg>`;
      case 'flame':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#fb923c" stroke-width="1.4"/>
          <path d="M16 6C19 10.5 22.5 13 22.5 18C22.5 22 19.6 25.5 16 25.5C12.4 25.5 9.5 22 9.5 18C9.5 14 12 11.5 13.5 10C13.5 12.5 15 13.5 15.5 13.5C16.2 13.5 16.5 11.5 16 6Z" fill="#f97316" stroke="#fde047" stroke-width="1.3"/>
        </svg>`;
      case 'drone':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#2dd4bf" stroke-width="1.4"/>
          <path d="M8 10L24 22M24 10L8 22" stroke="#5eead4" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="8" cy="10" r="2.6" fill="#0f766e" stroke="#99f6e4" stroke-width="1.1"/>
          <circle cx="24" cy="10" r="2.6" fill="#0f766e" stroke="#99f6e4" stroke-width="1.1"/>
          <circle cx="8" cy="22" r="2.6" fill="#0f766e" stroke="#99f6e4" stroke-width="1.1"/>
          <circle cx="24" cy="22" r="2.6" fill="#0f766e" stroke="#99f6e4" stroke-width="1.1"/>
          <circle cx="16" cy="16" r="4" fill="#14b8a6" stroke="#ccfbf1" stroke-width="1.2"/>
        </svg>`;
      case 'laser':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#facc15" stroke-width="1.4"/>
          <polygon points="7,16 14,9 14,23" fill="#854d0e" stroke="#facc15" stroke-width="1.3"/>
          <line x1="14" y1="16" x2="27" y2="16" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
          <circle cx="14" cy="16" r="3" fill="#facc15"/>
        </svg>`;
      case 'command':
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="${bg}" stroke="#818cf8" stroke-width="1.4"/>
          <circle cx="16" cy="16" r="8.5" stroke="#818cf8" stroke-width="1.2" stroke-dasharray="3 2"/>
          <path d="M16 8L18.2 13.4L24 14L19.5 17.8L20.9 23.5L16 20.4L11.1 23.5L12.5 17.8L8 14L13.8 13.4L16 8Z" fill="#6366f1" stroke="#e0e7ff" stroke-width="1.1"/>
        </svg>`;
    }
  }

  public static heroPortrait(heroId: HeroId, size = 38): string {
    switch (heroId) {
      case 'guardian':
        return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#0f2942" stroke="#38bdf8" stroke-width="2"/>
          <path d="M20 7L30 11.5V20C30 26.5 25.5 31.5 20 33.5C14.5 31.5 10 26.5 10 20V11.5L20 7Z" fill="#0284c7" stroke="#bae6fd" stroke-width="1.5"/>
          <path d="M20 12V28M14 18H26" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>
        </svg>`;
      case 'engineer':
        return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#172b1b" stroke="#4ade80" stroke-width="2"/>
          <circle cx="20" cy="20" r="9" stroke="#4ade80" stroke-width="2.5" stroke-dasharray="4 3"/>
          <circle cx="20" cy="20" r="4.5" fill="#22c55e" stroke="#dcfce7" stroke-width="1.5"/>
          <path d="M20 7V11M20 29V33M7 20H11M29 20H33" stroke="#86efac" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      case 'ranger':
        return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#33111c" stroke="#f43f5e" stroke-width="2"/>
          <circle cx="20" cy="20" r="10" stroke="#fb7185" stroke-width="1.8"/>
          <path d="M20 7V33M7 20H33" stroke="#fda4af" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="20" cy="20" r="3.2" fill="#f43f5e"/>
        </svg>`;
      case 'arcanist':
        return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#24133d" stroke="#c084fc" stroke-width="2"/>
          <polygon points="20,7 28,20 20,33 12,20" fill="#9333ea" stroke="#f3e8ff" stroke-width="1.6"/>
          <circle cx="20" cy="20" r="4.5" fill="#facc15"/>
        </svg>`;
    }
  }

  public static homeRowGuideSvg(): string {
    return `<svg width="260" height="58" viewBox="0 0 260 58" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="256" height="54" rx="8" fill="#090f1d" stroke="#1e293b" stroke-width="1.2"/>
      <!-- Left Hand Keys A S D F -->
      <rect x="12" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#f43f5e" stroke-width="1.4"/><text x="23" y="30" fill="#fda4af" font-size="11" font-weight="700" text-anchor="middle">A</text>
      <rect x="38" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#fb923c" stroke-width="1.4"/><text x="49" y="30" fill="#fed7aa" font-size="11" font-weight="700" text-anchor="middle">S</text>
      <rect x="64" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#facc15" stroke-width="1.4"/><text x="75" y="30" fill="#fef08a" font-size="11" font-weight="700" text-anchor="middle">D</text>
      <rect x="90" y="14" width="24" height="24" rx="4" fill="#052e16" stroke="#4ade80" stroke-width="2"/><text x="102" y="29" fill="#4ade80" font-size="12" font-weight="800" text-anchor="middle">F</text>
      <line x1="97" y1="34" x2="107" y2="34" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
      <!-- Divider -->
      <text x="130" y="30" fill="#64748b" font-size="10" font-weight="700" text-anchor="middle">••</text>
      <!-- Right Hand Keys J K L ; -->
      <rect x="146" y="14" width="24" height="24" rx="4" fill="#082f49" stroke="#38bdf8" stroke-width="2"/><text x="158" y="29" fill="#38bdf8" font-size="12" font-weight="800" text-anchor="middle">J</text>
      <line x1="153" y1="34" x2="163" y2="34" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <rect x="174" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#818cf8" stroke-width="1.4"/><text x="185" y="30" fill="#c7d2fe" font-size="11" font-weight="700" text-anchor="middle">K</text>
      <rect x="200" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1.4"/><text x="211" y="30" fill="#e9d5ff" font-size="11" font-weight="700" text-anchor="middle">L</text>
      <rect x="226" y="14" width="22" height="24" rx="4" fill="#1e293b" stroke="#f472b6" stroke-width="1.4"/><text x="237" y="30" fill="#fbcfe8" font-size="11" font-weight="700" text-anchor="middle">;</text>
      <text x="62" y="50" fill="#94a3b8" font-size="8.5" text-anchor="middle">Lewa dłoń (palec na F)</text>
      <text x="197" y="50" fill="#94a3b8" font-size="8.5" text-anchor="middle">Prawa dłoń (palec na J)</text>
    </svg>`;
  }
}

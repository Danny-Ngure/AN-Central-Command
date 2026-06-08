import { BrandMark } from './brand';
import { LogoutButton } from './logout-button';

interface NavbarProps {
  user: { fullName: string; role: string; wardName: string | null };
}

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant',
  campaign_manager: 'Campaign Manager',
  chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator',
  ward_coordinator: 'Ward Coordinator',
  assistant_ward_coordinator: 'Asst. Ward Coordinator',
  polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent',
  canvasser: 'Canvasser',
  influence_liaison: 'Influence Liaison',
  media_head: 'Media Head',
  comms_head: 'Comms Head',
  patron_ceo: 'Patron / CEO',
  tech_lead: 'Tech Lead',
  finance_lead: 'Finance Lead',
};

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="border-b border-brand-border bg-brand-cardBg/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <BrandMark size={44} />
          <div className="hidden lg:block text-xs text-brand-textMuted">·</div>
          <div className="hidden lg:block text-xs text-brand-textMuted">
            Nyali Constituency
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-brand-textActive">{user.fullName}</div>
            <div className="text-xs text-brand-textMuted">
              {ROLE_LABEL[user.role] ?? user.role}
              {user.wardName && <span> · {user.wardName}</span>}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

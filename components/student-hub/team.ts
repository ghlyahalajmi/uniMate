/**
 * The people with access to the UniMate repository.
 *
 * A short constant rather than a table: this changes when someone joins the
 * project, which is rare and is already a GitHub action. Storing it per
 * student would also mean four copies of the same list drifting apart.
 *
 * Only public GitHub logins — no email addresses, no personal details.
 */
export interface TeamMember {
  login: string;
  role: 'owner' | 'member';
}

export const TEAM: TeamMember[] = [
  { login: 'ghlyahalajmi', role: 'owner' },
  { login: 'AsmaaAlhajri', role: 'member' },
  { login: 'anwar-sarraf', role: 'member' },
  { login: 't021551-tech', role: 'member' },
];

export function profileUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}`;
}

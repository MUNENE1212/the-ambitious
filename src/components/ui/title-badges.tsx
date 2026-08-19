import { MemberTitle } from '@/lib/types';
import { TITLE_LABELS } from '@/lib/constants';
import { Badge } from './badge';

/** Renders a member's office-bearer titles as small gold badges — used
 * wherever a post, reply, or verification stamp needs to show who's speaking. */
export function TitleBadges({ titles }: { titles: MemberTitle[] }) {
  if (!titles || titles.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {titles.map(t => (
        <Badge key={t} variant="gold">{TITLE_LABELS[t]}</Badge>
      ))}
    </span>
  );
}

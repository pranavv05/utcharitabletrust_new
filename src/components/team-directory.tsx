'use client';
import {useMemo, useState} from 'react';
import Image from 'next/image';
import {Search} from 'lucide-react';
import type {SiteContent, TeamMember} from '@/lib/site-content';
import {uniquePeople} from '@/lib/media';
import {groupTeam, hasPhoto, initials, isLeader, type TeamGroup} from '@/lib/team';

type Tab = 'all' | TeamGroup;

function Person({member, index}: {member: TeamMember; index: number}) {
  return (
    <article
      className={'team-person' + (isLeader(member) ? ' leader' : '')}
      style={{'--i': index % 8} as React.CSSProperties}
    >
      <div className="team-person-photo">
        {hasPhoto(member.image) ? (
          <Image src={member.image} alt={member.name} fill sizes="(max-width: 700px) 46vw, 260px" />
        ) : (
          <span className="team-person-initials" role="img" aria-label={member.name}>
            {initials(member.name)}
          </span>
        )}
      </div>
      <div className="team-person-text">
        <h3>{member.name}</h3>
        <p className="team-person-role">{member.role}</p>
        {member.bio && <p className="team-bio">{member.bio}</p>}
      </div>
    </article>
  );
}

/**
 * The Our people page: everyone grouped as on the trust's member page (Trustees, Advisory Board, Mentors and
 * Working Body), with a count for each group, a search across everyone and leaders marked out.
 */
export function TeamDirectory({team}: {team: SiteContent['team']}) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const everyone = useMemo(() => uniquePeople(team), [team]);
  const groups = useMemo(() => groupTeam(everyone), [everyone]);
  const needle = query.trim().toLowerCase();
  const visible = groups
    .filter((g) => needle || tab === 'all' || g.group.id === tab)
    .map((g) => ({
      ...g,
      people: g.people.filter(
        (p) => !needle || (p.name + ' ' + p.role + ' ' + (p.bio || '')).toLowerCase().includes(needle),
      ),
    }))
    .filter((g) => g.people.length > 0);
  const found = visible.reduce((sum, g) => sum + g.people.length, 0);
  return (
    <div className="team-hub">
      <div className="team-summary">
        <p>
          <strong>{everyone.length}</strong> people in {groups.length} groups, giving their time and care to
          the trust.
        </p>
        <label className="team-search">
          <Search size={18} aria-hidden="true" />
          <span className="team-sr">Search people</span>
          <input
            type="search"
            value={query}
            placeholder="Search by name or role"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="team-tabs" role="group" aria-label="Show a group of people">
        <button type="button" aria-pressed={tab === 'all' && !needle} onClick={() => setTab('all')}>
          <strong>{everyone.length}</strong>
          <span>Everyone</span>
        </button>
        {groups.map((g) => (
          <button
            type="button"
            key={g.group.id}
            aria-pressed={tab === g.group.id && !needle}
            onClick={() => {
              setTab(g.group.id);
              setQuery('');
            }}
          >
            <strong>{g.people.length}</strong>
            <span>{g.group.tab}</span>
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {needle && (
          <p className="team-found">
            {found
              ? `${found} ${found === 1 ? 'person matches' : 'people match'} “${query.trim()}”`
              : `Nobody matches “${query.trim()}”.`}
          </p>
        )}
        {visible.map(({group, people}) => (
          <section className="team-group" key={group.id} aria-labelledby={'team-group-' + group.id}>
            <header className="team-group-head">
              <div>
                <h2 id={'team-group-' + group.id}>{group.label}</h2>
                <p>{group.about}</p>
              </div>
              <span className="team-count">{people.length}</span>
            </header>
            <div className="team-people">
              {people.map((m, i) => (
                <Person key={m.name + m.image} member={m} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

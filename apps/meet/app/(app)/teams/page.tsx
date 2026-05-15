import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { ButtonLink } from '@/components/ui/button';

type Team = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  my_role: 'lead' | 'member';
};

export default async function TeamsPage() {
  let items: Team[] = [];
  let error: string | null = null;

  try {
    const r = await apiFetch<{ items: Team[] }>('/api/v1/meet/teams');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Teams"
        description="Shared groups that own their own booking links and meeting types."
        actions={<ButtonLink href="/teams/new">New team</ButtonLink>}
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Your teams</SectionLabel>
        {items.length === 0 ? (
          <EmptyState>No teams yet. Create one to share booking links.</EmptyState>
        ) : (
          <ListGroup>
            {items.map((t) => (
              <ListRow
                key={t.id}
                href={`/teams/${t.id}`}
                primary={t.name}
                secondary={`meet.thefibre.app/${t.slug}`}
                meta={
                  <>
                    {!t.is_active && (
                      <span className="uppercase tracking-wider text-ink-muted">
                        Hidden
                      </span>
                    )}
                    <span className="uppercase tracking-wider text-ink-muted">
                      {t.my_role}
                    </span>
                  </>
                }
              />
            ))}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}

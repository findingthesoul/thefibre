import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { TeamForm } from '../form';

export default function NewTeamPage() {
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/teams" label="Teams" />
      <PageHeader
        title="New team"
        description="A team has its own booking URL and meeting types."
      />
      <div className="mt-10">
        <TeamForm initial={{}} />
      </div>
    </PageContainer>
  );
}

import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { MeetingTypeForm } from '../form';

export default function NewMeetingTypePage() {
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/meeting-types" label="Meeting types" />
      <PageHeader
        title="New meeting type"
        description="What can people book you for?"
      />
      <div className="mt-10">
        <MeetingTypeForm initial={{}} />
      </div>
    </PageContainer>
  );
}

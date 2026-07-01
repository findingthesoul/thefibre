import {
  Calendar,
  MessagesSquare,
  Presentation,
  PenLine,
  ListChecks,
  Mail,
  FileText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { EngagementType } from './thread-types';

// The 8 engagement types in two families (thethread-v3 model):
//   activities — timed, appear on the agenda, carry a location/meeting link
//   messages   — scheduled sends to enrolled participants (the email
//                sequence IS this family)
// Type can only change within its family after creation — the API enforces it.

export type EngagementFamily = 'activity' | 'message';

export type EngagementMeta = {
  type: EngagementType;
  family: EngagementFamily;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const ENGAGEMENT_META: EngagementMeta[] = [
  // Activities
  {
    type: 'event',
    family: 'activity',
    label: 'Event',
    description: 'A session at a set time — plenary, gathering, ceremony.',
    icon: Calendar,
  },
  {
    type: 'conversation',
    family: 'activity',
    label: 'Conversation',
    description: 'A guided group conversation or circle.',
    icon: MessagesSquare,
  },
  {
    type: 'workshop',
    family: 'activity',
    label: 'Workshop',
    description: 'Hands-on working session with a facilitator.',
    icon: Presentation,
  },
  // Messages
  {
    type: 'message',
    family: 'message',
    label: 'Message',
    description: 'An email to all participants, sent at a scheduled moment.',
    icon: Mail,
  },
  {
    type: 'reflection',
    family: 'message',
    label: 'Reflection',
    description: 'Questions participants answer in their own words.',
    icon: PenLine,
  },
  {
    type: 'practice',
    family: 'message',
    label: 'Practice',
    description: 'Assignments to complete before the next step.',
    icon: ListChecks,
  },
  {
    type: 'document',
    family: 'message',
    label: 'Document',
    description: 'A file or link shared with participants.',
    icon: FileText,
  },
  {
    type: 'inspiration',
    family: 'message',
    label: 'Inspiration',
    description: 'A quote, video or idea to spark the thread.',
    icon: Sparkles,
  },
];

export function metaFor(type: EngagementType): EngagementMeta {
  return ENGAGEMENT_META.find((m) => m.type === type) ?? ENGAGEMENT_META[0];
}

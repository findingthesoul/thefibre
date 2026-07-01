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
  /** Timeline dot colour (v3 had per-type coloured dots on the line). */
  dot: string;
};

export const ENGAGEMENT_META: EngagementMeta[] = [
  // Activities
  {
    type: 'event',
    family: 'activity',
    label: 'Event',
    description: 'A session at a set time — plenary, gathering, ceremony.',
    icon: Calendar,
    dot: 'bg-sky-500',
  },
  {
    type: 'conversation',
    family: 'activity',
    label: 'Conversation',
    description: 'A guided group conversation or circle.',
    icon: MessagesSquare,
    dot: 'bg-emerald-500',
  },
  {
    type: 'workshop',
    family: 'activity',
    label: 'Workshop',
    description: 'Hands-on working session with a facilitator.',
    icon: Presentation,
    dot: 'bg-amber-500',
  },
  // Messages
  {
    type: 'message',
    family: 'message',
    label: 'Message',
    description: 'An email to all participants, sent at a scheduled moment.',
    icon: Mail,
    dot: 'bg-blue-500',
  },
  {
    type: 'reflection',
    family: 'message',
    label: 'Reflection',
    description: 'Questions participants answer in their own words.',
    icon: PenLine,
    dot: 'bg-violet-500',
  },
  {
    type: 'practice',
    family: 'message',
    label: 'Practice',
    description: 'Assignments to complete before the next step.',
    icon: ListChecks,
    dot: 'bg-teal-500',
  },
  {
    type: 'document',
    family: 'message',
    label: 'Document',
    description: 'A file or link shared with participants.',
    icon: FileText,
    dot: 'bg-slate-400',
  },
  {
    type: 'inspiration',
    family: 'message',
    label: 'Inspiration',
    description: 'A quote, video or idea to spark the thread.',
    icon: Sparkles,
    dot: 'bg-pink-500',
  },
];

export function metaFor(type: EngagementType): EngagementMeta {
  return ENGAGEMENT_META.find((m) => m.type === type) ?? ENGAGEMENT_META[0];
}

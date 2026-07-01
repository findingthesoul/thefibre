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
  /** Tinted text for the type label on cards. */
  text: string;
  /** Tinted chip background for the card's icon. */
  chip: string;
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
    text: 'text-sky-700',
    chip: 'bg-sky-50 ring-sky-200',
  },
  {
    type: 'conversation',
    family: 'activity',
    label: 'Conversation',
    description: 'A guided group conversation or circle.',
    icon: MessagesSquare,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    chip: 'bg-emerald-50 ring-emerald-200',
  },
  {
    type: 'workshop',
    family: 'activity',
    label: 'Workshop',
    description: 'Hands-on working session with a facilitator.',
    icon: Presentation,
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    chip: 'bg-amber-50 ring-amber-200',
  },
  // Messages
  {
    type: 'message',
    family: 'message',
    label: 'Message',
    description: 'An email to all participants, sent at a scheduled moment.',
    icon: Mail,
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    chip: 'bg-blue-50 ring-blue-200',
  },
  {
    type: 'reflection',
    family: 'message',
    label: 'Reflection',
    description: 'Questions participants answer in their own words.',
    icon: PenLine,
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    chip: 'bg-violet-50 ring-violet-200',
  },
  {
    type: 'practice',
    family: 'message',
    label: 'Practice',
    description: 'Assignments to complete before the next step.',
    icon: ListChecks,
    dot: 'bg-teal-500',
    text: 'text-teal-700',
    chip: 'bg-teal-50 ring-teal-200',
  },
  {
    type: 'document',
    family: 'message',
    label: 'Document',
    description: 'A file or link shared with participants.',
    icon: FileText,
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    chip: 'bg-slate-50 ring-slate-200',
  },
  {
    type: 'inspiration',
    family: 'message',
    label: 'Inspiration',
    description: 'A quote, video or idea to spark the thread.',
    icon: Sparkles,
    dot: 'bg-pink-500',
    text: 'text-pink-700',
    chip: 'bg-pink-50 ring-pink-200',
  },
];

export function metaFor(type: EngagementType): EngagementMeta {
  return ENGAGEMENT_META.find((m) => m.type === type) ?? ENGAGEMENT_META[0];
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { cleanCourseCode } from '@/lib/validation/cleaning';

export interface GroupActionState {
  ok: boolean;
  /** Dictionary key under `groups.msg`, resolved on the client. */
  messageKey?: string;
  groupId?: string;
}

const FAILED: GroupActionState = { ok: false, messageKey: 'failed' };

/**
 * Create a group for a course.
 *
 * The university is snapshotted from the profile rather than typed, because it
 * is the discovery scope: a group is offered to students of the same
 * university and nobody else. Without one on the profile there is no scope to
 * offer it in, so the student is sent to fill it in first.
 */
export async function createGroup(input: {
  courseCode: string;
  courseName?: string | null;
  title: string;
  note?: string | null;
  maxMembers?: number;
}): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    const title = input.title.trim();
    const code = cleanCourseCode(input.courseCode).value.trim();
    if (!title || !code) return { ok: false, messageKey: 'missing' };

    const { data: profile } = await supabase
      .from('profiles').select('university').eq('user_id', userId).maybeSingle();
    const university = ((profile as { university?: string | null } | null)?.university ?? '').trim();
    if (!university) return { ok: false, messageKey: 'noUniversity' };

    const max = Math.min(20, Math.max(2, Math.round(input.maxMembers ?? 6)));

    const { data, error } = await supabase
      .from('study_groups')
      .insert({
        owner_id: userId,
        university,
        course_code: code.toUpperCase(),
        course_name: input.courseName?.trim() || null,
        title,
        note: input.note?.trim() || null,
        max_members: max,
      })
      .select('id')
      .single();
    if (error || !data) return FAILED;

    const groupId = (data as { id: string }).id;
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId, role: 'owner' });

    // A group with no members is not a group; if the owner row fails, the
    // group is removed rather than left behind as an empty shell.
    if (memberError) {
      await supabase.from('study_groups').delete().eq('id', groupId);
      return FAILED;
    }

    revalidatePath('/groups');
    return { ok: true, messageKey: 'created', groupId };
  } catch {
    return FAILED;
  }
}

/** Join through the database function, which is where capacity is enforced. */
export async function joinGroup(groupId: string): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('join_group', { p_group_id: groupId });
    if (error) return FAILED;

    const outcome = String(data ?? '');
    revalidatePath('/groups');
    revalidatePath(`/groups/${groupId}`);

    if (outcome === 'joined') return { ok: true, messageKey: 'joined', groupId };
    if (outcome === 'already_member') return { ok: true, messageKey: 'alreadyMember', groupId };
    if (outcome === 'full') return { ok: false, messageKey: 'full' };
    if (outcome === 'closed') return { ok: false, messageKey: 'closed' };
    if (outcome === 'other_university') return { ok: false, messageKey: 'otherUniversity' };
    return FAILED;
  } catch {
    return FAILED;
  }
}

export async function leaveGroup(groupId: string): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) return FAILED;

    revalidatePath('/groups');
    return { ok: true, messageKey: 'left' };
  } catch {
    return FAILED;
  }
}

/** Your name, inside this group only. The board's setting is separate. */
export async function setGroupNameVisible(
  groupId: string, visible: boolean,
): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('group_members')
      .update({ show_name: visible })
      .eq('group_id', groupId)
      .eq('user_id', userId);
    if (error) return FAILED;

    revalidatePath(`/groups/${groupId}`);
    return { ok: true, messageKey: 'saved' };
  } catch {
    return FAILED;
  }
}

/** Book one of the shared windows the engine found. */
export async function scheduleMeeting(input: {
  groupId: string;
  meetsOn: string;
  startTime: string;
  endTime: string;
  place?: string | null;
}): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.meetsOn)) return { ok: false, messageKey: 'missing' };
    if (input.endTime <= input.startTime) return { ok: false, messageKey: 'missing' };

    const { error } = await supabase.from('group_meetings').insert({
      group_id: input.groupId,
      created_by: userId,
      meets_on: input.meetsOn,
      start_time: input.startTime,
      end_time: input.endTime,
      place: input.place?.trim() || null,
    });
    if (error) return FAILED;

    revalidatePath(`/groups/${input.groupId}`);
    return { ok: true, messageKey: 'scheduled' };
  } catch {
    return FAILED;
  }
}

/**
 * Mark yourself present or absent.
 *
 * Only your own attendance, and only for a meeting of a group you are in —
 * both enforced by policy, not by this function. A commitment score built from
 * rows anyone could write for anyone else would mean nothing.
 */
export async function markAttendance(
  meetingId: string, groupId: string, attended: boolean,
): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    const { error } = await supabase
      .from('meeting_attendance')
      .upsert(
        { meeting_id: meetingId, user_id: userId, attended, marked_at: new Date().toISOString() },
        { onConflict: 'meeting_id,user_id' },
      );
    if (error) return FAILED;

    revalidatePath(`/groups/${groupId}`);
    return { ok: true, messageKey: 'saved' };
  } catch {
    return FAILED;
  }
}

/** Where the group meets, and whether it is still taking members. */
export async function updateGroup(input: {
  groupId: string;
  place?: string | null;
  isOpen?: boolean;
}): Promise<GroupActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.place !== undefined) patch.place = input.place?.trim() || null;
    if (input.isOpen !== undefined) patch.is_open = input.isOpen;

    const { error } = await supabase
      .from('study_groups').update(patch).eq('id', input.groupId).eq('owner_id', userId);
    if (error) return FAILED;

    revalidatePath(`/groups/${input.groupId}`);
    return { ok: true, messageKey: 'saved' };
  } catch {
    return FAILED;
  }
}

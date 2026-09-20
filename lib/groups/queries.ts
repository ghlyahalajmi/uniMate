import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import {
  sharedFreeWindows, toMinutes, WEEKDAYS,
  type Block, type FreeWindow, type Weekday,
} from './availability';

export interface GroupSummary {
  id: string;
  title: string;
  courseCode: string;
  courseName: string | null;
  note: string | null;
  place: string | null;
  memberCount: number;
  maxMembers: number;
  isMember: boolean;
  isOwner: boolean;
}

export interface DiscoveredGroup extends GroupSummary {
  /** Minutes per week this group and you could all study together. */
  sharedMinutes: number;
  /** The best two or three of those windows, for the card. */
  windows: FreeWindow[];
}

export interface RosterEntry {
  memberNo: number;
  displayName: string | null;
  isMe: boolean;
  isOwner: boolean;
  invited: number;
  attended: number;
}

export interface MeetingRow {
  id: string;
  meetsOn: string;
  startTime: string;
  endTime: string;
  place: string | null;
  createdBy: string;
  iAttended: boolean | null;
  attendedCount: number;
}

const WEEKDAY_SET = new Set<string>(WEEKDAYS);

interface BusyRow {
  group_id: string;
  member_no: number;
  day: string;
  starts_at: string;
  ends_at: string;
  building: string | null;
}

/**
 * The anonymised timetables behind one or more groups, turned into the shape
 * the engine takes: one array of blocks per member, per group.
 *
 * Nothing here knows who anybody is — the database hands back a member number
 * that only means "a different person", which is all the engine needs.
 */
export async function busyByGroup(
  groupIds: string[],
): Promise<Map<string, { members: Block[][]; buildings: string[] }>> {
  const out = new Map<string, { members: Block[][]; buildings: string[] }>();
  if (groupIds.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('group_busy_blocks', {
    p_group_ids: groupIds.slice(0, 20),
  });
  if (error || !Array.isArray(data)) return out;

  // member_no → index, per group, so a member with no classes still gets a
  // (empty) slot and is counted as free rather than missing.
  const perGroup = new Map<string, Map<number, Block[]>>();
  const buildings = new Map<string, Set<string>>();

  for (const row of data as BusyRow[]) {
    if (!WEEKDAY_SET.has(row.day)) continue;
    const start = toMinutes(row.starts_at);
    const end = toMinutes(row.ends_at);
    if (start === null || end === null || end <= start) continue;

    const members = perGroup.get(row.group_id) ?? new Map<number, Block[]>();
    const blocks = members.get(row.member_no) ?? [];
    blocks.push({ day: row.day as Weekday, start, end });
    members.set(row.member_no, blocks);
    perGroup.set(row.group_id, members);

    if (row.building) {
      const set = buildings.get(row.group_id) ?? new Set<string>();
      set.add(row.building);
      buildings.set(row.group_id, set);
    }
  }

  for (const [groupId, members] of perGroup) {
    out.set(groupId, {
      members: [...members.values()],
      buildings: [...(buildings.get(groupId) ?? [])],
    });
  }
  return out;
}

/**
 * Members with no classes at all never appear in the busy rows, so the group's
 * member count is passed in and the missing ones are added back as free.
 */
function paddedMembers(found: Block[][], memberCount: number): Block[][] {
  const missing = Math.max(0, memberCount - found.length);
  return [...found, ...Array.from({ length: missing }, () => [] as Block[])];
}

/** Groups you are in, newest first, each with its next meeting. */
export async function getMyGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const ids = (memberships ?? []).map((m) => (m as { group_id: string }).group_id);
  if (ids.length === 0) return [];

  const { data: groups } = await supabase
    .from('study_groups')
    .select('id, title, course_code, course_name, note, place, max_members, owner_id')
    .in('id', ids)
    .order('created_at', { ascending: false });

  const { data: counts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', ids);

  const countBy = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ group_id: string }>) {
    countBy.set(row.group_id, (countBy.get(row.group_id) ?? 0) + 1);
  }

  return ((groups ?? []) as Array<{
    id: string; title: string; course_code: string; course_name: string | null;
    note: string | null; place: string | null; max_members: number; owner_id: string;
  }>).map((g) => ({
    id: g.id,
    title: g.title,
    courseCode: g.course_code,
    courseName: g.course_name,
    note: g.note,
    place: g.place,
    memberCount: countBy.get(g.id) ?? 1,
    maxMembers: g.max_members,
    isMember: true,
    isOwner: g.owner_id === userId,
  }));
}

/**
 * Open groups for a course code, ranked by how much time they could actually
 * share with you — the whole point of the feature. Your own timetable is added
 * to each group's before the overlap is computed, so the number on the card is
 * the number you would get by joining, not the group's internal overlap.
 */
export async function discoverGroups(courseCode: string): Promise<DiscoveredGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('discover_groups', { p_course_code: courseCode });
  if (error || !Array.isArray(data)) return [];

  const rows = data as Array<{
    group_id: string; title: string; course_code: string; course_name: string | null;
    note: string | null; place: string | null; member_count: number; max_members: number;
    is_member: boolean;
  }>;
  if (rows.length === 0) return [];

  const [busy, mine] = await Promise.all([
    busyByGroup(rows.map((r) => r.group_id)),
    myBlocks(),
  ]);

  return rows
    .map((r) => {
      const found = busy.get(r.group_id)?.members ?? [];
      const members = paddedMembers(found, r.member_count);
      // Add yourself unless you are already counted in the group.
      const withMe = r.is_member ? members : [...members, mine];
      const windows = sharedFreeWindows(withMe, { requireAll: true });

      return {
        id: r.group_id,
        title: r.title,
        courseCode: r.course_code,
        courseName: r.course_name,
        note: r.note,
        place: r.place,
        memberCount: r.member_count,
        maxMembers: r.max_members,
        isMember: r.is_member,
        isOwner: false,
        sharedMinutes: windows.reduce((sum, w) => sum + (w.end - w.start), 0),
        windows: windows.slice(0, 3),
      };
    })
    .sort((a, b) => b.sharedMinutes - a.sharedMinutes || b.memberCount - a.memberCount);
}

/** Your own classes as blocks — the other half of every match. */
export async function myBlocks(): Promise<Block[]> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data } = await supabase
    .from('courses')
    .select('days, start_time, end_time')
    .eq('user_id', userId)
    .eq('status', 'active');

  const blocks: Block[] = [];
  for (const row of (data ?? []) as Array<{ days: string[]; start_time: string | null; end_time: string | null }>) {
    const start = toMinutes(row.start_time);
    const end = toMinutes(row.end_time);
    if (start === null || end === null || end <= start) continue;
    for (const day of row.days ?? []) {
      if (WEEKDAY_SET.has(day)) blocks.push({ day: day as Weekday, start, end });
    }
  }
  return blocks;
}

export interface GroupDetail {
  group: GroupSummary;
  roster: RosterEntry[];
  meetings: MeetingRow[];
  windows: FreeWindow[];
  /** Buildings the members already have classes in, for the place suggestion. */
  buildings: string[];
  /** Whether this student has their name shown inside the group. */
  showName: boolean;
}

/** Everything one group's page needs. Null when it is not yours to see. */
export async function getGroup(id: string): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data: group } = await supabase
    .from('study_groups')
    .select('id, title, course_code, course_name, note, place, max_members, owner_id, is_open')
    .eq('id', id)
    .maybeSingle();
  if (!group) return null;

  const g = group as {
    id: string; title: string; course_code: string; course_name: string | null;
    note: string | null; place: string | null; max_members: number; owner_id: string;
  };

  const [{ data: rosterRows }, { data: meetingRows }, { data: mine }, busy] = await Promise.all([
    supabase.rpc('group_roster', { p_group_id: id }),
    supabase
      .from('group_meetings')
      .select('id, meets_on, start_time, end_time, place, created_by')
      .eq('group_id', id)
      .order('meets_on', { ascending: false })
      .limit(20),
    supabase.from('group_members').select('show_name').eq('group_id', id).eq('user_id', userId).maybeSingle(),
    busyByGroup([id]),
  ]);

  const roster = ((rosterRows ?? []) as Array<{
    member_no: number; display_name: string | null; is_me: boolean;
    is_owner: boolean; invited: number; attended: number;
  }>).map((r) => ({
    memberNo: r.member_no,
    displayName: r.display_name,
    isMe: Boolean(r.is_me),
    isOwner: Boolean(r.is_owner),
    invited: r.invited,
    attended: r.attended,
  }));

  const meetingIds = ((meetingRows ?? []) as Array<{ id: string }>).map((m) => m.id);
  const { data: attendance } = meetingIds.length
    ? await supabase
      .from('meeting_attendance')
      .select('meeting_id, user_id, attended')
      .in('meeting_id', meetingIds)
    : { data: [] as Array<{ meeting_id: string; user_id: string; attended: boolean }> };

  const meetings: MeetingRow[] = ((meetingRows ?? []) as Array<{
    id: string; meets_on: string; start_time: string; end_time: string;
    place: string | null; created_by: string;
  }>).map((m) => {
    const rows = (attendance ?? []).filter((a) => a.meeting_id === m.id);
    const mineRow = rows.find((a) => a.user_id === userId);
    return {
      id: m.id,
      meetsOn: m.meets_on,
      startTime: m.start_time,
      endTime: m.end_time,
      place: m.place,
      createdBy: m.created_by,
      iAttended: mineRow ? mineRow.attended : null,
      attendedCount: rows.filter((a) => a.attended).length,
    };
  });

  const found = busy.get(id);
  const members = paddedMembers(found?.members ?? [], roster.length || 1);

  return {
    group: {
      id: g.id,
      title: g.title,
      courseCode: g.course_code,
      courseName: g.course_name,
      note: g.note,
      place: g.place,
      memberCount: roster.length,
      maxMembers: g.max_members,
      isMember: true,
      isOwner: g.owner_id === userId,
    },
    roster,
    meetings,
    windows: sharedFreeWindows(members).slice(0, 8),
    buildings: found?.buildings ?? [],
    showName: (mine as { show_name?: boolean } | null)?.show_name ?? true,
  };
}

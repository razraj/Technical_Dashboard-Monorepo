/* eslint-disable */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, TimesheetStatus, TaskType, TaskStatus, TaskPriority, ProjectRole, ProjectStatus, UserRole } from "./index.js";

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password123";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDayUTC(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
}

function mondayOfWeeksAgo(weeksAgo: number): Date {
    const now = startOfDayUTC(new Date());
    const dayOfWeek = now.getUTCDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - offsetToMonday);
    const target = new Date(thisMonday);
    target.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7);
    return target;
}

function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() + days);
    return out;
}

function atUTC(d: Date, hours: number, minutes = 0): Date {
    const out = new Date(d);
    out.setUTCHours(hours, minutes, 0, 0);
    return out;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function futureDate(daysFromNow: number): Date {
    return addDays(startOfDayUTC(new Date()), daysFromNow);
}

// ─── User definitions ─────────────────────────────────────────────────────────

const USERS = [
    // Admin — full CRUD on everything
    { email: "admin@example.com", username: "admin", firstName: "Admin", lastName: "User",     role: UserRole.ADMIN },
    // Project manager — sees everyone's tasks, creates/assigns tasks
    { email: "alice@example.com", username: "alice", firstName: "Alice", lastName: "Chen",     role: UserRole.PROJECT_MANAGER },
    // Employees
    { email: "bob@example.com",   username: "bob",   firstName: "Bob",   lastName: "Martinez", role: UserRole.EMPLOYEE },
    { email: "carol@example.com", username: "carol", firstName: "Carol", lastName: "Singh",    role: UserRole.EMPLOYEE },
    { email: "dave@example.com",  username: "dave",  firstName: "Dave",  lastName: "Brown",    role: UserRole.EMPLOYEE },
    { email: "eve@example.com",   username: "eve",   firstName: "Eve",   lastName: "Davis",    role: UserRole.EMPLOYEE },
];

// ─── Timesheet seeder ─────────────────────────────────────────────────────────

interface EntrySpec {
    taskId: string;
    hours: number;
    isOvertime: boolean;
    description: string;
    startHour: number;
    endHour: number;
}

interface DaySpec {
    dayOffset: number; // 0 = Monday
    entries: EntrySpec[];
}

interface WeekSpec {
    seqNum: number;
    weeksAgo: number;
    status: TimesheetStatus;
    notes: string | null;
    days: DaySpec[];
}

async function seedWeek(userId: string, spec: WeekSpec): Promise<void> {
    const monday = mondayOfWeeksAgo(spec.weeksAgo);
    const friday = addDays(monday, 4);

    let totalHours = 0;
    let overtimeHours = 0;
    for (const day of spec.days) {
        for (const entry of day.entries) {
            totalHours += entry.hours;
            if (entry.isOvertime) overtimeHours += entry.hours;
        }
    }
    const regularHours = totalHours - overtimeHours;

    const timesheet = await prisma.timesheet.create({
        data: {
            userId,
            sequenceNumber: spec.seqNum,
            status: spec.status,
            title: `Week of ${isoDate(monday)}`,
            notes: spec.notes,
            periodStart: monday,
            periodEnd: friday,
            totalHours,
            regularHours,
            overtimeHours,
            submittedAt: spec.status === TimesheetStatus.COMPLETED ? atUTC(friday, 17) : null,
        },
    });

    const entryRows = spec.days.flatMap((day) =>
        day.entries.map((e) => {
            const workDate = addDays(monday, day.dayOffset);
            return {
                timesheetId: timesheet.id,
                taskId: e.taskId,
                workDate,
                hours: e.hours,
                startTime: atUTC(workDate, e.startHour),
                endTime: atUTC(workDate, e.endHour),
                isOvertime: e.isOvertime,
                description: e.description,
            };
        })
    );

    if (entryRows.length > 0) {
        await prisma.timesheetEntry.createMany({ data: entryRows });
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("Seeding database...\n");

    // Clear existing data in FK-safe order before re-seeding.
    await prisma.timesheetEntry.deleteMany({});
    await prisma.timesheet.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    console.log("✓ Cleared existing data\n");

    // ── 1. Users ──────────────────────────────────────────────────────────────
    const hashedPw = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const users: Record<string, { id: string; email: string; username: string }> = {};

    for (const u of USERS) {
        const created = await prisma.user.create({
            data: {
                email: u.email,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                role: u.role,
                password: hashedPw,
                emailVerified: new Date(),
            },
        });
        users[u.username] = { id: created.id, email: u.email, username: u.username };
        console.log(`✓ User: ${u.username} (${u.role})`);
    }

    // ── 2. Projects ───────────────────────────────────────────────────────────
    const projects: Record<string, { id: string; name: string }> = {};

    const projectDefs = [
        { key: "platform",  name: "TenT Platform",      description: "Core SaaS dashboard product",              color: "#3B82F6", owner: "alice", status: ProjectStatus.ACTIVE    },
        { key: "mobile",    name: "Mobile App",          description: "iOS and Android companion app",             color: "#8B5CF6", owner: "alice", status: ProjectStatus.ACTIVE    },
        { key: "infra",     name: "Infrastructure",      description: "DevOps, CI/CD, and cloud infrastructure",   color: "#F59E0B", owner: "alice", status: ProjectStatus.ON_HOLD  },
    ];

    for (const p of projectDefs) {
        const created = await prisma.project.create({
            data: { name: p.name, description: p.description, color: p.color, status: p.status, createdById: users[p.owner]!.id },
        });
        projects[p.key] = { id: created.id, name: p.name };
        console.log(`✓ Project: ${p.name}`);
    }

    // ── 3. Project members ────────────────────────────────────────────────────
    const memberDefs: { project: string; username: string; role: ProjectRole }[] = [
        // TenT Platform
        { project: "platform", username: "alice", role: ProjectRole.OWNER  },
        { project: "platform", username: "bob",   role: ProjectRole.MEMBER },
        { project: "platform", username: "carol", role: ProjectRole.MEMBER },
        { project: "platform", username: "dave",  role: ProjectRole.MEMBER },
        // Mobile App
        { project: "mobile",   username: "alice", role: ProjectRole.OWNER  },
        { project: "mobile",   username: "bob",   role: ProjectRole.MEMBER },
        { project: "mobile",   username: "eve",   role: ProjectRole.MEMBER },
        // Infrastructure
        { project: "infra",    username: "alice", role: ProjectRole.OWNER  },
        { project: "infra",    username: "carol", role: ProjectRole.MEMBER },
        { project: "infra",    username: "dave",  role: ProjectRole.MEMBER },
    ];

    await prisma.projectMember.createMany({
        data: memberDefs.map((m) => ({
            projectId: projects[m.project]!.id,
            userId:    users[m.username]!.id,
            role:      m.role,
        })),
    });
    console.log(`✓ Project memberships (${memberDefs.length})`);

    // ── 4. Tasks ──────────────────────────────────────────────────────────────
    const tasks: Record<string, string> = {}; // key → id

    const taskDefs: {
        key: string; project: string; title: string; description: string;
        type: TaskType; status: TaskStatus; priority: TaskPriority; estimatedHours: number;
        assignedTo: string; assignedBy?: string; createdBy: string; dueDaysFromNow?: number;
    }[] = [
        // ── TenT Platform ──
        {
            key: "auth_redesign",  project: "platform",
            title: "User authentication redesign",
            description: "Redesign login, signup, and OAuth flows to support SSO providers.",
            type: TaskType.FEATURE, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
            estimatedHours: 24, assignedTo: "bob", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 10,
        },
        {
            key: "login_redirect", project: "platform",
            title: "Fix login redirect bug",
            description: "After OAuth login, users land on / instead of the dashboard.",
            type: TaskType.FIX, status: TaskStatus.DONE, priority: TaskPriority.URGENT,
            estimatedHours: 3, assignedTo: "carol", assignedBy: "alice", createdBy: "alice",
        },
        {
            key: "dashboard_perf", project: "platform",
            title: "Dashboard performance research",
            description: "Investigate why the main dashboard is slow for accounts with >500 tasks.",
            type: TaskType.RESEARCH, status: TaskStatus.TODO, priority: TaskPriority.MEDIUM,
            estimatedHours: 8, assignedTo: "dave", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 14,
        },
        {
            key: "dark_mode",      project: "platform",
            title: "Dark mode support",
            description: "Add a dark theme that respects the user's OS preference.",
            type: TaskType.FEATURE, status: TaskStatus.TODO, priority: TaskPriority.LOW,
            estimatedHours: 16, assignedTo: "bob", createdBy: "bob", dueDaysFromNow: 21,
        },
        {
            key: "csv_crash",      project: "platform",
            title: "Fix CSV export crash",
            description: "Exporting a timesheet with >1000 entries throws a memory error.",
            type: TaskType.FIX, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
            estimatedHours: 5, assignedTo: "carol", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 3,
        },
        // ── Mobile App ──
        {
            key: "push_notif",     project: "mobile",
            title: "iOS push notification integration",
            description: "Integrate APNs for timesheet reminder notifications.",
            type: TaskType.FEATURE, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
            estimatedHours: 24, assignedTo: "bob", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 7,
        },
        {
            key: "android_crash",  project: "mobile",
            title: "App crash on Android 14",
            description: "App crashes on launch on Pixel 8 running Android 14.",
            type: TaskType.FIX, status: TaskStatus.TODO, priority: TaskPriority.URGENT,
            estimatedHours: 8, assignedTo: "eve", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 2,
        },
        {
            key: "offline_mode",   project: "mobile",
            title: "Offline mode research",
            description: "Research approaches for offline timesheet entry with conflict resolution.",
            type: TaskType.RESEARCH, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM,
            estimatedHours: 12, assignedTo: "eve", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 5,
        },
        {
            key: "ui_components",  project: "mobile",
            title: "Shared UI component library",
            description: "Build a shared component library for consistent UI across iOS/Android.",
            type: TaskType.FEATURE, status: TaskStatus.BLOCKED, priority: TaskPriority.MEDIUM,
            estimatedHours: 40, assignedTo: "bob", createdBy: "bob",
        },
        // ── Infrastructure ──
        {
            key: "pg_migration",   project: "infra",
            title: "Migrate to PostgreSQL 16",
            description: "Upgrade from PG 14 to PG 16 to benefit from logical replication improvements.",
            type: TaskType.RESEARCH, status: TaskStatus.DONE, priority: TaskPriority.HIGH,
            estimatedHours: 10, assignedTo: "carol", assignedBy: "alice", createdBy: "alice",
        },
        {
            key: "staging_env",    project: "infra",
            title: "Set up staging environment",
            description: "Mirror production on a separate Neon branch for pre-release testing.",
            type: TaskType.OTHER, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM,
            estimatedHours: 16, assignedTo: "dave", assignedBy: "alice", createdBy: "alice", dueDaysFromNow: 5,
        },
        {
            key: "ci_pipeline",    project: "infra",
            title: "CI pipeline optimisation",
            description: "Reduce test suite run time from 8 min to under 3 min.",
            type: TaskType.FIX, status: TaskStatus.TODO, priority: TaskPriority.MEDIUM,
            estimatedHours: 6, assignedTo: "carol", createdBy: "carol", dueDaysFromNow: 12,
        },
        {
            key: "monitoring",     project: "infra",
            title: "Monitoring dashboard",
            description: "Set up Grafana dashboards for API latency, error rates, and DB query times.",
            type: TaskType.FEATURE, status: TaskStatus.BLOCKED, priority: TaskPriority.LOW,
            estimatedHours: 20, assignedTo: "dave", assignedBy: "alice", createdBy: "alice",
        },
    ];

    for (const t of taskDefs) {
        const isDone = t.status === TaskStatus.DONE;
        const created = await prisma.task.create({
            data: {
                projectId:      projects[t.project]!.id,
                title:          t.title,
                description:    t.description,
                type:           t.type,
                status:         t.status,
                priority:       t.priority,
                estimatedHours: t.estimatedHours,
                assignedToId:   users[t.assignedTo]!.id,
                // Only set assignedById when the assigner differs from the creator (manager assignment)
                assignedById:   t.assignedBy ? users[t.assignedBy]!.id : null,
                createdById:    users[t.createdBy]!.id,
                dueDate:        t.dueDaysFromNow != null ? futureDate(t.dueDaysFromNow) : null,
                completedAt:    isDone ? addDays(startOfDayUTC(new Date()), -7) : null,
            },
        });
        tasks[t.key] = created.id;
    }
    console.log(`✓ Tasks (${taskDefs.length})`);

    // ── 5. Timesheets ─────────────────────────────────────────────────────────
    // Helper: standard 8-hour workday entry
    const day8h = (taskId: string, desc: string): EntrySpec => ({
        taskId, hours: 8, isOvertime: false, description: desc, startHour: 9, endHour: 17,
    });
    const ot1h = (taskId: string, desc: string): EntrySpec => ({
        taskId, hours: 1, isOvertime: true, description: desc, startHour: 17, endHour: 18,
    });
    const ot2h = (taskId: string, desc: string): EntrySpec => ({
        taskId, hours: 2, isOvertime: true, description: desc, startHour: 17, endHour: 19,
    });

    // ── alice: PM, steady 40h/week, all weeks complete ────────────────────────
    const aliceWeeks: WeekSpec[] = [
        {
            seqNum: 1, weeksAgo: 3, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.auth_redesign!, "Sprint planning & task review")] },
                { dayOffset: 1, entries: [day8h(tasks.staging_env!,   "Staging environment kickoff")] },
                { dayOffset: 2, entries: [day8h(tasks.auth_redesign!, "Code review session")] },
                { dayOffset: 3, entries: [day8h(tasks.dashboard_perf!,"Stakeholder review")] },
                { dayOffset: 4, entries: [day8h(tasks.pg_migration!,  "PG16 upgrade final sign-off")] },
            ],
        },
        {
            seqNum: 2, weeksAgo: 2, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.push_notif!,   "Mobile sprint planning")] },
                { dayOffset: 1, entries: [day8h(tasks.auth_redesign!,"Auth redesign review")] },
                { dayOffset: 2, entries: [day8h(tasks.csv_crash!,    "Bug triage session")] },
                { dayOffset: 3, entries: [day8h(tasks.staging_env!,  "Staging deployment review")] },
                { dayOffset: 4, entries: [day8h(tasks.monitoring!,   "Monitoring requirements gathering")] },
            ],
        },
        {
            seqNum: 3, weeksAgo: 1, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.android_crash!,"Crash report triage")] },
                { dayOffset: 1, entries: [day8h(tasks.ci_pipeline!,  "CI review")] },
                { dayOffset: 2, entries: [day8h(tasks.dark_mode!,    "UI review — dark mode mockups")] },
                { dayOffset: 3, entries: [day8h(tasks.offline_mode!, "Research review")] },
                { dayOffset: 4, entries: [day8h(tasks.auth_redesign!,"Sprint retrospective")] },
            ],
        },
        {
            seqNum: 4, weeksAgo: 0, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
    ];

    // ── bob: heavy contributor, overtime in week 2, incomplete last week ──────
    const bobWeeks: WeekSpec[] = [
        {
            seqNum: 1, weeksAgo: 3, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.auth_redesign!,"Started auth redesign")] },
                { dayOffset: 1, entries: [day8h(tasks.auth_redesign!,"OAuth flow implementation")] },
                { dayOffset: 2, entries: [day8h(tasks.push_notif!,   "APNs token registration")] },
                { dayOffset: 3, entries: [day8h(tasks.auth_redesign!,"JWT refresh logic")] },
                { dayOffset: 4, entries: [day8h(tasks.push_notif!,   "Notification payload design")] },
            ],
        },
        {
            seqNum: 2, weeksAgo: 2, status: TimesheetStatus.COMPLETED, notes: "Tight deadline — 2h overtime Wed",
            days: [
                { dayOffset: 0, entries: [day8h(tasks.auth_redesign!,"SSO integration")] },
                { dayOffset: 1, entries: [day8h(tasks.push_notif!,   "Background fetch handling")] },
                { dayOffset: 2, entries: [day8h(tasks.auth_redesign!,"Code review fixes"), ot2h(tasks.auth_redesign!,"Deadline crunch")] },
                { dayOffset: 3, entries: [day8h(tasks.dark_mode!,    "Dark mode tokens setup")] },
                { dayOffset: 4, entries: [day8h(tasks.push_notif!,   "End-to-end notification test")] },
            ],
        },
        {
            seqNum: 3, weeksAgo: 1, status: TimesheetStatus.INCOMPLETE, notes: "Was out Thu–Fri",
            days: [
                { dayOffset: 0, entries: [day8h(tasks.dark_mode!,    "Component theming")] },
                { dayOffset: 1, entries: [day8h(tasks.auth_redesign!,"Final QA pass")] },
                { dayOffset: 2, entries: [day8h(tasks.ui_components!, "Component library scaffolding")] },
            ],
        },
        {
            seqNum: 4, weeksAgo: 0, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
    ];

    // ── carol: steady employee, completed everything except minor gap ─────────
    const carolWeeks: WeekSpec[] = [
        {
            seqNum: 1, weeksAgo: 3, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.pg_migration!, "PG16 upgrade research")] },
                { dayOffset: 1, entries: [day8h(tasks.login_redirect!,"Root cause analysis")] },
                { dayOffset: 2, entries: [day8h(tasks.pg_migration!, "Upgrade testing on staging")] },
                { dayOffset: 3, entries: [day8h(tasks.login_redirect!,"Fix + unit tests")] },
                { dayOffset: 4, entries: [day8h(tasks.ci_pipeline!,  "Pipeline profiling")] },
            ],
        },
        {
            seqNum: 2, weeksAgo: 2, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.csv_crash!,    "Reproduced crash locally")] },
                { dayOffset: 1, entries: [day8h(tasks.csv_crash!,    "Fixed memory issue in export")] },
                { dayOffset: 2, entries: [day8h(tasks.pg_migration!, "Final PG16 migration run")] },
                { dayOffset: 3, entries: [day8h(tasks.ci_pipeline!,  "Replaced slow test steps")] },
                { dayOffset: 4, entries: [day8h(tasks.csv_crash!,    "QA sign-off on CSV fix")] },
            ],
        },
        {
            seqNum: 3, weeksAgo: 1, status: TimesheetStatus.INCOMPLETE, notes: "Need to add Mon–Tue",
            days: [
                { dayOffset: 2, entries: [day8h(tasks.csv_crash!,    "Post-release monitoring")] },
                { dayOffset: 3, entries: [day8h(tasks.ci_pipeline!,  "Cache layer for build artefacts")] },
                { dayOffset: 4, entries: [day8h(tasks.csv_crash!,    "Docs update for CSV export")] },
            ],
        },
        {
            seqNum: 4, weeksAgo: 0, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
    ];

    // ── dave: forgot last week entirely ───────────────────────────────────────
    const daveWeeks: WeekSpec[] = [
        {
            seqNum: 1, weeksAgo: 3, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.dashboard_perf!,"Query profiling")] },
                { dayOffset: 1, entries: [day8h(tasks.staging_env!,   "Neon branch setup")] },
                { dayOffset: 2, entries: [day8h(tasks.dashboard_perf!,"Index analysis")] },
                { dayOffset: 3, entries: [day8h(tasks.staging_env!,   "Env variable sync")] },
                { dayOffset: 4, entries: [day8h(tasks.dashboard_perf!,"Write-up findings")] },
            ],
        },
        {
            seqNum: 2, weeksAgo: 2, status: TimesheetStatus.COMPLETED, notes: "1h overtime Mon",
            days: [
                { dayOffset: 0, entries: [day8h(tasks.staging_env!,"CI integration for staging"), ot1h(tasks.staging_env!,"Unblocking deployment")] },
                { dayOffset: 1, entries: [day8h(tasks.monitoring!,  "Grafana initial setup")] },
                { dayOffset: 2, entries: [day8h(tasks.staging_env!, "DNS and SSL setup")] },
                { dayOffset: 3, entries: [day8h(tasks.dashboard_perf!,"Performance regression test")] },
                { dayOffset: 4, entries: [day8h(tasks.monitoring!,  "Alert rule configuration")] },
            ],
        },
        {
            seqNum: 3, weeksAgo: 1, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
        {
            seqNum: 4, weeksAgo: 0, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
    ];

    // ── eve: heavy overtime week 2, barely started last week ─────────────────
    const eveWeeks: WeekSpec[] = [
        {
            seqNum: 1, weeksAgo: 3, status: TimesheetStatus.COMPLETED, notes: null,
            days: [
                { dayOffset: 0, entries: [day8h(tasks.offline_mode!,"Offline sync research")] },
                { dayOffset: 1, entries: [day8h(tasks.android_crash!,"Crash log analysis")] },
                { dayOffset: 2, entries: [day8h(tasks.offline_mode!, "Conflict resolution strategies")] },
                { dayOffset: 3, entries: [day8h(tasks.android_crash!,"Isolated crash scenario")] },
                { dayOffset: 4, entries: [day8h(tasks.offline_mode!, "Prototype offline queue")] },
            ],
        },
        {
            seqNum: 2, weeksAgo: 2, status: TimesheetStatus.COMPLETED, notes: "Critical Android 14 deadline — 3h OT",
            days: [
                { dayOffset: 0, entries: [day8h(tasks.android_crash!,"Android 14 fix attempt #1")] },
                { dayOffset: 1, entries: [day8h(tasks.android_crash!,"Fix attempt #2 + device testing")] },
                { dayOffset: 2, entries: [day8h(tasks.offline_mode!, "Offline prototype review"), ot2h(tasks.android_crash!,"Hotfix build")] },
                { dayOffset: 3, entries: [day8h(tasks.android_crash!,"Play Store submission"), ot1h(tasks.android_crash!,"Post-release monitoring")] },
                { dayOffset: 4, entries: [day8h(tasks.offline_mode!, "Documentation")] },
            ],
        },
        {
            seqNum: 3, weeksAgo: 1, status: TimesheetStatus.INCOMPLETE, notes: "Only Monday logged",
            days: [
                { dayOffset: 0, entries: [day8h(tasks.offline_mode!,"Conflict resolution testing")] },
            ],
        },
        {
            seqNum: 4, weeksAgo: 0, status: TimesheetStatus.MISSING, notes: null,
            days: [],
        },
    ];

    const timesheetPlan: { username: string; weeks: WeekSpec[] }[] = [
        { username: "alice", weeks: aliceWeeks },
        { username: "bob",   weeks: bobWeeks   },
        { username: "carol", weeks: carolWeeks },
        { username: "dave",  weeks: daveWeeks  },
        { username: "eve",   weeks: eveWeeks   },
    ];

    for (const { username, weeks } of timesheetPlan) {
        const userId = users[username]!.id;
        for (const week of weeks) {
            await seedWeek(userId, week);
        }
        const entryCount = weeks.flatMap((w) => w.days).flatMap((d) => d.entries).length;
        console.log(`✓ Timesheets for ${username}: ${weeks.length} weeks, ${entryCount} entries`);
    }

    // ── 6. Activity logs ──────────────────────────────────────────────────────
    const activityDefs: { username: string; type: string; description: string }[] = [
        { username: "alice", type: "LOGIN",            description: "Logged in" },
        { username: "alice", type: "TASK_ASSIGNED",    description: "Assigned auth redesign to bob" },
        { username: "alice", type: "TASK_CREATED",     description: "Created monitoring dashboard task" },
        { username: "bob",   type: "LOGIN",            description: "Logged in" },
        { username: "bob",   type: "TIMESHEET_SUBMIT", description: "Submitted week of 3 weeks ago" },
        { username: "bob",   type: "TASK_STATUS",      description: "Moved dark mode to IN_PROGRESS" },
        { username: "carol", type: "LOGIN",            description: "Logged in" },
        { username: "carol", type: "TIMESHEET_SUBMIT", description: "Submitted week of 3 weeks ago" },
        { username: "carol", type: "TASK_STATUS",      description: "Marked login redirect fix as DONE" },
        { username: "dave",  type: "LOGIN",            description: "Logged in" },
        { username: "dave",  type: "TIMESHEET_SUBMIT", description: "Submitted week of 3 weeks ago" },
        { username: "eve",   type: "LOGIN",            description: "Logged in" },
        { username: "eve",   type: "TIMESHEET_SUBMIT", description: "Submitted week of 3 weeks ago" },
        { username: "eve",   type: "TASK_STATUS",      description: "Moved Android 14 crash to IN_PROGRESS" },
    ];

    await prisma.activityLog.createMany({
        data: activityDefs.map((a) => ({
            userId:      users[a.username]!.id,
            type:        a.type,
            description: a.description,
        })),
    });
    console.log(`✓ Activity logs (${activityDefs.length})`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Login credentials (all use same password)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const u of USERS) {
        const label = u.role === UserRole.ADMIN ? "ADMIN" : u.role === UserRole.PROJECT_MANAGER ? "PM   " : "EMP  ";
        console.log(`  [${label}] ${u.username.padEnd(8)} | ${u.email.padEnd(24)} | ${DEFAULT_PASSWORD}`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Seed complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

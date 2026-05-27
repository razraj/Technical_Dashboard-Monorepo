/* eslint-disable */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, type TimesheetStatus } from "./index.js";

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password123";

const usersToCreate = [
    {
        email: "dave@example.com",
        username: "dave",
        firstName: "Dave",
        lastName: "Brown",
        password: DEFAULT_PASSWORD
    },
    {
        email: "eve@example.com",
        username: "eve",
        firstName: "Eve",
        lastName: "Davis",
        password: DEFAULT_PASSWORD
    }
];

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

function atUTC(d: Date, hours: number, minutes: number): Date {
    const out = new Date(d);
    out.setUTCHours(hours, minutes, 0, 0);
    return out;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function seedTimesheetsForUser(userId: string, username: string): Promise<void> {
    const twoWeeksAgoMonday = mondayOfWeeksAgo(2);
    const twoWeeksAgoFriday = addDays(twoWeeksAgoMonday, 4);

    const completed = await prisma.timesheet.create({
        data: {
            userId,
            sequenceNumber: 1,
            status: TimesheetStatus.COMPLETED,
            title: `Week of ${isoDate(twoWeeksAgoMonday)}`,
            notes: null,
            periodStart: twoWeeksAgoMonday,
            periodEnd: twoWeeksAgoFriday,
            totalHours: 40,
            regularHours: 40,
            overtimeHours: 0,
            submittedAt: atUTC(twoWeeksAgoFriday, 17, 0)
        }
    });

    await prisma.timesheetEntry.createMany({
        data: [0, 1, 2, 3, 4].map((dayOffset) => ({
            timesheetId: completed.id,
            workDate: addDays(twoWeeksAgoMonday, dayOffset),
            hours: 8,
            startTime: atUTC(addDays(twoWeeksAgoMonday, dayOffset), 9, 0),
            endTime: atUTC(addDays(twoWeeksAgoMonday, dayOffset), 17, 0),
            isOvertime: false,
            description: "Regular workday"
        }))
    });

    const lastWeekMonday = mondayOfWeeksAgo(1);
    const lastWeekFriday = addDays(lastWeekMonday, 4);
    const lastWeekTuesday = addDays(lastWeekMonday, 1);

    const incomplete = await prisma.timesheet.create({
        data: {
            userId,
            sequenceNumber: 2,
            status: TimesheetStatus.INCOMPLETE,
            title: `Week of ${isoDate(lastWeekMonday)}`,
            notes: "Still need to fill in Wed-Fri",
            periodStart: lastWeekMonday,
            periodEnd: lastWeekFriday,
            totalHours: 17,
            regularHours: 16,
            overtimeHours: 1,
            submittedAt: null
        }
    });

    await prisma.timesheetEntry.createMany({
        data: [
            {
                timesheetId: incomplete.id,
                workDate: lastWeekMonday,
                hours: 8,
                startTime: atUTC(lastWeekMonday, 9, 0),
                endTime: atUTC(lastWeekMonday, 17, 0),
                isOvertime: false,
                description: "Regular workday"
            },
            {
                timesheetId: incomplete.id,
                workDate: lastWeekTuesday,
                hours: 8,
                startTime: atUTC(lastWeekTuesday, 9, 0),
                endTime: atUTC(lastWeekTuesday, 17, 0),
                isOvertime: false,
                description: "Regular workday"
            },
            {
                timesheetId: incomplete.id,
                workDate: lastWeekTuesday,
                hours: 1,
                startTime: atUTC(lastWeekTuesday, 17, 0),
                endTime: atUTC(lastWeekTuesday, 18, 0),
                isOvertime: true,
                description: "Late ticket fix"
            }
        ]
    });

    console.log(`Created 2 timesheets (5 + 3 entries) for ${username}`);
}

async function main() {
    console.log("Seeding database...");

    const createdUsers: { id: string; username: string; email: string; password: string }[] = [];
    for (const u of usersToCreate) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.create({
            data: {
                email: u.email,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                password: hashedPassword
            }
        });
        createdUsers.push({ id: user.id, username: u.username, email: u.email, password: u.password });
        console.log(`Created user: ${u.username} (${u.email})`);
    }

    if (createdUsers[0]) {
        await prisma.activityLog.createMany({
            data: [
                { userId: createdUsers[0].id, type: "LOGIN", description: "User logged in" },
                { userId: createdUsers[0].id, type: "TIMESHEET", description: "Submitted weekly timesheet" },
                { userId: createdUsers[0].id, type: "PROFILE_UPDATE", description: "Updated profile" }
            ]
        });
        console.log("Created activity logs for", createdUsers[0].username);
    }

    for (let i = 0; i < Math.min(2, createdUsers.length); i++) {
        const user = createdUsers[i];
        if (!user) continue;
        await seedTimesheetsForUser(user.id, user.username);
    }

    console.log("\n############# Login details #############");
    createdUsers.forEach((u) => {
        console.log(`  username: ${u.username}  |  email: ${u.email}  |  password: ${u.password}`);
    });
    console.log("########################################\n");
    console.log("Seed completed.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, Role } from "./index.js";

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password123";

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

async function main() {
    console.log("Seeding database...");

    const managerPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const manager = await prisma.user.create({
        data: {
            email: "dave@example.com",
            username: "dave",
            firstName: "Dave",
            lastName: "Brown",
            role: Role.MANAGER,
            password: managerPassword,
            emailVerified: new Date()
        }
    });
    console.log(`Created manager: ${manager.username}`);

    const employeePassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const employee = await prisma.user.create({
        data: {
            email: "eve@example.com",
            username: "eve",
            firstName: "Eve",
            lastName: "Davis",
            role: Role.EMPLOYEE,
            password: employeePassword,
            emailVerified: new Date()
        }
    });
    console.log(`Created employee: ${employee.username}`);

    const project = await prisma.project.create({
        data: {
            name: "Homepage Redesign",
            description: "Marketing site revamp",
            managerId: manager.id
        }
    });
    console.log(`Created project: ${project.name}`);

    await prisma.activityLog.createMany({
        data: [
            { userId: manager.id, type: "LOGIN", description: "User logged in" },
            { userId: employee.id, type: "TIMESHEET", description: "Logged weekly time" }
        ]
    });

    // COMPLETED week (40h, two weeks ago, Mon-Fri @ 8h).
    const completedMonday = mondayOfWeeksAgo(2);
    await prisma.timesheetEntry.createMany({
        data: [0, 1, 2, 3, 4].map((dayOffset) => ({
            userId: employee.id,
            projectId: project.id,
            date: addDays(completedMonday, dayOffset),
            hours: 8,
            workType: "Development",
            description: "Homepage Development"
        }))
    });

    // INCOMPLETE week (17h, last week, Mon + Tue only).
    const lastWeekMonday = mondayOfWeeksAgo(1);
    await prisma.timesheetEntry.createMany({
        data: [
            {
                userId: employee.id,
                projectId: project.id,
                date: lastWeekMonday,
                hours: 8,
                workType: "Development",
                description: "Homepage Development"
            },
            {
                userId: employee.id,
                projectId: project.id,
                date: addDays(lastWeekMonday, 1),
                hours: 8,
                workType: "Development",
                description: "Homepage Development"
            },
            {
                userId: employee.id,
                projectId: project.id,
                date: addDays(lastWeekMonday, 1),
                hours: 1,
                workType: "Bug fixes",
                description: "Late ticket fix"
            }
        ]
    });

    console.log("\n############# Login details #############");
    console.log(`  username: dave  |  email: dave@example.com  |  password: ${DEFAULT_PASSWORD}`);
    console.log(`  username: eve   |  email: eve@example.com   |  password: ${DEFAULT_PASSWORD}`);
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

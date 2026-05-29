"use client";

import { NavMain } from "@/components/nav-main";
import { TeamSwitcher } from "@/components/team-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@repo/ui/components/sidebar";
import {
    AudioWaveform,
    BookOpen,
    Bot,
    Command,
    CreditCard,
    GalleryVerticalEnd,
    LucideIcon,
    Settings,
    Settings2,
    SquareTerminal,
    UsersIcon
} from "lucide-react";
import * as React from "react";
import { NavUser } from "./nav-user";
import { fetchSession } from "@/actions/auth-check";

export interface Data {
    user: {
        name: string;
        email: string;
        avatar: string;
    };
    teams: {
        name: string;
        logo: LucideIcon;
        plan: string;
    }[];
    navMain: {
        title: string;
        url: string;
        icon: LucideIcon;
        isActive?: boolean;
        items?: {
            title: string;
            url: string;
            icon: LucideIcon;
        }[];
    }[];
}

// This is sample data.
const data: Data = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: ""
    },
    teams: [
        {
            name: "ticktock Inc.",
            logo: GalleryVerticalEnd,
            plan: "Enterprise"
        },
        {
            name: "ticktock Corp.",
            logo: AudioWaveform,
            plan: "Startup"
        },
        {
            name: "Evil Corp.",
            logo: Command,
            plan: "Free"
        }
    ],
    navMain: [
        {
            title: "Timesheets",
            url: "/dashboard",
            icon: SquareTerminal,
            isActive: true
        },
        {
            title: "Settings",
            url: "#",
            icon: Settings2,
            items: [
                {
                    title: "General",
                    url: "#",
                    icon: Settings
                }
            ]
        }
    ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const [user, setUser] = React.useState(data.user);

    React.useEffect(() => {
        fetchSession().then((u) => {
            if (!u?.id) return;
            const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User";
            setUser({
                name,
                email: u.email ?? "",
                avatar: u.profilePic ?? ""
            });
        });
    }, []);

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <TeamSwitcher teams={data.teams} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

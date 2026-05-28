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
            title: "Playground",
            url: "#",
            icon: SquareTerminal,
            isActive: true
        },
        {
            title: "Models",
            url: "#",
            icon: Bot
        },
        {
            title: "Documentation",
            url: "#",
            icon: BookOpen
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
                },
                {
                    title: "Team",
                    url: "#",
                    icon: UsersIcon
                },
                {
                    title: "Billing",
                    url: "#",
                    icon: CreditCard
                }
            ]
        }
    ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <TeamSwitcher teams={data.teams} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

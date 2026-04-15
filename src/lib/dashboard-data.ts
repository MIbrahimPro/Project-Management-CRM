import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/api-handler";
import type { UserRole } from "@prisma/client";

const PROJECT_LIST_INCLUDE = {
  milestones: { orderBy: { order: "asc" as const } },
  members: {
    include: {
      user: { select: { id: true, name: true, profilePicUrl: true } },
    },
  },
  client: { select: { id: true, name: true } },
} as const;

/**
 * Loads dashboard payloads for the authenticated user by role (single DB round-trip batch per section).
 */
export async function fetchDashboardData(userId: string, role: UserRole) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const recentActivity = await prisma.notification.findMany({
    where: { userId, createdAt: { gte: weekStart } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      isRead: true,
      createdAt: true,
    },
  });

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    const [
      activeProjects,
      totalClients,
      openRequests,
      unansweredQuestionCount,
      unreadNotifications,
    ] = await Promise.all([
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "CLIENT", isActive: true } }),
      prisma.clientProjectRequest.count({ where: { status: "PENDING" } }),
      prisma.projectQuestion.count({ where: { isApproved: false } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const [projects, pendingClientRequests, pendingQuestions] = await Promise.all([
      prisma.project.findMany({
        where: { status: { not: "CANCELLED" } },
        include: PROJECT_LIST_INCLUDE,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.clientProjectRequest.findMany({
        where: { status: "PENDING" },
        include: { project: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.projectQuestion.findMany({
        where: { isApproved: false },
        include: {
          project: { select: { title: true } },
          milestone: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      stats: [
        { label: "Active Projects", value: activeProjects, icon: "FolderKanban", trend: "+2 this week" },
        { label: "Total Clients", value: totalClients, icon: "Users" },
        { label: "Pending Requests", value: openRequests, icon: "Inbox" },
        { label: "Unanswered Questions", value: unansweredQuestionCount, icon: "HelpCircle" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      projects,
      pendingClientRequests,
      pendingQuestions,
    };
  }

  if (role === "PROJECT_MANAGER") {
    const [myProjects, pendingRequests, pendingQuestionCount, unreadNotifications, overdueTasks] =
      await Promise.all([
        prisma.project.count({
          where: { members: { some: { userId } }, status: "ACTIVE" },
        }),
        prisma.clientProjectRequest.count({ where: { status: "PENDING" } }),
        prisma.projectQuestion.count({ where: { isApproved: false } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.task.count({
          where: {
            assignees: { some: { userId } },
            status: { notIn: ["DONE", "CANCELLED"] },
            dueDate: { lt: now },
          },
        }),
      ]);

    const [projects, pendingClientRequests, pendingQuestions] = await Promise.all([
      prisma.project.findMany({
        where: { members: { some: { userId } }, status: { not: "CANCELLED" } },
        include: PROJECT_LIST_INCLUDE,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.clientProjectRequest.findMany({
        where: { status: "PENDING" },
        include: { project: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.projectQuestion.findMany({
        where: { isApproved: false },
        include: {
          project: { select: { title: true } },
          milestone: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      stats: [
        { label: "My Projects", value: myProjects, icon: "FolderKanban" },
        { label: "Pending Requests", value: pendingRequests, icon: "Inbox" },
        { label: "Pending Questions", value: pendingQuestionCount, icon: "HelpCircle" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
        {
          label: "Overdue Tasks",
          value: overdueTasks,
          icon: "AlertTriangle",
          trend: overdueTasks > 0 ? "Needs attention" : undefined,
        },
      ],
      recentActivity,
      projects,
      pendingClientRequests,
      pendingQuestions,
    };
  }

  if (role === "DEVELOPER" || role === "DESIGNER") {
    const [myTasksCount, activeProjects, completedThisWeek, unreadNotifications] =
      await Promise.all([
        prisma.task.count({
          where: { assignees: { some: { userId } }, status: { notIn: ["DONE", "CANCELLED"] } },
        }),
        prisma.project.count({
          where: { members: { some: { userId } }, status: "ACTIVE" },
        }),
        prisma.task.count({
          where: {
            assignees: { some: { userId } },
            status: "DONE",
            completedAt: { gte: weekStart },
          },
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

    const myTasks = await prisma.task.findMany({
      where: {
        assignees: { some: { userId } },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      include: {
        project: { select: { title: true } },
        assignees: { include: { user: { select: { id: true, name: true, profilePicUrl: true } } } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
    });

    return {
      stats: [
        { label: "My Tasks", value: myTasksCount, icon: "CheckSquare" },
        { label: "Active Projects", value: activeProjects, icon: "FolderKanban" },
        {
          label: "Completed This Week",
          value: completedThisWeek,
          icon: "CheckCircle",
          trend: `${completedThisWeek} done`,
        },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      myTasks,
    };
  }

  if (role === "HR") {
    const [openHiring, totalCandidates, interviewsThisWeek, unreadNotifications] =
      await Promise.all([
        prisma.hiringRequest.count({ where: { status: { in: ["OPEN", "PENDING_APPROVAL"] } } }),
        prisma.candidate.count({ where: { status: { notIn: ["HIRED", "REJECTED"] } } }),
        prisma.candidate.count({
          where: {
            interviewAt: { gte: weekStart, lt: weekEnd },
          },
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

    const attendanceAlerts = await prisma.attendance.groupBy({
      by: ["status"],
      where: { date: today },
      _count: true,
    });

    const recentHiring = await prisma.hiringRequest.findMany({
      where: { status: { in: ["OPEN", "PENDING_APPROVAL"] } },
      include: {
        requestedBy: { select: { name: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const attendanceToday = attendanceAlerts.reduce(
      (acc, row) => {
        acc[row.status] = row._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      stats: [
        { label: "Open Positions", value: openHiring, icon: "Briefcase" },
        { label: "Active Candidates", value: totalCandidates, icon: "Users" },
        { label: "Interviews This Week", value: interviewsThisWeek, icon: "Calendar" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      hiringStats: { recentHiring },
      attendanceAlerts: { today: attendanceToday },
    };
  }

  if (role === "ACCOUNTANT") {
    const [monthIncome, monthExpense, monthEntryCount, unreadNotifications] =
      await Promise.all([
        prisma.accountEntry.aggregate({
          where: { type: "INCOME", date: { gte: monthStart }, isVoid: false },
          _sum: { amountUsd: true },
        }),
        prisma.accountEntry.aggregate({
          where: { type: "EXPENSE", date: { gte: monthStart }, isVoid: false },
          _sum: { amountUsd: true },
        }),
        prisma.accountEntry.count({ where: { isVoid: false, date: { gte: monthStart } } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

    const incomeN = Number(monthIncome._sum.amountUsd ?? 0);
    const expenseN = Number(monthExpense._sum.amountUsd ?? 0);

    const recentEntries = await prisma.accountEntry.findMany({
      where: { isVoid: false },
      include: {
        project: { select: { title: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 8,
    });

    return {
      stats: [
        {
          label: "Month Income",
          value: `$${incomeN.toLocaleString()}`,
          icon: "TrendingUp",
          trend: "This month",
        },
        { label: "Month Expenses", value: `$${expenseN.toLocaleString()}`, icon: "TrendingDown" },
        { label: "Net Profit", value: `$${(incomeN - expenseN).toLocaleString()}`, icon: "DollarSign" },
        { label: "Transactions", value: monthEntryCount, icon: "Receipt" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      accountStats: { recentEntries },
    };
  }

  if (role === "SALES") {
    const [myLeads, activeProjects, unreadNotifications, tasksDue] = await Promise.all([
      prisma.project.count({
        where: { requestedById: userId, status: { not: "CANCELLED" } },
      }),
      prisma.project.count({
        where: { requestedById: userId, status: "ACTIVE" },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.task.count({
        where: { assignees: { some: { userId } }, status: { notIn: ["DONE", "CANCELLED"] } },
      }),
    ]);

    const [myTasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        include: {
          project: { select: { title: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 8,
      }),
      prisma.project.findMany({
        where: { requestedById: userId, status: { not: "CANCELLED" } },
        include: PROJECT_LIST_INCLUDE,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    return {
      stats: [
        { label: "My Leads", value: myLeads, icon: "Target" },
        { label: "Active Deals", value: activeProjects, icon: "FolderKanban" },
        { label: "Pending Tasks", value: tasksDue, icon: "CheckSquare" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      projects,
      myTasks,
    };
  }

  if (role === "CLIENT") {
    const [myProjectsCount, openRequests, unreadNotifications] = await Promise.all([
      prisma.project.count({ where: { clientId: userId, status: { not: "CANCELLED" } } }),
      prisma.clientProjectRequest.count({ where: { clientId: userId, status: "PENDING" } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const projects = await prisma.project.findMany({
      where: { clientId: userId, status: { not: "CANCELLED" } },
      include: PROJECT_LIST_INCLUDE,
      orderBy: { updatedAt: "desc" },
      take: 6,
    });

    return {
      stats: [
        { label: "My Projects", value: myProjectsCount, icon: "FolderKanban" },
        { label: "Open Requests", value: openRequests, icon: "Inbox" },
        { label: "Unread Notifications", value: unreadNotifications, icon: "Bell" },
      ],
      recentActivity,
      projects,
    };
  }

  return forbidden();
}

export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;

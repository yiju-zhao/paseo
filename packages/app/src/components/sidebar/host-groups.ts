import type {
  SidebarProjectEntry,
  SidebarWorkspacePlacement,
} from "@/hooks/use-sidebar-workspaces-list";

export interface SidebarHostGroup {
  serverId: string;
  projects: SidebarProjectEntry[];
}

export function sidebarHostSectionKey(serverId: string): string {
  return JSON.stringify(["host", serverId]);
}

export function sidebarHostProjectSectionKey(serverId: string, projectViewKey: string): string {
  return JSON.stringify(["host-project", serverId, projectViewKey]);
}

export function visibleSidebarProjectHosts(input: {
  project: SidebarProjectEntry;
  workspaces: readonly SidebarWorkspacePlacement[];
  keepEmptyHosts: boolean;
}): SidebarProjectEntry["hosts"] {
  const visibleHosts = new Set(input.workspaces.map((workspace) => workspace.serverId));
  const occupiedHosts = new Set(input.project.workspaces.map((workspace) => workspace.serverId));
  return input.project.hosts.filter((host) => {
    const wasEmpty = !occupiedHosts.has(host.serverId);
    return visibleHosts.has(host.serverId) || (input.keepEmptyHosts && wasEmpty);
  });
}

/** Keep project identity for icons/actions, while limiting each copy to its owning host. */
export function buildSidebarHostGroups(
  projects: readonly SidebarProjectEntry[],
  serverIds: readonly string[] = [],
): SidebarHostGroup[] {
  const groups = new Map<string, SidebarHostGroup>();
  for (const project of projects) {
    for (const host of project.hosts) {
      let group = groups.get(host.serverId);
      if (!group) {
        group = { serverId: host.serverId, projects: [] };
        groups.set(host.serverId, group);
      }
      group.projects.push({
        ...project,
        iconWorkingDir: host.iconWorkingDir,
        hosts: [host],
        workspaces: project.workspaces.filter((workspace) => workspace.serverId === host.serverId),
      });
    }
  }
  const hostOrder = new Map(serverIds.map((serverId, index) => [serverId, index]));
  return [...groups.values()].sort(
    (left, right) =>
      (hostOrder.get(left.serverId) ?? Infinity) - (hostOrder.get(right.serverId) ?? Infinity),
  );
}

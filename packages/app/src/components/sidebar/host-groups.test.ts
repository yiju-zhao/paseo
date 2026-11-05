import { describe, expect, it } from "vitest";
import type {
  SidebarProjectEntry,
  SidebarWorkspacePlacement,
} from "@/hooks/use-sidebar-workspaces-list";
import {
  buildSidebarHostGroups,
  sidebarHostProjectSectionKey,
  sidebarHostSectionKey,
  visibleSidebarProjectHosts,
} from "./host-groups";

function workspace(serverId: string, workspaceId: string): SidebarWorkspacePlacement {
  return {
    serverId,
    workspaceId,
    workspaceKey: `${serverId}:${workspaceId}`,
    projectViewKey: "git:shared",
    projectName: "Shared",
    projectKind: "git",
    workspaceKind: "worktree",
    name: workspaceId,
  };
}

function sharedProject(): SidebarProjectEntry {
  return {
    viewKey: "git:shared",
    projectName: "Shared",
    projectKind: "git",
    iconWorkingDir: "/local/shared",
    hosts: [
      {
        serverId: "local",
        projectId: "local-project",
        iconWorkingDir: "/local/shared",
        worktreeSupport: "supported",
      },
      {
        serverId: "remote",
        projectId: "remote-project",
        iconWorkingDir: "/remote/shared",
        worktreeSupport: "supported",
      },
    ],
    workspaces: [workspace("remote", "second"), workspace("local", "first")],
  };
}

describe("sidebar host groups", () => {
  it("splits an aggregated project without changing its identity or action target", () => {
    const project = sharedProject();
    const groups = buildSidebarHostGroups([project], ["remote", "local"]);

    expect(groups.map((group) => group.serverId)).toEqual(["remote", "local"]);
    expect(groups[0]?.projects[0]).toEqual({
      ...project,
      iconWorkingDir: "/remote/shared",
      hosts: [project.hosts[1]],
      workspaces: [project.workspaces[0]],
    });
    expect(groups[1]?.projects[0]).toEqual({
      ...project,
      hosts: [project.hosts[0]],
      workspaces: [project.workspaces[1]],
    });
    expect(project.hosts).toHaveLength(2);
    expect(project.workspaces).toHaveLength(2);
  });

  it("keeps registered empty projects available under their host", () => {
    const project = { ...sharedProject(), workspaces: [] };

    const groups = buildSidebarHostGroups([project]);
    expect(groups.map((group) => group.serverId)).toEqual(["local", "remote"]);
    expect(groups[0]?.projects[0]?.workspaces).toEqual([]);
    expect(groups[1]?.projects[0]?.workspaces).toEqual([]);
  });

  it("keeps host order stable when projects are reordered", () => {
    const shared = sharedProject();
    const remoteOnly = {
      ...shared,
      viewKey: "git:remote",
      hosts: [shared.hosts[1]!],
      workspaces: [],
    };
    const groups = buildSidebarHostGroups([remoteOnly, shared], ["local", "remote"]);

    expect(groups.map((group) => group.serverId)).toEqual(["local", "remote"]);
    expect(groups[1]?.projects.map((project) => project.viewKey)).toEqual([
      "git:remote",
      "git:shared",
    ]);
  });

  it("uses independent collapse identities for each host and project copy", () => {
    expect(
      new Set([
        sidebarHostSectionKey("local"),
        sidebarHostProjectSectionKey("local", "git:shared"),
        sidebarHostProjectSectionKey("remote", "git:shared"),
        sidebarHostProjectSectionKey("local:git", "shared"),
        "git:shared",
      ]).size,
    ).toBe(5);
  });

  it("drops the other host when its workspaces do not match the label filter", () => {
    const project = sharedProject();
    const workspaces = project.workspaces.filter((entry) => entry.serverId === "local");
    const hosts = visibleSidebarProjectHosts({ project, workspaces, keepEmptyHosts: false });
    const groups = buildSidebarHostGroups([{ ...project, hosts, workspaces }]);

    expect(groups.map((group) => group.serverId)).toEqual(["local"]);
  });

  it("hides hosts emptied by background filtering but retains registered empty projects", () => {
    const project = sharedProject();
    project.hosts.push({
      serverId: "empty",
      projectId: "empty-project",
      iconWorkingDir: "/empty",
      worktreeSupport: "supported",
    });
    const workspaces = project.workspaces.filter((entry) => entry.serverId === "local");

    expect(
      visibleSidebarProjectHosts({ project, workspaces, keepEmptyHosts: true }).map(
        (host) => host.serverId,
      ),
    ).toEqual(["local", "empty"]);
    expect(visibleSidebarProjectHosts({ project, workspaces: [], keepEmptyHosts: false })).toEqual(
      [],
    );
  });
});

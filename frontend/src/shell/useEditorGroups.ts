import { useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { EditorTabModel } from "./EditorTabs";

export type SplitDirection = "left" | "right" | "up" | "down";
export type EditorGroupModel = { id: string; tabs: EditorTabModel[]; activeId: string };
export type EditorLayoutNode =
  | { kind: "group"; groupId: string }
  | { kind: "split"; id: string; orientation: "horizontal" | "vertical"; ratio: number; children: [EditorLayoutNode, EditorLayoutNode] };

type WorkspaceState = {
  groups: Record<string, EditorGroupModel>;
  layout: EditorLayoutNode;
  focusedGroupId: string;
};

type Rect = { groupId: string; x: number; y: number; width: number; height: number };

function stickyFirst(tabs: EditorTabModel[]): EditorTabModel[] {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
}

function splitLeaf(node: EditorLayoutNode, sourceId: string, newId: string, splitId: string, direction: SplitDirection): EditorLayoutNode {
  if (node.kind === "group") {
    if (node.groupId !== sourceId) return node;
    const source: EditorLayoutNode = { kind: "group", groupId: sourceId };
    const added: EditorLayoutNode = { kind: "group", groupId: newId };
    const addedFirst = direction === "left" || direction === "up";
    return {
      kind: "split",
      id: splitId,
      orientation: direction === "left" || direction === "right" ? "horizontal" : "vertical",
      ratio: 50,
      children: addedFirst ? [added, source] : [source, added],
    };
  }
  return { ...node, children: node.children.map((child) => splitLeaf(child, sourceId, newId, splitId, direction)) as [EditorLayoutNode, EditorLayoutNode] };
}

function resizeSplit(node: EditorLayoutNode, splitId: string, ratio: number): EditorLayoutNode {
  if (node.kind === "group") return node;
  if (node.id === splitId) return { ...node, ratio };
  return { ...node, children: node.children.map((child) => resizeSplit(child, splitId, ratio)) as [EditorLayoutNode, EditorLayoutNode] };
}

function removeGroupFromLayout(node: EditorLayoutNode, groupId: string): EditorLayoutNode | undefined {
  if (node.kind === "group") return node.groupId === groupId ? undefined : node;
  const first = removeGroupFromLayout(node.children[0], groupId);
  const second = removeGroupFromLayout(node.children[1], groupId);
  if (!first) return second;
  if (!second) return first;
  return { ...node, children: [first, second] };
}

function collectRects(node: EditorLayoutNode, x = 0, y = 0, width = 1, height = 1, result: Rect[] = []): Rect[] {
  if (node.kind === "group") {
    result.push({ groupId: node.groupId, x, y, width, height });
    return result;
  }
  if (node.orientation === "horizontal") {
    collectRects(node.children[0], x, y, width / 2, height, result);
    collectRects(node.children[1], x + width / 2, y, width / 2, height, result);
  } else {
    collectRects(node.children[0], x, y, width, height / 2, result);
    collectRects(node.children[1], x, y + height / 2, width, height / 2, result);
  }
  return result;
}

function findNeighbour(layout: EditorLayoutNode, sourceId: string, direction: SplitDirection): string | undefined {
  const rects = collectRects(layout);
  const source = rects.find((rect) => rect.groupId === sourceId);
  if (!source) return undefined;
  const epsilon = 0.0001;
  const candidates = rects.filter((rect) => {
    if (rect.groupId === sourceId) return false;
    const horizontalOverlap = Math.min(source.x + source.width, rect.x + rect.width) - Math.max(source.x, rect.x) > epsilon;
    const verticalOverlap = Math.min(source.y + source.height, rect.y + rect.height) - Math.max(source.y, rect.y) > epsilon;
    if (direction === "right") return verticalOverlap && rect.x >= source.x + source.width - epsilon;
    if (direction === "left") return verticalOverlap && rect.x + rect.width <= source.x + epsilon;
    if (direction === "down") return horizontalOverlap && rect.y >= source.y + source.height - epsilon;
    return horizontalOverlap && rect.y + rect.height <= source.y + epsilon;
  });
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  candidates.sort((left, right) => {
    const distance = (rect: Rect) => Math.abs(rect.x + rect.width / 2 - sourceCenterX) + Math.abs(rect.y + rect.height / 2 - sourceCenterY);
    return distance(left) - distance(right);
  });
  return candidates[0]?.groupId;
}

export function useEditorGroups(initialTab: EditorTabModel, navigate: NavigateFunction) {
  const nextGroupId = useRef(2);
  const nextSplitId = useRef(1);
  const pendingGroup = useRef<string>();
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    groups: { "group-1": { id: "group-1", tabs: [initialTab], activeId: initialTab.id } },
    layout: { kind: "group", groupId: "group-1" },
    focusedGroupId: "group-1",
  });

  const syncRoute = (tab: EditorTabModel) => {
    const pending = pendingGroup.current;
    pendingGroup.current = undefined;
    const existing = Object.values(workspace.groups).find((group) => group.tabs.some((item) => item.id === tab.id));
    const targetId = pending && workspace.groups[pending]?.tabs.some((item) => item.id === tab.id)
      ? pending
      : workspace.groups[workspace.focusedGroupId]?.tabs.some((item) => item.id === tab.id)
        ? workspace.focusedGroupId
        : existing?.id ?? workspace.focusedGroupId;
    setWorkspace((current) => {
      const target = current.groups[targetId];
      if (!target) return current;
      const tabs = target.tabs.some((item) => item.id === tab.id) ? target.tabs : [...target.tabs, tab];
      return { ...current, focusedGroupId: targetId, groups: { ...current.groups, [targetId]: { ...target, tabs, activeId: tab.id } } };
    });
  };

  const activate = (groupId: string, tabId: string) => {
    pendingGroup.current = groupId;
    setWorkspace((current) => ({
      ...current,
      focusedGroupId: groupId,
      groups: { ...current.groups, [groupId]: { ...current.groups[groupId], activeId: tabId } },
    }));
  };

  const close = (groupId: string, tabId: string) => {
    const group = workspace.groups[groupId];
    if (!group) return;
    const index = group.tabs.findIndex((tab) => tab.id === tabId);
    const remaining = group.tabs.filter((tab) => tab.id !== tabId);
    const next = remaining[index] ?? remaining[index - 1];
    if (remaining.length === 0) {
      const otherGroups = Object.values(workspace.groups).filter((item) => item.id !== groupId);
      if (otherGroups.length > 0) {
        const fallback = otherGroups[0];
        const groups = { ...workspace.groups };
        delete groups[groupId];
        pendingGroup.current = fallback.id;
        setWorkspace({
          groups,
          layout: removeGroupFromLayout(workspace.layout, groupId) ?? { kind: "group", groupId: fallback.id },
          focusedGroupId: workspace.focusedGroupId === groupId ? fallback.id : workspace.focusedGroupId,
        });
        if (workspace.focusedGroupId === groupId) navigate(fallback.tabs.find((tab) => tab.id === fallback.activeId)?.href ?? fallback.tabs[0]?.href ?? "/");
        return;
      }
      setWorkspace({
        groups: { [groupId]: { id: groupId, tabs: [initialTab], activeId: initialTab.id } },
        layout: { kind: "group", groupId },
        focusedGroupId: groupId,
      });
      navigate(initialTab.href);
      return;
    }
    setWorkspace((current) => ({
      ...current,
      groups: { ...current.groups, [groupId]: { ...current.groups[groupId], tabs: remaining, activeId: group.activeId === tabId ? next?.id ?? "" : group.activeId } },
    }));
    if (workspace.focusedGroupId === groupId && group.activeId === tabId) navigate(next?.href ?? "/");
  };

  const closeOthers = (groupId: string, tabId: string) => {
    const group = workspace.groups[groupId];
    const target = group?.tabs.find((tab) => tab.id === tabId);
    if (!group || !target) return;
    const remaining = group.tabs.filter((tab) => tab.pinned || tab.id === tabId);
    setWorkspace((current) => ({ ...current, focusedGroupId: groupId, groups: { ...current.groups, [groupId]: { ...group, tabs: remaining, activeId: tabId } } }));
    navigate(target.href);
  };

  const closeRight = (groupId: string, tabId: string) => {
    const group = workspace.groups[groupId];
    if (!group) return;
    const index = group.tabs.findIndex((tab) => tab.id === tabId);
    const remaining = group.tabs.filter((tab, tabIndex) => tabIndex <= index || tab.pinned);
    const active = remaining.some((tab) => tab.id === group.activeId) ? group.activeId : tabId;
    setWorkspace((current) => ({ ...current, groups: { ...current.groups, [groupId]: { ...group, tabs: remaining, activeId: active } } }));
    if (active !== group.activeId) navigate(group.tabs[index].href);
  };

  const closeAll = (groupId: string) => {
    const group = workspace.groups[groupId];
    if (!group) return;
    const remaining = group.tabs.filter((tab) => tab.pinned);
    const next = remaining[0];
    if (remaining.length === 0) {
      const otherGroups = Object.values(workspace.groups).filter((item) => item.id !== groupId);
      if (otherGroups.length > 0) {
        const fallback = otherGroups[0];
        const groups = { ...workspace.groups };
        delete groups[groupId];
        pendingGroup.current = fallback.id;
        setWorkspace({
          groups,
          layout: removeGroupFromLayout(workspace.layout, groupId) ?? { kind: "group", groupId: fallback.id },
          focusedGroupId: workspace.focusedGroupId === groupId ? fallback.id : workspace.focusedGroupId,
        });
        if (workspace.focusedGroupId === groupId) navigate(fallback.tabs.find((tab) => tab.id === fallback.activeId)?.href ?? fallback.tabs[0]?.href ?? "/");
        return;
      }
      setWorkspace({
        groups: { [groupId]: { id: groupId, tabs: [initialTab], activeId: initialTab.id } },
        layout: { kind: "group", groupId },
        focusedGroupId: groupId,
      });
      navigate(initialTab.href);
      return;
    }
    setWorkspace((current) => ({ ...current, groups: { ...current.groups, [groupId]: { ...group, tabs: remaining, activeId: next?.id ?? "" } } }));
    if (workspace.focusedGroupId === groupId) navigate(next?.href ?? "/");
  };

  const keepOpen = (groupId: string, tabId: string) => {
    setWorkspace((current) => {
      const group = current.groups[groupId];
      return { ...current, groups: { ...current.groups, [groupId]: { ...group, tabs: group.tabs.map((tab) => tab.id === tabId ? { ...tab, kept: true } : tab) } } };
    });
  };

  const togglePin = (groupId: string, tabId: string) => {
    setWorkspace((current) => {
      const group = current.groups[groupId];
      const tabs = stickyFirst(group.tabs.map((tab) => tab.id === tabId ? { ...tab, pinned: !tab.pinned, kept: true } : tab));
      return { ...current, groups: { ...current.groups, [groupId]: { ...group, tabs } } };
    });
  };

  const split = (groupId: string, tabId: string, direction: SplitDirection) => {
    const source = workspace.groups[groupId];
    const tab = source?.tabs.find((item) => item.id === tabId);
    if (!source || !tab) return;
    const newId = `group-${nextGroupId.current++}`;
    const splitId = `split-${nextSplitId.current++}`;
    pendingGroup.current = newId;
    setWorkspace((current) => ({
      groups: { ...current.groups, [newId]: { id: newId, tabs: [tab], activeId: tab.id } },
      layout: splitLeaf(current.layout, groupId, newId, splitId, direction),
      focusedGroupId: newId,
    }));
  };

  const move = (groupId: string, tabId: string, direction: SplitDirection) => {
    const source = workspace.groups[groupId];
    const tab = source?.tabs.find((item) => item.id === tabId);
    if (!source || !tab) return;
    let targetId = findNeighbour(workspace.layout, groupId, direction);
    let layout = workspace.layout;
    const groups = { ...workspace.groups };
    if (!targetId) {
      targetId = `group-${nextGroupId.current++}`;
      const splitId = `split-${nextSplitId.current++}`;
      groups[targetId] = { id: targetId, tabs: [], activeId: "" };
      layout = splitLeaf(layout, groupId, targetId, splitId, direction);
    }
    const sourceTabs = source.tabs.filter((item) => item.id !== tabId);
    const sourceNext = sourceTabs.find((item) => item.id === source.activeId) ?? sourceTabs[0];
    const target = groups[targetId];
    const targetTabs = target.tabs.some((item) => item.id === tab.id) ? target.tabs : stickyFirst([...target.tabs, tab]);
    groups[targetId] = { ...target, tabs: targetTabs, activeId: tab.id };
    if (sourceTabs.length === 0) {
      delete groups[groupId];
      layout = removeGroupFromLayout(layout, groupId) ?? { kind: "group", groupId: targetId };
    } else {
      groups[groupId] = { ...source, tabs: sourceTabs, activeId: sourceNext?.id ?? "" };
    }
    pendingGroup.current = targetId;
    setWorkspace({ groups, layout, focusedGroupId: targetId });
    navigate(tab.href);
  };

  const resize = (splitId: string, ratio: number) => {
    const boundedRatio = Math.min(100, Math.max(0, ratio));
    setWorkspace((current) => ({ ...current, layout: resizeSplit(current.layout, splitId, boundedRatio) }));
  };

  return { workspace, syncRoute, activate, close, closeOthers, closeRight, closeAll, keepOpen, togglePin, split, move, resize };
}

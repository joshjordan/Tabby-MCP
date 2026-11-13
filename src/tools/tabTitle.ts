// Pure helpers for resolving what the tab strip (sidebar) shows versus the
// Claude Code session description.
//
// The strip shows a user-set custom title when a tab has been renamed by hand;
// otherwise it shows the dynamic title. For a Claude Code tab the dynamic title
// gets overwritten with the session description, so the raw title no longer
// matches the name the user sees. The MCP must report the name the user sees,
// so these helpers prefer the custom title and expose the session description
// as a separate value. They are intentionally dependency-free and duck-typed so
// they can be unit-tested in isolation.

export interface TabTitleLike {
    customTitle?: string | null;
    title?: string | null;
    claudeTitle?: string | null;
    getAllTabs?: () => TabTitleLike[];
}

/**
 * The name shown in the tab strip: a hand-set custom title wins over the
 * dynamic title (which Claude Code may have overwritten).
 */
export function tabDisplayTitle(tab: TabTitleLike | null | undefined): string {
    if (!tab) {
        return '';
    }
    return tab.customTitle || tab.title || '';
}

/**
 * The Claude Code session description shown in the tab's top bar, or null when
 * the tab has none. For a split tab it comes from the pane that carries the
 * Claude session.
 */
export function tabSessionDescription(tab: TabTitleLike | null | undefined): string | null {
    if (!tab) {
        return null;
    }
    if (tab.claudeTitle) {
        return tab.claudeTitle;
    }
    const children = tab.getAllTabs ? tab.getAllTabs() : [];
    for (const child of children) {
        if (child && child.claudeTitle) {
            return child.claudeTitle;
        }
    }
    return null;
}

/**
 * Case-insensitive partial match against the strip name or the Claude session
 * description, so a title locator finds a tab by either the name the user sees
 * or the session description shown in its top bar.
 */
export function tabTitleMatches(tab: TabTitleLike | null | undefined, query: string | null | undefined): boolean {
    if (!tab || !query) {
        return false;
    }
    const needle = query.toLowerCase();
    if (tabDisplayTitle(tab).toLowerCase().includes(needle)) {
        return true;
    }
    const description = tabSessionDescription(tab);
    return description != null && description.toLowerCase().includes(needle);
}

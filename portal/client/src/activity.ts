const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "client.create": "Client created",
  "client.update": "Client settings changed",
  "team.add": "Team member added",
  "team.password_reset": "Team password reset",
  "user.password_change": "Password changed",
  "user.invite": "Person invited",
  "user.activate": "Access turned on",
  "user.deactivate": "Access turned off",
  "demo.load": "Sample data loaded",
  "demo.remove": "Sample data removed",
  "ideas.to_task": "Idea turned into a to-do",
  "ideas.to_project": "Idea turned into a project",
  "leads.convert": "Lead converted to a client",
};
const NAMES: Record<string, string> = {
  projects: "Project", ideas: "Idea", brand: "Brand profile", accounts: "Social account", captions: "Caption", hashtags: "Hashtag set",
  websites: "Website", audits: "Audit", meetings: "Meeting", files: "File", finance: "Invoice", leads: "Lead", resources: "Resource",
  notices: "Notice", links: "Link", tasks: "To-do", posts: "Content", mood: "Moodboard item",
};

export function actionLabel(a: string): string {
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  const [section, verb] = a.split(".");
  const name = NAMES[section] ?? "Item";
  if (verb === "to_tasks") return `${name} turned into to-dos`;
  const v = verb === "create" ? "added" : verb === "update" ? "updated" : verb === "delete" ? "removed" : verb;
  return `${name} ${v}`;
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

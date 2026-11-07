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
  "post.approve": "Post approved",
  "post.request_changes": "Changes requested on a post",
};

export function actionLabel(a: string): string {
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  const [section, verb] = a.split(".");
  const v = verb === "create" ? "added to" : verb === "update" ? "changed in" : verb === "delete" ? "removed from" : verb;
  return `Item ${v} ${section}`;
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

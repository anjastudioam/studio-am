import { useEffect, useState } from "react";
import { api } from "../api";
import { Btn, ErrorNote, Loading, PageHead } from "../components/ui";
import { useAction, useLoad } from "../hooks";
import { canInstall, isStandalone, runInstall, subscribeInstall } from "../install";
import { TeamPage } from "./Team";

function InstallApp() {
  const [ready, setReady] = useState(canInstall());
  useEffect(() => subscribeInstall(() => setReady(canInstall())), []);
  if (isStandalone()) return <p className="ok-note">You're using the installed app.</p>;
  return (
    <>
      {ready ? (
        <Btn onClick={runInstall}>Install Studio AM on this device</Btn>
      ) : (
        <p className="muted">If there's no install button, use the steps below for your device.</p>
      )}
      <ul className="muted" style={{ margin: "1rem 0 0", paddingLeft: "1.2rem", display: "grid", gap: ".35rem" }}>
        <li>Windows or Mac, in Chrome or Edge: click the install icon at the right end of the address bar, then Install.</li>
        <li>Android tablet or phone, in Chrome: open the menu, then Install app (or Add to Home screen).</li>
        <li>iPad or iPhone, in Safari: tap Share, then Add to Home Screen.</li>
      </ul>
    </>
  );
}

function DemoData() {
  const { data, loading, reload } = useLoad<{ loaded: boolean; clients: number }>("/api/admin/demo-data");
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  if (loading || !data) return <Loading />;
  return (
    <>
      {data.loaded ? (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            {data.clients} sample {data.clients === 1 ? "client is" : "clients are"} loaded. They contain made-up information only.
          </p>
          {confirm ? (
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
              <Btn
                kind="danger"
                busy={act.busy}
                onClick={async () => {
                  await act.run(() => api.del("/api/admin/demo-data"));
                  setConfirm(false);
                  reload();
                }}
              >
                Yes, remove sample clients
              </Btn>
              <Btn kind="quiet" onClick={() => setConfirm(false)}>
                Cancel
              </Btn>
            </div>
          ) : (
            <Btn kind="quiet" onClick={() => setConfirm(true)}>
              Remove sample clients
            </Btn>
          )}
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>Add two made-up clients with example content, so you can explore how everything fits together. You can remove them in one click.</p>
          <Btn
            busy={act.busy}
            onClick={async () => {
              await act.run(() => api.post("/api/admin/demo-data"));
              reload();
            }}
          >
            Load sample clients
          </Btn>
        </>
      )}
      <ErrorNote message={act.error} />
    </>
  );
}

export function SettingsPage() {
  return (
    <div className="panel">
      <PageHead title="Settings" lead="Your devices, your team and the sample data." />
      <section className="setting-block" aria-labelledby="s-install">
        <h2 id="s-install">Install the app</h2>
        <p className="muted">Studio AM can run like a normal app on your laptop, tablet and phone, with its own icon and window.</p>
        <InstallApp />
      </section>
      <section className="setting-block" aria-labelledby="s-team">
        <h2 id="s-team">Team and passwords</h2>
        <TeamPage bare />
      </section>
      <section className="setting-block" aria-labelledby="s-demo">
        <h2 id="s-demo">Sample data</h2>
        <DemoData />
      </section>
    </div>
  );
}

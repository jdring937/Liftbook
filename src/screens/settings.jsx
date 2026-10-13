import { useEffect, useState } from 'preact/hooks';
import { useStore, allExercises, setSettings, exportJSON, importJSON, exportCSV, eraseAll, storageMode } from '../store.js';
import { fmtDateYear, fmtClock, plural } from '../lib/util.js';
import { Icon, Header, Seg, Toggle, pop, push, confirmSheet, toast } from '../ui.jsx';
import { restSheet } from './workout.jsx';
import { exportPhotosZip, importPhotosZip } from './photos.jsx';

async function shareOrDownload(text, filename, type) {
  const blob = text instanceof Blob ? text : new Blob([text], { type });
  try {
    const file = new File([blob], filename, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function Row({ label, sub, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag class={'set-line' + (onClick ? ' tap' : '')} onClick={onClick}>
      <span class="set-line-l"><span>{label}</span>{sub && <span class="small muted">{sub}</span>}</span>
      <span class="set-line-r">{children}</span>
    </Tag>
  );
}

export function SettingsScreen() {
  const s = useStore();
  const st = s.settings;
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => setUsage(e)).catch(() => {});
  }, [s.workouts.length]);
  const stamp = new Date().toISOString().slice(0, 10);

  const backup = async () => {
    const ok = await shareOrDownload(exportJSON(), `liftbook-backup-${stamp}.json`, 'application/json');
    if (ok) { setSettings({ lastBackup: Date.now() }); toast('Backup exported'); }
  };
  const csv = async () => {
    const ok = await shareOrDownload(exportCSV(allExercises(s)), `liftbook-sets-${stamp}.csv`, 'text/csv');
    if (ok) toast('CSV exported');
  };
  const restore = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(async (text) => {
      if (!(await confirmSheet({ title: 'Replace everything with this backup?', body: 'Your current workouts, plans and settings are replaced by the ones in the file.', confirm: 'Restore backup', danger: true }))) return;
      try { importJSON(text); toast('Backup restored'); } catch (err) { toast(err.message || 'That file could not be read'); }
    });
  };

  return (
    <div class="screen-body">
      <Header title="Settings" onBack={pop} />
      <div class="pad-16 stack-24">
        <section>
          <h2 class="h-sec">Training</h2>
          <div class="group">
            <Row label="Weight unit" sub="Changes how every weight is shown; nothing is lost">
              <Seg options={[['lb', 'lb'], ['kg', 'kg']]} value={st.unit} onChange={(v) => setSettings({ unit: v })} />
            </Row>
            <Row label="Default rest timer" onClick={() => restSheet(st.rest, (v) => setSettings({ rest: v == null ? 120 : v }))}>
              <span class="muted">{st.rest ? fmtClock(st.rest) : 'Off'}</span><Icon name="right" size={18} class="muted" />
            </Row>
            <Row label="Rest timer sound">
              <Toggle on={st.sound} onChange={(v) => setSettings({ sound: v })} label="Rest timer sound" />
            </Row>
            <Row label="Keep screen on during workouts">
              <Toggle on={st.keepAwake} onChange={(v) => setSettings({ keepAwake: v })} label="Keep screen on" />
            </Row>
            <Row label="Session targets" sub="Aim for each set based on your last session">
              <Toggle on={st.targets} onChange={(v) => setSettings({ targets: v })} label="Session targets" />
            </Row>
            <Row label="Weight jump in targets" sub="Added once you hit the top of your rep range">
              <Seg options={st.unit === 'lb' ? [[2.5, '2.5'], [5, '5'], [10, '10']] : [[1, '1'], [2.5, '2.5'], [5, '5']]}
                value={st.unit === 'lb' ? st.incLb : st.incKg} onChange={(v) => setSettings(st.unit === 'lb' ? { incLb: v } : { incKg: v })} />
            </Row>
          </div>
        </section>

        <section>
          <h2 class="h-sec">Analytics</h2>
          <div class="group">
            <Row label="1RM formula" sub={st.formula === 'epley' ? 'weight × (1 + reps ÷ 30)' : 'weight × 36 ÷ (37 − reps)'}>
              <Seg options={[['brzycki', 'Brzycki'], ['epley', 'Epley']]} value={st.formula} onChange={(v) => setSettings({ formula: v })} />
            </Row>
            <Row label="Muscle map body">
              <Seg options={[['male', 'Male'], ['female', 'Female']]} value={st.bodySex || 'male'} onChange={(v) => setSettings({ bodySex: v })} />
            </Row>
            <Row label="Week starts on">
              <Seg options={[[0, 'Sun'], [1, 'Mon']]} value={st.weekStart} onChange={(v) => setSettings({ weekStart: v })} />
            </Row>
            <Row label="Appearance">
              <Seg options={[['system', 'Auto'], ['dark', 'Dark'], ['light', 'Light']]} value={st.theme} onChange={(v) => setSettings({ theme: v })} />
            </Row>
          </div>
        </section>

        <section>
          <h2 class="h-sec">The science</h2>
          <div class="group">
            <Row label="Research behind the recommendations" sub="Volume, rest, deloads, progression and more, with sources" onClick={() => push('evidence')}>
              <Icon name="right" size={18} class="muted" />
            </Row>
          </div>
        </section>

        <section>
          <h2 class="h-sec">Your data</h2>
          <p class="small muted mb-8">
            Everything is stored on this phone only: {plural(s.workouts.length, 'workout')}, {plural(s.templates.length, 'saved workout')}.
            {' '}Removing the app from your Home Screen deletes it, so export a backup now and then.
          </p>
          <div class="group">
            <Row label="Export backup" sub={st.lastBackup ? `Last exported ${fmtDateYear(st.lastBackup)}` : 'Never exported'} onClick={backup}>
              <Icon name="share" size={20} class="muted" />
            </Row>
            <label class="set-line tap">
              <span class="set-line-l"><span>Restore from backup</span><span class="small muted">Pick a .json file you exported</span></span>
              <span class="set-line-r"><Icon name="right" size={18} class="muted" /></span>
              <input type="file" accept="application/json,.json" class="sr" onChange={restore} />
            </label>
            <Row label="Export sets as CSV" sub="For spreadsheets" onClick={csv}>
              <Icon name="share" size={20} class="muted" />
            </Row>
            <Row label="Export progress photos" sub={s.photos.length ? `${plural(s.photos.length, 'photo')} as a .zip file` : 'No photos yet'} onClick={s.photos.length ? async () => {
              toast('Preparing photos…');
              const { blob, count } = await exportPhotosZip();
              if (await shareOrDownload(blob, `liftbook-photos-${stamp}.zip`, 'application/zip')) toast(`Exported ${plural(count, 'photo')}`);
            } : undefined}>
              <Icon name="share" size={20} class="muted" />
            </Row>
            <label class="set-line tap">
              <span class="set-line-l"><span>Import progress photos</span><span class="small muted">Pick a photos .zip you exported</span></span>
              <span class="set-line-r"><Icon name="right" size={18} class="muted" /></span>
              <input type="file" accept=".zip,application/zip" class="sr" onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!f) return;
                try { const n = await importPhotosZip(f); toast(n ? `Imported ${plural(n, 'photo')}` : 'No new photos in that file'); } catch (err) { toast(err.message || 'That file could not be read'); }
              }} />
            </label>
            <Row label="Erase all data" onClick={async () => {
              if (await confirmSheet({ title: 'Erase everything?', body: 'All workouts, plans, custom exercises and settings are deleted from this phone. Export a backup first if you might want them.', confirm: 'Erase all data', danger: true })) {
                eraseAll(); toast('All data erased'); pop();
              }
            }}>
              <span class="danger-text small">Erase</span>
            </Row>
          </div>
          <p class="small muted mt-8">
            Storage: {storageMode === 'indexeddb' ? 'on-device database' : 'browser storage'}
            {usage && usage.usage != null ? `, ${(usage.usage / 1024).toFixed(0)} KB used` : ''}.
          </p>
        </section>
      </div>
    </div>
  );
}

import { useT } from "@seance/ui";
import { exportGuide } from "../exportGuide";

/** Plain steps for getting an .mbox out of common mail providers. Collapsed until asked for. */
export function ExportGuide() {
  const t = useT(exportGuide);
  return (
    <details className="mx-auto mt-2 w-[min(36rem,calc(100%-2rem))] rounded-lg border border-line bg-surface p-4 text-left text-sm">
      <summary className="cursor-pointer font-medium text-fg">{t.title}</summary>
      <p className="mt-3 text-muted">{t.intro}</p>
      <dl className="mt-3 space-y-3">
        {t.providers.map((p) => (
          <div key={p.name}>
            <dt className="font-medium text-fg">{p.name}</dt>
            <dd>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
                {p.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-muted">{t.thunderbirdStep}</p>
      <p className="mt-2 text-muted">{t.singleMails}</p>
    </details>
  );
}

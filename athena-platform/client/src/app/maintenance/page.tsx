import Link from 'next/link';
import { QuickExitButton } from '../dashboard/safety/QuickExit';

/**
 * While ATHENA is closed for an update this is the only page a visitor sees, so
 * it is also where someone who is not safe will land. It carries the three
 * numbers that matter and a way off the page, with nothing behind them: the
 * numbers are plain links, so they work with the API closed and with scripts
 * slow to load, and the exit takes her address from the safety settings the
 * server keeps open during maintenance, falling back to a search engine.
 *
 * The list is typed out here, not fetched. A page that asks the server for the
 * numbers is a page with no numbers on the one day the server is being changed.
 * They are the same national lines the Safety Centre lists (help/safety-center).
 */
const LINES = [
  { name: 'Police, fire and ambulance', display: '000', tel: '000', note: 'If you are in danger right now.' },
  { name: '1800RESPECT', display: '1800 737 732', tel: '1800737732', note: 'Family and domestic violence support, any time.' },
  { name: 'Lifeline', display: '13 11 14', tel: '131114', note: 'Someone to talk to, any time.' },
] as const;

export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-6 py-12">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">ATHENA is updating</h1>
          <p className="text-slate-300">
            We’re preparing something better. Please check back shortly.
          </p>
        </div>

        <section aria-labelledby="maintenance-help" className="space-y-3 text-left">
          <h2 id="maintenance-help" className="text-center text-lg font-semibold">
            If you need help now
          </h2>
          <ul className="space-y-3">
            {LINES.map((line) => (
              <li key={line.tel}>
                <a
                  href={`tel:${line.tel}`}
                  className="flex min-h-[56px] items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <span>
                    <span className="block font-semibold">{line.name}</span>
                    <span className="block text-sm text-slate-400">{line.note}</span>
                  </span>
                  <span className="shrink-0 text-lg font-bold text-rose-300">{line.display}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-center text-sm text-slate-400">
            More support lines are on the{' '}
            <Link href="/help/safety-center" className="underline underline-offset-2 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
              Safety Centre
            </Link>
            .
          </p>
        </section>

        <div className="flex justify-center">
          <QuickExitButton />
        </div>
      </div>
    </main>
  );
}

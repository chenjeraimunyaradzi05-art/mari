export default function AccessibilityPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Accessibility</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA aims to provide a platform that works with keyboards, common screen readers, zoom, and reduced-motion
        preferences. Accessibility work is ongoing as the platform expands.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Current accessibility focus</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Semantic landmarks and headings across primary navigation and dashboard routes.</li>
          <li>Keyboard-accessible dialogs, sheets, and notification surfaces.</li>
          <li>Support for reduced motion and responsive layouts across desktop and mobile.</li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          If you hit an accessibility issue, report it to <a className="text-primary hover:underline" href="mailto:support@athena.com">support@athena.com</a> with the page, browser, and assistive technology you were using.
        </p>
      </div>
    </div>
  );
}

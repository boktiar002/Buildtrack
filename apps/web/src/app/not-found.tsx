import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-rebar">The link may be old, or the page may have moved.</p>
      <Link href="/" className="mt-6 inline-block font-medium underline underline-offset-4">Go to the home page</Link>
    </div>
  );
}

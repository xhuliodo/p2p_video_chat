export default function NotFound() {
  return (
    <div
      id="error-page"
      className="flex h-dvh flex-col items-center justify-center gap-8"
    >
      <h1 className="text-4xl font-bold">Oops!</h1>
      <p>Sorry, the url you are requesting does not exist.</p>
      <a href="/">
        <button className="rounded-md bg-gray-200 p-2">Go back</button>
      </a>
    </div>
  );
}

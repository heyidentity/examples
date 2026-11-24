import { connection } from 'next/server';
import { auth } from '../auth';
import { readSettings } from '../settings';
import { MissingSettings, SignIn, SignOut } from './controls';

export default async function Home() {
  await connection();
  const { missing } = readSettings();
  if (missing.length) return <MissingSettings names={missing} />;

  const session = await auth();
  return (
    <>
      <h1>Next.js sign-in example</h1>
      {session ? <><p data-testid="signed-in-user">{session.user?.name}</p><a href="/admin">Admin</a><SignOut /></> : <SignIn />}
    </>
  );
}

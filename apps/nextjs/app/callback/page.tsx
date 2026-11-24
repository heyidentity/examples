import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { readSettings } from '../../settings';
import { MissingSettings, SignIn } from '../controls';

export default async function Callback({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await connection();
  const { missing } = readSettings();
  if (missing.length) return <MissingSettings names={missing} />;

  const { error, error_description } = await searchParams;
  if (typeof error !== 'string') redirect('/');
  const description = typeof error_description === 'string' ? error_description : 'Sign-in could not be completed.';
  return (
    <>
      <h1>Sign in again</h1>
      <p data-testid="sign-in-error">{error}: {description}</p>
      <SignIn />
    </>
  );
}

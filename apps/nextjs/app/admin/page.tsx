import { connection } from 'next/server';
import { auth } from '../../auth';
import { readSettings } from '../../settings';
import { MissingSettings, SignIn } from '../controls';

export default async function Admin() {
  await connection();
  const { missing } = readSettings();
  if (missing.length) return <MissingSettings names={missing} />;

  const session = await auth();
  if (!session) return <SignIn />;
  return (
    <>
      <h1>Admin</h1>
      <p data-testid="signed-in-user">{session.user?.name}</p>
      {session.roles.includes('admin') ?
        <p data-testid="admin-area">Admin area</p> :
        <p data-testid="access-denied">Access denied</p>}
    </>
  );
}

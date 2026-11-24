import { beginSignIn, endSignIn } from '../actions';

export function SignIn() {
  return <form action={beginSignIn}><button data-testid="sign-in">Sign in</button></form>;
}

export function SignOut() {
  return <form action={endSignIn}><button data-testid="sign-out">Sign out</button></form>;
}

export function MissingSettings({ names }: { names: string[] }) {
  return <ul>{names.map(name => <li key={name}>Missing setting: {name} in .env</li>)}</ul>;
}

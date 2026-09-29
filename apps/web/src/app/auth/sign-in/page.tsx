import { SignInForm } from './sign-in-form'

// Read OAuth availability server-side and pass as props to the client form
export default function SignInPage() {
  return (
    <SignInForm
      github={!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
      google={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
    />
  )
}

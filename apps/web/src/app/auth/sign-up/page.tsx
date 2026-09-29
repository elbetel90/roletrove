import { SignUpForm } from './sign-up-form'

export default function SignUpPage() {
  return (
    <SignUpForm
      github={!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
      google={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
    />
  )
}

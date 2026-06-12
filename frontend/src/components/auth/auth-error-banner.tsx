/**
 * Inline error banner shared across the auth forms.
 */
export function AuthErrorBanner({ message }: Readonly<{ message: string }>) {
  return (
    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">
      {message}
    </div>
  );
}

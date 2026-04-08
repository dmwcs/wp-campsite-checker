import { useState } from 'react';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword } from 'aws-amplify/auth';

const VIEWS = {
  SIGN_IN: 'signIn',
  SIGN_UP: 'signUp',
  CONFIRM: 'confirm',
  FORGOT: 'forgot',
  RESET: 'reset',
};

export default function AuthModal({ onClose, onSuccess }) {
  const [view, setView] = useState(VIEWS.SIGN_IN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleError = (e) => {
    const msg = e?.message || 'Operation failed, please try again';
    if (msg.includes('User already exists')) setError('This email is already registered. Please sign in.');
    else if (msg.includes('Incorrect username or password')) setError('Incorrect email or password');
    else if (msg.includes('User does not exist')) setError('This email is not registered');
    else if (msg.includes('Invalid verification code')) setError('Invalid verification code');
    else if (msg.includes('Password did not conform')) setError('Password must be at least 8 characters with numbers and lowercase letters');
    else setError(msg);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      handleError(err);
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      if (isSignUpComplete) {
        await signIn({ username: email, password });
        onSuccess?.();
        onClose();
      } else if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setView(VIEWS.CONFIRM);
      }
    } catch (err) {
      handleError(err);
    }
    setLoading(false);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      handleError(err);
    }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword({ username: email });
      setView(VIEWS.RESET);
    } catch (err) {
      handleError(err);
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword: password });
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      handleError(err);
    }
    setLoading(false);
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>&times;</button>

        {/* Sign In */}
        {view === VIEWS.SIGN_IN && (
          <form onSubmit={handleSignIn}>
            <div className="auth-header">
              <h2>Welcome back</h2>
              <p>Sign in to use favourites and email notifications</p>
            </div>
            <div className="auth-fields">
              <div className="auth-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { setError(''); setView(VIEWS.SIGN_UP); }}>No account? Sign Up</button>
              <button type="button" className="auth-link" onClick={() => { setError(''); setView(VIEWS.FORGOT); }}>Forgot password</button>
            </div>
          </form>
        )}

        {/* Sign Up */}
        {view === VIEWS.SIGN_UP && (
          <form onSubmit={handleSignUp}>
            <div className="auth-header">
              <h2>Create account</h2>
              <p>Sign up to save favourites and receive availability notifications</p>
            </div>
            <div className="auth-fields">
              <div className="auth-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, include numbers" required />
              </div>
              <div className="auth-field">
                <label>Confirm password</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter password" required />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { setError(''); setView(VIEWS.SIGN_IN); }}>Already have an account? Sign In</button>
            </div>
          </form>
        )}

        {/* Confirm Code */}
        {view === VIEWS.CONFIRM && (
          <form onSubmit={handleConfirm}>
            <div className="auth-header">
              <h2>Verify email</h2>
              <p>A verification code has been sent to <strong>{email}</strong></p>
            </div>
            <div className="auth-fields">
              <div className="auth-field">
                <label>Verification code</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" required autoFocus />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
        )}

        {/* Forgot Password */}
        {view === VIEWS.FORGOT && (
          <form onSubmit={handleForgot}>
            <div className="auth-header">
              <h2>Reset password</h2>
              <p>Enter your email and we will send a verification code</p>
            </div>
            <div className="auth-fields">
              <div className="auth-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send verification code'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { setError(''); setView(VIEWS.SIGN_IN); }}>Back to sign in</button>
            </div>
          </form>
        )}

        {/* Reset Password */}
        {view === VIEWS.RESET && (
          <form onSubmit={handleReset}>
            <div className="auth-header">
              <h2>Set new password</h2>
              <p>A verification code has been sent to <strong>{email}</strong></p>
            </div>
            <div className="auth-fields">
              <div className="auth-field">
                <label>Verification code</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" required autoFocus />
              </div>
              <div className="auth-field">
                <label>New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, include numbers" required />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset password & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

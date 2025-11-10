import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [userId, setUserId] = useState('');

  const { login, verify, isLoading, error, clearError } = useAuthStore();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const result = await login(phoneNumber);
      setUserId(result.userId);
      setStep('code');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await verify(userId, code);
      // User will be redirected by App.tsx after successful verification
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setCode('');
    clearError();
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Teleport</h1>
          <p>Fast and Secure Messaging</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="login-form">
            <h2>Sign In</h2>
            <p className="login-description">
              Enter your phone number to continue
            </p>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={isLoading || !phoneNumber} className="btn-primary">
              {isLoading ? 'Sending...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="login-form">
            <h2>Verification</h2>
            <p className="login-description">
              Enter the verification code sent to
              <br />
              <strong>{phoneNumber}</strong>
            </p>

            <div className="form-group">
              <label htmlFor="code">Verification Code</label>
              <input
                id="code"
                type="text"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={5}
                disabled={isLoading}
                required
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={isLoading || code.length !== 5} className="btn-primary">
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>

            <button type="button" onClick={handleBack} className="btn-secondary" disabled={isLoading}>
              Back
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}

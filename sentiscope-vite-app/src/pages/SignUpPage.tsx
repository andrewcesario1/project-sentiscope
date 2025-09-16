import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import "../styles/HomePage.css";

const API_BASE = "http://localhost:5000";

const SignUpPage: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const plan = "free";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({ name, email, password, plan }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Account created successfully! Redirecting...");
        setName("");
        setEmail("");
        setPassword("");

        const { custom_token } = data;
        await signInWithCustomToken(auth, custom_token);

        setTimeout(() => {
          navigate("/home", { replace: true });
        }, 2000);
      } else {
        setError(data.error || "Failed to sign up. Please try again.");
        setIsLoading(false);
      }
    } catch (error) {
      setError("Sign up failed. Please try again.");
      console.error("Sign up error:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !successMessage) {
        navigate("/home", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate, successMessage]);

  return (
    <div className="hp-container" style={{ paddingTop: '8rem' }}>
      <div className="hp-hero" style={{ minHeight: 'auto', paddingTop: '2rem', paddingBottom: '2rem' }}>
        <div className="hp-search-card" style={{ maxWidth: '420px' }}>
          <h1 className="hp-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            Sign Up
          </h1>
          <p className="hp-subtitle" style={{ marginBottom: '2rem', fontSize: '1rem' }}>
            Create your free account
          </p>

          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              background: '#d1fae5',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#065f46',
              fontSize: '0.9rem',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: 'var(--text-color)'
              }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="hp-search-input"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: '#fdfdff',
                  color: 'var(--text-color)',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: 'var(--text-color)'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="hp-search-input"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: '#fdfdff',
                  color: 'var(--text-color)',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: 'var(--text-color)'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password"
                className="hp-search-input"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: '#fdfdff',
                  color: 'var(--text-color)',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !name.trim() || !email.trim() || !password.trim()}
              className="hp-analyze-button"
              style={{
                width: '100%',
                padding: '1rem 2rem',
                fontSize: '1rem',
                backgroundImage: 'var(--primary-gradient)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                marginBottom: '1.5rem'
              }}
            >
              {isLoading ? "Creating Account..." : "Create Free Account"}
            </button>

            <div style={{
              textAlign: 'center',
              fontSize: '0.9rem',
              color: 'var(--text-color-secondary)'
            }}>
              Already have an account?{" "}
              <Link
                to="/"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
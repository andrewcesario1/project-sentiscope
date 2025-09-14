import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import "../styles/Navbar.css";
import Logo from "/Logo.png";

interface NavbarProps {
  user: User | null;
}

const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const navigate = useNavigate();

  const authDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) {
      setError(null);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (user) {
      resetCredentials();
    }
  }, [user]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const resetCredentials = () => {
    setEmail("");
    setPassword("");
    setError(null);
  };

  const handleSignIn = async (): Promise<void> => {
    setError(null);
    
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      resetCredentials();
    } catch (error: unknown) {
      let errorMessage = "Sign in failed. Please try again.";
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === "auth/user-not-found") {
          errorMessage = "No account found. Please sign up.";
        } else if (firebaseError.code === "auth/wrong-password") {
          errorMessage = "Incorrect password. Please try again.";
        } else if (firebaseError.code === "auth/invalid-email") {
          errorMessage = "Invalid email address.";
        } else if (firebaseError.code === "auth/too-many-requests") {
          errorMessage = "Too many failed attempts. Please try again later.";
        }
      }
      
      setError(errorMessage);
    }
  };

  const handleSignUp = (): void => {
    navigate("/signup");
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut(auth);
      resetCredentials();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };
 

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-brand-link">
          <img src={Logo} alt="Sentiscope Logo" className="navbar-logo" />
          SENTISCOPE
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>

        {user ? (
          <div className={`profile-dropdown ${profileDropdown ? 'open' : ''}`} ref={profileDropdownRef}>
            <button onClick={() => setProfileDropdown(!profileDropdown)} className="navbar-link">
              Profile ▼
            </button>
            {profileDropdown && (
              <div className="dropdown-menu">
                <button onClick={() => navigate("/settings")} className="dropdown-item">
                  Settings
                </button>
                <button onClick={handleSignOut} className="dropdown-item">
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`auth-dropdown ${dropdownOpen ? 'open' : ''}`} ref={authDropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="navbar-link">
              Sign In
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button onClick={handleSignIn} className="dropdown-item">Login</button>
                <button onClick={handleSignUp} className="dropdown-item">Sign Up</button>
                {error && <p className="error-text">{error}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

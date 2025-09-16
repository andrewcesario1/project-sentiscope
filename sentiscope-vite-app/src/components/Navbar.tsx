import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import "../styles/Navbar.css";
import Logo from "/Logo.png";

interface NavbarProps {
  user: User | null;
}

interface UserData {
  name: string;
  email: string;
  plan: string;
}

const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
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
      fetchUserData();
    } else {
      setUserData(null);
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as any;
        setUserData({ 
          name: data.name || '', 
          email: user.email || data.email || '', 
          plan: data.plan || 'free' 
        });
      } else {
        setUserData({ 
          name: '', 
          email: user.email || '', 
          plan: 'free' 
        });
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserData({ 
        name: '', 
        email: user.email || '', 
        plan: 'free' 
      });
    }
  };
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
            <button onClick={() => setProfileDropdown(!profileDropdown)} className="profile-button">
              <div className="profile-avatar">
                {userData?.name ? userData.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
              </div>
              <span className="profile-name">
                {userData?.name || (user.email ? user.email.split('@')[0] : 'Profile')}
              </span>
              <svg className={`profile-chevron ${profileDropdown ? 'rotated' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
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

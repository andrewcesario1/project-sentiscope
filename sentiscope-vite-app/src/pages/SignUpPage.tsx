import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithCustomToken, onAuthStateChanged} from "firebase/auth";

const API_BASE = "http://localhost:5000";


const SignUpPage = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null); 
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate  = useNavigate();
    const plan = "free";


    const handleSubmit = async (e:React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        setError(null)
        setSuccessMessage(null);

        try{
            const response = await fetch(`${API_BASE}/signup`, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json'
                }, 
                body: JSON.stringify({ name, email, password, plan })
            });

            const data = await response.json();

            if(response.ok){
              setSuccessMessage("Account created successfully!");
              setName("");
              setEmail("");
              setPassword("");

              const { custom_token } = data;
              await signInWithCustomToken(auth, custom_token);

              setTimeout(() => { navigate("/home", { replace: true }); }, 3000);
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
            console.log("Auth state changed:", user ? user.uid : "No user");
            if (user && !successMessage) {
              navigate("/home", { replace: true });
          }
      });
      return () => unsubscribe();
      }, [navigate, successMessage]);


return (
    <div className="signup-page">
      <h2>Sign Up</h2>
      {error && <p className="error">{error}</p>}
      {successMessage && <p className="success">{successMessage}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Add your name: </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name..." required disabled={isLoading}/>
        </div>
        <div className="form-group">
          <label>Add your email: </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter an email..."  required disabled={isLoading}/>
        </div>
        <div className="form-group">
          <label>Create a password: </label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a password..."  required disabled={isLoading}/>
        </div>
        <button type="submit">
          {isLoading ? "Signing Up..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
};

export default SignUpPage;

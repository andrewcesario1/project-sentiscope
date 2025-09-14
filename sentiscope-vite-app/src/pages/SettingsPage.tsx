import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import "../styles/SettingsPage.css";

interface UserData {
  name: string;
  email: string;
  plan: string;
}

interface UsageData {
  visits: number;
  sentiments: number;
  recent: string[];
}

type SettingsTab = 'account' | 'security' | 'usage';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [usageData, setUsageData] = useState<UsageData>({
    visits: 0,
    sentiments: 0,
    recent: []
  });
  const [showCount, setShowCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    const fetchUserAndUsage = async () => {
      setLoading(true);
      const u = auth.currentUser;
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const d = userSnap.data() as any;
            setUserData({ name: d.name, email: u.email || d.email, plan: d.plan });
            setUsageData({
              visits: d.visits || 0,
              sentiments: d.sentiments || 0,
              recent: Array.isArray(d.recent) ? d.recent : []
            });
          } else {
            setUserData({ name: '', email: u.email || '', plan: 'free' });
          }
        } catch (err) {
          setUserData({ name: '', email: u.email || '', plan: 'free' });
        }
      }
      setLoading(false);
    };
    fetchUserAndUsage();
  }, []);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!auth.currentUser) return;
    if (!oldPassword || !newPassword) {
      setPasswordError('Both fields are required.');
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email || '', oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Password change failed";
      setPasswordError(errorMessage);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="settings-form">
            <h2>Account Information</h2>
            <div className="form-group">
              <label>Name:</label>
              <span>{userData?.name}</span>
            </div>
            <div className="form-group">
              <label>Email:</label>
              <span>{userData?.email}</span>
            </div>
             <div className="form-group">
              <label>Current Plan:</label>
              <span>{userData?.plan.toUpperCase()}</span>
            </div>
            <button className="settings-button logout" onClick={handleLogout}>Log Out</button>
          </div>
        );
      case 'security':
        return (
          <div className="settings-form">
            <h2>Security</h2>
            <div className="form-group">
              <label>Old Password:</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Enter old password"/>
            </div>
            <div className="form-group">
              <label>New Password:</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password"/>
            </div>
            {passwordError && <p className="error-text">{passwordError}</p>}
            {passwordSuccess && <p className="success-text">{passwordSuccess}</p>}
            <button className="settings-button" onClick={handleChangePassword}>Update Password</button>
          </div>
        );
      case 'usage':
        return (
          <div className="settings-form">
            <h2>Usage Data</h2>
            <div className="form-group">
              <label>Site Visits:</label>
              <span>{usageData.visits}</span>
            </div>
            <div className="form-group">
              <label>Sentiments Created:</label>
              <span>{usageData.sentiments}</span>
            </div>
            <div className="form-group vertical">
              <label>Recent Searches:</label>
              <div className="recent-searches">
                {usageData.recent.length > 0 ? (
                  usageData.recent.slice(0, showCount).map((item, idx) => (
                    <div key={idx} className="search-item">{idx + 1}. {item}</div>
                  ))
                ) : (
                  <p>No recent searches.</p>
                )}
                {usageData.recent.length > showCount && (
                  <button onClick={() => setShowCount(c => c + 10)} className="settings-button load-more-btn">
                    Load More
                  </button>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-content">
        <h1>Settings</h1>
        <div className="settings-layout">
          <div className="settings-sidebar">
            <button className={`sidebar-btn ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>Account</button>
            <button className={`sidebar-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security</button>
            <button className={`sidebar-btn ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}>Usage</button>
          </div>
          <div className="settings-panel">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Navbar from '../Navbar';

// Mock Firebase auth
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signOut: mockSignOut,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderNavbar = (user = null) => {
  return render(
    <BrowserRouter>
      <Navbar user={user} />
    </BrowserRouter>
  );
};

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders navbar with brand and links', () => {
    renderNavbar();
    
    expect(screen.getByText('SENTISCOPE')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  test('shows sign in dropdown when user is not logged in', () => {
    renderNavbar();
    
    const signInButton = screen.getByText('Sign In');
    expect(signInButton).toBeInTheDocument();
    
    fireEvent.click(signInButton);
    
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  test('shows profile dropdown when user is logged in', () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    renderNavbar(mockUser);
    
    const profileButton = screen.getByText('Profile ▼');
    expect(profileButton).toBeInTheDocument();
    
    fireEvent.click(profileButton);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('handles sign in with valid credentials', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({});
    renderNavbar();
    
    fireEvent.click(screen.getByText('Sign In'));
    
    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByText('Login');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );
    });
  });

  test('shows error for empty credentials', async () => {
    renderNavbar();
    
    fireEvent.click(screen.getByText('Sign In'));
    fireEvent.click(screen.getByText('Login'));
    
    await waitFor(() => {
      expect(screen.getByText('Please enter both email and password')).toBeInTheDocument();
    });
  });

  test('handles sign in error', async () => {
    const error = { code: 'auth/user-not-found' };
    mockSignInWithEmailAndPassword.mockRejectedValue(error);
    renderNavbar();
    
    fireEvent.click(screen.getByText('Sign In'));
    
    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByText('Login');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText('No account found. Please sign up.')).toBeInTheDocument();
    });
  });

  test('handles sign up navigation', () => {
    renderNavbar();
    
    fireEvent.click(screen.getByText('Sign In'));
    fireEvent.click(screen.getByText('Sign Up'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/signup');
  });

  test('handles sign out', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    mockSignOut.mockResolvedValue({});
    renderNavbar(mockUser);
    
    fireEvent.click(screen.getByText('Profile ▼'));
    fireEvent.click(screen.getByText('Logout'));
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('handles settings navigation', () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    renderNavbar(mockUser);
    
    fireEvent.click(screen.getByText('Profile ▼'));
    fireEvent.click(screen.getByText('Settings'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  test('closes dropdown when clicking outside', () => {
    renderNavbar();
    
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    
    // Click outside the dropdown
    fireEvent.mouseDown(document.body);
    
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
  });
});

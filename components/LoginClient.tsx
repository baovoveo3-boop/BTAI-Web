"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { UserData } from "@/context/AuthContext";

const isValidPort = (port: string | null) => {
  if (!port) return false;
  return /^\d+$/.test(port) && parseInt(port) >= 1 && parseInt(port) <= 65535;
};

export default function LoginClient() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktopAuth = searchParams.get('desktop_auth') === 'true';
  const desktopPort = searchParams.get('port');
  const forceReauth = searchParams.get('force_reauth') === 'true';
  
  const ssoAttemptedRef = useRef(false);

  const handleSSORedirect = useCallback(async (user: User) => {
    if (isDesktopAuth && isValidPort(desktopPort)) {
      if (ssoAttemptedRef.current) {
        return true; // Already redirecting / handled
      }
      ssoAttemptedRef.current = true;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/desktop-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const data = await res.json();
        if (data.success && data.customToken) {
          window.location.href = `http://localhost:${desktopPort}/callback?token=${data.customToken}`;
          return true;
        } else {
          console.error("SSO Error:", data.error);
          setError("Lỗi liên kết SSO: " + (data.error || "Không rõ nguyên nhân"));
        }
      } catch (err: any) {
        console.error("Failed to generate custom token for SSO", err);
        setError("Lỗi liên kết SSO: " + (err.message || "Lỗi kết nối"));
      }
    }
    return false;
  }, [isDesktopAuth, desktopPort]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && isDesktopAuth && isValidPort(desktopPort) && !ssoAttemptedRef.current) {

        // Nếu App Hub gửi force_reauth=true → user vừa logout thủ công
        // Phải signOut để xóa cookie, hiện form đăng nhập sạch, không auto-login
        if (forceReauth) {
          await signOut(auth);
          return;
        }

        // Trường hợp bình thường (khởi động lần đầu) → Auto-login như cũ
        setLoading(true);
        handleSSORedirect(currentUser).finally(() => {
          setLoading(false);
        });
      }
    });
    return () => unsubscribe();
  }, [isDesktopAuth, desktopPort, handleSSORedirect, forceReauth]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const isRedirecting = await handleSSORedirect(userCredential.user);
        if (!isRedirecting) {
          router.push("/");
        }
      } else {
        if (!name.trim()) throw new Error("Vui lòng nhập tên hiển thị");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Tạo document mới cho user đăng ký bằng email
        const userDocRef = doc(db, "users", user.uid);
        const newUserData: UserData = {
          uid: user.uid,
          email: user.email,
          displayName: name,
          walletBalance: 0,
          currentTier: "free",
          tierExpiresAt: null,
          role: "user",
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newUserData);

        const isRedirecting = await handleSSORedirect(user);
        if (!isRedirecting) {
          router.push("/");
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential") setError("Email hoặc mật khẩu không đúng.");
      else if (err.code === "auth/email-already-in-use") setError("Email này đã được sử dụng.");
      else if (err.code === "auth/weak-password") setError("Mật khẩu phải từ 6 ký tự trở lên.");
      else setError(err.message || "Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // AuthContext sẽ tự động handle việc tạo document cho Google User mới
      const userCredential = await signInWithPopup(auth, provider);
      const isRedirecting = await handleSSORedirect(userCredential.user);
      if (!isRedirecting) {
        router.push("/");
      }
    } catch (err: any) {
      console.error(err);
      setError("Đăng nhập bằng Google thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-zinc-950">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại trang chủ
        </Link>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h2>
          <p className="text-zinc-400 mb-8">
            {isLogin ? "Đăng nhập để quản lý công cụ và dịch vụ của bạn." : "Trải nghiệm thế giới AI tự động hóa hoàn toàn mới."}
          </p>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Đăng nhập với Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900/50 text-zinc-500">Hoặc tiếp tục với</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Tên hiển thị</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="khachhang@gmail.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isDesktopAuth && isValidPort(desktopPort) && loading && !error && (
              <div className="text-blue-400 text-sm bg-blue-400/10 p-3 rounded-lg border border-blue-400/20 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang chuyển hướng liên kết SSO...
              </div>
            )}

            {error && <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Đăng nhập" : "Đăng ký")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

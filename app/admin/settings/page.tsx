"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { logAdminAction } from "@/lib/adminLogger";
import { Save, RefreshCw } from "lucide-react";

interface SettingsData {
  version: string;
  download_url: string;
  force_update: boolean;
  enable_trial: boolean;
}

const convertGoogleDriveUrl = (url: string): string => {
  if (!url) return "";
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (trimmed.includes("drive.google.com/open") && openMatch && openMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }
  return trimmed;
};

export default function AdminSettings() {
  const { userData } = useAuth();
  const [version, setVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({
    version: "",
    download_url: "",
    force_update: false,
    enable_trial: false,
  });

  const [enableTrial, setEnableTrial] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, "settings", "general");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SettingsData;
        const fetched = {
          version: data.version || "",
          download_url: data.download_url || "",
          force_update: !!data.force_update,
          enable_trial: !!data.enable_trial,
        };
        setVersion(fetched.version);
        setDownloadUrl(fetched.download_url);
        setForceUpdate(fetched.force_update);
        setEnableTrial(fetched.enable_trial);
        setOriginalSettings(fetched);
      } else {
        // Fallback gracefully if document does not exist yet
        const fetched = {
          version: "",
          download_url: "",
          force_update: false,
          enable_trial: false,
        };
        setVersion(fetched.version);
        setDownloadUrl(fetched.download_url);
        setForceUpdate(fetched.force_update);
        setEnableTrial(fetched.enable_trial);
        setOriginalSettings(fetched);
      }
    } catch (error) {
      console.error("Lỗi khi tải cấu hình hệ thống:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !downloadUrl) {
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const convertedUrl = convertGoogleDriveUrl(downloadUrl);
      const docRef = doc(db, "settings", "general");
      
      const payload = {
        version,
        download_url: convertedUrl,
        force_update: forceUpdate,
        enable_trial: enableTrial,
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, payload, { merge: true });

      await logAdminAction({
        adminUid: userData?.uid || "unknown",
        adminEmail: userData?.email || "unknown",
        action: "UPDATE_SYSTEM_SETTINGS",
        target: "settings/general",
        details: `Cập nhật cấu hình: Phiên bản ${version}, Bắt buộc ${forceUpdate}, Bật Dùng Thử ${enableTrial}`,
      });

      setOriginalSettings({
        version,
        download_url: convertedUrl,
        force_update: forceUpdate,
        enable_trial: enableTrial,
      });
      setDownloadUrl(convertedUrl);
      
      alert("Cập nhật cấu hình hệ thống thành công!");
    } catch (error: any) {
      console.error("Lỗi khi lưu cấu hình:", error);
      alert("Lỗi khi thực hiện lưu cấu hình: " + (error.message || error));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setVersion(originalSettings.version);
    setDownloadUrl(originalSettings.download_url);
    setForceUpdate(originalSettings.force_update);
    setEnableTrial(originalSettings.enable_trial);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Đang tải cấu hình hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Cấu hình Hệ thống</h1>
        <p className="text-zinc-400 mt-1">Cấu hình phiên bản và đường dẫn cập nhật cho App Launcher</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          ⚙️ Launcher Settings
        </h3>
        
        <form onSubmit={handleSaveClick} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Phiên bản App Launcher</label>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="VD: 1.0.0"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Đường dẫn tải xuống (Download Link)</label>
              <input
                type="text"
                required
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="Nhập link Google Drive..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-4 border border-zinc-800/50 group hover:border-zinc-700/50 transition-colors">
            <div className="space-y-1 pr-4">
              <h4 className="text-sm font-bold text-white">Bắt buộc Cập nhật (Force Update)</h4>
              <p className="text-xs text-zinc-500">Yêu cầu người dùng cập nhật lên phiên bản mới mới được sử dụng ứng dụng launcher.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={forceUpdate}
              onClick={() => setForceUpdate(!forceUpdate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                forceUpdate ? "bg-purple-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  forceUpdate ? "translate-x-6" : "translate-x-1"
                }`}
              />
              <input type="checkbox" checked={forceUpdate} onChange={() => {}} className="sr-only" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-4 border border-zinc-800/50 group hover:border-zinc-700/50 transition-colors">
            <div className="space-y-1 pr-4">
              <h4 className="text-sm font-bold text-white">Bật Dùng Thử 3 Ngày (Trial)</h4>
              <p className="text-xs text-zinc-500">Hiển thị nút "Nhận 3 ngày dùng thử" trên website cho các công cụ có hỗ trợ dùng thử.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableTrial}
              onClick={() => setEnableTrial(!enableTrial)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                enableTrial ? "bg-green-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableTrial ? "translate-x-6" : "translate-x-1"
                }`}
              />
              <input type="checkbox" checked={enableTrial} onChange={() => {}} className="sr-only" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-lg bg-transparent hover:bg-zinc-800 text-zinc-300 font-medium transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setConfirmOpen(false)}
          ></div>
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Xác nhận cập nhật cấu hình</h3>
            <p className="text-sm text-zinc-400 mb-6">Bạn chuẩn bị lưu lại cấu hình mới cho App Launcher. Hành động này sẽ ảnh hưởng tới toàn bộ người dùng và được ghi lại trong nhật ký hoạt động. Xác nhận?</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmOpen(false)} 
                className="px-4 py-2 rounded-lg bg-transparent hover:bg-zinc-800 text-zinc-300 font-medium transition"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20"
              >
                Xác nhận thao tác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

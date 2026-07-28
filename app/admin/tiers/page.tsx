"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Edit2, Plus, Trash2, X, Save, Check, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { logAdminAction } from "@/lib/adminLogger";

interface TierFeature {
  text: string;
  type: "check" | "cross";
}

interface Tier {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  badgeText: string;
  features: TierFeature[];
}

export default function AdminTiers() {
  const { userData } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);

  // Form State
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceYearly, setPriceYearly] = useState(0);
  const [badgeText, setBadgeText] = useState("");
  const [features, setFeatures] = useState<TierFeature[]>([]);

  // Modal Xác nhận xóa
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false, title: "", message: "", onConfirm: () => {}
  });

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
  const closeConfirm = () => {
    setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  };

  const loadTiers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "tiers"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tier));
      // Sort by price to keep order Free -> Plus -> Premium
      data.sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
      setTiers(data);
    } catch (error) {
      console.error("Error loading tiers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const openModal = (tier?: Tier) => {
    if (tier) {
      setEditingTier(tier);
      setId(tier.id);
      setName(tier.name || "");
      setDescription(tier.description || "");
      setPriceMonthly(tier.priceMonthly || 0);
      setPriceYearly(tier.priceYearly || 0);
      setBadgeText(tier.badgeText || "");
      setFeatures(tier.features ? [...tier.features] : []);
    } else {
      setEditingTier(null);
      setId("tier-new");
      setName("");
      setDescription("");
      setPriceMonthly(0);
      setPriceYearly(0);
      setBadgeText("");
      setFeatures([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTier(null);
  };

  const handleAddFeature = () => {
    setFeatures([...features, { text: "", type: "check" }]);
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleFeatureChange = (index: number, key: keyof TierFeature, value: any) => {
    const updated = [...features];
    updated[index] = { ...updated[index], [key]: value };
    setFeatures(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return alert("Vui lòng nhập đủ ID và Tên Gói");

    setSubmitting(true);
    try {
      const dataToSave = {
        name,
        description,
        priceMonthly: Number(priceMonthly),
        priceYearly: Number(priceYearly),
        badgeText,
        features: features.filter(f => f.text.trim() !== "")
      };

      await setDoc(doc(db, "tiers", id), dataToSave, { merge: true });
      
      logAdminAction({
        adminUid: userData?.uid || "unknown",
        adminEmail: userData?.email || "Unknown",
        action: editingTier ? "UPDATE_TIER" : "CREATE_TIER",
        target: "tiers",
        details: `Tier ID: ${id}`
      });
      alert("Lưu thành công!");
      closeModal();
      loadTiers();
    } catch (error: any) {
      alert("Lỗi khi lưu: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tierId: string) => {
    requestConfirm(
      "Xác nhận xóa Gói",
      `Bạn có chắc chắn muốn xóa vĩnh viễn gói ${tierId}? Thao tác này có thể ảnh hưởng giao diện Web.`,
      async () => {
        try {
          await deleteDoc(doc(db, "tiers", tierId));
          logAdminAction({
            adminUid: userData?.uid || "unknown",
            adminEmail: userData?.email || "Unknown",
            action: "DELETE_TIER",
            target: "tiers",
            details: `Tier ID: ${tierId}`
          });
          closeConfirm();
          loadTiers();
        } catch (error: any) {
          alert("Lỗi khi xóa: " + error.message);
        }
      }
    );
  };

  const formatMoney = (val: number) => {
    if (val === 0) return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Quản lý Gói Thành Viên (Tiers)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Chỉnh sửa bảng giá, tên gọi, và các tính năng hiển thị trên trang chủ.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} /> Thêm Gói Mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative flex flex-col justify-between">
              {tier.badgeText && (
                <div className="absolute -top-3 left-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full shadow-lg">
                  {tier.badgeText}
                </div>
              )}
              
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs text-zinc-500 font-mono mb-1">ID: {tier.id}</div>
                    <h3 className="text-xl font-bold text-zinc-100">{tier.name}</h3>
                  </div>
                </div>
                
                <p className="text-sm text-zinc-400 h-10 mb-4 line-clamp-2">{tier.description}</p>
                
                <div className="bg-black/30 rounded-xl p-4 mb-6 border border-zinc-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-zinc-500">Giá Tháng:</span>
                    <span className="font-bold text-emerald-400">{formatMoney(tier.priceMonthly)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Giá Năm:</span>
                    <span className="font-bold text-teal-400">{formatMoney(tier.priceYearly)}</span>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Tính năng hiển thị:</h4>
                  <ul className="space-y-2 text-sm">
                    {tier.features?.slice(0, 4).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-zinc-300">
                        <span className="mt-0.5">{f.type === 'check' ? '✅' : '❌'}</span>
                        <span className="line-clamp-1">{f.text}</span>
                      </li>
                    ))}
                    {tier.features?.length > 4 && (
                      <li className="text-xs text-zinc-500 italic">+ {tier.features.length - 4} tính năng khác...</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => openModal(tier)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Edit2 size={16} /> Sửa Gói
                </button>
                <button
                  onClick={() => handleDelete(tier.id)}
                  className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-3 py-2 rounded-lg transition"
                  title="Xóa Gói"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edit Tier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0B0510] border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {editingTier ? <Edit2 className="text-emerald-500" size={20} /> : <Plus className="text-emerald-500" size={20} />}
                {editingTier ? "Chỉnh sửa Gói Thành Viên" : "Thêm Gói Thành Viên Mới"}
              </h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white transition bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form id="tierForm" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">Thông tin cơ bản</h3>
                    
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">ID (vd: tier-plus) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={id}
                        onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        disabled={!!editingTier}
                        className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50"
                        required
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">ID quyết định logic gán Tier cho user. Đừng đổi nếu không hiểu rõ Backend.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Tên Gói (vd: Plus (Chuyên Gia)) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Mô tả ngắn</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition min-h-[80px]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Huy hiệu (Badge) hiển thị trên đầu card</label>
                      <input
                        type="text"
                        value={badgeText}
                        onChange={(e) => setBadgeText(e.target.value)}
                        placeholder="VD: Phổ Biến, Khuyên Dùng..."
                        className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Pricing Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">Thiết lập Giá</h3>
                    
                    <div className="bg-black/30 p-4 rounded-xl border border-zinc-800">
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Giá theo Tháng (VND) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          value={priceMonthly}
                          onChange={(e) => setPriceMonthly(Number(e.target.value))}
                          className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Giá theo Năm (VND) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          value={priceYearly}
                          onChange={(e) => setPriceYearly(Number(e.target.value))}
                          className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold text-teal-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features Matrix */}
                <div className="mt-8 pt-6 border-t border-zinc-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Danh sách Tính năng hiển thị</h3>
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Plus size={14} /> Thêm dòng
                    </button>
                  </div>
                  
                  <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4 space-y-3">
                    {features.length === 0 && (
                      <div className="text-center py-6 text-zinc-500 text-sm">Chưa có tính năng nào. Bấm "Thêm dòng" để bắt đầu.</div>
                    )}
                    
                    {features.map((feat, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => handleFeatureChange(idx, "type", feat.type === "check" ? "cross" : "check")}
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition border ${
                            feat.type === "check" 
                              ? "bg-emerald-900/20 border-emerald-500/50 text-emerald-400" 
                              : "bg-red-900/20 border-red-500/50 text-red-400"
                          }`}
                          title="Bấm để đổi loại Check/Cross"
                        >
                          {feat.type === "check" ? "✅" : "❌"}
                        </button>
                        
                        <input
                          type="text"
                          value={feat.text}
                          onChange={(e) => handleFeatureChange(idx, "text", e.target.value)}
                          placeholder="VD: Không giới hạn số tool..."
                          className={`flex-1 bg-zinc-900/80 border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition ${
                            feat.type === "check" ? "text-zinc-200 border-zinc-700 focus:border-emerald-500" : "text-zinc-500 border-zinc-800 focus:border-red-500 line-through decoration-red-900/50"
                          }`}
                        />
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(idx)}
                          className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-900/10 text-red-500 hover:bg-red-900/30 hover:text-red-400 flex items-center justify-center transition border border-red-900/20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </form>
            </div>
            
            <div className="p-5 border-t border-zinc-800 bg-zinc-900/80 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="tierForm"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : (
                  <>
                    <Save size={18} /> Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0B0510] border border-red-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4 border border-red-500/20">
              <ShieldAlert className="text-red-500 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-zinc-400 text-sm mb-8">{confirmModal.message}</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={closeConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
              >
                Hủy
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition shadow-lg shadow-red-600/20"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

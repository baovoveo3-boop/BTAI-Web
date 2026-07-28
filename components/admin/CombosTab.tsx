"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { Plus, Edit2, Trash2, X, Save, ShieldAlert } from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";
import { useAuth } from "@/context/AuthContext";

interface Combo {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceLifetime: number;
  badgeText: string;
  itemIds: string[];
  features: { text: string }[];
}

interface Item {
  id: string;
  name: string;
  type: string; // 'tool' | 'course'
}

export default function CombosTab() {
  const { userData } = useAuth();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [tools, setTools] = useState<Item[]>([]);
  const [courses, setCourses] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);

  // Form State
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceLifetime, setPriceLifetime] = useState(0);
  const [badgeText, setBadgeText] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [features, setFeatures] = useState<{ text: string }[]>([]);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const loadData = async () => {
    setLoading(true);
    try {
      const [combosSnap, productsSnap, coursesSnap] = await Promise.all([
        getDocs(collection(db, "combos")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "courses"))
      ]);

      setCombos(combosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Combo)));
      
      const loadedTools = productsSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id, type: 'tool' }));
      setTools(loadedTools);

      const loadedCourses = coursesSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id, type: 'course' }));
      setCourses(loadedCourses);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (combo?: Combo) => {
    if (combo) {
      setEditingCombo(combo);
      setId(combo.id);
      setName(combo.name || "");
      setDescription(combo.description || "");
      setPriceMonthly(combo.priceMonthly || 0);
      setPriceLifetime(combo.priceLifetime || 0);
      setBadgeText(combo.badgeText || "");
      setSelectedItemIds(combo.itemIds || []);
      setFeatures(combo.features ? [...combo.features] : []);
    } else {
      setEditingCombo(null);
      setId("combo-new");
      setName("");
      setDescription("");
      setPriceMonthly(0);
      setPriceLifetime(0);
      setBadgeText("");
      setSelectedItemIds([]);
      setFeatures([]);
    }
    setIsModalOpen(true);
  };

  const toggleItem = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      setSelectedItemIds(selectedItemIds.filter(id => id !== itemId));
    } else {
      setSelectedItemIds([...selectedItemIds, itemId]);
    }
  };

  const handleAddFeature = () => setFeatures([...features, { text: "" }]);
  const handleRemoveFeature = (idx: number) => setFeatures(features.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return alert("Vui lòng nhập ID và Tên Combo");
    
    setSubmitting(true);
    try {
      const dataToSave = {
        name,
        description,
        priceMonthly: Number(priceMonthly),
        priceLifetime: Number(priceLifetime),
        badgeText,
        itemIds: selectedItemIds,
        features: features.filter(f => f.text.trim() !== "")
      };

      await setDoc(doc(db, "combos", id), dataToSave, { merge: true });
      logAdminAction({
        adminUid: userData?.uid || "unknown",
        adminEmail: userData?.email || "Unknown",
        action: editingCombo ? "UPDATE_COMBO" : "CREATE_COMBO",
        target: "combos",
        details: `Combo ID: ${id}`
      });
      
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (comboId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Xóa Combo",
      message: `Bạn có chắc muốn xóa Combo ${comboId}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "combos", comboId));
          setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} });
          loadData();
        } catch (err: any) {
          alert("Lỗi khi xóa: " + err.message);
        }
      }
    });
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-teal-400">Quản lý Combos (Omni-cart)</h2>
          <p className="text-sm text-zinc-400">Gộp nhiều Sản phẩm lẻ và Khóa học vào một Combo để bán chéo.</p>
        </div>
        <button onClick={() => openModal()} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Plus size={16} /> Tạo Combo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-teal-500 rounded-full animate-spin border-t-transparent" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combos.map(combo => (
            <div key={combo.id} className="bg-zinc-900/50 border border-teal-500/30 rounded-2xl p-6 relative flex flex-col justify-between">
              {combo.badgeText && (
                <div className="absolute -top-3 right-6 bg-teal-500 text-[10px] font-bold uppercase px-3 py-1 rounded text-white">{combo.badgeText}</div>
              )}
              <div>
                <h3 className="text-lg font-bold text-teal-400">{combo.name}</h3>
                <p className="text-xs text-zinc-500 font-mono mb-4">ID: {combo.id}</p>
                <div className="bg-black/30 rounded-xl p-3 mb-4 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Giá Tháng:</span><span className="text-emerald-400 font-bold">{formatMoney(combo.priceMonthly)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-zinc-500">Mua Đứt:</span><span className="text-teal-400 font-bold">{formatMoney(combo.priceLifetime)}</span></div>
                </div>
                <div className="mb-4">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">Bao gồm {combo.itemIds?.length || 0} mục:</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {combo.itemIds?.map(itemId => {
                      const tool = tools.find(t => t.id === itemId);
                      const course = courses.find(c => c.id === itemId);
                      if (tool) return <span key={itemId} className="bg-blue-900/40 text-blue-300 text-[10px] px-2 py-1 rounded border border-blue-800">📦 {tool.name}</span>;
                      if (course) return <span key={itemId} className="bg-orange-900/40 text-orange-300 text-[10px] px-2 py-1 rounded border border-orange-800">🎓 {course.name}</span>;
                      return <span key={itemId} className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-1 rounded border border-zinc-700">{itemId}</span>;
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                <button onClick={() => openModal(combo)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm flex justify-center items-center gap-2"><Edit2 size={14} /> Sửa</button>
                <button onClick={() => handleDelete(combo.id)} className="bg-red-900/20 text-red-500 hover:bg-red-900/40 px-3 rounded-lg flex items-center justify-center"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex justify-between">
              <h2 className="font-bold text-lg text-teal-400">{editingCombo ? "Sửa Combo" : "Tạo Combo Mới"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="comboForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-400">ID Combo (vd: combo-powerpack)</label>
                      <input type="text" value={id} onChange={e => setId(e.target.value)} disabled={!!editingCombo} className="w-full mt-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400">Tên Combo</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400">Giá Thuê Tháng (VND)</label>
                      <input type="number" value={priceMonthly} onChange={e => setPriceMonthly(Number(e.target.value))} className="w-full mt-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400">Giá Mua Đứt Vĩnh Viễn (VND)</label>
                      <input type="number" value={priceLifetime} onChange={e => setPriceLifetime(Number(e.target.value))} className="w-full mt-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400">Huy hiệu (Badge)</label>
                      <input type="text" value={badgeText} onChange={e => setBadgeText(e.target.value)} className="w-full mt-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500" />
                    </div>
                  </div>

                  <div className="space-y-6 border-l border-zinc-800 pl-6">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3">Thành phần trong Combo</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-bold text-blue-400 uppercase mb-2">📦 Tools (Sản Phẩm Lẻ)</p>
                          <div className="bg-black border border-zinc-800 rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                            {tools.map(tool => (
                              <label key={tool.id} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900 p-1 rounded">
                                <input type="checkbox" checked={selectedItemIds.includes(tool.id)} onChange={() => toggleItem(tool.id)} className="rounded bg-zinc-800 border-zinc-700 text-blue-500" />
                                <span className="text-sm text-zinc-300">{tool.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-orange-400 uppercase mb-2">🎓 Khóa Học (Courses)</p>
                          <div className="bg-black border border-zinc-800 rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                            {courses.length === 0 && <p className="text-xs text-zinc-500">Chưa có khóa học nào</p>}
                            {courses.map(course => (
                              <label key={course.id} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900 p-1 rounded">
                                <input type="checkbox" checked={selectedItemIds.includes(course.id)} onChange={() => toggleItem(course.id)} className="rounded bg-zinc-800 border-zinc-700 text-orange-500" />
                                <span className="text-sm text-zinc-300">{course.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-semibold text-zinc-400">Tính năng hiển thị</label>
                        <button type="button" onClick={handleAddFeature} className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-white">Thêm dòng</button>
                      </div>
                      <div className="space-y-2">
                        {features.map((f, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input type="text" value={f.text} onChange={e => {
                              const newF = [...features]; newF[idx].text = e.target.value; setFeatures(newF);
                            }} className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white" />
                            <button type="button" onClick={() => handleRemoveFeature(idx)} className="bg-red-900/20 text-red-500 p-2 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-zinc-800 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm">Hủy</button>
              <button type="submit" form="comboForm" disabled={submitting} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                <Save size={16} /> Lưu Combo
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl w-full max-w-sm text-center">
            <ShieldAlert className="text-red-500 w-10 h-10 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-zinc-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 bg-zinc-800 py-2 rounded-xl text-white">Hủy</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 bg-red-600 py-2 rounded-xl text-white font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
